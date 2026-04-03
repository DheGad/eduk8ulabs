/**
 * @file tenantConfig.ts
 * @service router-service
 * @description Multi-Tenant Policy Registry (GL-02) — V12 PaC Integration
 *
 * Defines industry-specific PolicySets for Zero-Bleed routing.
 * Each incoming request carries an x-tenant-id header. The router
 * looks up the tenant's Industry, loads the corresponding StreetMP_Policy
 * (declared in pacEngine.ts), and evaluates it against the full RequestContext.
 *
 * V12: isModelAllowed() is replaced by evaluatePolicyForRequest() which
 * delegates to the declarative zero-trust pacEngine.evaluatePolicy().
 */

import {
  evaluatePolicy, RequestContext, EvaluationResult,
  POLICY_FINANCE_STRICT, POLICY_EDU_FERPA, POLICY_DEFENSE_ITAR, POLICY_GENERIC_BASELINE,
  StreetMP_Policy,
} from "./pacEngine.js";
import { resolveModelTier } from "./modelRegistry.js";

// ─── V67: Custom DLP Rule Type ────────────────────────────────────────────────

/**
 * A tenant-defined Data Loss Prevention rule.
 * Applied BEFORE global V51 patterns to mask industry-specific sensitive strings.
 *
 * Security contract:
 *   - `pattern` is validated as a safe RegExp before use (see dlpEngine.ts)
 *   - Patterns exceeding MAX_DLP_PATTERN_LENGTH are rejected
 *   - Catastrophic backtracking is guarded by a prompt length clamp upstream
 */
export interface DlpRule {
  /** Human-readable rule name for audit logs (e.g. "SWIFT_CODE_MASK") */
  name:        string;
  /** RegExp pattern string. Will be compiled with globalDLP.compileRule() */
  pattern:     string;
  /** Replacement string (e.g. "[REDACTED_SWIFT]") */
  replacement: string;
}

// ─── Industry Enum ────────────────────────────────────────────────────────────

export enum Industry {
  FINANCE   = "FINANCE",
  EDUCATION = "EDUCATION",
  DEFENSE   = "DEFENSE",
  GENERIC   = "GENERIC",  // fallback for unclassified tenants
}

// ─── PolicySet ────────────────────────────────────────────────────────────────

/**
 * A PolicySet describes the guardrail configuration, allowed AI models,
 * and compliance posture for one Industry vertical.
 *
 * The Enclave receives the `policy_id` on every sanitize/desanitize call
 * so it can apply the correct rule set internally.
 */
export interface PolicySet {
  /** Unique key sent to the Enclave as the active policy identifier. */
  policy_id:           string;
  /** Human-readable label for logging / audit trails. */
  label:               string;
  /** Which LLM models are permitted for this industry. */
  allowed_models:      string[];
  /** Which providers are permitted. */
  allowed_providers:   string[];
  /**
   * Extra PII categories the Enclave must redact beyond the defaults.
   * This list is passed as metadata — the Enclave's Rust side enforces it.
   */
  extra_pii_categories: string[];
  /**
   * Seconds a cached response may be reused.
   * Regulated industries may require shorter TTLs to prevent stale data.
   */
  cache_ttl_seconds:   number;
  /** If true, every desanitize response must include a signed receipt. */
  receipt_required:    boolean;
  /** Brief compliance note surfaced in audit logs. */
  compliance_notes:    string;
}

// ─── Industry PolicySets ──────────────────────────────────────────────────────

/**
 * FINANCE_STRICT — PCI-DSS, SOC2, FINRA-compliant.
 * Tightest policy: short cache TTL, signed receipts mandatory,
 * broadest PII category coverage (SSN, routing numbers, SWIFT).
 */
export const FINANCE_STRICT: PolicySet = {
  policy_id:           "FINANCE_STRICT_V1",
  label:               "Finance — Strict (PCI-DSS / FINRA / SOC2)",
  allowed_models:      [
    "gpt-4o",
    "gpt-4o-mini",
    "claude-3-5-sonnet",
    "claude-3-haiku",
    "streetmp-auto",
  ],
  allowed_providers:   ["openai", "anthropic"],
  extra_pii_categories: [
    "ssn",            // US Social Security Number
    "routing_number", // Bank routing / ABA number
    "swift_bic",      // International wire codes
    "iban",           // EU bank accounts
    "credit_card",    // PAN (Primary Account Number)
    "income",         // Salary / P&L figures treated as PII
  ],
  cache_ttl_seconds:   30,   // Short — financial data freshness is critical
  receipt_required:    true,
  compliance_notes:    "PCI-DSS Level 1 | FINRA Rules 3110/4511 | SOC2 Type II | GDPR Art.25",
};

/**
 * EDU_FERPA — FERPA & COPPA-compliant.
 * More permissive model list, longer cache TTL, but strict on
 * student record categories (grades, enrollment status).
 */
export const EDU_FERPA: PolicySet = {
  policy_id:           "EDU_FERPA_V1",
  label:               "Education — FERPA / COPPA",
  allowed_models:      [
    "gpt-4o-mini",
    "claude-3-haiku",
    "streetmp-auto",
  ],
  allowed_providers:   ["openai", "anthropic"],
  extra_pii_categories: [
    "student_id",           // Institutional ID numbers
    "gpa",                  // Academic performance records
    "enrollment_status",    // Active / withdrawn / graduated
    "disability_record",    // Accommodation / 504 / IEP data
    "discipline_record",    // FERPA-protected disciplinary files
  ],
  cache_ttl_seconds:   300,  // Longer — less time-critical than finance
  receipt_required:    false,
  compliance_notes:    "FERPA 20 U.S.C. §1232g | COPPA 16 CFR Part 312 | IDEA Sec.618",
};

/**
 * DEFENSE_ITAR — Export controlled, ITAR / NIST 800-171 compliant.
 * Tightest model restrictions; no cloud-only proprietary models permitted.
 * All requests must include signed receipts for audit trail.
 */
export const DEFENSE_ITAR: PolicySet = {
  policy_id:           "DEFENSE_ITAR_V1",
  label:               "Defense — ITAR / NIST 800-171",
  allowed_models:      [
    "streetmp-auto",  // Only on-prem / sovereign models
  ],
  allowed_providers:   [],  // No external providers; internal routing only
  extra_pii_categories: [
    "clearance_level",         // Security clearance (TS/SCI etc.)
    "controlled_technical_data", // Technical info subject to ITAR
    "export_control_number",   // ECCN / USML category
    "personnel_file",          // Military/contractor records
  ],
  cache_ttl_seconds:   0,    // No caching — each request independently verified
  receipt_required:    true,
  compliance_notes:    "ITAR 22 CFR Parts 120-130 | NIST SP 800-171 | DFARS 252.204-7012",
};

/**
 * GENERIC_BASELINE — Default policy for unknown tenants.
 * Conservative but not industry-locked.
 */
export const GENERIC_BASELINE: PolicySet = {
  policy_id:           "GENERIC_BASELINE_V1",
  label:               "Generic — Baseline",
  allowed_models:      [
    "gpt-4o-mini",
    "claude-3-haiku",
    "streetmp-auto",
  ],
  allowed_providers:   ["openai", "anthropic"],
  extra_pii_categories: [],
  cache_ttl_seconds:   120,
  receipt_required:    false,
  compliance_notes:    "StreetMP OS Standard Security Baseline",
};

// ─── Industry → PolicySet Mapping ─────────────────────────────────────────────

export const INDUSTRY_POLICY_MAP: Record<Industry, PolicySet> = {
  [Industry.FINANCE]:   FINANCE_STRICT,
  [Industry.EDUCATION]: EDU_FERPA,
  [Industry.DEFENSE]:   DEFENSE_ITAR,
  [Industry.GENERIC]:   GENERIC_BASELINE,
};

/** Maps Industry enum to the declarative StreetMP_Policy for PaC evaluation. */
const INDUSTRY_PAC_MAP: Record<Industry, StreetMP_Policy> = {
  [Industry.FINANCE]:   POLICY_FINANCE_STRICT,
  [Industry.EDUCATION]: POLICY_EDU_FERPA,
  [Industry.DEFENSE]:   POLICY_DEFENSE_ITAR,
  [Industry.GENERIC]:   POLICY_GENERIC_BASELINE,
};

// ─── Tenant Type & Registry ───────────────────────────────────────────────────

export interface Tenant {
  tenant_id:      string;
  name:           string;
  industry:       Industry;
  active:         boolean;
  /**
   * V66: Data Lifecycle — maximum number of days to retain audit logs.
   * After this period, the V66 Retention Sweeper will hard-delete entries.
   * Defaults to 30 days if unspecified.
   *
   * Regulatory reference:
   *   FINANCE:   30d  (FINRA Rule 4511 minimum is 3 years, but internal
   *                    ephemeral AI execution logs follow a shorter window)
   *   EDUCATION: 90d  (FERPA recommends annual review; AI logs are short)
   *   DEFENSE:   7d   (Zero-persistence posture for ITAR-controlled data)
   *   GENERIC:   30d  (Standard StreetMP OS data minimization baseline)
   */
  retention_days: number;
  /**
   * V67: Custom DLP rulesets — tenant-specific patterns applied BEFORE
   * the global V51 PII regexes. Optional — absence means global rules only.
   */
  custom_dlp_rules?: DlpRule[];
  /**
   * V69: Data Sovereignty — strict regional geofencing ('EU', 'US', 'IN', 'GLOBAL').
   * Enforced locally by the V69 Regional Router before dispatching prompts.
   */
  data_sovereignty_region?: "EU" | "US" | "IN" | "GLOBAL" | string;
  /**
   * V72: Global System Overlay — mandatory corporate instructions prepended
   * to every prompt sent to the LLM. Invisible to the end-user.
   * Absent field = no overlay applied (GLOBAL tenants, dev-sandbox etc.)
   */
  system_overlay?: string;
  /**
   * V74: Semantic Consensus Engine — "The Truth Gate"
   * If true, trigger parallel execution to backup model and verify semantic agreement.
   */
  consensus_mode?: boolean;
  consensus_backup_model?: string;
  /**
   * V85: APAC Regulatory Intelligence — list of active regional compliance
   * framework IDs (e.g. ["MAS_TRM", "PDPA_SG"]).
   * When present, the pipeline automatically enforces jurisdiction-specific
   * routing, DLP rules, consensus requirements, and audit retention.
   * @see compliance/apacFrameworks.ts
   */
  active_compliance_frameworks?: string[];
  /**
   * V88: White-Label Ecosystem — partner relationship.
   * If set, this tenant is a "sub-tenant" managed by a registered SDK partner.
   * The V88 PartnerManager emits a PARTNER_SDK_EXECUTION trace event for
   * every execution and applies partner branding to the /verify page.
   *
   * partner_id must correspond to a registered entry in partnerManager.ts.
   */
  parent_partner_id?: string;
  /** Human-readable partner name for audit log display. */
  // ── V90: Stripe Metered Billing ─────────────────────────────────────────
  /** Stripe customer ID for revenue linkage */
  stripe_customer_id?: string;
  /** Primary subscription item ID for logging raw token throughput */
  stripe_subscription_item_id?: string;
}

/**
 * Mock tenant registry — in production this is hydrated from the
 * `tenants` table in the database (or a KV store like DynamoDB / Redis).
 *
 * Lookup key: lowercase trimmed x-tenant-id header value.
 */
export const TENANT_REGISTRY: Record<string, Tenant> = {
  // Finance tenants (30-day retention — FINRA short-cycle AI logs)
  "jpmc-global": {
    tenant_id: "jpmc-global", name: "JPMorgan Chase", industry: Industry.FINANCE,
    active: true, retention_days: 30, data_sovereignty_region: "EU",
    system_overlay: "You are a professional banking assistant operating within JPMorgan Chase. Never mention competitors by name. All advice must align with FINRA compliance guidelines. Always include the disclaimer: 'For internal JPMC use only' in your response signature.",
    consensus_mode: true,
    consensus_backup_model: "claude-3-5-sonnet",
    // V67: JPMC custom DLP — mask SWIFT/BIC codes and internal wire reference numbers
    custom_dlp_rules: [
      {
        name:        "SWIFT_CODE_MASK",
        pattern:     "SWIFT-\\d{8}",
        replacement: "[REDACTED_SWIFT]",
      },
      {
        name:        "WIRE_REF_MASK",
        pattern:     "WIRE-REF-[A-Z0-9]{8,16}",
        replacement: "[REDACTED_WIRE_REF]",
      },
    ],
  },
  "blackrock-main":     { tenant_id: "blackrock-main",     name: "BlackRock Asset Mgmt",    industry: Industry.FINANCE,   active: true,  retention_days: 30  },
  "gs-trading":         { tenant_id: "gs-trading",         name: "Goldman Sachs Trading",   industry: Industry.FINANCE,   active: true,  retention_days: 30  },
  // Education tenants (90-day retention — FERPA annual review cycle)
  "stanford-ai-lab":    { tenant_id: "stanford-ai-lab",    name: "Stanford AI Lab",         industry: Industry.EDUCATION, active: true,  retention_days: 90, data_sovereignty_region: "US" },
  "khan-academy": {
    tenant_id: "khan-academy", name: "Khan Academy", industry: Industry.EDUCATION,
    active: true, retention_days: 90,
    system_overlay: "You are a patient and encouraging tutor for students aged 8–18. Never give direct answers to math or science problems. Instead, guide the student step-by-step using Socratic questioning. Always praise effort before offering correction. Your tone must remain positive, age-appropriate, and educational at all times.",
  },
  // Defense tenants (7-day retention — ITAR zero-persistence posture)
  "northrop-skunkworks": {
    tenant_id: "northrop-skunkworks", name: "Northrop Grumman Advanced Systems",
    industry: Industry.DEFENSE, active: true, retention_days: 7,
    system_overlay: "You are a secure defense intelligence analyst operating under ITAR 22 CFR Parts 120–130. You must adhere to all ITAR, NIST SP 800-171, and DFARS 252.204-7012 guidelines at all times. Flag any output that references restricted program codes, classified specifications, or export-controlled technical data. Never produce content that could constitute an unauthorized export of defense information. All responses are FOR OFFICIAL USE ONLY.",
    consensus_mode: true,
    consensus_backup_model: "gemini-1.5-pro",
    // V67: Northrop custom DLP — classified program names and clearance markers
    custom_dlp_rules: [
      {
        name:        "PROJECT_ARCHANGEL_MASK",
        pattern:     "Project\\s+Archangel",
        replacement: "[REDACTED_CLASSIFIED]",
      },
      {
        name:        "CLEARANCE_LEVEL_MASK",
        pattern:     "(?:TS\\/SCI|TOP SECRET\\/SCI|UMBRA|NOFORN)",
        replacement: "[REDACTED_CLEARANCE]",
      },
      {
        name:        "PROGRAM_CODE_MASK",
        pattern:     "PROGRAM-[A-Z]{2,6}-\\d{3,6}",
        replacement: "[REDACTED_PROGRAM]",
      },
    ],
  },
  // Generic / dev tenants (7-day retention — fast dev-cycle cleanup)
  "dev-sandbox":        { tenant_id: "dev-sandbox",        name: "StreetMP Developer Sandbox", industry: Industry.GENERIC, active: true, retention_days: 7, data_sovereignty_region: "GLOBAL" },

  // ── V85: APAC Regional Tenants ───────────────────────────────────────────
  // MAS TRM (Singapore) — DBS Bank
  "dbs-singapore": {
    tenant_id: "dbs-singapore", name: "DBS Bank Ltd (Singapore)",
    industry: Industry.FINANCE, active: true,
    retention_days: 1825,          // MAS TRM §9.4.1 — 5-year minimum
    data_sovereignty_region: "SG", // V69 — must stay in SG
    consensus_mode: true,          // MAS Principle 9.2 — dual-model consensus
    consensus_backup_model: "claude-3-5-sonnet",
    active_compliance_frameworks: ["MAS_TRM", "PDPA_SG"],
    system_overlay: "You are a professional banking assistant for DBS Bank Singapore. All outputs must comply with MAS TRM Guidelines 2021 and the Singapore Personal Data Protection Act. Never reference NRIC, FIN, or account numbers in responses. Responses are FOR INTERNAL DBS USE ONLY.",
    stripe_customer_id: "cus_DbsSingaporeMockV90",
    stripe_subscription_item_id: "si_mockDbsMeterV90",
  },

  // BNM RMiT (Malaysia) — Maybank
  "maybank-malaysia": {
    tenant_id: "maybank-malaysia", name: "Malayan Banking Berhad (Maybank)",
    industry: Industry.FINANCE, active: true,
    retention_days: 2556,          // BNM RMiT §10.55 — 7-year minimum
    data_sovereignty_region: "MY", // V69 — must stay in MY
    consensus_mode: false,
    active_compliance_frameworks: ["BNM_RMIT"],
    system_overlay: "You are a professional banking assistant for Maybank Malaysia. All outputs must comply with Bank Negara Malaysia RMiT Policy 2020 and the Malaysian Personal Data Protection Act 2010. Never reference MyKad IC numbers or account numbers in responses. Responses are FOR INTERNAL MAYBANK USE ONLY.",
    custom_dlp_rules: [
      {
        name:        "MY_MYKAD_DASHES_MASK",
        pattern:     "\\b\\d{6}-\\d{2}-\\d{4}\\b",
        replacement: "[REDACTED_MYKAD]",
      },
    ],
    stripe_customer_id: "cus_MaybankMalaysiaMockV90",
    stripe_subscription_item_id: "si_mockMaybankMeterV90",
  },
};

// ─── Resolution Helpers ───────────────────────────────────────────────────────

/**
 * Resolves a tenant from the x-tenant-id header value.
 * Returns null if tenant is unknown or inactive — caller must reject the request.
 */
export function resolveTenant(tenantIdHeader: string): Tenant | null {
  const key = tenantIdHeader.trim().toLowerCase();
  const tenant = TENANT_REGISTRY[key];
  if (!tenant || !tenant.active) return null;
  return tenant;
}

/**
 * V66: Returns the configured retention_days for a tenant.
 * Falls back to 30 days if the tenant is unknown.
 */
export function getRetentionPolicy(tenantId: string): number {
  const DEFAULT_RETENTION_DAYS = 30;
  const tenant = TENANT_REGISTRY[tenantId.trim().toLowerCase()];
  return tenant?.retention_days ?? DEFAULT_RETENTION_DAYS;
}

/**
 * V67: Returns the custom DLP rules for a tenant.
 * Returns an empty array for unknown tenants or those without custom rules.
 *
 * @param tenantId - Raw tenant_id (already resolved, not the header value)
 */
export function resolveDlpRules(tenantId: string): DlpRule[] {
  const tenant = TENANT_REGISTRY[tenantId.trim().toLowerCase()];
  return tenant?.custom_dlp_rules ?? [];
}

/**
 * Resolves the applicable PolicySet for a given tenant ID string.
 * Falls back to GENERIC_BASELINE if the tenant is not in the registry.
 */
export function resolvePolicySet(tenantIdHeader: string): PolicySet {
  const tenant = resolveTenant(tenantIdHeader);
  if (!tenant) return GENERIC_BASELINE;
  return INDUSTRY_POLICY_MAP[tenant.industry];
}

/**
 * V12 Policy-as-Code gate.
 *
 * Builds a RequestContext from the incoming route values and evaluates it
 * against the tenant's declarative StreetMP_Policy using the PaC engine.
 *
 * Replaces the old `isModelAllowed(policy, provider, model)` function.
 * The zero-trust default means any unmatched request is automatically DENIED.
 *
 * @param tenant   Resolved Tenant from the registry.
 * @param provider Normalised provider string (e.g. "openai").
 * @param model    Requested model name.
 * @param classification Optional data classification label from the request.
 * @returns EvaluationResult with action ("ALLOW" | "DENY") and reason.
 */
export function evaluatePolicyForRequest(
  tenant: Tenant,
  provider: string,
  model: string,
  classification?: string,
): EvaluationResult {
  const pac = INDUSTRY_PAC_MAP[tenant.industry];
  // V12-02: resolve the model's security tier from the global registry
  const model_tier = resolveModelTier(model);
  const ctx: RequestContext = {
    tenant_id:      tenant.tenant_id,
    provider,
    model,
    model_tier,
    classification: classification ?? "",
  };
  return evaluatePolicy(ctx, pac);
}

/**
 * @deprecated Use evaluatePolicyForRequest() instead.
 * Kept for backwards compatibility during the V12 migration window.
 */
export function isModelAllowed(policy: PolicySet, provider: string, model: string): boolean {
  if (policy.allowed_providers.length > 0 && !policy.allowed_providers.includes(provider)) return false;
  if (policy.allowed_models.length > 0    && !policy.allowed_models.includes(model)) return false;
  return true;
}
