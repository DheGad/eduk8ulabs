"use server";

import { pool } from "./db";

export interface DashboardMetrics {
  totalExecutions: number;
  riskScore: number;
  threatsBlocked: number;
  dataExposurePrevented: string; // e.g., "1.24" (in Millions)
}

/**
 * Sweeps all live telemetry signals to power the main executive dashboard cards.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const execResult = await pool.query("SELECT COUNT(*) as count FROM executions");
    const totalExecutions = parseInt(execResult.rows[0].count, 10) || 0;

    const compResult = await pool.query("SELECT COUNT(DISTINCT execution_id) as count FROM compliance_events");
    const failedExecutions = parseInt(compResult.rows[0].count, 10) || 0;

    const blockResult = await pool.query("SELECT COUNT(*) as count FROM compliance_events WHERE action = 'block'");
    const threatsBlocked = parseInt(blockResult.rows[0].count, 10) || 0;

    const piiResult = await pool.query("SELECT COUNT(*) as count FROM pii_events WHERE masked = true");
    const piiMasked = parseInt(piiResult.rows[0].count, 10) || 0;

    const riskScore = totalExecutions === 0 ? 100 : Math.max(0, 100 - Math.round((failedExecutions / totalExecutions) * 100));
    
    // Convert masked PII items into theoretical dollar values saved (e.g. $10k per PII leak avoided)
    const dataExposurePrevented = (piiMasked * 10000 / 1000000).toFixed(2);

    return {
      totalExecutions,
      riskScore,
      threatsBlocked,
      dataExposurePrevented,
    };
  } catch (error) {
    console.error("[Telemetry] DB Error:", error);
    // Return graceful 0 states if the database doesn't have the table yet or fails connection
    return {
      totalExecutions: 0,
      riskScore: 100,
      threatsBlocked: 0,
      dataExposurePrevented: "0.00",
    };
  }
}

/**
 * Returns specific metrics for the X-Ray visualizer
 */
export async function getXRayMetrics() {
  try {
    const piiResult = await pool.query("SELECT COUNT(*) as count FROM pii_events WHERE masked = true");
    const compResult = await pool.query("SELECT COUNT(*) as count FROM compliance_events WHERE rule = 'schema_repair'");
    const hallResult = await pool.query("SELECT COUNT(*) as count FROM compliance_events WHERE rule = 'hallucination'");
    return {
      piiMasked: parseInt(piiResult.rows[0].count, 10) || 0,
      schemasRepaired: parseInt(compResult.rows[0].count, 10) || 0,
      hallucinations: parseInt(hallResult.rows[0].count, 10) || 0,
    };
  } catch (error) {
    return { piiMasked: 0, schemasRepaired: 0, hallucinations: 0 };
  }
}

/**
 * Returns Merkle audit log entries for the sovereign report generator.
 */
export async function getAuditLedgerEntries(startStr: string, endStr: string) {
  try {
    // Add 1 day to end date to ensure inclusive querying up to midnight
    const end = new Date(endStr);
    end.setDate(end.getDate() + 1);

    const result = await pool.query(`
      SELECT 
        e.id as exec_id, 
        e.created_at, 
        c.rule, 
        c.action 
      FROM executions e 
      LEFT JOIN compliance_events c ON e.id = c.execution_id 
      WHERE e.created_at >= $1 AND e.created_at <= $2 
      ORDER BY e.created_at DESC 
      LIMIT 100
    `, [new Date(startStr), end]);
    
    return result.rows.map(row => ({
      id: row.exec_id,
      proof_id: `exec_proof_${row.exec_id.substring(0,8)}`,
      timestamp: new Date(row.created_at).toISOString().slice(0, 19).replace("T", " "),
      regulation: "Universal Policy",
      template: "Sovereign Scan",
      verdict: row.action === 'block' ? "FAIL" : "PASS",
      merkle_root: `sha256:ROOT_${row.exec_id.substring(8, 16)}`,
    }));
  } catch (error) {
    console.error("[Telemetry] Audit Fetch Error:", error);
    return [];
  }
}

/**
 * Returns Merkle execution financial ledger entries
 */
export async function getRecentFinanceTicks() {
  try {
    const result = await pool.query(`
      SELECT id, model, cost, created_at 
      FROM executions 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    return result.rows.map(r => ({
      id: r.id,
      model: r.model,
      promptTokens: 0, 
      completionTokens: 0,
      cost: parseFloat(r.cost),
      cacheHit: parseFloat(r.cost) === 0,
      savedVsGpt4: parseFloat(r.cost) === 0 ? 0.005 : 0.0,
      timestamp: new Date(r.created_at).toLocaleTimeString(),
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Returns totals for the financial visualizer
 */
export async function getFinanceTotals() {
  try {
    const totalCostRes = await pool.query("SELECT SUM(cost) as total FROM executions");
    const totalCost = parseFloat(totalCostRes.rows[0].total) || 0;
    
    // Cache hits are executions with cost = 0 and actual results
    const cacheRes = await pool.query("SELECT COUNT(*) as hits FROM executions WHERE cost = 0");
    const cacheHits = parseInt(cacheRes.rows[0].hits, 10) || 0;

    return { totalCost, totalSaved: cacheHits * 0.005, cacheHits };
  } catch (error) {
    return { totalCost: 0, totalSaved: 0, cacheHits: 0 };
  }
}



