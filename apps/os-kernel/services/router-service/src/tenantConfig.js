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
import { evaluatePolicy, POLICY_FINANCE_STRICT, POLICY_EDU_FERPA, POLICY_DEFENSE_ITAR, POLICY_GENERIC_BASELINE, } from "./pacEngine.js";
import { resolveModelTier } from "./modelRegistry.js";
// ─── Industry Enum ────────────────────────────────────────────────────────────
export var Industry;
(function (Industry) {
    Industry["FINANCE"] = "FINANCE";
    Industry["EDUCATION"] = "EDUCATION";
    Industry["DEFENSE"] = "DEFENSE";
    Industry["GENERIC"] = "GENERIC";
})(Industry || (Industry = {}));
// ─── Industry PolicySets ──────────────────────────────────────────────────────
/**
 * FINANCE_STRICT — PCI-DSS, SOC2, FINRA-compliant.
 * Tightest policy: short cache TTL, signed receipts mandatory,
 * broadest PII category coverage (SSN, routing numbers, SWIFT).
 */
export const FINANCE_STRICT = {
    policy_id: "FINANCE_STRICT_V1",
    label: "Finance — Strict (PCI-DSS / FINRA / SOC2)",
    allowed_models: [
        "gpt-4o",
        "gpt-4o-mini",
        "claude-3-5-sonnet",
        "claude-3-haiku",
        "streetmp-auto",
    ],
    allowed_providers: ["openai", "anthropic"],
    extra_pii_categories: [
        "ssn", // US Social Security Number
        "routing_number", // Bank routing / ABA number
        "swift_bic", // International wire codes
        "iban", // EU bank accounts
        "credit_card", // PAN (Primary Account Number)
        "income", // Salary / P&L figures treated as PII
    ],
    cache_ttl_seconds: 30, // Short — financial data freshness is critical
    receipt_required: true,
    compliance_notes: "PCI-DSS Level 1 | FINRA Rules 3110/4511 | SOC2 Type II | GDPR Art.25",
};
/**
 * EDU_FERPA — FERPA & COPPA-compliant.
 * More permissive model list, longer cache TTL, but strict on
 * student record categories (grades, enrollment status).
 */
export const EDU_FERPA = {
    policy_id: "EDU_FERPA_V1",
    label: "Education — FERPA / COPPA",
    allowed_models: [
        "gpt-4o-mini",
        "claude-3-haiku",
        "streetmp-auto",
    ],
    allowed_providers: ["openai", "anthropic"],
    extra_pii_categories: [
        "student_id", // Institutional ID numbers
        "gpa", // Academic performance records
        "enrollment_status", // Active / withdrawn / graduated
        "disability_record", // Accommodation / 504 / IEP data
        "discipline_record", // FERPA-protected disciplinary files
    ],
    cache_ttl_seconds: 300, // Longer — less time-critical than finance
    receipt_required: false,
    compliance_notes: "FERPA 20 U.S.C. §1232g | COPPA 16 CFR Part 312 | IDEA Sec.618",
};
/**
 * DEFENSE_ITAR — Export controlled, ITAR / NIST 800-171 compliant.
 * Tightest model restrictions; no cloud-only proprietary models permitted.
 * All requests must include signed receipts for audit trail.
 */
export const DEFENSE_ITAR = {
    policy_id: "DEFENSE_ITAR_V1",
    label: "Defense — ITAR / NIST 800-171",
    allowed_models: [
        "streetmp-auto", // Only on-prem / sovereign models
    ],
    allowed_providers: [], // No external providers; internal routing only
    extra_pii_categories: [
        "clearance_level", // Security clearance (TS/SCI etc.)
        "controlled_technical_data", // Technical info subject to ITAR
        "export_control_number", // ECCN / USML category
        "personnel_file", // Military/contractor records
    ],
    cache_ttl_seconds: 0, // No caching — each request independently verified
    receipt_required: true,
    compliance_notes: "ITAR 22 CFR Parts 120-130 | NIST SP 800-171 | DFARS 252.204-7012",
};
/**
 * GENERIC_BASELINE — Default policy for unknown tenants.
 * Conservative but not industry-locked.
 */
export const GENERIC_BASELINE = {
    policy_id: "GENERIC_BASELINE_V1",
    label: "Generic — Baseline",
    allowed_models: [
        "gpt-4o-mini",
        "claude-3-haiku",
        "streetmp-auto",
    ],
    allowed_providers: ["openai", "anthropic"],
    extra_pii_categories: [],
    cache_ttl_seconds: 120,
    receipt_required: false,
    compliance_notes: "StreetMP OS Standard Security Baseline",
};
// ─── Industry → PolicySet Mapping ─────────────────────────────────────────────
export const INDUSTRY_POLICY_MAP = {
    [Industry.FINANCE]: FINANCE_STRICT,
    [Industry.EDUCATION]: EDU_FERPA,
    [Industry.DEFENSE]: DEFENSE_ITAR,
    [Industry.GENERIC]: GENERIC_BASELINE,
};
/** Maps Industry enum to the declarative StreetMP_Policy for PaC evaluation. */
const INDUSTRY_PAC_MAP = {
    [Industry.FINANCE]: POLICY_FINANCE_STRICT,
    [Industry.EDUCATION]: POLICY_EDU_FERPA,
    [Industry.DEFENSE]: POLICY_DEFENSE_ITAR,
    [Industry.GENERIC]: POLICY_GENERIC_BASELINE,
};
/**
 * Mock tenant registry — in production this is hydrated from the
 * `tenants` table in the database (or a KV store like DynamoDB / Redis).
 *
 * Lookup key: lowercase trimmed x-tenant-id header value.
 */
export const TENANT_REGISTRY = {
    // Finance tenants
    "jpmc-global": { tenant_id: "jpmc-global", name: "JPMorgan Chase", industry: Industry.FINANCE, active: true },
    "blackrock-main": { tenant_id: "blackrock-main", name: "BlackRock Asset Mgmt", industry: Industry.FINANCE, active: true },
    "gs-trading": { tenant_id: "gs-trading", name: "Goldman Sachs Trading", industry: Industry.FINANCE, active: true },
    // Education tenants
    "stanford-ai-lab": { tenant_id: "stanford-ai-lab", name: "Stanford AI Lab", industry: Industry.EDUCATION, active: true },
    "khan-academy": { tenant_id: "khan-academy", name: "Khan Academy", industry: Industry.EDUCATION, active: true },
    // Defense tenants
    "northrop-skunkworks": { tenant_id: "northrop-skunkworks", name: "Northrop Grumman Advanced Systems", industry: Industry.DEFENSE, active: true },
    // Generic / dev tenants
    "dev-sandbox": { tenant_id: "dev-sandbox", name: "StreetMP Developer Sandbox", industry: Industry.GENERIC, active: true },
};
// ─── Resolution Helpers ───────────────────────────────────────────────────────
/**
 * Resolves a tenant from the x-tenant-id header value.
 * Returns null if tenant is unknown or inactive — caller must reject the request.
 */
export function resolveTenant(tenantIdHeader) {
    const key = tenantIdHeader.trim().toLowerCase();
    const tenant = TENANT_REGISTRY[key];
    if (!tenant || !tenant.active)
        return null;
    return tenant;
}
/**
 * Resolves the applicable PolicySet for a given tenant ID string.
 * Falls back to GENERIC_BASELINE if the tenant is not in the registry.
 */
export function resolvePolicySet(tenantIdHeader) {
    const tenant = resolveTenant(tenantIdHeader);
    if (!tenant)
        return GENERIC_BASELINE;
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
export function evaluatePolicyForRequest(tenant, provider, model, classification) {
    const pac = INDUSTRY_PAC_MAP[tenant.industry];
    // V12-02: resolve the model's security tier from the global registry
    const model_tier = resolveModelTier(model);
    const ctx = {
        tenant_id: tenant.tenant_id,
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
export function isModelAllowed(policy, provider, model) {
    if (policy.allowed_providers.length > 0 && !policy.allowed_providers.includes(provider))
        return false;
    if (policy.allowed_models.length > 0 && !policy.allowed_models.includes(model))
        return false;
    return true;
}
