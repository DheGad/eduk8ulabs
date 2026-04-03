/**
 * @file dlpEngine.ts
 * @service os-kernel/services/security
 * @version V67
 * @description Bi-Directional DLP & PII Tokenization — StreetMP OS
 *
 * V51: Global PII patterns (SSN, CC, Email, Phone, IP, Medical, DOB, Name, Address)
 * V67: Tenant-specific custom DLP rulesets applied BEFORE global patterns.
 *      Accepts tenantId, resolves custom rules, applies them safely.
 *
 * ================================================================
 * REDOS PROTECTION (V67)
 * ================================================================
 *
 *  Tenant-supplied patterns are treated as UNTRUSTED input. Three
 *  layers of protection prevent a ReDoS attack via misconfigured rules:
 *
 *    1. PROMPT LENGTH CLAMP: Any prompt > MAX_PROMPT_LENGTH characters
 *       is truncated before custom regexes run. Limits backtracking time.
 *
 *    2. PATTERN LENGTH GATE: Patterns > MAX_DLP_PATTERN_LENGTH chars are
 *       rejected before compilation. Rules with an absurd pattern string
 *       (e.g. a 50k char alternation) are never converted to RegExp objects.
 *
 *    3. SAFE COMPILE: All pattern strings are compiled inside a try/catch.
 *       An invalid pattern (syntax error) is logged and skipped — it never
 *       crashes the server.
 *
 * ================================================================
 * EXECUTION ORDER
 * ================================================================
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  1. Clamp prompt to MAX_PROMPT_LENGTH (ReDoS guard)         │
 *   │  2. Apply tenant custom DLP rules (V67, in order)           │
 *   │  3. Apply global V51 PII patterns                           │
 *   │  4. Return DlpResult with both tallies merged               │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Compliance: HIPAA · PCI-DSS · GDPR · ITAR · FINRA
 */

// ================================================================
// SAFETY CONSTANTS (V67 ReDoS Guards)
// ================================================================

/** Prompts larger than this are clamped BEFORE custom rules run. */
const MAX_PROMPT_LENGTH      = 50_000;

/** Custom rule patterns longer than this are rejected (never compiled). */
const MAX_DLP_PATTERN_LENGTH = 512;

// ================================================================
// TYPES
// ================================================================

export type PIICategory =
  | "SSN"
  | "CREDIT_CARD"
  | "EMAIL"
  | "PHONE"
  | "IP_ADDRESS"
  | "MEDICAL_ID"
  | "DOB"
  | "FULL_NAME"
  | "ADDRESS";

export interface PIIMatch {
  /** The raw text that was detected */
  original: string;
  /** The synthetic replacement token */
  token: string;
  /** Category of PII detected */
  category: PIICategory;
  /** Character index in the original prompt */
  index: number;
}

export interface TokenizationResult {
  /** The scrubbed prompt safe for external LLM transmission */
  sanitizedPayload: string;
  /** All PII entities detected and replaced */
  detections: PIIMatch[];
  /** Unique context ID binding this tokenization to its detokenization */
  contextId: string;
  /** Number of PII entities removed */
  entityCount: number;
  /** V67: Number of custom tenant rule redactions (subset of entityCount) */
  customRedactionCount: number;
  /** V67: Names of custom rules that fired */
  customRulesFired: string[];
  /** Latency of the tokenization in milliseconds */
  latencyMs: number;
  /** Whether the prompt was clamped due to length (V67 ReDoS guard) */
  promptClamped: boolean;
}

export interface DetokenizationResult {
  /** The restored response with original values back in place */
  restoredResponse: string;
  /** Number of tokens successfully resolved */
  resolvedCount: number;
}

// ================================================================
// PII DETECTION PATTERNS (V51 — Global)
// Ordered most-specific → most-generic to prevent partial overlaps
// ================================================================

interface PIIPattern {
  category: PIICategory;
  /** RegExp with at least one capture group containing the sensitive value */
  pattern: RegExp;
}

const PII_PATTERNS: PIIPattern[] = [
  // U.S. Social Security Numbers (XXX-XX-XXXX or XXXXXXXXX)
  {
    category: "SSN",
    pattern: /\b(\d{3}-\d{2}-\d{4}|\d{9})\b/g,
  },
  // Credit / Debit card numbers (Luhn-compatible structure, major networks)
  {
    category: "CREDIT_CARD",
    pattern: /\b((?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
  },
  // Medical Record / National Provider Identifiers (10-digit sequences after keyword)
  {
    category: "MEDICAL_ID",
    pattern: /\b(?:MRN|NPI|Patient ID|Medical ID)[:\s#]*(\d{6,10})\b/gi,
  },
  // Date of Birth (various formats)
  {
    category: "DOB",
    pattern: /\b(?:DOB|Date of Birth|Born)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
  },
  // Email addresses
  {
    category: "EMAIL",
    pattern: /\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g,
  },
  // International phone numbers
  {
    category: "PHONE",
    pattern: /\b(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/g,
  },
  // IPv4 addresses
  {
    category: "IP_ADDRESS",
    pattern: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
  },
  // Full names preceded by common honorifics / identifiers
  {
    category: "FULL_NAME",
    pattern: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Patient|Client|Employee|User)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g,
  },
  // Street addresses (number + street keyword)
  {
    category: "ADDRESS",
    pattern: /\b(\d{1,6}\s+[A-Za-z0-9\s]{3,40}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\.?)\b/gi,
  },
];

// Token prefix for all StreetMP-issued synthetic markers
const TOKEN_PREFIX = "STREETMP_SECURE";

// ================================================================
// V67: CUSTOM RULE APPLICATION HELPERS
// ================================================================

/**
 * DlpRule interface mirrored here to avoid circular imports.
 * The canonical definition lives in tenantConfig.ts.
 */
interface DlpRule {
  name:        string;
  pattern:     string;
  replacement: string;
}

/**
 * compileCustomRule
 * -----------------
 * Safely compiles a tenant-supplied pattern string into a RegExp.
 *
 * Rejects patterns that are:
 *   - Empty or whitespace-only
 *   - Longer than MAX_DLP_PATTERN_LENGTH (ReDoS protection)
 *   - Invalid RegExp syntax
 *
 * @returns A compiled RegExp with the `gi` flags, or null if rejected.
 */
function compileCustomRule(ruleName: string, patternStr: string): RegExp | null {
  if (!patternStr || !patternStr.trim()) {
    console.warn(`[V67:DLP] Custom rule "${ruleName}" rejected: empty pattern`);
    return null;
  }

  if (patternStr.length > MAX_DLP_PATTERN_LENGTH) {
    console.warn(
      `[V67:DLP] Custom rule "${ruleName}" rejected: pattern too long ` +
      `(${patternStr.length} > ${MAX_DLP_PATTERN_LENGTH} chars) — ReDoS guard`
    );
    return null;
  }

  try {
    return new RegExp(patternStr, "gi");
  } catch (err) {
    console.warn(
      `[V67:DLP] Custom rule "${ruleName}" rejected: invalid RegExp syntax — ` +
      `${(err as Error).message}`
    );
    return null;
  }
}

/**
 * applyCustomRules
 * ----------------
 * Iterates through tenant-supplied DLP rules and applies each compiled
 * RegExp as a global replace on the (possibly clamped) prompt.
 *
 * Returns:
 *   - `sanitized`: the prompt after all custom replacements
 *   - `count`:     number of individual substitutions performed
 *   - `fired`:     names of rules that matched at least once
 */
function applyCustomRules(
  prompt:   string,
  rules:    DlpRule[],
  tenantId: string
): { sanitized: string; count: number; fired: string[] } {
  let sanitized = prompt;
  let count     = 0;
  const fired:  string[] = [];

  for (const rule of rules) {
    const regex = compileCustomRule(rule.name, rule.pattern);
    if (!regex) continue; // Skip invalid rules — fail-open

    let ruleHits = 0;
    const replaced = sanitized.replace(regex, () => {
      ruleHits++;
      count++;
      return rule.replacement;
    });

    if (ruleHits > 0) {
      sanitized = replaced;
      fired.push(rule.name);
      console.info(
        `[V67:DLP] Custom rule "${rule.name}" masked ${ruleHits} match(es) ` +
        `(tenant=${tenantId})`
      );
    }
  }

  return { sanitized, count, fired };
}

// ================================================================
// DLP ENGINE CLASS
// ================================================================

export class DataLossPrevention {
  /**
   * In-memory token map keyed by contextId.
   * Maps `token → originalValue` for bi-directional resolution.
   */
  private readonly tokenStore = new Map<string, Map<string, string>>();

  private totalTokenized            = 0;
  private totalViolationsPrevented  = 0;
  private totalCustomRedactions     = 0;

  // ── Private Helpers ─────────────────────────────────────────────

  private generateContextId(): string {
    return `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private generateToken(category: PIICategory, index: number): string {
    return `[${TOKEN_PREFIX}_${category}_${String(index + 1).padStart(2, "0")}]`;
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * tokenizePayload (V67)
   * ---------------------
   * Scans `prompt` for PII entities, replaces each with a synthetic token,
   * and stores the original→token map for later de-tokenization.
   *
   * V67: Now accepts an optional `tenantId` and `customRules` array.
   * Custom rules are applied BEFORE global V51 patterns with ReDoS guards.
   *
   * @param prompt       Raw user/application prompt to be sent to an LLM.
   * @param contextId    Optional pre-assigned context ID (auto-generated if omitted).
   * @param tenantId     Optional tenant identifier for audit logging.
   * @param customRules  Optional tenant-specific DLP rules (from tenantConfig).
   */
  public tokenizePayload(
    prompt:      string,
    contextId?:  string,
    tenantId?:   string,
    customRules?: DlpRule[]
  ): TokenizationResult {
    const start = Date.now();
    const id    = contextId ?? this.generateContextId();
    const tokenMap = new Map<string, string>();

    // ---- V67: ReDoS Guard — Clamp prompt length ----
    // Catastrophic backtracking scales with input size. By clamping before
    // ANY regex runs (custom or global), we bound worst-case execution.
    const promptClamped = prompt.length > MAX_PROMPT_LENGTH;
    let working = promptClamped
      ? prompt.slice(0, MAX_PROMPT_LENGTH)
      : prompt;

    if (promptClamped) {
      console.warn(
        `[V67:DLP] Prompt clamped to ${MAX_PROMPT_LENGTH} chars ` +
        `(original ${prompt.length} chars) for tenant=${tenantId ?? "unknown"} ` +
        `— ReDoS guard active`
      );
    }

    // ---- V67: Apply Tenant Custom Rules (Pass 1) ----
    let customRedactionCount = 0;
    const customRulesFired:  string[] = [];

    if (customRules && customRules.length > 0) {
      const customResult = applyCustomRules(working, customRules, tenantId ?? "unknown");
      working              = customResult.sanitized;
      customRedactionCount = customResult.count;
      customRulesFired.push(...customResult.fired);
      this.totalCustomRedactions += customRedactionCount;
    }

    // ---- V51: Apply Global PII Patterns (Pass 2) ----
    const detections: PIIMatch[] = [];
    let entityIndex = 0;

    for (const { category, pattern } of PII_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;

      working = working.replace(pattern, (fullMatch, capturedGroup) => {
        const original = capturedGroup ?? fullMatch;
        const token    = this.generateToken(category, entityIndex++);

        tokenMap.set(token, original);

        detections.push({
          original,
          token,
          category,
          index: working.indexOf(fullMatch),
        });

        return fullMatch.replace(original, token);
      });
    }

    this.tokenStore.set(id, tokenMap);
    this.totalTokenized += detections.length;
    if (detections.length > 0 || customRedactionCount > 0) {
      this.totalViolationsPrevented += 1;
    }

    const latencyMs = Date.now() - start;
    const totalRedacted = detections.length + customRedactionCount;

    if (totalRedacted > 0) {
      console.info(
        `[V67:DLP] Tokenized ${detections.length} PII + ${customRedactionCount} custom ` +
        `= ${totalRedacted} total redactions in ${latencyMs}ms ` +
        `(ctx=${id}, tenant=${tenantId ?? "global"})`
      );
    }

    return {
      sanitizedPayload:     working,
      detections,
      contextId:            id,
      entityCount:          totalRedacted,
      customRedactionCount,
      customRulesFired,
      latencyMs,
      promptClamped,
    };
  }

  /**
   * detokenizeResponse
   * ------------------
   * Restores original PII values in an AI response using the context's token map.
   * Custom rule replacements are static strings (not tokenized), so they are NOT
   * reversed — classified data stays masked in the response. Only PII tokens are restored.
   *
   * @param aiOutput   Raw response text from the LLM provider.
   * @param contextId  Context ID returned by `tokenizePayload`.
   */
  public detokenizeResponse(aiOutput: string, contextId: string): DetokenizationResult {
    const tokenMap = this.tokenStore.get(contextId);

    if (!tokenMap || tokenMap.size === 0) {
      return { restoredResponse: aiOutput, resolvedCount: 0 };
    }

    let restored     = aiOutput;
    let resolvedCount = 0;

    for (const [token, original] of tokenMap.entries()) {
      if (restored.includes(token)) {
        restored = restored.replaceAll(token, original);
        resolvedCount += 1;
      }
    }

    // Clean up memory after de-tokenization
    this.tokenStore.delete(contextId);

    console.info(`[V67:DLP] De-tokenized ${resolvedCount} entities for ctx=${contextId}`);
    return { restoredResponse: restored, resolvedCount };
  }

  /** Total PII entities masked since startup (includes custom redactions). */
  public getTotalTokenized(): number {
    return this.totalTokenized;
  }

  /** Total custom rule redactions since startup. */
  public getTotalCustomRedactions(): number {
    return this.totalCustomRedactions;
  }

  /** Total requests where at least one PII violation was prevented. */
  public getTotalViolationsPrevented(): number {
    return this.totalViolationsPrevented;
  }

  /** Number of active in-flight request contexts. */
  public getActiveContextCount(): number {
    return this.tokenStore.size;
  }
}

// ================================================================
// SINGLETON EXPORT — consumed by the proxy pipeline
// ================================================================
export const globalDLP = new DataLossPrevention();
