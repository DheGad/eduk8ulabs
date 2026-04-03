/**
 * @file residencyManager.ts
 * @version V23
 * @description V23 Data Residency & Sovereignty Layer.
 *
 * Enforces strict geopolitical boundaries. A tenant's data must NEVER
 * leave their legally mandated geographic jurisdiction.
 */

export type DataRegion = "US" | "EU" | "APAC";

interface TenantResidency {
  tenant_id: string;
  region: DataRegion;
}

// Hardcoded explicit mapping for demonstration
const TENANT_RESIDENCY_MAP: Record<string, TenantResidency> = {
  FINANCE: { tenant_id: "FINANCE", region: "US" },
  EDUCATION: { tenant_id: "EDUCATION", region: "US" },
  DEFENSE: { tenant_id: "DEFENSE", region: "US" }, // Also TOP_SECRET restricted via Data Classification
  EU_CORP: { tenant_id: "EU_CORP", region: "EU" },
  "dev-sandbox": { tenant_id: "dev-sandbox", region: "US" },
};

/**
 * Validates if a given model is physically allowed to process data 
 * for the tenant based on their legally required jurisdiction.
 * 
 * @param tenantId The requesting tenant identification
 * @param modelRegions The regions where the requested model is currently hosted
 * @returns boolean True if the route is legally compliant
 */
export function enforceResidency(tenantId: string, modelRegions: DataRegion[]): boolean {
  // 1. Resolve tenant's mandated region (Default: US to conservatively sandbox unknowns)
  const requiredRegion = TENANT_RESIDENCY_MAP[tenantId]?.region ?? "US";

  // 2. Check if the model is hosted in the requested region
  if (!modelRegions.includes(requiredRegion)) {
    console.warn(`[V23:ResidencyManager] 🛑 BORDER BLOCK: Tenant [${tenantId}] is locked to [${requiredRegion}], but model is only available in [${modelRegions.join(",")}].`);
    return false;
  }

  // 3. Path is legally clear
  return true;
}

/**
 * Returns a tenant's data region constraint for UI display.
 */
export function getTenantRegion(tenantId: string): DataRegion {
  return TENANT_RESIDENCY_MAP[tenantId]?.region ?? "US";
}
