/**
 * @file app/api/builder/execution-cost/route.ts
 * @description Live cost widget for the App Builder page.
 *
 * GET  — Returns current org's total spend + per-model breakdown from execution_costs
 * POST — Records execution cost COMPUTED SERVER-SIDE and enforces monthly quota.
 *
 * CB-4 Fix: cost_usd is now computed from tokens server-side — never trusted from client.
 * CB-5 Fix: Free-tier quota enforcement added before INSERT.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth/next";
import { authOptions }               from "@/lib/authOptions";
import { pool }                      from "@/lib/db";
import type { Session }              from "next-auth";

export const runtime  = "nodejs";
export const revalidate = 0;

// ── Types ─────────────────────────────────────────────────────────────────────

interface StreetSession extends Session {
  user: Session["user"] & { id: string; org_id: string | null; role: string };
}

// ── Cost per 1K tokens (USD) for models the Builder uses ──────────────────────
const BUILDER_MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":        { input: 0.000150, output: 0.000600 },
  "gpt-4o":             { input: 0.002500, output: 0.010000 },
  "claude-3-5-sonnet":  { input: 0.003000, output: 0.015000 },
  "gemini-1.5-flash":   { input: 0.000075, output: 0.000300 },
  "streetmp-auto":      { input: 0.000150, output: 0.000600 }, // billed at mini rate
};

// Average estimated tokens for a single AI_PROMPT step (used when client omits counts)
const AVG_TOKENS_IN  = 300;
const AVG_TOKENS_OUT = 500;

// Free-tier monthly spend limit (USD).
// Set FREE_TIER_USD_LIMIT=0 to enforce a $0 limit (sandbox-only, no real spend).
const FREE_TIER_USD_LIMIT = parseFloat(process.env.FREE_TIER_USD_LIMIT ?? "0");

// ── GET — return org spend totals ─────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions) as StreetSession | null;
  const userId  = session?.user?.id ?? null;

  try {
    // Total spend for this user
    const totalsResult = await pool.query<{
      total_cost:   string;
      total_tokens: string;
      request_count: string;
    }>(
      `SELECT
         COALESCE(SUM(cost_usd), 0)::text              AS total_cost,
         COALESCE(SUM(tokens_in + tokens_out), 0)::text AS total_tokens,
         COUNT(*)::text                                  AS request_count
       FROM execution_costs
       WHERE user_id = $1`,
      [userId],
    );

    // Monthly spend (current calendar month)
    const monthlyResult = await pool.query<{ monthly_cost: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0)::text AS monthly_cost
       FROM execution_costs
       WHERE user_id = $1
         AND created_at >= date_trunc('month', NOW())`,
      [userId],
    );

    // Per-model breakdown
    const modelsResult = await pool.query<{
      model_name:   string;
      cost_usd:     string;
      request_count: string;
    }>(
      `SELECT model_name,
              COALESCE(SUM(cost_usd), 0)::text AS cost_usd,
              COUNT(*)::text                    AS request_count
       FROM execution_costs
       WHERE user_id = $1
       GROUP BY model_name
       ORDER BY SUM(cost_usd) DESC
       LIMIT 5`,
      [userId],
    );

    const row          = totalsResult.rows[0];
    const totalCostUsd = parseFloat(row?.total_cost    ?? "0");
    const totalTokens  = parseInt(row?.total_tokens    ?? "0", 10);
    const requestCount = parseInt(row?.request_count   ?? "0", 10);
    const monthlyCost  = parseFloat(monthlyResult.rows[0]?.monthly_cost ?? "0");

    return NextResponse.json({
      success: true,
      data: {
        total_cost_usd:   totalCostUsd,
        monthly_cost_usd: monthlyCost,
        total_tokens:     totalTokens,
        request_count:    requestCount,
        model_breakdown:  modelsResult.rows.map(r => ({
          model:         r.model_name,
          cost_usd:      parseFloat(r.cost_usd),
          request_count: parseInt(r.request_count, 10),
        })),
      },
    });
  } catch {
    // Fail-safe: return $0 so the UI still renders even if DB is offline
    return NextResponse.json({
      success: true,
      data: {
        total_cost_usd:   0,
        monthly_cost_usd: 0,
        total_tokens:     0,
        request_count:    0,
        model_breakdown:  [],
      },
    });
  }
}

// ── POST — record a builder execution cost ────────────────────────────────────
// CB-4: cost_usd is now computed server-side from token counts.
//        Client must NOT send cost_usd — it is ignored.
// CB-5: Monthly quota is checked before INSERT.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions) as StreetSession | null;
  const userId  = session?.user?.id ?? null;

  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { model?: string; tokens_in?: number; tokens_out?: number };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.model || typeof body.model !== "string") {
    return NextResponse.json({ success: false, error: "model is required" }, { status: 400 });
  }

  // ── CB-4: Compute cost SERVER-SIDE — never use client-supplied cost_usd ────
  const rates     = BUILDER_MODEL_RATES[body.model] ?? BUILDER_MODEL_RATES["gpt-4o-mini"]!;
  const tokensIn  = Math.max(0, Math.floor(body.tokens_in  ?? AVG_TOKENS_IN));
  const tokensOut = Math.max(0, Math.floor(body.tokens_out ?? AVG_TOKENS_OUT));
  const costUsd   = (tokensIn / 1000) * rates.input + (tokensOut / 1000) * rates.output;

  // ── CB-5: Enforce free-tier quota before INSERT ─────────────────────────────
  try {
    const quotaResult = await pool.query<{ plan_tier: string; monthly_spend: string }>(
      `SELECT
         COALESCE(up.plan_tier, 'free') AS plan_tier,
         COALESCE(SUM(ec.cost_usd), 0)::text AS monthly_spend
       FROM users u
       LEFT JOIN usage_plans up ON up.org_id = u.org_id
       LEFT JOIN execution_costs ec
         ON ec.user_id = u.id
         AND ec.created_at >= date_trunc('month', NOW())
       WHERE u.id = $1
       GROUP BY up.plan_tier`,
      [userId]
    );

    const tier         = quotaResult.rows[0]?.plan_tier ?? "free";
    const monthlySpend = parseFloat(quotaResult.rows[0]?.monthly_spend ?? "0");

    if (tier === "free" && (monthlySpend + costUsd) > FREE_TIER_USD_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error:   "Free tier monthly quota exceeded. Upgrade to Pro to continue.",
          code:    "QUOTA_EXCEEDED",
          used_usd: monthlySpend,
          limit_usd: FREE_TIER_USD_LIMIT,
        },
        { status: 429 }
      );
    }
  } catch {
    // If quota check fails (DB offline), allow the request through (fail-open).
    // The router-service has its own quota guard as a second line of defence.
  }

  // ── INSERT ──────────────────────────────────────────────────────────────────
  try {
    await pool.query(
      `INSERT INTO execution_costs (model_name, tokens_in, tokens_out, cost_usd, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [body.model, tokensIn, tokensOut, costUsd, userId],
    );

    return NextResponse.json({ success: true, cost_usd: costUsd });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to record cost" },
      { status: 500 }
    );
  }
}
