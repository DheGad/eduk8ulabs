/**
 * @file lib/costEngine.ts
 * @description V22 2.0 — Live Cost Engine (SERVER-ONLY)
 *
 * This module is SERVER-ONLY — it imports `pg` via `./db`.
 * Do NOT import this file in client components.
 *
 * Client-safe pure utilities (getRates, computeCost, formatCostUSD) live in
 * `./costUtils` — no pg dependency, safe for client components.
 *
 * This file re-exports costUtils for backward compatibility with server-side
 * callers, and adds the DB-dependent async functions.
 */

import { pool } from "./db";

// ── Re-export pure utilities for server callers that currently import costEngine
export type { ModelRates }                       from "./costUtils";
export { getRates, computeCost, formatCostUSD }  from "./costUtils";

// ── Internal use in DB functions
import { getRates } from "./costUtils";

// ================================================================
// SECTION: DB QUERIES (server-only)
// ================================================================

export interface SpendingTotals {

  /** Total USD spent across all executions */
  totalUsd: number;
  /** Breakdown by model, sorted by cost desc */
  byModel: Array<{ model: string; usd: number; calls: number; provider: string }>;
  /** 24-hour rolling window total */
  last24hUsd: number;
  /** Number of executions in the last 24h */
  last24hCount: number;
}

/**
 * Fetches the spending widget totals from the execution_costs table.
 * Primary query for the Dashboard "Spending" card.
 *
 * Falls back gracefully to usage_logs if execution_costs is empty
 * (for compatibility during the migration period before the router
 * starts writing to the new table).
 */
export async function getSpendingTotals(): Promise<SpendingTotals> {
  try {
    // ── Try execution_costs first (the new real-data table) ──
    const totalRes = await pool.query<{ total: string; count: string }>(`
      SELECT
        COALESCE(SUM(cost_usd), 0)  AS total,
        COUNT(*)                     AS count
      FROM execution_costs
    `);

    const last24hRes = await pool.query<{ total: string; count: string }>(`
      SELECT
        COALESCE(SUM(cost_usd), 0)  AS total,
        COUNT(*)                     AS count
      FROM execution_costs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const byModelRes = await pool.query<{ model: string; usd: string; calls: string }>(`
      SELECT
        model_name                   AS model,
        COALESCE(SUM(cost_usd), 0)  AS usd,
        COUNT(*)                     AS calls
      FROM execution_costs
      GROUP BY model_name
      ORDER BY SUM(cost_usd) DESC
      LIMIT 10
    `);

    const totalUsd    = parseFloat(totalRes.rows[0]?.total   ?? "0") || 0;
    const last24hUsd  = parseFloat(last24hRes.rows[0]?.total ?? "0") || 0;
    const last24hCount = parseInt(last24hRes.rows[0]?.count  ?? "0", 10) || 0;

    // If the new table has data, return it directly
    if (totalUsd > 0 || byModelRes.rows.length > 0) {
      return {
        totalUsd,
        last24hUsd,
        last24hCount,
        byModel: byModelRes.rows.map(r => ({
          model:    r.model,
          usd:      parseFloat(r.usd),
          calls:    parseInt(r.calls, 10),
          provider: getRates(r.model).provider,
        })),
      };
    }

    // ── Fallback: usage_logs (existing table, pre-migration data) ──
    const legacyTotal = await pool.query<{ total: string }>(`
      SELECT COALESCE(SUM(total_cost), 0) AS total FROM usage_logs
    `);
    const legacyByModel = await pool.query<{ model: string; usd: string; calls: string }>(`
      SELECT
        model_used                     AS model,
        COALESCE(SUM(total_cost), 0)  AS usd,
        COUNT(*)                       AS calls
      FROM usage_logs
      GROUP BY model_used
      ORDER BY SUM(total_cost) DESC
      LIMIT 10
    `);
    const legacyLast24h = await pool.query<{ total: string; count: string }>(`
      SELECT
        COALESCE(SUM(total_cost), 0) AS total,
        COUNT(*) AS count
      FROM usage_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    return {
      totalUsd:     parseFloat(legacyTotal.rows[0]?.total   ?? "0") || 0,
      last24hUsd:   parseFloat(legacyLast24h.rows[0]?.total ?? "0") || 0,
      last24hCount: parseInt(legacyLast24h.rows[0]?.count    ?? "0", 10) || 0,
      byModel: legacyByModel.rows.map(r => ({
        model:    r.model,
        usd:      parseFloat(r.usd),
        calls:    parseInt(r.calls, 10),
        provider: getRates(r.model).provider,
      })),
    };
  } catch (err) {
    console.error("[costEngine] Failed to fetch spending totals:", err);
    return { totalUsd: 0, last24hUsd: 0, last24hCount: 0, byModel: [] };
  }
}

export interface RecentCostEvent {
  id:        string;
  model:     string;
  tokensIn:  number;
  tokensOut: number;
  costUsd:   number;
  provider:  string;
  createdAt: string;
}

/**
 * Fetches the N most recent cost events for the live spending feed.
 */
export async function getRecentCostEvents(limit = 20): Promise<RecentCostEvent[]> {
  try {
    const res = await pool.query<{
      id: string; model_name: string; tokens_in: string;
      tokens_out: string; cost_usd: string; created_at: Date;
    }>(`
      SELECT id, model_name, tokens_in, tokens_out, cost_usd, created_at
      FROM execution_costs
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    return res.rows.map(r => ({
      id:        r.id,
      model:     r.model_name,
      tokensIn:  parseInt(r.tokens_in,  10) || 0,
      tokensOut: parseInt(r.tokens_out, 10) || 0,
      costUsd:   parseFloat(r.cost_usd)     || 0,
      provider:  getRates(r.model_name).provider,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}
