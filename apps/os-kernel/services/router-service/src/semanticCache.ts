/**
 * @file semanticCache.ts
 * @service router-service
 * @version V64
 * @description Semantic Cache — Tenant-Isolated Prompt Response Cache (Profit Engine)
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 *
 *  Identical LLM calls are expensive ($) and slow (latency).
 *  This module intercepts repeated prompts and returns sub-50ms
 *  responses from Redis, bypassing OpenAI/Anthropic entirely.
 *
 *  Every cache key is scoped to (tenantId + model + sanitizedPrompt)
 *  so Company A can NEVER receive Company B's cached answer.
 *  Cross-tenant cache bleed is architecturally impossible.
 *
 * ================================================================
 * CACHE KEY DESIGN (V64)
 * ================================================================
 *
 *  Key format: "sc:<sha256(tenantId:model:sanitizedPrompt)>"
 *
 *  The fingerprint incorporates:
 *    • tenantId      — strict tenant boundary enforcement
 *    • model         — GPT-4o and GPT-4o-mini must not share entries
 *    • sanitizedPrompt — the PII-scrubbed prompt (never raw user input)
 *
 *  "sc:" prefix (semantic cache) namespaces entries away from the
 *  legacy "cache:" prefix used in the V1 cache.ts module.
 *
 * ================================================================
 * TTL STRATEGY
 * ================================================================
 *
 *  Default: 86400 seconds (24 hours)
 *  Override: SEMANTIC_CACHE_TTL_SECONDS env var (max recommended: 172800 / 48h)
 *
 *  24h is the sweet spot:
 *    - Long enough to capture repeated intra-day queries
 *    - Short enough that model knowledge doesn't go stale
 *    - Aligned with most LLM providers' rate-limit windows
 *
 * ================================================================
 * CACHE HIT RESPONSE HEADER
 * ================================================================
 *
 *  On a HIT, routes.ts MUST set:
 *    res.setHeader("x-streetmp-cache", "HIT")
 *
 *  This signals to the caller (and monitoring) that no LLM was
 *  invoked and the response was served from the cache tier.
 *  MISS responses carry no such header (absence = MISS).
 *
 * ================================================================
 * FAIL-OPEN CONTRACT
 * ================================================================
 *
 *  Redis is treated as non-critical. If it's down:
 *    • getCachedEntry() returns null (transparent MISS)
 *    • setCachedEntry() silently no-ops
 *    • The LLM execution always proceeds — cache failure must
 *      NEVER block a user from getting their AI response.
 *
 * ================================================================
 * SECURITY
 * ================================================================
 *
 *  • Redis stores ONLY the final restored LLM output string.
 *    Raw prompts, user IDs, and PII tokens are NEVER persisted.
 *  • The cache key is a one-way SHA-256 hash — it leaks nothing
 *    about the prompt content if Redis is compromised.
 *  • tenantId is embedded in the hash pre-image, not as a
 *    plaintext Redis key segment — internal routing is opaque.
 *
 * ================================================================
 */

import { createHash } from "node:crypto";
import { Redis, type RedisOptions } from "ioredis";

// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------

const CACHE_ENABLED = process.env.SEMANTIC_CACHE_ENABLED !== "false"; // defaults true

/**
 * Default TTL: 24 hours.
 * Set SEMANTIC_CACHE_TTL_SECONDS in env to override (max: 172800 = 48h).
 */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 86400

export const SEMANTIC_CACHE_TTL = (() => {
  const raw = parseInt(process.env.SEMANTIC_CACHE_TTL_SECONDS ?? String(DEFAULT_TTL_SECONDS), 10);
  if (isNaN(raw) || raw <= 0) return DEFAULT_TTL_SECONDS;
  // Cap at 48 hours to prevent permanently stale knowledge
  return Math.min(raw, 172_800);
})();

/** Namespace prefix — distinct from legacy "cache:" prefix in cache.ts */
const KEY_PREFIX = "sc:";

// ----------------------------------------------------------------
// REDIS CLIENT
// ----------------------------------------------------------------
// Dedicated ioredis singleton for the V64 semantic cache.
// Reuses REDIS_URL (same instance as the cache.ts and quotaManager.ts).
// Keeping a separate client reference gives us clean graceful-shutdown
// control and avoids cross-module pipeline interference.
// ----------------------------------------------------------------

let scRedisClient: Redis | null = null;
let scConnectAttempted = false;

function getScRedis(): Redis | null {
  if (!CACHE_ENABLED) return null;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (!scConnectAttempted) {
      console.warn(
        "[V64:SemanticCache] REDIS_URL not set — semantic cache disabled. " +
        "Set REDIS_URL to enable sub-50ms prompt serving."
      );
      scConnectAttempted = true;
    }
    return null;
  }

  if (scRedisClient) return scRedisClient;

  scConnectAttempted = true;

  try {
    scRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn(`[V64:SemanticCache] Redis connection failed after ${times} retries — cache disabled.`);
          return null;
        }
        return Math.min(times * 200, 1000);
      },
      connectTimeout: 5000,
      commandTimeout: 3000,
      lazyConnect: false,
      enableOfflineQueue: false, // drop commands immediately if disconnected
    } satisfies RedisOptions);

    scRedisClient.on("connect", () => {
      console.log(
        `[V64:SemanticCache] ✅ Redis connected — ` +
        `tenant-isolated semantic cache active (TTL=${SEMANTIC_CACHE_TTL}s)`
      );
    });

    scRedisClient.on("error", (err: Error) => {
      // Cache failure must NEVER crash the process
      console.warn(`[V64:SemanticCache] Redis error (non-fatal): ${err.message}`);
    });

    scRedisClient.on("close", () => {
      console.warn("[V64:SemanticCache] Redis connection closed — cache inactive");
      scRedisClient = null; // reset so reconnect is attempted on next request
    });
  } catch (err) {
    console.warn("[V64:SemanticCache] Failed to initialize Redis client:", (err as Error).message);
    return null;
  }

  return scRedisClient;
}

// ----------------------------------------------------------------
// KEY GENERATION
// ----------------------------------------------------------------

/**
 * Generates a deterministic, tenant-isolated SHA-256 cache key.
 *
 * The pre-image is `tenantId:model:sanitizedPrompt` — the tenantId
 * is the first segment so even a hash collision across prompts
 * cannot produce a cross-tenant key match.
 *
 * The key is safe to store in Redis: it reveals nothing about the
 * tenant, model selection, or prompt content.
 *
 * @param tenantId        - Tenant identifier (e.g. "jpmc-global")
 * @param model           - Exact model name (e.g. "gpt-4o-mini")
 * @param sanitizedPrompt - PII-scrubbed prompt (safePromptFinal in routes.ts)
 * @returns               - Redis key string: "sc:<sha256hex>"
 */
export function generateCacheKey(
  tenantId:        string,
  model:           string,
  sanitizedPrompt: string
): string {
  const fingerprint = `${tenantId}:${model}:${sanitizedPrompt}`;
  const hash        = createHash("sha256").update(fingerprint, "utf8").digest("hex");
  return `${KEY_PREFIX}${hash}`;
}

// ----------------------------------------------------------------
// CACHE READ
// ----------------------------------------------------------------

/**
 * Attempts to retrieve a cached LLM response for the given key.
 *
 * @param cacheKey - Pre-computed key from generateCacheKey()
 * @returns        - Cached response string, or null on MISS / Redis error
 *
 * Cache misses and Redis errors both return null — the caller should
 * always be prepared to invoke the LLM on a null response.
 */
export async function getCachedEntry(cacheKey: string): Promise<string | null> {
  const redis = getScRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get(cacheKey);

    if (cached !== null) {
      console.info(
        `[V64:SemanticCache] ⚡ Cache HIT — key=${cacheKey.slice(0, 28)}… ` +
        `len=${cached.length} chars`
      );
      return cached;
    }

    console.info(
      `[V64:SemanticCache] Cache MISS — key=${cacheKey.slice(0, 28)}…`
    );
    return null;
  } catch (err) {
    // Cache failure must NEVER break an LLM execution
    console.warn(
      `[V64:SemanticCache] GET failed (non-fatal): ${(err as Error).message}`
    );
    return null;
  }
}

// ----------------------------------------------------------------
// CACHE WRITE
// ----------------------------------------------------------------

/**
 * Persists an LLM response string in Redis with the given TTL.
 *
 * MUST be called fire-and-forget from routes.ts:
 *   void setCachedEntry(key, response, ttl)
 *
 * Errors are caught internally — this function must never throw
 * to the caller, even if Redis is unavailable.
 *
 * @param cacheKey - Pre-computed key from generateCacheKey()
 * @param response - Final restored LLM output (NEVER raw prompt or PII)
 * @param ttl      - TTL in seconds (defaults to SEMANTIC_CACHE_TTL)
 */
export async function setCachedEntry(
  cacheKey: string,
  response: string,
  ttl: number = SEMANTIC_CACHE_TTL
): Promise<void> {
  const redis = getScRedis();
  if (!redis) return;

  try {
    await redis.set(cacheKey, response, "EX", ttl);
    console.info(
      `[V64:SemanticCache] 💾 Cached — key=${cacheKey.slice(0, 28)}… ` +
      `TTL=${ttl}s len=${response.length} chars`
    );
  } catch (err) {
    // Non-fatal — the LLM result is still returned to the caller
    console.warn(
      `[V64:SemanticCache] SET failed (non-fatal): ${(err as Error).message}`
    );
  }
}

// ----------------------------------------------------------------
// CACHE STATS (admin / metrics endpoint)
// ----------------------------------------------------------------

/**
 * Returns diagnostic statistics for the V64 semantic cache layer.
 * Surfaced by admin routes for monitoring dashboards.
 */
export async function getSemanticCacheStats(): Promise<{
  connected:         boolean;
  key_count:         number | null;
  used_memory_human: string | null;
  ttl_seconds:       number;
  enabled:           boolean;
  prefix:            string;
}> {
  const redis = getScRedis();

  if (!redis) {
    return {
      connected:         false,
      key_count:         null,
      used_memory_human: null,
      ttl_seconds:       SEMANTIC_CACHE_TTL,
      enabled:           CACHE_ENABLED,
      prefix:            KEY_PREFIX,
    };
  }

  try {
    const [keyCount, info] = await Promise.all([
      redis.dbsize(),
      redis.info("memory"),
    ]);

    const memMatch        = /used_memory_human:([^\r\n]+)/.exec(info);
    const usedMemoryHuman = memMatch?.[1]?.trim() ?? null;

    return {
      connected:         true,
      key_count:         keyCount,
      used_memory_human: usedMemoryHuman,
      ttl_seconds:       SEMANTIC_CACHE_TTL,
      enabled:           CACHE_ENABLED,
      prefix:            KEY_PREFIX,
    };
  } catch {
    return {
      connected:         false,
      key_count:         null,
      used_memory_human: null,
      ttl_seconds:       SEMANTIC_CACHE_TTL,
      enabled:           CACHE_ENABLED,
      prefix:            KEY_PREFIX,
    };
  }
}

// ----------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ----------------------------------------------------------------

/**
 * Closes the semantic cache Redis connection gracefully.
 * Call from the SIGTERM handler alongside closeQuotaConnection().
 */
export async function closeSemanticCacheConnection(): Promise<void> {
  if (scRedisClient) {
    await scRedisClient.quit();
    scRedisClient = null;
    console.log("[V64:SemanticCache] Redis connection closed gracefully.");
  }
}
