/**
 * @file quotaManager.ts
 * @service router-service
 * @version V57 + V63
 * @description Quota Governor — Monthly Token Budget Enforcement & Alert Tracking
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 *
 *  Tracks cumulative monthly token consumption per tenant in Redis.
 *  On each AI execution, the token count is atomically incremented.
 *  After incrementing, a non-blocking background check fires to:
 *
 *    1. Calculate the new burn percentage
 *    2. Check if 80%, 90%, or 100% thresholds are newly crossed
 *    3. Issue "alert locks" (Redis SET EX) so alerts fire exactly
 *       once per billing cycle per threshold level
 *    4. Dispatch outbound webhook via alertEngine.dispatchQuotaAlert()
 *
 * ================================================================
 * REDIS KEY SCHEMA
 * ================================================================
 *
 *   Token counter:  quota:tokens:{tenantId}:{YYYY-MM}
 *                   → integer, increments atomically with INCRBY
 *                   → TTL set to 62 days (billing period + buffer)
 *
 *   Alert lock:     quota:alerts:{tenantId}:{YYYY-MM}:{threshold}
 *                   → present = alert fired this cycle
 *                   → TTL = seconds until end of current month
 *                   → prevents alert spam on every prompt after 80%
 *
 * ================================================================
 * FAIL-OPEN CONTRACT
 * ================================================================
 *
 *  Redis is treated as non-critical infrastructure for quota tracking.
 *  If Redis is unavailable:
 *    • Token increment is silently skipped (logged as warning)
 *    • Threshold checks are skipped
 *    • Alerts are NOT fired (no false-positive spam)
 *    • The AI execution ALWAYS proceeds — users never blocked by telemetry
 *
 * ================================================================
 * ASYNC EXECUTION CONTRACT (V63 requirement)
 * ================================================================
 *
 *  checkAndFireAlerts() MUST be called with floating Promise:
 *    Promise.resolve().then(() => checkAndFireAlerts(...))
 *
 *  incrementTenantTokens() handles this internally via the
 *  optional triggerAlerts parameter — callers in routes.ts only
 *  need to call incrementTenantTokens() and NOT await it.
 *
 * ================================================================
 */

import { Redis, type RedisOptions } from "ioredis";
import { dispatchQuotaAlert, getBillingPeriod, secondsUntilEndOfMonth } from "./alertEngine.js";
import { reportUsage } from "./services/billingService.js";

// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------

/**
 * Per-tenant monthly token caps.
 * In production, hydrate from the `tenants` DB table or a KV config.
 * Keys must match TENANT_REGISTRY keys in tenantConfig.ts.
 *
 * Default cap for unknown tenants: 1,000,000 tokens/month.
 */
const TENANT_MONTHLY_CAPS: Record<string, number> = {
  "jpmc-global":          50_000_000,
  "blackrock-main":       30_000_000,
  "gs-trading":           40_000_000,
  "stanford-ai-lab":      10_000_000,
  "khan-academy":         15_000_000,
  "northrop-skunkworks":  20_000_000,
  "dev-sandbox":           1_000_000,
};

const DEFAULT_MONTHLY_CAP = 1_000_000;

/** Redis key TTL for the monthly counter — 62 days covers any billing quirks */
const COUNTER_TTL_SECONDS = 62 * 24 * 60 * 60;

/** Thresholds that trigger alerts, in ascending order */
const ALERT_THRESHOLDS = [80, 90, 100] as const;
type AlertThreshold = typeof ALERT_THRESHOLDS[number];

// ----------------------------------------------------------------
// REDIS CLIENT
// ----------------------------------------------------------------
// Reuses the same REDIS_URL env var as the semantic cache (cache.ts).
// We maintain a SEPARATE client instance so quota tracking Redis I/O
// is never pipelined ahead of or behind cache operations.
// ----------------------------------------------------------------

let quotaRedisClient: Redis | null = null;
let quotaConnectAttempted = false;

function getQuotaRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    if (!quotaConnectAttempted) {
      console.warn("[V57:QuotaManager] REDIS_URL not set — quota tracking disabled.");
      quotaConnectAttempted = true;
    }
    return null;
  }

  if (quotaRedisClient) return quotaRedisClient;

  quotaConnectAttempted = true;

  try {
    quotaRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => {
        if (times > 2) return null; // stop retrying
        return Math.min(times * 150, 600);
      },
      connectTimeout: 4000,
      commandTimeout: 2000,
      lazyConnect: false,
      enableOfflineQueue: false,
    } satisfies RedisOptions);

    quotaRedisClient.on("connect", () => {
      console.log("[V57:QuotaManager] ✅ Redis connected — quota tracking active");
    });

    quotaRedisClient.on("error", (err: Error) => {
      console.warn(`[V57:QuotaManager] Redis error (non-fatal): ${err.message}`);
    });

    quotaRedisClient.on("close", () => {
      console.warn("[V57:QuotaManager] Redis connection closed — quota tracking inactive");
      quotaRedisClient = null;
    });

  } catch (err) {
    console.warn("[V57:QuotaManager] Failed to initialize Redis client:", (err as Error).message);
    return null;
  }

  return quotaRedisClient;
}

// ----------------------------------------------------------------
// KEY BUILDERS
// ----------------------------------------------------------------

function buildCounterKey(tenantId: string, billingPeriod: string): string {
  return `quota:tokens:${tenantId}:${billingPeriod}`;
}

function buildAlertLockKey(tenantId: string, billingPeriod: string, threshold: AlertThreshold): string {
  return `quota:alerts:${tenantId}:${billingPeriod}:${threshold}`;
}

// ----------------------------------------------------------------
// CORE: INCREMENT TOKEN COUNT
// ----------------------------------------------------------------

/**
 * Atomically increments the tenant's monthly token counter in Redis.
 *
 * After incrementing, a fully non-blocking background task fires
 * threshold checks and dispatches alerts — zero latency added to
 * the caller's critical path.
 *
 * @param tenantId       - Tenant identifier
 * @param tokensConsumed - Tokens used in this single execution
 * @returns The new cumulative token total, or null if Redis unavailable
 */
export async function incrementTenantTokens(
  tenantId:       string,
  tokensConsumed: number
): Promise<number | null> {
  const redis = getQuotaRedis();
  if (!redis) return null;

  const billingPeriod = getBillingPeriod();
  const counterKey    = buildCounterKey(tenantId, billingPeriod);

  let newTotal: number;

  try {
    // INCRBY is atomic — no race conditions in concurrent environments
    newTotal = await redis.incrby(counterKey, tokensConsumed);

    // Set TTL on first increment (INCRBY creates the key if absent)
    if (newTotal === tokensConsumed) {
      // Key was just created — set expiry
      await redis.expire(counterKey, COUNTER_TTL_SECONDS);
    }

    console.info(
      `[V57:QuotaManager] Tenant=${tenantId} monthly_tokens=${newTotal.toLocaleString()} ` +
      `(+${tokensConsumed}) period=${billingPeriod}`
    );
  } catch (err) {
    // Redis failure must NEVER block the AI response
    console.warn(
      `[V57:QuotaManager] Token increment failed (non-fatal): ` +
      `tenant=${tenantId} error="${(err as Error).message}"`
    );
    return null;
  }

  Promise.resolve().then(() =>
    checkAndFireAlerts(tenantId, newTotal, billingPeriod)
  ).catch((err: unknown) => {
    // Belt-and-suspenders: catch any unexpected error from async chain
    console.warn(
      `[V63:AlertEngine] Background alert check threw unexpectedly: ` +
      `${(err as Error)?.message ?? String(err)}`
    );
  });

  // ---- [V90] Metered Billing Report ----
  void reportUsage(tenantId, tokensConsumed);

  return newTotal;
}

// ----------------------------------------------------------------
// CORE: THRESHOLD CHECK & ALERT DISPATCH
// ----------------------------------------------------------------

/**
 * Evaluates whether the new token total crosses any alert threshold.
 * For each triggered threshold, checks the Redis alert lock —
 * if absent, fires the alert and sets the lock.
 *
 * This function is ALWAYS called asynchronously (floating Promise).
 * It must NEVER be awaited on the hot path.
 *
 * @param tenantId      - Tenant identifier
 * @param newTotal      - Fresh cumulative total after this execution
 * @param billingPeriod - YYYY-MM billing period string
 */
async function checkAndFireAlerts(
  tenantId:      string,
  newTotal:      number,
  billingPeriod: string
): Promise<void> {
  const redis = getQuotaRedis();
  if (!redis) return;

  const monthlyCap  = TENANT_MONTHLY_CAPS[tenantId] ?? DEFAULT_MONTHLY_CAP;
  const burnPercent = (newTotal / monthlyCap) * 100;

  // Evaluate thresholds in descending order of severity so that if
  // a tenant jumps from 79% → 101% in one call, all three fire.
  // We process highest-severity first to get the most critical alert
  // dispatched earliest.
  for (const threshold of [100, 90, 80] as const) {
    if (burnPercent < threshold) continue;

    const lockKey   = buildAlertLockKey(tenantId, billingPeriod, threshold);
    const lockTtl   = secondsUntilEndOfMonth();

    try {
      // NX = only set if key does not exist (atomic check-and-set)
      // EX = TTL in seconds — expires at end of billing month
      const wasSet = await redis.set(lockKey, "1", "EX", lockTtl, "NX");

      if (wasSet === "OK") {
        // Lock was freshly acquired — this is the FIRST alert for this
        // tenant + threshold + billing period. Fire the notification.
        console.info(
          `[V63:AlertEngine] 🔔 Alert lock acquired: ` +
          `tenant=${tenantId} threshold=${threshold}% ttl=${lockTtl}s`
        );

        // dispatchQuotaAlert is itself async but we don't await it here —
        // errors are caught inside dispatchQuotaAlert and demoted to warnings.
        dispatchQuotaAlert(tenantId, newTotal, monthlyCap, threshold).catch(
          (err: unknown) => console.warn(
            `[V63:AlertEngine] dispatchQuotaAlert threw: ${(err as Error)?.message ?? String(err)}`
          )
        );
      } else {
        // Lock already exists — alert was already fired this billing cycle.
        console.debug(
          `[V63:AlertEngine] Alert lock already set — suppressing duplicate ` +
          `tenant=${tenantId} threshold=${threshold}% period=${billingPeriod}`
        );
      }
    } catch (err) {
      // Redis error during lock check — skip this threshold, don't block
      console.warn(
        `[V63:AlertEngine] Lock check failed (non-fatal): ` +
        `tenant=${tenantId} threshold=${threshold}% error="${(err as Error).message}"`
      );
    }
  }
}

// ----------------------------------------------------------------
// INTROSPECTION (admin/metrics use)
// ----------------------------------------------------------------

/**
 * Returns the current monthly token total and burn percentage for a tenant.
 * Used by admin routes for real-time quota dashboards.
 *
 * @returns { currentTokens, monthlyCap, burnPercent } or null if unavailable
 */
export async function getTenantQuotaStatus(tenantId: string): Promise<{
  tenantId:      string;
  billingPeriod: string;
  currentTokens: number;
  monthlyCap:    number;
  burnPercent:   number;
  alertsFired:   Record<AlertThreshold, boolean>;
} | null> {
  const redis = getQuotaRedis();
  if (!redis) return null;

  const billingPeriod = getBillingPeriod();
  const counterKey    = buildCounterKey(tenantId, billingPeriod);
  const monthlyCap    = TENANT_MONTHLY_CAPS[tenantId] ?? DEFAULT_MONTHLY_CAP;

  try {
    const rawTotal = await redis.get(counterKey);
    const currentTokens = rawTotal ? parseInt(rawTotal, 10) : 0;
    const burnPercent   = parseFloat(((currentTokens / monthlyCap) * 100).toFixed(2));

    // Check each alert lock status
    const alertsFired = {} as Record<AlertThreshold, boolean>;
    for (const threshold of ALERT_THRESHOLDS) {
      const lockKey = buildAlertLockKey(tenantId, billingPeriod, threshold);
      const lockVal = await redis.get(lockKey);
      alertsFired[threshold] = lockVal !== null;
    }

    return {
      tenantId,
      billingPeriod,
      currentTokens,
      monthlyCap,
      burnPercent,
      alertsFired,
    };
  } catch (err) {
    console.warn(
      `[V57:QuotaManager] Status fetch failed: tenant=${tenantId} ` +
      `error="${(err as Error).message}"`
    );
    return null;
  }
}

/**
 * Returns all monthly caps registered in this service instance.
 * Useful for admin dashboards to display tenant configurations.
 */
export function getAllMonthlyCaps(): Record<string, number> {
  return { ...TENANT_MONTHLY_CAPS };
}

/**
 * V56: Checks if the Iron Curtain has locked out this tenant (e.g. via billing webhook).
 * Fails open if Redis is unavailable.
 */
export async function isTenantRestricted(tenantId: string): Promise<boolean> {
  const redis = getQuotaRedis();
  if (!redis) return false;
  try {
    const status = await redis.get(`tenant_status:${tenantId.trim().toLowerCase()}`);
    return status === "RESTRICTED";
  } catch (err) {
    return false; // Fail open
  }
}

// ----------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ----------------------------------------------------------------

/**
 * Closes the quota Redis connection gracefully.
 * Call alongside closeCacheConnection() from SIGTERM handler.
 */
export async function closeQuotaConnection(): Promise<void> {
  if (quotaRedisClient) {
    await quotaRedisClient.quit();
    quotaRedisClient = null;
    console.log("[V57:QuotaManager] Redis connection closed gracefully.");
  }
}
