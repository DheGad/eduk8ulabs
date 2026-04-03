/**
 * @file pacEngine.ts
 * @service router-service
 * @description V12 Policy-as-Code (PaC) Execution Engine
 *
 * Implements a declarative, zero-trust policy evaluator for StreetMP OS.
 * Enterprise tenants define JSON Policy documents that are evaluated against
 * each incoming request context before any LLM routing occurs.
 *
 * ZERO-TRUST RULE: Default action is always DENY.
 * A request is ONLY allowed if at least one explicit ALLOW rule matches
 * AND no DENY rule with higher priority matches.
 *
 * Evaluation Order:
 *   1. Filter rules whose conditions ALL match the request context.
 *   2. Among matching rules, DENY beats ALLOW at equal priority.
 *   3. Higher `priority` number wins (100 > 10).
 *   4. If no rule matches → DENY with reason "NO_MATCHING_RULE".
 */

// ─── Condition Operators ──────────────────────────────────────────────────────

export type ConditionOperator =
  | "eq"          // exact equality (case-insensitive)
  | "neq"         // not equal
  | "in"          // value in list
  | "not_in"      // value NOT in list
  | "contains"    // string contains substring
  | "starts_with" // string starts with prefix
  | "gte"         // numeric >=
  | "lte";        // numeric <=

// ─── Policy Schema ────────────────────────────────────────────────────────────

/**
 * A single atomic condition. All conditions in a Rule must match (logical AND).
 *
 * `field` is a dot-path into the RequestContext:
 *   "model", "provider", "classification", "user_role", "tenant_id",
 *   "data_residency", "request_size_tokens"
 */
export interface Condition {
  field:    string;
  operator: ConditionOperator;
  value:    string | string[] | number;
}

/** The action taken if all conditions in a Rule match. */
export type PolicyAction = "ALLOW" | "DENY";

/**
 * A single policy rule. Rules are evaluated in descending priority order.
 * Higher `priority` number = evaluated first.
 * DENY rules win over ALLOW rules at equal priority.
 */
export interface Rule {
  id:          string;         // unique rule identifier for audit trails
  description: string;        // human-readable explanation
  priority:    number;        // 0–1000; higher = evaluated first
  conditions:  Condition[];   // ALL must match (logical AND)
  action:      PolicyAction;
}

/**
 * The top-level StreetMP Policy document.
 * Sent by tenants during onboarding and re-evaluated on each request.
 */
export interface StreetMP_Policy {
  version:     string;        // semver: "1.0.0"
  tenant_id:   string;        // must match x-tenant-id header
  name:        string;        // human-readable policy name
  description: string;
  default_action: "DENY";    // MUST always be DENY (zero-trust)
  rules:       Rule[];
  created_at:  string;        // ISO-8601
  updated_at:  string;
}

// ─── Request Context ──────────────────────────────────────────────────────────

/**
 * The runtime context evaluated against the policy rules.
 * Populated by the router before calling evaluatePolicy().
 *
 * V12-02: `model_tier` is injected by the router after resolving the
 * modelId through modelRegistry.resolveModelTier().
 */
export interface RequestContext {
  tenant_id:             string;
  user_id?:              string;
  user_role?:            string;
  model:                 string;
  provider:              string;
  /** V12-02: Security tier resolved from modelRegistry */
  model_tier?:           string;   // "SOVEREIGN_ONLY" | "LOCAL_VPC" | "CLOUD_ENTERPRISE" | "CLOUD_CONSUMER"
  classification?:       string;
  data_residency?:       string;
  request_size_tokens?:  number;
  policy_id?:            string;
  [key: string]: unknown;
}

// ─── Evaluation Result ────────────────────────────────────────────────────────

export interface EvaluationResult {
  action:         PolicyAction;
  reason:         string;          // human-readable explanation
  matched_rule_id: string | null;  // null when default DENY fires
  priority:       number | null;   // of the winning rule
}

// ─── Condition Evaluator ──────────────────────────────────────────────────────

/**
 * Extracts a dot-path field from the RequestContext.
 * e.g. "model" → context.model, "user.role" → context.user?.role
 */
function getField(ctx: RequestContext, field: string): unknown {
  return field.split(".").reduce<unknown>((obj, key) => {
    if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
    return undefined;
  }, ctx);
}

function normaliseStr(v: unknown): string {
  return String(v ?? "").toLowerCase().trim();
}

/**
 * Evaluates a single Condition against the request context.
 * Returns true if the condition is satisfied.
 */
function evaluateCondition(condition: Condition, ctx: RequestContext): boolean {
  const raw = getField(ctx, condition.field);
  const op  = condition.operator;

  switch (op) {
    case "eq":
      return normaliseStr(raw) === normaliseStr(condition.value);

    case "neq":
      return normaliseStr(raw) !== normaliseStr(condition.value);

    case "in": {
      const list = (condition.value as string[]).map(v => normaliseStr(v));
      return list.includes(normaliseStr(raw));
    }

    case "not_in": {
      const list = (condition.value as string[]).map(v => normaliseStr(v));
      return !list.includes(normaliseStr(raw));
    }

    case "contains":
      return normaliseStr(raw).includes(normaliseStr(condition.value));

    case "starts_with":
      return normaliseStr(raw).startsWith(normaliseStr(condition.value));

    case "gte": {
      const numRaw = Number(raw);
      const numVal = Number(condition.value);
      return !isNaN(numRaw) && !isNaN(numVal) && numRaw >= numVal;
    }

    case "lte": {
      const numRaw = Number(raw);
      const numVal = Number(condition.value);
      return !isNaN(numRaw) && !isNaN(numVal) && numRaw <= numVal;
    }

    default:
      return false;
  }
}

// ─── Core Evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluates a policy document against a request context.
 *
 * Algorithm:
 *   1. Sort rules by priority DESC, then DENY before ALLOW at equal priority.
 *   2. For each rule, test all conditions (logical AND).
 *   3. The FIRST fully-matching rule wins.
 *   4. If no rule matches, apply default_action (always DENY in zero-trust).
 *
 * @param ctx    Runtime request context built by the router.
 * @param policy The tenant's StreetMP_Policy document.
 * @returns      EvaluationResult with action, reason, and the winning rule ID.
 */
export function evaluatePolicy(
  ctx: RequestContext,
  policy: StreetMP_Policy,
): EvaluationResult {
  // Safety: reject mismatched tenant
  if (policy.tenant_id !== "ANY" && policy.tenant_id !== ctx.tenant_id) {
    return {
      action:          "DENY",
      reason:          `POLICY_TENANT_MISMATCH: policy is for "${policy.tenant_id}", request is from "${ctx.tenant_id}"`,
      matched_rule_id: null,
      priority:        null,
    };
  }

  // --- Sort: highest priority first; at tie, DENY before ALLOW ---
  const sorted = [...policy.rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // DENY wins ties over ALLOW
    if (a.action === "DENY" && b.action === "ALLOW") return -1;
    if (a.action === "ALLOW" && b.action === "DENY") return 1;
    return 0;
  });

  for (const rule of sorted) {
    const allMatch = rule.conditions.every(c => evaluateCondition(c, ctx));
    if (allMatch) {
      return {
        action:          rule.action,
        reason:          `RULE_MATCH: [${rule.id}] ${rule.description}`,
        matched_rule_id: rule.id,
        priority:        rule.priority,
      };
    }
  }

  // Default: DENY (zero-trust)
  return {
    action:          "DENY",
    reason:          "NO_MATCHING_RULE: zero-trust default applied",
    matched_rule_id: null,
    priority:        null,
  };
}

// ─── Built-in Policy Templates ────────────────────────────────────────────────

const NOW = "2026-03-23T00:00:00Z";

/**
 * FINANCE_STRICT_V1 — V12-02 Tier-Based Policy.
 * Now uses model_tier conditions instead of enumerating individual model names.
 */
export const POLICY_FINANCE_STRICT: StreetMP_Policy = {
  version:        "2.0.0",
  tenant_id:      "ANY",
  name:           "Finance Strict — PCI-DSS / FINRA / SOC2 (Tier-Based)",
  description:    "Tier-aware routing: TOP_SECRET → LOCAL_VPC/SOVEREIGN only; CONFIDENTIAL → no CLOUD_ENTERPRISE openai.",
  default_action: "DENY",
  created_at:     NOW,
  updated_at:     NOW,
  rules: [
    {
      id:          "FIN-T01-DENY-TOP-SECRET-CLOUD",
      description: "TOP_SECRET/SECRET data must never leave sovereign/local VPC — block all CLOUD_* tiers",
      priority:    1000,
      action:      "DENY",
      conditions:  [
        { field: "classification", operator: "in",     value: ["TOP_SECRET", "SECRET"] },
        { field: "model_tier",     operator: "in",     value: ["CLOUD_ENTERPRISE", "CLOUD_CONSUMER"] },
      ],
    },
    {
      id:          "FIN-T02-DENY-CONFIDENTIAL-CLOUD-ENTERPRISE-OPENAI",
      description: "CONFIDENTIAL data: OpenAI CLOUD_ENTERPRISE tier denied; sovereign/local + Anthropic ok",
      priority:    900,
      action:      "DENY",
      conditions:  [
        { field: "classification", operator: "eq",     value: "CONFIDENTIAL" },
        { field: "provider",       operator: "eq",     value: "openai" },
        { field: "model_tier",     operator: "eq",     value: "CLOUD_ENTERPRISE" },
      ],
    },
    {
      id:          "FIN-T03-DENY-CONSUMER-TIER-ALWAYS",
      description: "Finance tenants never use CLOUD_CONSUMER tier (no BAA)",
      priority:    850,
      action:      "DENY",
      conditions:  [
        { field: "model_tier", operator: "eq", value: "CLOUD_CONSUMER" },
      ],
    },
    {
      id:          "FIN-T04-ALLOW-TOP-SECRET-LOCAL",
      description: "TOP_SECRET data ALLOWED on LOCAL_VPC or SOVEREIGN_ONLY tiers",
      priority:    800,
      action:      "ALLOW",
      conditions:  [
        { field: "classification", operator: "in",  value: ["TOP_SECRET", "SECRET"] },
        { field: "model_tier",     operator: "in",  value: ["LOCAL_VPC", "SOVEREIGN_ONLY"] },
      ],
    },
    {
      id:          "FIN-T05-ALLOW-CONFIDENTIAL-SOVEREIGN",
      description: "CONFIDENTIAL data ALLOWED on SOVEREIGN_ONLY or LOCAL_VPC with non-OpenAI provider",
      priority:    700,
      action:      "ALLOW",
      conditions:  [
        { field: "classification", operator: "eq",     value: "CONFIDENTIAL" },
        { field: "model_tier",     operator: "in",     value: ["LOCAL_VPC", "SOVEREIGN_ONLY"] },
      ],
    },
    {
      id:          "FIN-T06-ALLOW-CLOUD-ENTERPRISE-PUBLIC-INTERNAL",
      description: "PUBLIC/INTERNAL data allowed on CLOUD_ENTERPRISE with BAA-covered providers",
      priority:    500,
      action:      "ALLOW",
      conditions:  [
        { field: "classification", operator: "in",  value: ["PUBLIC", "INTERNAL", ""] },
        { field: "model_tier",     operator: "in",  value: ["CLOUD_ENTERPRISE", "LOCAL_VPC", "SOVEREIGN_ONLY"] },
        { field: "provider",       operator: "in",  value: ["openai", "anthropic", "google", "cohere", "meta", "xai", "mistral", "local"] },
      ],
    },
  ],
};

/**
 * EDU_FERPA_V1 as a declarative StreetMP_Policy.
 */
export const POLICY_EDU_FERPA: StreetMP_Policy = {
  version:        "1.0.0",
  tenant_id:      "ANY",
  name:           "Education — FERPA / COPPA",
  description:    "Student records and grades restricted to approved lightweight models.",
  default_action: "DENY",
  created_at:     NOW,
  updated_at:     NOW,
  rules: [
    {
      id:          "EDU-001-DENY-STUDENT-RECORDS-EXTERNAL",
      description: "Student records (CONFIDENTIAL+) cannot be sent to external LLMs",
      priority:    900,
      action:      "DENY",
      conditions:  [
        { field: "classification", operator: "in",  value: ["CONFIDENTIAL", "TOP_SECRET", "SECRET"] },
        { field: "provider",       operator: "neq", value: "local" },
      ],
    },
    {
      id:          "EDU-002-DENY-HEAVY-MODELS",
      description: "Heavy models are cost-prohibited for edu tenants",
      priority:    700,
      action:      "DENY",
      conditions:  [
        { field: "model", operator: "in", value: ["gpt-4o", "claude-3-5-sonnet", "claude-3-opus"] },
      ],
    },
    {
      id:          "EDU-003-ALLOW-LIGHTWEIGHT",
      description: "Allow lightweight approved models for PUBLIC / INTERNAL content",
      priority:    500,
      action:      "ALLOW",
      conditions:  [
        { field: "model",          operator: "in", value: ["gpt-4o-mini", "claude-3-haiku", "streetmp-auto"] },
        { field: "provider",       operator: "in", value: ["openai", "anthropic", "local"] },
        { field: "classification", operator: "in", value: ["PUBLIC", "INTERNAL", ""] },
      ],
    },
  ],
};

/**
 * DEFENSE_ITAR_V1 — V12-02 Tier-Based Policy.
 * Uses model_tier so any new LOCAL_VPC model is automatically permitted
 * without policy file changes.
 */
export const POLICY_DEFENSE_ITAR: StreetMP_Policy = {
  version:        "2.0.0",
  tenant_id:      "ANY",
  name:           "Defense — ITAR / NIST 800-171 (Tier-Based)",
  description:    "Only LOCAL_VPC and SOVEREIGN_ONLY model tiers permitted. Absolute deny for all CLOUD tiers.",
  default_action: "DENY",
  created_at:     NOW,
  updated_at:     NOW,
  rules: [
    {
      id:          "DEF-T01-DENY-ALL-CLOUD-TIERS",
      description: "ITAR: all CLOUD_ENTERPRISE and CLOUD_CONSUMER model tiers are absolutely prohibited",
      priority:    1000,
      action:      "DENY",
      conditions:  [
        { field: "model_tier", operator: "in", value: ["CLOUD_ENTERPRISE", "CLOUD_CONSUMER"] },
      ],
    },
    {
      id:          "DEF-T02-ALLOW-LOCAL-VPC",
      description: "LOCAL_VPC models (Llama, Mixtral, DeepSeek) on sovereign infra are permitted",
      priority:    900,
      action:      "ALLOW",
      conditions:  [
        { field: "model_tier", operator: "in", value: ["LOCAL_VPC", "SOVEREIGN_ONLY"] },
      ],
    },
  ],
};

/** Generic baseline for unknown tenants */
export const POLICY_GENERIC_BASELINE: StreetMP_Policy = {
  version:        "1.0.0",
  tenant_id:      "ANY",
  name:           "Generic Baseline",
  description:    "Conservative baseline for dev / sandbox tenants.",
  default_action: "DENY",
  created_at:     NOW,
  updated_at:     NOW,
  rules: [
    {
      id:          "GEN-001-ALLOW-STANDARD",
      description: "Allow lightweight models for any non-secret data",
      priority:    500,
      action:      "ALLOW",
      conditions:  [
        { field: "model",          operator: "in", value: ["gpt-4o-mini", "claude-3-haiku", "streetmp-auto"] },
        { field: "provider",       operator: "in", value: ["openai", "anthropic", "local"] },
        { field: "classification", operator: "in", value: ["PUBLIC", "INTERNAL", ""] },
      ],
    },
  ],
};

// ─── Self-Test ────────────────────────────────────────────────────────────────

// ESM-compatible entry-point guard
const isMain = process.argv[1]?.includes("pacEngine");
if (isMain) {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  V12-02 Policy-as-Code Engine — Self-Test (Tier-Based)");
  console.log("══════════════════════════════════════════════════\n");

  let passed = 0; let failed = 0;

  type TC = { desc: string; ctx: RequestContext; policy: StreetMP_Policy; expect: "ALLOW" | "DENY" };

  const cases: TC[] = [
    // ── V12-02 CANONICAL PROOF TESTS ────────────────────────────────────────
    {
      desc:   "🔑 PROOF: Finance TOP_SECRET + llama-3.1-405b (LOCAL_VPC) → ALLOW",
      ctx:    { tenant_id: "jpmc", model: "llama-3.1-405b", provider: "meta",
                model_tier: "LOCAL_VPC", classification: "TOP_SECRET" },
      policy: POLICY_FINANCE_STRICT,
      expect: "ALLOW",
    },
    {
      desc:   "🔑 PROOF: Finance TOP_SECRET + gpt-4o (CLOUD_ENTERPRISE) → DENY",
      ctx:    { tenant_id: "jpmc", model: "gpt-4o", provider: "openai",
                model_tier: "CLOUD_ENTERPRISE", classification: "TOP_SECRET" },
      policy: POLICY_FINANCE_STRICT,
      expect: "DENY",
    },
    // ── FINANCE TIER TESTS ──────────────────────────────────────────────────
    {
      desc:   "Finance: CONFIDENTIAL + streetmp-auto (SOVEREIGN_ONLY) → ALLOW",
      ctx:    { tenant_id: "bank-a", model: "streetmp-auto", provider: "local",
                model_tier: "SOVEREIGN_ONLY", classification: "CONFIDENTIAL" },
      policy: POLICY_FINANCE_STRICT,
      expect: "ALLOW",
    },
    {
      desc:   "Finance: CONFIDENTIAL + gpt-4o (CLOUD_ENTERPRISE, openai) → DENY",
      ctx:    { tenant_id: "bank-a", model: "gpt-4o", provider: "openai",
                model_tier: "CLOUD_ENTERPRISE", classification: "CONFIDENTIAL" },
      policy: POLICY_FINANCE_STRICT,
      expect: "DENY",
    },
    {
      desc:   "Finance: PUBLIC + gpt-4o-mini (CLOUD_ENTERPRISE) → ALLOW",
      ctx:    { tenant_id: "bank-a", model: "gpt-4o-mini", provider: "openai",
                model_tier: "CLOUD_ENTERPRISE", classification: "PUBLIC" },
      policy: POLICY_FINANCE_STRICT,
      expect: "ALLOW",
    },
    {
      desc:   "Finance: INTERNAL + mixtral-8x22b (LOCAL_VPC) → ALLOW",
      ctx:    { tenant_id: "bank-a", model: "mixtral-8x22b", provider: "mistral",
                model_tier: "LOCAL_VPC", classification: "INTERNAL" },
      policy: POLICY_FINANCE_STRICT,
      expect: "ALLOW",
    },
    {
      desc:   "Finance: any CLOUD_CONSUMER model → DENY (no BAA)",
      ctx:    { tenant_id: "bank-a", model: "mistral-small", provider: "mistral",
                model_tier: "CLOUD_CONSUMER", classification: "PUBLIC" },
      policy: POLICY_FINANCE_STRICT,
      expect: "DENY",
    },
    // ── DEFENSE / ITAR TIER TESTS ───────────────────────────────────────────
    {
      desc:   "Defense: deepseek-v3 (LOCAL_VPC) TOP_SECRET → ALLOW",
      ctx:    { tenant_id: "ng-skunk", model: "deepseek-v3", provider: "deepseek",
                model_tier: "LOCAL_VPC", classification: "TOP_SECRET" },
      policy: POLICY_DEFENSE_ITAR,
      expect: "ALLOW",
    },
    {
      desc:   "Defense: claude-3-5-sonnet (CLOUD_ENTERPRISE) → DENY (ITAR absolute)",
      ctx:    { tenant_id: "ng-skunk", model: "claude-3-5-sonnet", provider: "anthropic",
                model_tier: "CLOUD_ENTERPRISE", classification: "PUBLIC" },
      policy: POLICY_DEFENSE_ITAR,
      expect: "DENY",
    },
    {
      desc:   "Defense: streetmp-auto (SOVEREIGN_ONLY) → ALLOW",
      ctx:    { tenant_id: "ng-skunk", model: "streetmp-auto", provider: "local",
                model_tier: "SOVEREIGN_ONLY", classification: "SECRET" },
      policy: POLICY_DEFENSE_ITAR,
      expect: "ALLOW",
    },
    // ── EDU FERPA ───────────────────────────────────────────────────────────
    {
      desc:   "EDU: heavy gpt-4o any tier → DENY (cost prohibition)",
      ctx:    { tenant_id: "uni-x", model: "gpt-4o", provider: "openai",
                model_tier: "CLOUD_ENTERPRISE", classification: "PUBLIC" },
      policy: POLICY_EDU_FERPA,
      expect: "DENY",
    },
    {
      desc:   "EDU: gpt-4o-mini CONFIDENTIAL external → DENY (FERPA)",
      ctx:    { tenant_id: "uni-x", model: "gpt-4o-mini", provider: "openai",
                model_tier: "CLOUD_ENTERPRISE", classification: "CONFIDENTIAL" },
      policy: POLICY_EDU_FERPA,
      expect: "DENY",
    },
    {
      desc:   "EDU: gpt-4o-mini PUBLIC → ALLOW",
      ctx:    { tenant_id: "uni-x", model: "gpt-4o-mini", provider: "openai",
                model_tier: "CLOUD_ENTERPRISE", classification: "PUBLIC" },
      policy: POLICY_EDU_FERPA,
      expect: "ALLOW",
    },
    // ── ZERO-TRUST DEFAULT ──────────────────────────────────────────────────
    {
      desc:   "No matching rule → zero-trust default DENY",
      ctx:    { tenant_id: "dev", model: "totally-unknown", provider: "unknown",
                model_tier: "CLOUD_ENTERPRISE", classification: "PUBLIC" },
      policy: POLICY_GENERIC_BASELINE,
      expect: "DENY",
    },
  ];

  for (const tc of cases) {
    const result = evaluatePolicy(tc.ctx, tc.policy);
    const ok = result.action === tc.expect;
    console.log(`  ${ok ? "✅" : "❌"} ${tc.desc}`);
    console.log(`       → ${result.action} | ${result.reason}`);
    if (ok) passed++; else failed++;
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed / ${failed} failed`);
  console.log(`══════════════════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}
