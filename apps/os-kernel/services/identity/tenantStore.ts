/**
 * @file tenantStore.ts
 * @service identity
 * @version V100-2
 * @description Centralized Tenant Lifecycle State Machine
 */

import { Industry } from "../router-service/src/tenantConfig.js";

export enum TenantStatus {
  TRIAL = "TRIAL",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  PENDING_APPROVAL = "PENDING_APPROVAL", // The administrative gate
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED"
}

export interface EnterpriseTenant {
  tenant_id: string;
  name: string;
  industry: Industry;
  employee_count: string;
  stripe_tier: string;
  status: TenantStatus;
  created_at: string;
}

export class TenantLifecycleStore {
  private static instance: TenantLifecycleStore;
  
  // In-memory mock database of tenants going through the production launch pipeline
  private DB: Record<string, EnterpriseTenant> = {
    // A fresh tenant that just paid via Stripe but is awaiting admin provisioning
    "acme-corp": {
      tenant_id: "acme-corp",
      name: "Acme Healthcare Systems",
      industry: Industry.GENERIC,
      employee_count: "500-1000",
      stripe_tier: "Enterprise ($2000/mo)",
      status: TenantStatus.PENDING_APPROVAL,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    // The master admin tenant
    "streetmp-core": {
      tenant_id: "streetmp-core",
      name: "StreetMP Core Operations",
      industry: Industry.FINANCE,
      employee_count: "1-50",
      stripe_tier: "God-Mode",
      status: TenantStatus.ACTIVE,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    }
  };

  private constructor() {
    console.info("[V100:Identity:TenantStore] State Machine Initialized.");
  }

  public static getInstance(): TenantLifecycleStore {
    if (!TenantLifecycleStore.instance) {
      TenantLifecycleStore.instance = new TenantLifecycleStore();
    }
    return TenantLifecycleStore.instance;
  }

  public getTenant(tenantId: string): EnterpriseTenant | null {
    return this.DB[tenantId] || null;
  }

  public getAllPending(): EnterpriseTenant[] {
    return Object.values(this.DB).filter(t => t.status === TenantStatus.PENDING_APPROVAL);
  }

  /**
   * The "God-Mode" trigger. Elevates a tenant from PENDING_APPROVAL to ACTIVE.
   */
  public provisionTenant(tenantId: string): boolean {
    const tenant = this.DB[tenantId];
    if (tenant && tenant.status === TenantStatus.PENDING_APPROVAL) {
      tenant.status = TenantStatus.ACTIVE;
      console.info(`[V100:Identity:TenantStore] VERIFIED & PROVISIONED: ${tenantId}`);
      return true;
    }
    return false;
  }
}

export const tenantStore = TenantLifecycleStore.getInstance();
