/**
 * @file firewallGuard.ts
 * @service router-service
 * @phase Phase 3.2 — Sentinel-02: The Enforcer
 * @description
 *   Express middleware that checks every incoming request's IP against
 *   `firewall_blacklist`. If the IP has an active, non-expired, non-unblocked
 *   entry, the request is rejected with 403 Forbidden BEFORE any route
 *   handler, auth, or proxy logic runs.
 *
 * Performance architecture:
 *   - Uses the SHARED router-service `pool` from db.ts (same pool used by
 *     routes.ts and sovereignty.ts — no extra connections needed).
 *   - A Redis-backed "hot cache" short-circuits the DB lookup for the
 *     common case (not blocked). Cache TTL = 60 seconds. If Redis is
 *     unavailable, the guard falls back to a direct DB query — fail-open
 *     is intentional: a Redis outage must not DDoS the DB.
 *   - The guard is FAIL-OPEN: if the DB is unreachable (network blip),
 *     the request is allowed through and an error is logged. Blocking
 *     all traffic due to a DB transient is worse than missing one request.
 *
 * Mount position in index.ts:
 *   After traceProviderMiddleware (so traceId is set),
 *   Before ALL route handlers and rate limiters.
 */

import { Request, Response, NextFunction } from "express";
import { pool } from "../db.js";

// ── Redis hot-cache (optional, fail-open) ─────────────────────────────────────

let _redisClient: import("ioredis").Redis | null = null;

function getRedis(): import("ioredis").Redis | null {
  if (_redisClient) return _redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { Redis } = require("ioredis") as typeof import("ioredis");
    _redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout:       2000,
      commandTimeout:       500,
      lazyConnect:          false,
      enableOfflineQueue:   false,
    });
    _redisClient.on("error", (e: Error) =>
      console.debug("[FirewallGuard:Redis] Non-fatal:", e.message)
    );
    _redisClient.on("close", () => { _redisClient = null; });
    return _redisClient;
  } catch {
    return null;
  }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 60;

/** Key pattern: fw:blocked:<ip>  → "1" if blocked, "0" if clean */
function cacheKey(ip: string) { return `fw:blocked:${ip}`; }

async function getCachedStatus(ip: string): Promise<"blocked" | "clean" | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    const val = await r.get(cacheKey(ip));
    if (val === "1") return "blocked";
    if (val === "0") return "clean";
    return null;
  } catch {
    return null;
  }
}

async function setCachedStatus(ip: string, blocked: boolean): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.setex(cacheKey(ip), CACHE_TTL_SECONDS, blocked ? "1" : "0");
  } catch { /* non-fatal */ }
}

/** Immediately invalidate cache for an IP (called after Manual Override unblock) */
export async function invalidateFirewallCache(ip: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.del(cacheKey(ip));
  } catch { /* non-fatal */ }
}

// ── DB lookup ─────────────────────────────────────────────────────────────────

const CHECK_BLOCKED_SQL = `
  SELECT id, reason, expires_at::TEXT
  FROM firewall_blacklist
  WHERE
    ip_address   = $1::INET
    AND unblocked_at IS NULL
    AND expires_at   > NOW()
  LIMIT 1;
`;

interface BlockRecord {
  id:         string;
  reason:     string;
  expires_at: string;
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Firewall Guard — MUST be mounted before all route handlers.
 *
 * Mount in index.ts immediately after traceProviderMiddleware:
 *   import { firewallGuard } from "./middleware/firewallGuard.js";
 *   app.use(firewallGuard);
 */
export async function firewallGuard(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  // Extract client IP (trust proxy header if set)
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    req.ip;

  if (!ip) {
    // No IP determinable — fail open
    next();
    return;
  }

  try {
    // ── 1. Redis hot-cache check (< 1 ms) ─────────────────────────────────
    const cached = await getCachedStatus(ip);

    if (cached === "clean") {
      next();
      return;
    }

    if (cached === "blocked") {
      res.status(403).json({
        success: false,
        error: {
          code:    "IP_BLOCKED",
          message: "Your IP address has been blocked by the StreetMP Sentinel firewall.",
        },
      });
      return;
    }

    // ── 2. DB lookup (cache miss) ─────────────────────────────────────────
    const { rows } = await pool.query<BlockRecord>(CHECK_BLOCKED_SQL, [ip]);

    if (rows.length > 0) {
      const block = rows[0];
      // Write back to cache before responding
      await setCachedStatus(ip, true);

      console.warn(
        `[FirewallGuard] 🚫 BLOCKED ${ip} — reason: "${block.reason}" — expires: ${block.expires_at}`
      );

      res.status(403).json({
        success: false,
        error: {
          code:    "IP_BLOCKED",
          message: "Your IP address has been blocked by the StreetMP Sentinel firewall.",
          expires: block.expires_at,
        },
      });
      return;
    }

    // IP is clean — cache and continue
    await setCachedStatus(ip, false);
    next();
  } catch (err) {
    // FAIL-OPEN: DB/Redis error must not block all traffic
    console.error("[FirewallGuard] DB lookup failed (fail-open):", (err as Error).message);
    next();
  }
}
