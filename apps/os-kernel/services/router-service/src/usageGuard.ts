/**
 * @file usageGuard.ts
 * @service router-service
 * @description API Usage Guard Middleware.
 *
 * Enforces monthly API call limits per account tier before each
 * AI execution request reaches the proxy routes.
 *
 * Tier limits (calls/month):
 *   FREE      →    100
 *   PRO       → 10,000
 *   BUSINESS  → 100,000
 *   SOVEREIGN → Unlimited
 *
 * Behaviour:
 *   • Fetches current `api_calls_this_month` and `monthly_limit` from DB
 *   • Returns HTTP 429 if limit is reached
 *   • Atomically increments the counter with UPDATE … RETURNING
 *   • Attaches `req.usageInfo` for downstream logging
 */

import { Request, Response, NextFunction } from "express";
import { Pool } from "pg";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsageInfo {
  userId:           string;
  callsThisMonth:   number;
  monthlyLimit:     number;
  remainingCalls:   number;
}

// ── Express Request augmentation (local to this service) ─────────────────────

declare global {
  namespace Express {
    interface Request {
      usageInfo?: UsageInfo;
      user?: { sub: string; tier: string };
    }
  }
}

// ── DB pool reference ─────────────────────────────────────────────────────────

let _pool: Pool | null = null;

export function setUsageGuardPool(pool: Pool): void {
  _pool = pool;
}

function getPool(): Pool {
  if (!_pool) throw new Error("[UsageGuard] DB pool not initialised — call setUsageGuardPool()");
  return _pool;
}

// ── Limit constants (mirrors stripeService.ts MONTHLY_LIMITS) ───────────────

const TIER_LIMITS: Record<string, number> = {
  free:      100,
  pro:       10_000,
  business:  100_000,
  sovereign: Number.MAX_SAFE_INTEGER,
};

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * usageGuard
 *
 * Drop-in Express middleware. Place AFTER requireAuth so req.user is populated.
 *
 * Usage:
 *   router.post("/execute", requireAuth, usageGuard, executeHandler);
 */
export async function usageGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.sub;

  if (!userId) {
    // Should not happen after requireAuth, but be defensive
    res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
    return;
  }

  const db = getPool();

  try {
    // ── Fetch current counters & limit from DB ────────────────────────────────
    const { rows } = await db.query<{
      api_calls_this_month: number;
      monthly_limit:        number;
      account_tier:         string;
    }>(
      `SELECT api_calls_this_month, monthly_limit, account_tier
         FROM users
        WHERE id = $1`,
      [userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User record not found" } });
      return;
    }

    let { api_calls_this_month, monthly_limit, account_tier } = rows[0];

    // Ensure monthly_limit is set (for users who existed before billing migration)
    if (!monthly_limit || monthly_limit === 0) {
      monthly_limit = TIER_LIMITS[account_tier] ?? TIER_LIMITS.free;
    }

    // ── Enforce limit ─────────────────────────────────────────────────────────
    if (api_calls_this_month >= monthly_limit) {
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Monthly API call limit of ${monthly_limit.toLocaleString()} reached for the ${account_tier} plan. Upgrade to continue.`,
          currentUsage: api_calls_this_month,
          monthlyLimit: monthly_limit,
          upgradeUrl:   `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/pricing`,
        },
      });
      return;
    }

    // ── Atomically increment counter ──────────────────────────────────────────
    const { rows: updated } = await db.query<{ api_calls_this_month: number }>(
      `UPDATE users
          SET api_calls_this_month = api_calls_this_month + 1,
              updated_at           = NOW()
        WHERE id = $1
        RETURNING api_calls_this_month`,
      [userId],
    );

    const newCount = updated[0]?.api_calls_this_month ?? api_calls_this_month + 1;

    // Attach usage metadata for downstream logging / response headers
    req.usageInfo = {
      userId,
      callsThisMonth: newCount,
      monthlyLimit:   monthly_limit,
      remainingCalls: Math.max(0, monthly_limit - newCount),
    };

    // Expose useful headers so the frontend can render a usage bar
    res.setHeader("X-RateLimit-Limit",     monthly_limit.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, monthly_limit - newCount).toString());
    res.setHeader("X-RateLimit-Used",      newCount.toString());

    next();
  } catch (err: any) {
    console.error("[UsageGuard] DB error:", err.message);
    // Fail open in case of DB issues — log but don't block the request
    next();
  }
}

// ── Monthly Reset Helper ──────────────────────────────────────────────────────

/**
 * resetMonthlyCounters
 *
 * Should be called by a cron job on the 1st of each month (00:00 UTC).
 * Resets api_calls_this_month for all users to 0.
 */
export async function resetMonthlyCounters(): Promise<void> {
  const db = getPool();
  const { rowCount } = await db.query(
    `UPDATE users SET api_calls_this_month = 0, updated_at = NOW()`,
  );
  console.info(`[UsageGuard] Monthly reset complete — ${rowCount ?? 0} users reset`);
}
