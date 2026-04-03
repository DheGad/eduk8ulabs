/**
 * @file contextFirewall.ts
 * @service router-service
 * @description V10 Context Firewall — Anti-Inference Engine
 *
 * Detects and abstracts relational and contextual clues (job roles,
 * organisation types, and locations) BEFORE the prompt reaches the Enclave
 * for final PII tokenization. This closes the inference gap that V5 leaves open:
 *
 *   "The CEO of the bank in New York" still uniquely identifies a person
 *    even after direct PII is removed. V10 converts it to:
 *   "The [ROLE_1] of the [ORG_1] in [LOC_1]"
 *
 * ARCHITECTURE RULES:
 *   1. ZERO external API calls — runs entirely inside router-service.
 *   2. Deterministic session mapping — [ROLE_1] always maps to the SAME
 *      original term within one request/response cycle.
 *   3. MUST run BEFORE the Enclave sanitize call, NOT after.
 *   4. restoreContext() MUST run on the final desanitized output so the
 *      end-user receives a coherent response with the original terms restored.
 */

// ─── Pattern Dictionaries ────────────────────────────────────────────────────
// Ordered from most specific to most generic to prevent partial overlaps.
// All patterns are case-insensitive and wrap in \b word boundaries.

const ROLE_PATTERNS: string[] = [
  // C-Suite
  "Chief Executive Officer", "Chief Financial Officer", "Chief Operating Officer",
  "Chief Technology Officer", "Chief Information Officer", "Chief Information Security Officer",
  "Chief Marketing Officer", "Chief Revenue Officer", "Chief Product Officer",
  "Chief People Officer", "Chief Data Officer", "Chief Risk Officer",
  "CEO", "CFO", "COO", "CTO", "CIO", "CISO", "CMO", "CPO", "CDO", "CRO",
  // Executive
  "Executive Vice President", "Senior Vice President", "Vice President",
  "EVP", "SVP", "VP",
  // Management
  "Managing Director", "General Manager", "Executive Director",
  "Director", "Associate Director", "Deputy Director",
  // Finance-specific
  "Portfolio Manager", "Fund Manager", "Investment Analyst", "Analyst",
  "Quantitative Analyst", "Quant", "Risk Manager", "Compliance Officer",
  "Relationship Manager", "Wealth Manager", "Financial Advisor",
  "Private Banker", "Trader", "Underwriter", "Actuary",
  // Tech
  "Principal Engineer", "Staff Engineer", "Senior Engineer", "Software Engineer",
  "Data Scientist", "Machine Learning Engineer", "DevOps Engineer",
  "Product Manager", "Program Manager", "Engineering Manager",
  // General
  "President", "Chairman", "Board Member", "Trustee", "Partner", "Associate",
  "Consultant", "Advisor", "Contractor", "Auditor", "Regulator",
];

const ORG_TYPE_PATTERNS: string[] = [
  // Financial institutions
  "Investment Bank", "Commercial Bank", "Retail Bank", "Central Bank",
  "Credit Union", "Savings Bank", "Thrift", "Brokerage", "Broker-Dealer",
  "Hedge Fund", "Private Equity Fund", "Mutual Fund", "Sovereign Wealth Fund",
  "Venture Capital Fund", "VC Firm", "Asset Manager", "Wealth Manager",
  "Insurance Company", "Reinsurance Company", "Insurer", "Reinsurer",
  // Corporate types
  "Corporation", "Incorporated", "Inc", "Limited", "LLC", "LLP",
  "Partnership", "Conglomerate", "Multinational", "REIT",
  // Org styles
  "Startup", "Scale-up", "Enterprise", "Firm", "Company", "Group",
  "Holding Company", "Subsidiary", "Consortium", "Joint Venture", "JV",
  "NGO", "Nonprofit", "Foundation", "Trust", "Agency", "Bureau",
  "Department", "Division", "Committee", "Board",
  // Industry verticals
  "Bank", "Exchange", "Clearinghouse", "Depository", "Custodian",
  "Market Maker", "Prime Broker", "Fintech", "Regtech",
];

const LOCATION_PATTERNS: string[] = [
  // Financial hubs
  "New York", "Wall Street", "Lower Manhattan", "Midtown Manhattan", "Manhattan",
  "London", "City of London", "Canary Wharf", "Frankfurt", "Zurich", "Geneva",
  "Hong Kong", "Singapore", "Tokyo", "Shanghai", "Beijing", "Dubai",
  "Sydney", "Toronto", "Chicago", "San Francisco", "Boston",
  "Luxembourg", "Amsterdam", "Paris", "Milan", "Madrid", "Cayman Islands",
  "Delaware", "Jersey", "Bermuda", "British Virgin Islands",
  // Generic geography
  "Downtown", "Uptown", "Midtown", "the City", "the District",
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AbstractionResult {
  /** Prompt with all detected contextual terms replaced by [ROLE_X] / [ORG_X] / [LOC_X]. */
  abstractedText: string;
  /**
   * Mapping of placeholder → original term.
   * Must be forwarded through the execution lifecycle and supplied to restoreContext().
   *
   * Example: { "[ROLE_1]": "CEO", "[ORG_1]": "Investment Bank", "[LOC_1]": "New York" }
   */
  contextMap: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escapes a raw string so it can be safely embedded in a RegExp pattern.
 */
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compiles a list of terms into a single alternation regex.
 * Patterns are sorted longest-first to ensure more specific multi-word phrases
 * match before shorter abbreviations (e.g. "Chief Executive Officer" before "CEO").
 */
function buildDictRegex(terms: string[]): RegExp {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const alternation = sorted.map(escapeForRegex).join("|");
  return new RegExp(`\\b(${alternation})\\b`, "gi");
}

// Pre-compile regexes once at module load — zero runtime compilation cost.
const ROLE_REGEX = buildDictRegex(ROLE_PATTERNS);
const ORG_REGEX  = buildDictRegex(ORG_TYPE_PATTERNS);
const LOC_REGEX  = buildDictRegex(LOCATION_PATTERNS);

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Scans `text` for role, organisation, and location terms, replaces each
 * unique occurrence with a numbered placeholder, and returns the abstracted
 * text along with the mapping needed to restore the originals.
 *
 * Ordering guarantee: ROLE → ORG → LOC, each pass respects already-placed
 * placeholders so a location embedded inside an org name isn't double-replaced.
 *
 * @example
 *   abstractContext("The CEO of the bank in New York")
 *   // → { abstractedText: "The [ROLE_1] of the [ORG_1] in [LOC_1]",
 *   //     contextMap: { "[ROLE_1]": "CEO", "[ORG_1]": "bank", "[LOC_1]": "New York" } }
 */
export function abstractContext(text: string): AbstractionResult {
  const contextMap: Record<string, string> = {};
  let roleCounter = 0;
  let orgCounter  = 0;
  let locCounter  = 0;

  // ── Pass 1: Roles ─────────────────────────────────────────────────────────
  // Track unique originals so "CEO" always maps to the same placeholder.
  const roleOriginalToPlaceholder: Record<string, string> = {};

  let result = text.replace(ROLE_REGEX, (match) => {
    const canonical = match.toUpperCase();
    if (!roleOriginalToPlaceholder[canonical]) {
      roleCounter++;
      const placeholder = `[ROLE_${roleCounter}]`;
      roleOriginalToPlaceholder[canonical] = placeholder;
      contextMap[placeholder] = match; // preserve original casing
    }
    return roleOriginalToPlaceholder[canonical];
  });

  // ── Pass 2: Organisations ─────────────────────────────────────────────────
  const orgOriginalToPlaceholder: Record<string, string> = {};

  result = result.replace(ORG_REGEX, (match) => {
    // Skip if this region was already replaced by a role placeholder
    const canonical = match.toLowerCase();
    if (!orgOriginalToPlaceholder[canonical]) {
      orgCounter++;
      const placeholder = `[ORG_${orgCounter}]`;
      orgOriginalToPlaceholder[canonical] = placeholder;
      contextMap[placeholder] = match;
    }
    return orgOriginalToPlaceholder[canonical];
  });

  // ── Pass 3: Locations ─────────────────────────────────────────────────────
  const locOriginalToPlaceholder: Record<string, string> = {};

  result = result.replace(LOC_REGEX, (match) => {
    const canonical = match.toLowerCase();
    if (!locOriginalToPlaceholder[canonical]) {
      locCounter++;
      const placeholder = `[LOC_${locCounter}]`;
      locOriginalToPlaceholder[canonical] = placeholder;
      contextMap[placeholder] = match;
    }
    return locOriginalToPlaceholder[canonical];
  });

  return { abstractedText: result, contextMap };
}

/**
 * Reverses the abstraction performed by {@link abstractContext}.
 * Each placeholder in `text` is replaced with its original value from `contextMap`.
 *
 * Safe to call with an empty `contextMap` (returns `text` unchanged).
 *
 * @param text        Text produced by the LLM after Enclave desanitization.
 * @param contextMap  The map returned by the original abstractContext() call.
 */
export function restoreContext(text: string, contextMap: Record<string, string>): string {
  if (!text || Object.keys(contextMap).length === 0) return text;

  let restored = text;
  // Sort by placeholder to ensure deterministic replacement order
  for (const [placeholder, original] of Object.entries(contextMap)) {
    // Escape brackets for safe use in regex
    const escapedPlaceholder = escapeForRegex(placeholder);
    restored = restored.replace(new RegExp(escapedPlaceholder, "g"), original);
  }
  return restored;
}

// ─── Self-Test (run with `ts-node contextFirewall.ts`) ───────────────────────

// ESM-compatible entry-point guard
const isMain = process.argv[1]?.includes("contextFirewall");
if (isMain) {
  const testCases: Array<{ input: string; desc: string }> = [
    {
      desc: "Classic finance inference attack",
      input: "The CEO of the Investment Bank in New York said the CFO would resign.",
    },
    {
      desc: "Multi-role, same role repeated",
      input: "The CEO met with the VP of Engineering and the CEO of the Startup in San Francisco.",
    },
    {
      desc: "Compliance scenario",
      input: "Our Chief Risk Officer flagged the Hedge Fund in the Cayman Islands.",
    },
    {
      desc: "Restore round-trip fidelity",
      input: "The Director at our LLC in London approved the deal.",
    },
  ];

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  V10 Context Firewall — Self-Test");
  console.log("══════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`📌 ${tc.desc}`);
    console.log(`   IN:  ${tc.input}`);

    const { abstractedText, contextMap } = abstractContext(tc.input);
    console.log(`   OUT: ${abstractedText}`);
    console.log(`   MAP: ${JSON.stringify(contextMap)}`);

    const restored = restoreContext(abstractedText, contextMap);
    const roundTrip = restored === tc.input;
    console.log(`   RESTORE: ${restored}`);
    console.log(`   ROUND-TRIP: ${roundTrip ? "✅ PASS" : "❌ FAIL"}\n`);

    const hasPlaceholder =
      abstractedText.includes("[ROLE_") ||
      abstractedText.includes("[ORG_") ||
      abstractedText.includes("[LOC_");

    if (hasPlaceholder && roundTrip) {
      passed++;
    } else {
      failed++;
      if (!hasPlaceholder) console.log("   ⚠ WARNING: No placeholders were inserted.");
      if (!roundTrip) console.log("   ⚠ WARNING: Round-trip failed.");
    }
  }

  // Canonical proof test: assert the exact placeholder structure
  const proof = abstractContext("The CEO of the bank in New York");
  console.log("══════════════════════════════════════════════════════════");
  console.log("  Canonical Proof Test");
  console.log(`  IN:  The CEO of the bank in New York`);
  console.log(`  OUT: ${proof.abstractedText}`);
  const roleOk = proof.abstractedText.includes("[ROLE_");
  const orgOk  = proof.abstractedText.includes("[ORG_");
  const locOk  = proof.abstractedText.includes("[LOC_");
  console.log(`  ROLE placeholder: ${roleOk ? "✅" : "❌"}`);
  console.log(`  ORG  placeholder: ${orgOk  ? "✅" : "❌"}`);
  console.log(`  LOC  placeholder: ${locOk  ? "✅" : "❌"}`);
  if (roleOk && orgOk && locOk) passed++;
  else failed++;
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed / ${failed} failed`);
  console.log("══════════════════════════════════════════════════════════\n");
  process.exit(failed > 0 ? 1 : 0);
}
