/**
 * @file cache.ts
 * @service router-service
 * @description Semantic Cache Bolt — Redis-backed prompt response cache.
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 *
 *  LLM API calls are expensive (latency + cost). Identical or
 *  semantically-equivalent prompts routed to the same model
 *  should return the same output. This module implements a
 *  content-addressed cache using SHA-256 of the prompt + model
 *  as the cache key.
 *
 * ================================================================
 * CACHE KEY DESIGN
 * ================================================================
 *
 *  Key format:  "cache:<sha256(provider:model:prompt)>"
 *
 *  The key incorporates:
 *    • provider (openai / anthropic) — same prompt to different
 *      providers produces different outputs
 *    • model (gpt-4o / claude-3-5-sonnet-20241022) — same prompt
 *      to different model versions produces different outputs
 *    • prompt — the actual input text (after system prefix injection)
 *
 *  This ensures cache entries are scoped to the exact execution
 *  configuration and never produce cross-model contamination.
 *
 * ================================================================
 * CACHE HIT FLOW
 * ================================================================
 *
 *   1. Caller invokes getCachedResponse(provider, model, prompt)
 *   2. SHA-256 hash computed (synchronous, ~50μs)
 *   3. Redis GET "cache:<hash>"
 *   4a. HIT  → return parsed JSON immediately (0 LLM latency)
 *   4b. MISS → caller executes LLM, calls setCachedResponse(...)
 *   5. Redis SET "cache:<hash>" with TTL_SECONDS (default 24h)
 *
 * ================================================================
 * CACHE INVALIDATION
 * ================================================================
 *
 *  The cache uses a 24-hour TTL (configurable via CACHE_TTL_SECONDS).
 *  There is no manual invalidation — expired entries are removed
 *  automatically by Redis. Redis is configured with maxmemory-policy
 *  allkeys-lru so high-frequency prompts stay warm and cold entries
 *  are evicted first.
 *
 *  To manually invalidate all cache entries (e.g. after model fine-tuning):
 *    redis-cli SCAN 0 MATCH "cache:*" | xargs redis-cli DEL
 *
 * ================================================================
 * SECURITY
 * ================================================================
 *
 *  • Cache values store ONLY the raw LLM output string, never the
 *    original prompt or user_id — minimizing what a Redis compromise exposes.
 *  • Enterprise mode (sanitized prompts): the hashed cache key is based
 *    on the SANITIZED prompt, not the original. This ensures PII is
 *    never written to Redis as part of the cache key construction.
 *  • Redis is on the private backend-tier network (not exposed to host).
 *
 * ================================================================
 */

import { createHash } from "node:crypto";
import { Redis, type RedisOptions } from "ioredis";

// ================================================================
// CONFIG
// ================================================================

const CACHE_ENABLED =
  process.env.CACHE_ENABLED !== "false"; // defaults true

const TTL_SECONDS = parseInt(
  process.env.CACHE_TTL_SECONDS ?? String(24 * 60 * 60), // 24 hours
  10
);

const CACHE_KEY_PREFIX = "cache:";

// ================================================================
// REDIS CLIENT
// Lazily initialized — only connects if REDIS_URL is set.
// Using a module-level singleton to reuse the connection pool.
// ================================================================

let redisClient: Redis | null = null;
let connectAttempted = false;

/**
 * Returns the Redis client, initializing it on first call.
 * Returns null if:
 *   - CACHE_ENABLED=false
 *   - REDIS_URL is not set
 *   - Previous connection attempt failed
 */
function getRedisClient(): Redis | null {
  if (!CACHE_ENABLED) return null;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (!connectAttempted) {
      console.warn("[SemanticCache] REDIS_URL not set — cache disabled. Set REDIS_URL to enable.");
      connectAttempted = true;
    }
    return null;
  }

  if (redisClient) return redisClient;

  connectAttempted = true;

  try {
    redisClient = new Redis(redisUrl, {
      // Retry up to 3 times with 200ms backoff — then give up
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn(`[SemanticCache] Redis connection failed after ${times} retries — cache disabled.`);
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      connectTimeout: 5000,
      commandTimeout: 3000,
      lazyConnect: false,
      enableOfflineQueue: false, // drop commands immediately if disconnected
    } satisfies RedisOptions);

    redisClient.on("connect", () => {
      console.log("[SemanticCache] ✅ Redis connected — semantic cache active");
    });

    redisClient.on("error", (err: Error) => {
      // Log but don't crash — cache is non-critical infrastructure
      console.warn(`[SemanticCache] Redis error (non-fatal): ${err.message}`);
    });

    redisClient.on("close", () => {
      console.warn("[SemanticCache] Redis connection closed — cache inactive");
      redisClient = null; // reset so reconnect is attempted on next request
    });
  } catch (err) {
    console.warn("[SemanticCache] Failed to initialize Redis client:", (err as Error).message);
    return null;
  }

  return redisClient;
}

// ================================================================
// CACHE KEY GENERATION
// ================================================================

/**
 * Generates a deterministic SHA-256 cache key for a given
 * provider + model + prompt combination.
 *
 * The key is prefixed with "cache:" for Redis namespace isolation
 * and easy bulk deletion: SCAN 0 MATCH "cache:*"
 */
export function buildCacheKey(
  provider: string,
  model: string,
  prompt: string
): string {
  const fingerprint = `${provider}:${model}:${prompt}`;
  const hash = createHash("sha256").update(fingerprint, "utf8").digest("hex");
  return `${CACHE_KEY_PREFIX}${hash}`;
}

// ================================================================
// CACHE READ
// ================================================================

/**
 * Attempts to retrieve a cached LLM output for the given inputs.
 *
 * @returns The cached raw output string, or null on miss/error.
 *
 * Cache misses and Redis errors both return null (transparent fallback).
 * The caller should always be prepared to call the LLM on null return.
 */
export async function getCachedResponse(
  provider: string,
  model: string,
  prompt: string
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const key = buildCacheKey(provider, model, prompt);

  try {
    const cached = await redis.get(key);

    if (cached !== null) {
      console.log(
        `[SemanticCache] ✨ Cache HIT — key=${key.slice(0, 24)}... ` +
        `[${provider}/${model}] len=${cached.length}`
      );
      return cached;
    }

    console.log(
      `[SemanticCache] Cache MISS — key=${key.slice(0, 24)}... [${provider}/${model}]`
    );
    return null;
  } catch (err) {
    // Cache failure must NEVER break an LLM execution
    console.warn(`[SemanticCache] GET failed (non-fatal): ${(err as Error).message}`);
    return null;
  }
}

// ================================================================
// CACHE WRITE
// ================================================================

/**
 * Stores a raw LLM output string in Redis with the configured TTL.
 *
 * Called after a successful LLM response that should be cached.
 * Fire-and-forget safe — errors are logged but not re-thrown.
 *
 * @param provider    - LLM provider (openai / anthropic)
 * @param model       - Model name (gpt-4o / claude-3-5-sonnet-20241022)
 * @param prompt      - The prompt sent to the LLM (SANITIZED if enterprise_mode)
 * @param rawOutput   - The raw string response from the LLM
 */
export async function setCachedResponse(
  provider: string,
  model: string,
  prompt: string,
  rawOutput: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const key = buildCacheKey(provider, model, prompt);

  try {
    // EX = expiry in seconds (TTL)
    await redis.set(key, rawOutput, "EX", TTL_SECONDS);
    console.log(
      `[SemanticCache] 💾 Cached — key=${key.slice(0, 24)}... ` +
      `TTL=${TTL_SECONDS}s [${provider}/${model}]`
    );
  } catch (err) {
    // Non-fatal — the LLM result is still returned to the caller;
    // it just won't be cached for future requests
    console.warn(`[SemanticCache] SET failed (non-fatal): ${(err as Error).message}`);
  }
}

// ================================================================
// CACHE STATS (for health/metrics endpoint)
// ================================================================

/**
 * Returns basic cache statistics (key count and memory info).
 * Used by the Router Service health endpoint for observability.
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  key_count: number | null;
  used_memory_human: string | null;
  ttl_seconds: number;
  enabled: boolean;
}> {
  const redis = getRedisClient();

  if (!redis) {
    return { connected: false, key_count: null, used_memory_human: null, ttl_seconds: TTL_SECONDS, enabled: CACHE_ENABLED };
  }

  try {
    const [keyCount, info] = await Promise.all([
      redis.dbsize(),
      redis.info("memory"),
    ]);

    const memMatch = /used_memory_human:([^\r\n]+)/.exec(info);
    const usedMemoryHuman = memMatch?.[1]?.trim() ?? null;

    return {
      connected: true,
      key_count: keyCount,
      used_memory_human: usedMemoryHuman,
      ttl_seconds: TTL_SECONDS,
      enabled: CACHE_ENABLED,
    };
  } catch {
    return { connected: false, key_count: null, used_memory_human: null, ttl_seconds: TTL_SECONDS, enabled: CACHE_ENABLED };
  }
}

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

/**
 * Closes the Redis connection gracefully.
 * Call this from the Router Service's SIGTERM handler.
 */
export async function closeCacheConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("[SemanticCache] Redis connection closed gracefully.");
  }
}
