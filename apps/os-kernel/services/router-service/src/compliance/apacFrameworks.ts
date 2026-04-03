/**
 * @file compliance/apacFrameworks.ts
 * @service router-service
 * @description Command 085 — APAC Regulatory Intelligence Engine
 *
 * Defines Southeast Asian compliance frameworks as first-class kernel objects.
 * When a tenant has one of these frameworks active, the pipeline automatically:
 *   1. Enforces geographic data sovereignty routing (V69)
 *   2. Injects jurisdiction-specific DLP rules (V67)
 *   3. Enables dual-model consensus for financial decisions (V74 where required)
 *   4. Emits a V70 APAC_COMPLIANCE_ENFORCED trace event
 *
 * Regulatory basis:
 *   MAS TRM  — MAS Technology Risk Management Guidelines 2021, Singapore
 *   BNM RMiT — Bank Negara Malaysia Risk Management in Technology Policy 2020
 *   PDPA_SG  — Singapore Personal Data Protection Act 2012 (Cap 26G)
 */

// ─── Framework Identifier Constants ──────────────────────────────────────────

export const FRAMEWORK_MAS_TRM  = "MAS_TRM"  as const;
export const FRAMEWORK_BNM_RMIT = "BNM_RMIT" as const;
export const FRAMEWORK_PDPA_SG  = "PDPA_SG"  as const;

export type ApacFrameworkId =
  | typeof FRAMEWORK_MAS_TRM
  | typeof FRAMEWORK_BNM_RMIT
  | typeof FRAMEWORK_PDPA_SG;

// ─── DLP Rule Type (re-export-compatible shape) ───────────────────────────────

export interface ApacDlpRule {
  name:        string;
  pattern:     string;
  replacement: string;
}

// ─── Framework Descriptor ────────────────────────────────────────────────────

export interface ApacComplianceFramework {
  /** Canonical identifier used in Tenant.active_compliance_frameworks[] */
  id:                    ApacFrameworkId;
  /** Human-readable display label */
  label:                 string;
  /** ISO 3166-1 alpha-2 jurisdiction code */
  jurisdiction:          string;
  /** Required data sovereignty region — enforced by V69 Regional Router */
  required_region:       string;
  /** Whether V74 dual-model consensus is mandatory for this framework */
  consensus_required:    boolean;
  /** Minimum audit log retention in days required by the regulation */
  min_retention_days:    number;
  /** Jurisdiction-specific DLP rules injected BEFORE global V51 patterns */
  dlp_rules:             ApacDlpRule[];
  /** Short compliance reference for logging */
  regulatory_reference:  string;
  /** V12 rule tag emitted to PaC audit log */
  v12_rule_tags:         string[];
}

// ─── MAS TRM (Monetary Authority of Singapore) ───────────────────────────────

/**
 * MAS Technology Risk Management Guidelines 2021
 *
 * Key requirements enforced:
 *  - Data must remain within Singapore jurisdiction (data_sovereignty: "SG")
 *  - NRIC/FIN numbers (Singapore national ID) must be tokenised before LLM dispatch
 *  - Financial AI decisions require dual-model consensus per Principle 9.2
 *  - Audit logs retained minimum 5 years (1825 days)
 *
 * NRIC pattern: S/T/F/G + 7 digits + check letter (e.g. S1234567A)
 * FIN pattern:  F/G + 7 digits + check letter (e.g. F1234567N) — foreign nationals
 */
export const MAS_TRM_FRAMEWORK: ApacComplianceFramework = {
  id:                   FRAMEWORK_MAS_TRM,
  label:                "MAS TRM (Singapore)",
  jurisdiction:         "SG",
  required_region:      "SG",
  consensus_required:   true,   // MAS Principle 9.2 — material AI-assisted decisions
  min_retention_days:   1825,   // MAS TRM §9.4.1 — 5-year audit retention
  regulatory_reference: "MAS Technology Risk Management Guidelines 2021 | MAS Notice 655 | PDPA Cap 26G",
  v12_rule_tags: [
    "MAS_TRM_9.1_SYSTEM_RISK",
    "MAS_TRM_9.2_AI_GOVERNANCE",
    "MAS_TRM_9.4_AUDIT_LOG",
    "V69_REGION_SG",
    "V74_CONSENSUS_REQUIRED",
    "V13_RETENTION_1825D",
  ],
  dlp_rules: [
    {
      // Singapore NRIC — Citizens & PRs (S=citizen born before 2000, T=born 2000+)
      name:        "SG_NRIC_MASK",
      pattern:     "\\b[STFG]\\d{7}[A-Z]\\b",
      replacement: "[REDACTED_NRIC]",
    },
    {
      // Singapore FIN — Foreign nationals & Employment Pass holders
      name:        "SG_FIN_MASK",
      pattern:     "\\b[FG]\\d{7}[A-Z]\\b",
      replacement: "[REDACTED_FIN]",
    },
    {
      // Singapore bank account numbers (DBS/POSB, OCBC, UOB formats)
      name:        "SG_BANK_ACCOUNT_MASK",
      pattern:     "\\b\\d{3}[-\\s]?\\d{3}[-\\s]?\\d{3}[-\\s]?\\d?\\b",
      replacement: "[REDACTED_SG_BANK_ACCT]",
    },
    {
      // Singapore phone numbers (+65 XXXX XXXX)
      name:        "SG_PHONE_MASK",
      pattern:     "(?:\\+65[\\s-]?)?[689]\\d{3}[\\s-]?\\d{4}",
      replacement: "[REDACTED_SG_PHONE]",
    },
  ],
};

// ─── BNM RMiT (Bank Negara Malaysia) ─────────────────────────────────────────

/**
 * Bank Negara Malaysia — Risk Management in Technology Policy 2020
 *
 * Key requirements enforced:
 *  - Data must remain within Malaysia jurisdiction (data_sovereignty: "MY")
 *  - MyKad (Malaysian IC) numbers must be redacted before LLM dispatch
 *  - Audit logs retained minimum 7 years (2556 days) per RMiT §10.55
 *  - Consensus not mandated (BNM allows single-model with audit trail)
 *
 * MyKad format: YYMMDD-PB-GGGG (e.g. 800101-14-5678, no dashes: 800101145678)
 *   YY = year, MM = month, DD = day
 *   PB = place of birth code (01–16 = state, 21–59 = foreign)
 *   GGGG = random sequence + gender indicator (odd=male, even=female)
 */
export const BNM_RMIT_FRAMEWORK: ApacComplianceFramework = {
  id:                   FRAMEWORK_BNM_RMIT,
  label:                "BNM RMiT (Malaysia)",
  jurisdiction:         "MY",
  required_region:      "MY",
  consensus_required:   false,  // Not mandated — single-model with V13 audit satisfies RMiT
  min_retention_days:   2556,   // BNM RMiT §10.55 — 7-year audit retention
  regulatory_reference: "BNM Risk Management in Technology Policy 2020 | PDPA Malaysia 2010 | FSA 2013",
  v12_rule_tags: [
    "BNM_RMIT_10.55_AUDIT_LOG",
    "BNM_RMIT_10.68_AI_RISK",
    "V69_REGION_MY",
    "V13_RETENTION_2556D",
    "MY_PDPA_DATA_MINIMISATION",
  ],
  dlp_rules: [
    {
      // MyKad with dashes (YYMMDD-PB-GGGG)
      name:        "MY_MYKAD_DASHES_MASK",
      pattern:     "\\b\\d{6}-\\d{2}-\\d{4}\\b",
      replacement: "[REDACTED_MYKAD]",
    },
    {
      // MyKad without dashes (12-digit continuous: YYMMDDPBGGGG)
      name:        "MY_MYKAD_NODASH_MASK",
      pattern:     "\\b\\d{12}\\b",
      replacement: "[REDACTED_MYKAD]",
    },
    {
      // MyPR (permanent resident): starts with 00
      name:        "MY_MYPR_MASK",
      pattern:     "\\b00\\d{10}\\b",
      replacement: "[REDACTED_MYPR]",
    },
    {
      // Malaysian bank account numbers (e.g. Maybank/CIMB 14-digit)
      name:        "MY_BANK_ACCOUNT_MASK",
      pattern:     "\\b\\d{14,16}\\b",
      replacement: "[REDACTED_MY_BANK_ACCT]",
    },
  ],
};

// ─── PDPA_SG (Singapore Personal Data Protection Act) ────────────────────────

/**
 * Singapore PDPA 2012 (Cap 26G) — enhanced since 2021
 * Lighter framework: no consensus requirement, 3-year retention.
 */
export const PDPA_SG_FRAMEWORK: ApacComplianceFramework = {
  id:                   FRAMEWORK_PDPA_SG,
  label:                "PDPA Singapore",
  jurisdiction:         "SG",
  required_region:      "SG",
  consensus_required:   false,
  min_retention_days:   1095,  // PDPA — 3-year standard retention
  regulatory_reference: "Singapore Personal Data Protection Act 2012 (Cap 26G) | PDPC Advisory Guidelines",
  v12_rule_tags: [
    "PDPA_SG_PURPOSE_LIMITATION",
    "PDPA_SG_DATA_MINIMISATION",
    "V69_REGION_SG",
    "V13_RETENTION_1095D",
  ],
  dlp_rules: [
    // Reuse NRIC/FIN rules from MAS_TRM
    {
      name:        "SG_NRIC_MASK",
      pattern:     "\\b[STFG]\\d{7}[A-Z]\\b",
      replacement: "[REDACTED_NRIC]",
    },
    {
      name:        "SG_FIN_MASK",
      pattern:     "\\b[FG]\\d{7}[A-Z]\\b",
      replacement: "[REDACTED_FIN]",
    },
  ],
};

// ─── Framework Registry ───────────────────────────────────────────────────────

export const APAC_FRAMEWORK_REGISTRY: Record<ApacFrameworkId, ApacComplianceFramework> = {
  [FRAMEWORK_MAS_TRM]:  MAS_TRM_FRAMEWORK,
  [FRAMEWORK_BNM_RMIT]: BNM_RMIT_FRAMEWORK,
  [FRAMEWORK_PDPA_SG]:  PDPA_SG_FRAMEWORK,
};

/**
 * Accepted inference-region codes per framework.
 * Includes ISO 3166-1 alpha-2 codes AND common cloud-provider region aliases
 * (e.g. AWS ap-southeast-1, Azure southeastasia) so real deployments pass.
 *
 * SECURITY CONTRACT: This list is the authoritative enforcement source.
 * Any region not in this set will cause a 403 REGULATORY_SOVEREIGNTY_VIOLATION.
 */
export const APAC_ALLOWED_INFERENCE_REGIONS: Record<ApacFrameworkId, ReadonlyArray<string>> = {
  [FRAMEWORK_MAS_TRM]: [
    "SG",
    "sg",
    "singapore",
    "ap-southeast-1",       // AWS — Singapore
    "southeastasia",        // Azure — Singapore/Malaysia region
    "asia-southeast1",      // GCP — Singapore
    "mas-approved-sg",      // StreetMP sovereign endpoint alias
  ],
  [FRAMEWORK_BNM_RMIT]: [
    "MY",
    "my",
    "malaysia",
    "ap-southeast-3",       // AWS — Jakarta (closest MY-sovereign option)
    "southeastasia",        // Azure — includes Malaysia edge
    "asia-southeast2",      // GCP — Jakarta (nearest compliant zone)
    "bnm-approved-my",      // StreetMP sovereign endpoint alias
  ],
  [FRAMEWORK_PDPA_SG]: [
    "SG",
    "sg",
    "singapore",
    "ap-southeast-1",
    "southeastasia",
    "asia-southeast1",
    "mas-approved-sg",
  ],
};

// ─── Enforcement Helper ───────────────────────────────────────────────────────

/**
 * Given a list of active framework IDs on a tenant, returns the merged set of
 * APAC enforcement rules to apply for this request.
 *
 * Merge strategy (strictest wins):
 *  - required_region:    First non-null region wins (frameworks are jurisdiction-specific)
 *  - consensus_required: true if ANY active framework requires it
 *  - min_retention_days: maximum across all active frameworks
 *  - dlp_rules:          union of all rules (deduplicated by name)
 */
export function resolveApacEnforcement(
  activeFrameworks: string[],
): {
  enforced:            boolean;
  frameworkIds:        ApacFrameworkId[];
  required_region:     string | null;
  consensus_required:  boolean;
  min_retention_days:  number;
  dlp_rules:           ApacDlpRule[];
  v12_rule_tags:       string[];
} {
  const matched: ApacComplianceFramework[] = [];

  for (const id of activeFrameworks) {
    const fw = APAC_FRAMEWORK_REGISTRY[id as ApacFrameworkId];
    if (fw) matched.push(fw);
  }

  if (matched.length === 0) {
    return {
      enforced: false, frameworkIds: [],
      required_region: null, consensus_required: false,
      min_retention_days: 0, dlp_rules: [], v12_rule_tags: [],
    };
  }

  const seenRuleNames = new Set<string>();
  const mergedDlp: ApacDlpRule[] = [];

  for (const fw of matched) {
    for (const rule of fw.dlp_rules) {
      if (!seenRuleNames.has(rule.name)) {
        seenRuleNames.add(rule.name);
        mergedDlp.push(rule);
      }
    }
  }

  return {
    enforced:           true,
    frameworkIds:       matched.map((fw) => fw.id),
    required_region:    matched[0]?.required_region ?? null,
    consensus_required: matched.some((fw) => fw.consensus_required),
    min_retention_days: Math.max(...matched.map((fw) => fw.min_retention_days)),
    dlp_rules:          mergedDlp,
    v12_rule_tags:      [...new Set(matched.flatMap((fw) => fw.v12_rule_tags))],
  };
}
