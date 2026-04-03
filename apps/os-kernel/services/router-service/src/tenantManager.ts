/**
 * @file tenantManager.ts
 * @service router-service
 * @version V38
 * @description Enterprise Workspace Isolation
 *
 * Allows a single enterprise tenant to partition their AI usage
 * into discrete Workspaces (e.g., Finance, HR, R&D), each with
 * their own V18 API key pool and V12 Policy bindings.
 *
 * ADDITIVE ONLY: Does not modify V1-V37 logic.
 */

export type WorkspaceTier = "PRODUCTION" | "STAGING" | "SANDBOX";

export interface Workspace {
  workspace_id:   string;
  tenant_id:      string;
  name:           string;
  tier:           WorkspaceTier;
  /** V12 Policy Set IDs bound to this workspace */
  policy_ids:     string[];
  /** V18 API Key IDs scoped to this workspace */
  api_key_ids:    string[];
  /** Data classification ceiling for this workspace */
  max_classification: "TOP_SECRET" | "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";
  created_at:     string;
  active:         boolean;
}

// ─── In-Memory Workspace Store ────────────────────────────────────────────────
// In production: persisted in the Vault database.

const workspaceStore = new Map<string, Workspace>();

// Seed with default workspaces for the three demo tenants
const defaultWorkspaces: Workspace[] = [
  {
    workspace_id:        "ws_jpmc_finance",
    tenant_id:           "jpmc",
    name:                "Finance Workspace",
    tier:                "PRODUCTION",
    policy_ids:          ["pac_strict_pii", "pac_gdpr_eu", "pac_fin_reg"],
    api_key_ids:         ["smp_jpmc_finance_key"],
    max_classification:  "TOP_SECRET",
    created_at:          "2026-01-15T00:00:00Z",
    active:              true,
  },
  {
    workspace_id:        "ws_jpmc_hr",
    tenant_id:           "jpmc",
    name:                "HR Workspace",
    tier:                "PRODUCTION",
    policy_ids:          ["pac_strict_pii", "pac_gdpr_eu"],
    api_key_ids:         ["smp_jpmc_hr_key"],
    max_classification:  "CONFIDENTIAL",
    created_at:          "2026-01-15T00:00:00Z",
    active:              true,
  },
  {
    workspace_id:        "ws_jpmc_rd",
    tenant_id:           "jpmc",
    name:                "R&D Workspace",
    tier:                "STAGING",
    policy_ids:          ["pac_internal_only"],
    api_key_ids:         ["smp_jpmc_rd_key"],
    max_classification:  "INTERNAL",
    created_at:          "2026-02-01T00:00:00Z",
    active:              true,
  },
  {
    workspace_id:        "ws_nhs_clinical",
    tenant_id:           "nhs",
    name:                "Clinical Workspace",
    tier:                "PRODUCTION",
    policy_ids:          ["pac_hipaa", "pac_strict_pii"],
    api_key_ids:         ["smp_nhs_demo_key"],
    max_classification:  "TOP_SECRET",
    created_at:          "2026-01-20T00:00:00Z",
    active:              true,
  },
];

for (const ws of defaultWorkspaces) {
  workspaceStore.set(ws.workspace_id, ws);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns all workspaces for a tenant */
export function getWorkspacesForTenant(tenant_id: string): Workspace[] {
  return Array.from(workspaceStore.values()).filter(w => w.tenant_id === tenant_id);
}

/** Returns a specific workspace by ID */
export function getWorkspace(workspace_id: string): Workspace | null {
  return workspaceStore.get(workspace_id) ?? null;
}

/** Creates a new workspace for a tenant */
export function createWorkspace(params: {
  tenant_id:          string;
  name:               string;
  tier:               WorkspaceTier;
  policy_ids?:        string[];
  api_key_ids?:       string[];
  max_classification?: Workspace["max_classification"];
}): Workspace {
  const ws: Workspace = {
    workspace_id:       "ws_" + params.tenant_id + "_" + Date.now().toString(36),
    tenant_id:          params.tenant_id,
    name:               params.name,
    tier:               params.tier,
    policy_ids:         params.policy_ids ?? [],
    api_key_ids:        params.api_key_ids ?? [],
    max_classification: params.max_classification ?? "INTERNAL",
    created_at:         new Date().toISOString(),
    active:             true,
  };
  workspaceStore.set(ws.workspace_id, ws);
  console.info(`[V38:TenantManager] Created workspace "${ws.name}" for tenant ${ws.tenant_id}`);
  return ws;
}

/** Validates that a given API key ID is authorised for the specified workspace */
export function isKeyAuthorisedForWorkspace(key_id: string, workspace_id: string): boolean {
  const ws = workspaceStore.get(workspace_id);
  return ws?.api_key_ids.includes(key_id) ?? false;
}

/** Returns the active policy IDs bound to a workspace — used by V12 evaluation */
export function getPoliciesForWorkspace(workspace_id: string): string[] {
  return workspaceStore.get(workspace_id)?.policy_ids ?? [];
}

/** Returns total workspace count (for monitoring) */
export function getTotalWorkspaceCount(): number {
  return workspaceStore.size;
}
