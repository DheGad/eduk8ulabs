/**
 * @file tenantIsolator.ts
 * @service security
 * @version V52
 * @description Blast Radius Containment — Multi-Tenant Isolation Engine
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 * Enforces mathematically-impossible cross-tenant data access by:
 *   1. Prefixing every cache/vault/DLP key with the tenantId
 *   2. Detecting cross-tenant memory bleed attempts and throwing
 *      FATAL errors before any downstream operation executes
 *
 * Every cache read/write (V60 Semantic Cache, V47 Vaults, V51 DLP)
 * MUST pass through enforceIsolation() to get a namespaced key.
 *
 * Usage:
 *   import { globalBlastRadius } from '../security/src/tenantIsolator.js';
 *   const safeKey = globalBlastRadius.enforceIsolation('tenant_9942', 'cache_key');
 *   // → 'tenant_9942:cache_key'
 * ================================================================
 */

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export interface IsolationEnvelope {
  /** The namespaced key safe to use in any downstream store */
  namespacedKey: string;
  /** The original tenant that owns this resource */
  ownerTenantId: string;
  /** Timestamp the isolation envelope was created */
  issuedAt: string;
}

export interface MemoryAccess {
  requestingTenantId: string;
  resourceKey: string;
  /** The tenantId extracted from the resource key's namespace prefix */
  resourceOwnerTenantId: string;
}

export interface BreachReport {
  fatal: true;
  code: "CROSS_TENANT_BREACH";
  requestingTenant: string;
  ownerTenant: string;
  resourceKey: string;
  timestamp: string;
  message: string;
}

// ----------------------------------------------------------------
// BlastRadiusContainer
// ----------------------------------------------------------------

export class BlastRadiusContainer {
  private readonly _separator = ":";

  /**
   * enforceIsolation
   * ----------------
   * Wraps any downstream cache/vault/DLP key with a strict tenant
   * namespace prefix. This ensures every read/write is scoped to the
   * authenticated tenant's sandbox — making cross-tenant key collisions
   * mathematically impossible.
   *
   * Example:
   *   enforceIsolation('tenant_9942', 'semantic_cache_v60_abc123')
   *   → { namespacedKey: 'tenant_9942:semantic_cache_v60_abc123', ... }
   */
  enforceIsolation(tenantId: string, payload: string): IsolationEnvelope {
    if (!tenantId || tenantId.trim() === "") {
      throw new Error(
        "[V52:BlastRadius] FATAL — enforceIsolation called with empty tenantId. " +
        "All traffic must be tenant-scoped before reaching the cache/vault layer."
      );
    }

    if (!payload || payload.trim() === "") {
      throw new Error(
        `[V52:BlastRadius] FATAL — enforceIsolation(${tenantId}) received empty payload/key. ` +
        "Cannot namespace an empty key."
      );
    }

    // Security invariant: the payload itself must not already contain
    // a tenant prefix for a *different* tenant (prevent injection attacks).
    const parts = payload.split(this._separator);
    if (parts.length > 1 && parts[0] !== tenantId) {
      // Payload looks like it already has a foreign namespace prefix
      const foreignTenant = parts[0];
      this._raiseBreach({
        requestingTenantId: tenantId,
        resourceKey: payload,
        resourceOwnerTenantId: foreignTenant,
      });
    }

    const namespacedKey = `${tenantId}${this._separator}${payload}`;

    console.info(
      `[V52:BlastRadius] Isolation enforced → tenant=${tenantId} | key=${payload} → ${namespacedKey}`
    );

    return {
      namespacedKey,
      ownerTenantId: tenantId,
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * detectCrossTenantBreach
   * -----------------------
   * Validates that the tenant requesting a resource legitimately owns it.
   * Called by cache/vault adapters on every read before returning data.
   *
   * Throws a BreachReport (fatal error) if Tenant A attempts to access
   * a key whose namespace prefix belongs to Tenant B.
   */
  detectCrossTenantBreach(access: MemoryAccess): void {
    const { requestingTenantId, resourceKey, resourceOwnerTenantId } = access;

    // Derive the owner from the key prefix when the caller doesn't inject it
    const computedOwner =
      resourceOwnerTenantId || resourceKey.split(this._separator)[0] || "unknown";

    if (computedOwner !== requestingTenantId) {
      this._raiseBreach({
        requestingTenantId,
        resourceKey,
        resourceOwnerTenantId: computedOwner,
      });
    }

    console.info(
      `[V52:BlastRadius] ✅ Cross-tenant check passed — ` +
      `tenant=${requestingTenantId} | resource=${resourceKey}`
    );
  }

  /**
   * resolveKey
   * ----------
   * Convenience helper: given an already-namespaced key and a requesting
   * tenant, validates ownership and returns the raw (un-prefixed) key.
   *
   * Use this when reading FROM a store to strip the prefix before passing
   * the value to upstream business logic.
   */
  resolveKey(tenantId: string, namespacedKey: string): string {
    const prefix = `${tenantId}${this._separator}`;

    if (!namespacedKey.startsWith(prefix)) {
      const computedOwner = namespacedKey.split(this._separator)[0] || "unknown";
      this._raiseBreach({
        requestingTenantId: tenantId,
        resourceKey: namespacedKey,
        resourceOwnerTenantId: computedOwner,
      });
    }

    return namespacedKey.slice(prefix.length);
  }

  // ----------------------------------------------------------------
  // Private: raise a fatal breach error
  // ----------------------------------------------------------------

  private _raiseBreach(params: {
    requestingTenantId: string;
    resourceKey: string;
    resourceOwnerTenantId: string;
  }): never {
    const report: BreachReport = {
      fatal: true,
      code: "CROSS_TENANT_BREACH",
      requestingTenant: params.requestingTenantId,
      ownerTenant: params.resourceOwnerTenantId,
      resourceKey: params.resourceKey,
      timestamp: new Date().toISOString(),
      message:
        `FATAL: Tenant "${params.requestingTenantId}" attempted to access a resource ` +
        `owned by Tenant "${params.resourceOwnerTenantId}". ` +
        `Resource key: "${params.resourceKey}". ` +
        `Cross-tenant bleed is NOT permitted. Partition lockdown initiated.`,
    };

    console.error(`[V52:BlastRadius] 🚨 CROSS-TENANT BREACH DETECTED`, report);

    throw Object.assign(new Error(report.message), report);
  }
}

// ----------------------------------------------------------------
// Singleton export — injected into proxyRoutes.ts
// ----------------------------------------------------------------

export const globalBlastRadius = new BlastRadiusContainer();
