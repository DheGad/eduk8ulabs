/**
 * @file redisClient.ts
 * @service router-service
 * @version Phase1-INFRA-01
 * @description Shared Redis singleton — session store & rate-limiter backend.
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 *
 *  This module exports ONE shared Redis client used by:
 *
 *    1. Rate-limiter store (express-rate-limit + rate-limit-redis)
 *       → Distributes rate-limit counters across all router-service
 *         instances, preventing bypass via round-robin DNS.
 *
 *    2. Session / JWT revocation store
 *       → Allows instant session invalidation without DB queries
 *         (key: session:<jti>, value: "revoked", TTL=token_exp)
 *
 *    3. Semantic cache (cache.ts) — re-exported for convenience;
 *       cache.ts still manages its own lazy init but can be
 *       migrated to consume this shared client in a future pass.
 *
 * ================================================================
 * FAIL-SAFE DESIGN
 * ================================================================
 *
 *  • Redis is non-critical infrastructure. If it is unavailable:
 *      - Rate limiting falls back to in-memory (single-instance safe)
 *      - Session revocation calls become no-ops (JWT still expires naturally)
 *  • All operations are wrapped in try/catch — Redis errors NEVER
 *    propagate to the HTTP response layer.
 *  • Connection is established lazily on first use; the HTTP server
 *    starts even if Redis is offline.
 *
 * ================================================================
 * CONFIGURATION
 * ================================================================
 *
 *  REDIS_URL          — Connection string (e.g. redis://localhost:6379)
 *                       Required to enable Redis-backed features.
 *  REDIS_PASSWORD     — Optional password (used if not embedded in URL)
 *  REDIS_KEY_PREFIX   — Namespace prefix (default: "streetmp:")
 *  REDIS_CONNECT_TIMEOUT_MS  — Connection timeout in ms (default: 5000)
 *  REDIS_COMMAND_TIMEOUT_MS  — Per-command timeout in ms (default: 2000)
 *
 * ================================================================
 */

import { Redis, type RedisOptions } from "ioredis";

// ──────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────

const REDIS_URL              = process.env.REDIS_URL ?? "";
const REDIS_PASSWORD         = process.env.REDIS_PASSWORD ?? undefined;
const KEY_PREFIX             = process.env.REDIS_KEY_PREFIX ?? "streetmp:";
const CONNECT_TIMEOUT_MS     = parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "5000",  10);
const COMMAND_TIMEOUT_MS     = parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS ?? "2000",  10);
const MAX_RETRIES            = 3;

// ──────────────────────────────────────────────────────────────────
// SINGLETON STATE
// ──────────────────────────────────────────────────────────────────

let _client: Redis | null = null;
let _initAttempted = false;
let _isReady = false;

// ──────────────────────────────────────────────────────────────────
// FACTORY
// ──────────────────────────────────────────────────────────────────

/**
 * Returns the shared Redis client, initialising it on first call.
 *
 * Returns null when:
 *   - REDIS_URL is not configured (Redis intentionally disabled)
 *   - A connection was previously attempted and permanently failed
 *
 * Always safe to call — never throws.
 */
export function getSharedRedisClient(): Redis | null {
  if (!REDIS_URL) {
    if (!_initAttempted) {
      console.warn(
        "[Phase1:RedisClient] REDIS_URL not set — Redis-backed features " +
        "(distributed rate-limiting, session revocation) are disabled. " +
        "Set REDIS_URL=redis://localhost:6379 to enable."
      );
      _initAttempted = true;
    }
    return null;
  }

  if (_client) return _client;
  if (_initAttempted && !_client) return null; // permanent failure, don't retry

  _initAttempted = true;

  try {
    const opts: RedisOptions = {
      // ── Connection ───────────────────────────────────────────────
      connectTimeout: CONNECT_TIMEOUT_MS,
      commandTimeout: COMMAND_TIMEOUT_MS,
      lazyConnect:    false, // Connect immediately so failures surface early
      enableOfflineQueue: false, // Drop commands if disconnected rather than queue forever

      // ── Retry strategy ──────────────────────────────────────────
      maxRetriesPerRequest: MAX_RETRIES,
      retryStrategy: (times: number) => {
        if (times > MAX_RETRIES) {
          console.error(
            `[Phase1:RedisClient] ❌ Redis permanently unreachable after ${times} retries. ` +
            `Falling back to in-memory rate-limiting.`
          );
          return null; // stop retrying
        }
        const delay = Math.min(times * 300, 2000);
        console.warn(`[Phase1:RedisClient] Retrying connection in ${delay}ms (attempt ${times})...`);
        return delay;
      },

      // ── Auth ────────────────────────────────────────────────────
      ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),

      // ── Namespace isolation ────────────────────────────────────
      keyPrefix: KEY_PREFIX,
    };

    _client = new Redis(REDIS_URL, opts);

    // ── Event listeners ─────────────────────────────────────────
    _client.on("connect", () => {
      _isReady = true;
      console.log("[Phase1:RedisClient] ✅ Redis connected — distributed rate-limiting active");
    });

    _client.on("ready", () => {
      _isReady = true;
      console.log("[Phase1:RedisClient] ✅ Redis ready");
    });

    _client.on("error", (err: Error) => {
      // Non-fatal — rate-limiting falls back to in-memory
      console.warn(`[Phase1:RedisClient] Redis error (non-fatal): ${err.message}`);
    });

    _client.on("close", () => {
      _isReady = false;
      console.warn("[Phase1:RedisClient] Redis connection closed");
    });

    _client.on("reconnecting", () => {
      console.warn("[Phase1:RedisClient] Redis reconnecting...");
    });

    _client.on("end", () => {
      _isReady = false;
      _client = null; // Allow re-init on next call after permanent disconnect
      console.warn("[Phase1:RedisClient] Redis connection ended — will not retry further");
    });

  } catch (err) {
    console.error(
      `[Phase1:RedisClient] Failed to create Redis client: ${(err as Error).message}. ` +
      `Falling back to in-memory rate-limiting.`
    );
    _client = null;
  }

  return _client;
}

// ──────────────────────────────────────────────────────────────────
// HEALTH CHECK HELPER
// ──────────────────────────────────────────────────────────────────

/** Returns true if the Redis client is connected and ready. */
export function isRedisReady(): boolean {
  return _isReady && _client !== null;
}

/**
 * Returns a basic Redis health snapshot for the /health endpoint.
 */
export async function getRedisHealthSnapshot(): Promise<{
  connected:    boolean;
  key_prefix:   string;
  latency_ms:   number | null;
  server_info:  string | null;
}> {
  const client = getSharedRedisClient();

  if (!client) {
    return { connected: false, key_prefix: KEY_PREFIX, latency_ms: null, server_info: null };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latency_ms = Date.now() - start;

    const info = await client.info("server");
    const versionMatch = /redis_version:([^\r\n]+)/.exec(info);
    const server_info = versionMatch ? `Redis ${versionMatch[1].trim()}` : "Redis (version unknown)";

    return { connected: true, key_prefix: KEY_PREFIX, latency_ms, server_info };
  } catch {
    return { connected: false, key_prefix: KEY_PREFIX, latency_ms: null, server_info: null };
  }
}

// ──────────────────────────────────────────────────────────────────
// SESSION REVOCATION HELPERS
// ──────────────────────────────────────────────────────────────────

/**
 * Marks a JWT `jti` (JWT ID) as revoked in Redis.
 * The TTL is set to match the token's remaining lifetime.
 *
 * @param jti       - JWT ID claim (unique per token)
 * @param ttlSeconds - Seconds until expiry (token's `exp` - now)
 */
export async function revokeSession(jti: string, ttlSeconds: number): Promise<void> {
  const client = getSharedRedisClient();
  if (!client) return; // No-op if Redis unavailable

  try {
    // Key: "streetmp:session:<jti>" — value "1" is a tombstone
    await client.set(`session:${jti}`, "1", "EX", Math.max(ttlSeconds, 1));
    console.info(`[Phase1:RedisClient] Session revoked: jti=${jti} ttl=${ttlSeconds}s`);
  } catch (err) {
    console.warn(`[Phase1:RedisClient] revokeSession failed (non-fatal): ${(err as Error).message}`);
  }
}

/**
 * Checks if a JWT `jti` has been revoked.
 *
 * @returns true if revoked (block the request), false if valid / Redis unavailable.
 */
export async function isSessionRevoked(jti: string): Promise<boolean> {
  const client = getSharedRedisClient();
  if (!client) return false; // Fail-open: Redis unavailable → allow (JWT still validates)

  try {
    const val = await client.get(`session:${jti}`);
    return val !== null;
  } catch (err) {
    console.warn(`[Phase1:RedisClient] isSessionRevoked failed (non-fatal): ${(err as Error).message}`);
    return false; // Fail-open
  }
}

// ──────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ──────────────────────────────────────────────────────────────────

/**
 * Closes the shared Redis connection gracefully.
 * Call from the SIGTERM handler in index.ts.
 */
export async function closeSharedRedisClient(): Promise<void> {
  if (_client) {
    try {
      await _client.quit();
      console.log("[Phase1:RedisClient] Redis connection closed gracefully.");
    } catch {
      // Non-fatal on shutdown
    } finally {
      _client  = null;
      _isReady = false;
    }
  }
}
