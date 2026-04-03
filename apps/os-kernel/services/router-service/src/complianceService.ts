/**
 * @file complianceService.ts
 * @version V21
 * @description V21 Auto-Compliance Engine.
 *
 * This service sits above the V12 Policy Engine. It maps high-level
 * regulatory frameworks (GDPR, HIPAA) to underlying V12 Rules
 * (PII masking, log retention, region-locking).
 *
 * In a real implementation, toggling a framework would automatically
 * sync the underlying V12 Policy documents in the database. Here,
 * we use an in-memory store to simulate tenant subscriptions.
 */

export interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  icon: string;
  v12_rules: string[];
}

export interface TenantComplianceState {
  tenant_id: string;
  framework_id: string;
  active: boolean;
  enforced_since?: string;
}

export interface ComplianceReport {
  tenant_id: string;
  generated_at: string;
  active_frameworks: {
    framework: ComplianceFramework;
    enforced_since: string;
    health: "ENFORCING" | "DEGRADED" | "INACTIVE";
  }[];
  total_rules_enforced: number;
}

// ─── Framework Registry ──────────────────────────────────────────────────────

export const FRAMEWORK_REGISTRY: Record<string, ComplianceFramework> = {
  GDPR_EU: {
    id: "GDPR_EU",
    name: "GDPR (EU)",
    description: "General Data Protection Regulation. Strict PII masking, right-to-be-forgotten webhooks, and EU data residency.",
    icon: "🇪🇺",
    v12_rules: ["MASK_PII", "REQUIRE_CONSENT_HEADER", "DISABLE_TELEMETRY_LOGS", "EU_REGION_LOCK"],
  },
  HIPAA_HEALTH: {
    id: "HIPAA_HEALTH",
    name: "HIPAA (Health)",
    description: "Health Insurance Portability and Accountability Act. Enforces PHI redaction, BAA logging, and zero-retention transit.",
    icon: "⚕️",
    v12_rules: ["REDACT_PHI", "AUDIT_LOG_ALL", "ZERO_DATA_RETENTION_LLM"],
  },
  SEC_FINANCE: {
    id: "SEC_FINANCE",
    name: "SEC 17a-4 (Finance)",
    description: "Securities and Exchange Commission. WORM storage routing, insider trading keyword blocking, and immutable audit trails.",
    icon: "🏦",
    v12_rules: ["WORM_STORAGE_ROUTING", "BLOCK_INSIDER_KEYWORDS", "IMMUTABLE_AUDIT_TRAIL"],
  },
  FERPA_EDU: {
    id: "FERPA_EDU",
    name: "FERPA (Education)",
    description: "Family Educational Rights and Privacy Act. Student record redaction and instructor-only override.",
    icon: "🎓",
    v12_rules: ["REDACT_STUDENT_RECORDS", "REQUIRE_INSTRUCTOR_TOKEN"],
  },
};

// ─── In-Memory Store ──────────────────────────────────────────────────────────

// Map<tenant_id, Map<framework_id, TenantComplianceState>>
const complianceStore = new Map<string, Map<string, TenantComplianceState>>();

/** Gets the compliance map for a given tenant, initializing if missing. */
function getTenantMap(tenant_id: string): Map<string, TenantComplianceState> {
  if (!complianceStore.has(tenant_id)) {
    // Seed default state based on tenant personality
    const map = new Map<string, TenantComplianceState>();
    
    // Seed some defaults for the demo
    if (tenant_id === "jpmc") {
      map.set("SEC_FINANCE", { tenant_id, framework_id: "SEC_FINANCE", active: true, enforced_since: new Date(Date.now() - 30 * 86400000).toISOString() });
    } else if (tenant_id === "stanford") {
      map.set("FERPA_EDU", { tenant_id, framework_id: "FERPA_EDU", active: true, enforced_since: new Date(Date.now() - 15 * 86400000).toISOString() });
    } else if (tenant_id === "pentagon") {
      // Pentagon uses all of them
      map.set("SEC_FINANCE", { tenant_id, framework_id: "SEC_FINANCE", active: true, enforced_since: new Date(Date.now() - 100 * 86400000).toISOString() });
      map.set("HIPAA_HEALTH", { tenant_id, framework_id: "HIPAA_HEALTH", active: true, enforced_since: new Date(Date.now() - 100 * 86400000).toISOString() });
    }

    complianceStore.set(tenant_id, map);
  }
  return complianceStore.get(tenant_id)!;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Returns the current active frameworks and health status for a tenant.
 */
export function getTenantCompliance(tenant_id: string): ComplianceReport {
  const map = getTenantMap(tenant_id);
  
  const active_frameworks = [];
  let total_rules_enforced = 0;

  for (const state of map.values()) {
    if (state.active) {
      const fw = FRAMEWORK_REGISTRY[state.framework_id];
      if (fw) {
        active_frameworks.push({
          framework: fw,
          enforced_since: state.enforced_since!,
          health: "ENFORCING" as const,
        });
        total_rules_enforced += fw.v12_rules.length;
      }
    }
  }

  return {
    tenant_id,
    generated_at: new Date().toISOString(),
    active_frameworks,
    total_rules_enforced,
  };
}

/**
 * Returns ALL frameworks, indicating which ones the tenant has active.
 */
export function getAllFrameworksForTenant(tenant_id: string) {
  const map = getTenantMap(tenant_id);
  return Object.values(FRAMEWORK_REGISTRY).map(fw => ({
    ...fw,
    active: map.get(fw.id)?.active ?? false,
    enforced_since: map.get(fw.id)?.enforced_since,
  }));
}

/**
 * Subscribes or unsubscribes a tenant from a specific framework.
 */
export function toggleFramework(tenant_id: string, framework_id: string, status: boolean): boolean {
  if (!FRAMEWORK_REGISTRY[framework_id]) {
    throw new Error(`Unknown compliance framework: ${framework_id}`);
  }

  const map = getTenantMap(tenant_id);
  
  if (status) {
    // Activate
    map.set(framework_id, {
      tenant_id,
      framework_id,
      active: true,
      enforced_since: new Date().toISOString(),
    });
  } else {
    // Deactivate
    const existing = map.get(framework_id);
    if (existing) {
      existing.active = false;
      delete existing.enforced_since;
    }
  }

  console.info(`[V21:Compliance] Tenant ${tenant_id} set ${framework_id} to ${status ? "ACTIVE" : "INACTIVE"}`);
  return true;
}

/**
 * Generates a mock "Audit Report" JSON string.
 */
export function generateAuditReport(tenant_id: string): string {
  const compliance = getTenantCompliance(tenant_id);
  const report = {
    document_title: "StreetMP OS - Compliance Audit Report",
    organization: tenant_id.toUpperCase(),
    date_generated: compliance.generated_at,
    auditor_checksum: "sha256:0x" + Math.random().toString(16).slice(2, 10).padStart(8, '0'),
    active_frameworks: compliance.active_frameworks.map(f => f.framework.id),
    enforced_rules: compliance.active_frameworks.flatMap(f => f.framework.v12_rules),
    signature: "ACCEPTED // STREETMP_ZK_PROVER"
  };
  return JSON.stringify(report, null, 2);
}
