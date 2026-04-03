/**
 * @file middleware/usageGuard.ts
 * @service router-service
 * @phase Phase 5 — Scale & API Marketplace
 * @description
 *   Usage Guard middleware — enforces per-org monthly execution quotas.
 *
 *   Mount on LLM execution routes ONLY (not health/auth/sentinel routes):
 *     app.post("/v1/chat/completions", usageGuard, ...otherMiddleware, handler);
 *
 *   Flow:
 *     1. Extract org_id from req.orgId (set by orgContextMiddleware Phase 4).
 *        If no org_id: fail-open (unauthenticated requests handled by API key guard).
 *     2. Call DB function `increment_org_execution(org_id)` — atomic counter.
 *     3. If is_limited = true → return HTTP 429 with Retry-After header.
 *     4. Append X-RateLimit-* headers on every response for client visibility.
 *
 *   Redis hot-cache:
 *     A "quota-blocked" flag is cached for 60 seconds so repeat requests
 *     from an over-quota org skip the DB call entirely (< 1 ms check).
 *     The cache is invalidated when Stripe webhook upgrades the plan.
 */

import { Request, Response, NextFunction } from "express";
import { pool } from "../db.js";

// ── Redis hot-cache (optional, fail-open) ─────────────────────────────────────

let _redis: import("ioredis").Redis | null = null;

function getRedis(): import("ioredis").Redis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { Redis } = require("ioredis") as typeof import("ioredis");
    _redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 500,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    _redis.on("error", () => undefined);
    _redis.on("close", () => { _redis = null; });
    return _redis;
  } catch {
    return null;
  }
}

const CACHE_TTL = 60; // seconds
const blockedKey = (orgId: string) => `quota:blocked:${orgId}`;

async function isCachedBlocked(orgId: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    return (await r.get(blockedKey(orgId))) === "1";
  } catch { return false; }
}

async function setCachedBlocked(orgId: string, blocked: boolean): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    if (blocked) {
      await r.setex(blockedKey(orgId), CACHE_TTL, "1");
    } else {
      await r.del(blockedKey(orgId));
    }
  } catch { /* non-fatal */ }
}

/** Call this after Stripe webhook upgrades a plan to immediately unblock */
export async function invalidateQuotaCache(orgId: string): Promise<void> {
  await setCachedBlocked(orgId, false);
}

// ── DB quota types ────────────────────────────────────────────────────────────

interface QuotaResult {
  executions:    number;
  monthly_limit: number;
  is_limited:    boolean;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function usageGuard(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  const orgId = req.orgId;

  // No org context → API key path manages its own limits; pass through
  if (!orgId) {
    next();
    return;
  }

  try {
    // ── 1. Redis hot-cache check ───────────────────────────────────────────
    if (await isCachedBlocked(orgId)) {
      res.setHeader("Retry-After", "3600");
      res.setHeader("X-RateLimit-Limit", "0");
      res.setHeader("X-RateLimit-Remaining", "0");
      res.status(429).json({
        success: false,
        error: {
          code:    "QUOTA_EXCEEDED",
          message: "Monthly execution limit reached. Upgrade your plan or wait for the next billing cycle.",
          upgrade_url: `${process.env.APP_URL ?? "https://os.streetmp.com"}/plans`,
        },
      });
      return;
    }

    // ── 2. Atomic DB increment ─────────────────────────────────────────────
    const { rows } = await pool.query<QuotaResult>(
      "SELECT executions, monthly_limit, is_limited FROM increment_org_execution($1::UUID)",
      [orgId]
    );

    const quota = rows[0];
    if (!quota) {
      // Failed to get quota row — fail-open
      next();
      return;
    }

    const remaining =
      quota.monthly_limit === -1
        ? 999999
        : Math.max(0, quota.monthly_limit - quota.executions);

    // Set rate-limit headers on all responses
    res.setHeader("X-RateLimit-Limit",     quota.monthly_limit === -1 ? "unlimited" : String(quota.monthly_limit));
    res.setHeader("X-RateLimit-Used",      String(quota.executions));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset",     "monthly");

    if (quota.is_limited) {
      // Cache the block and return 429
      void setCachedBlocked(orgId, true);

      console.warn(
        `[UsageGuard] ⛔ QUOTA_EXCEEDED — org: ${orgId} ` +
        `executions: ${quota.executions}/${quota.monthly_limit}`
      );

      res.setHeader("Retry-After", "3600");
      res.status(429).json({
        success: false,
        error: {
          code:        "QUOTA_EXCEEDED",
          message:     "Monthly execution limit reached. Upgrade your plan or wait for the next billing cycle.",
          used:        quota.executions,
          limit:       quota.monthly_limit,
          upgrade_url: `${process.env.APP_URL ?? "https://os.streetmp.com"}/plans`,
        },
      });
      return;
    }

    next();
  } catch (err) {
    // FAIL-OPEN: quota DB error must not block all traffic
    console.error("[UsageGuard] DB error (fail-open):", (err as Error).message);
    next();
  }
}
