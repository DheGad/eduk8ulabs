/**
 * @file controllers/titanController.ts
 * @service router-service
 * @phase Phase 6 — Titan Hardening
 * @description
 *   API Handlers for the Titan SuperAdmin Command Center.
 *   Provides data for "The Nexus", "The Sentinel Hub", and "Revenue Analytics".
 */

import { Request, Response } from "express";
import { pool } from "../db.js";
import { log } from "../utils/logger.js";
import { getSharedRedisClient } from "../redisClient.js";
import fs from "fs/promises";
import path from "path";

// --- The Nexus: Org Manager ---

export async function getOrganizations(req: Request, res: Response) {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.name, o.slug, o.plan_tier, o.billing_provider,
             CAST(q.current_month_executions AS INTEGER) as usage,
             CAST(sp.monthly_limit AS INTEGER) as "limit",
             (SELECT COUNT(*) FROM organization_members m WHERE m.org_id = o.id) as user_count,
             o.created_at
      FROM organizations o
      LEFT JOIN org_usage_quotas q ON q.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = q.plan_id
      ORDER BY o.created_at DESC
      LIMIT 100
    `);
    
    // Simulate a status column based on limits to avoid adding a new column if not needed
    const mapped = rows.map(r => ({
      ...r,
      status: r.usage >= r.limit ? "SUSPENDED" : "ACTIVE"
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    log.error("Titan.getOrganizations failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export async function upgradeOrg(req: Request, res: Response) {
  const { orgId } = req.params;
  try {
    // For manual override, we might just set the tier to ENTERPRISE and link the plan
    const planRes = await pool.query("SELECT id FROM subscription_plans WHERE name = 'ENTERPRISE' LIMIT 1");
    if (planRes.rowCount === 0) return res.status(404).json({ success: false, error: "Enterprise plan not found" });

    await pool.query(
      "UPDATE organizations SET plan_tier = 'ENTERPRISE' WHERE id = $1", 
      [orgId]
    );
    await pool.query(
      "UPDATE org_usage_quotas SET plan_id = $1, limit_reached_at = NULL WHERE org_id = $2",
      [planRes.rows[0].id, orgId]
    );

    log.info("Titan overridden org plan to ENTERPRISE", { org_id: orgId });
    res.json({ success: true });
  } catch (err) {
    log.error("Titan.upgradeOrg failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export async function suspendOrg(req: Request, res: Response) {
  const { orgId } = req.params;
  try {
    // A quick way to suspend without schema changes is to zero the quota limit or 
    // set limit_reached_at to NOW(). Let's use limit_reached_at.
    await pool.query(
      "UPDATE org_usage_quotas SET limit_reached_at = NOW() WHERE org_id = $1",
      [orgId]
    );
    log.warn("Titan suspended org", { org_id: orgId });
    res.json({ success: true });
  } catch (err) {
    log.error("Titan.suspendOrg failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// --- The Sentinel Hub: Global Blocks ---

export async function getThreatEvents(req: Request, res: Response) {
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.entity_type, t.entity_id, t.event_type, t.risk_score, 
             t.ip_address, t.created_at, t.org_id, o.name as org_name
      FROM threat_events t
      LEFT JOIN organizations o ON o.id = t.org_id
      WHERE t.risk_score > 50
      ORDER BY t.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    log.error("Titan.getThreatEvents failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export async function blockIp(req: Request, res: Response) {
  const { ip_address, reason } = req.body;
  if (!ip_address) return res.status(400).json({ success: false, error: "Missing IP" });

  try {
    await pool.query(
      `INSERT INTO firewall_blacklist (ip_address, reason, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '30 days')
       ON CONFLICT (ip_address) DO UPDATE SET expires_at = NOW() + INTERVAL '30 days'`,
      [ip_address, reason || "Titan Global Block"]
    );
    log.info("Titan manually blocked IP", { ip: ip_address });
    res.json({ success: true });
  } catch (err) {
    log.error("Titan.blockIp failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// --- Revenue Analytics (Stripe + Razorpay) ---

export async function getRevenueStats(req: Request, res: Response) {
  try {
    // Simplistic sum for the current month
    // We assume Razorpay amounts are in paise (divide by 100) and Stripe is handled similarly if tracked in DB.
    // However, StreetMP relies on Stripe Webhooks hitting our DB, or we just approximate from 'organizations' count if active.
    // For Razorpay, we have `razorpay_orders` where status = 'paid'.
    
    const rzpRes = await pool.query(`
      SELECT SUM(amount) as total_paise
      FROM razorpay_orders
      WHERE rzp_order_status IN ('paid', 'captured')
        AND created_at >= date_trunc('month', NOW())
    `);
    
    // Convert paise to INR
    const rzpInr = (parseInt(rzpRes.rows[0].total_paise || "0", 10) / 100);

    // For Stripe, since we didn't track individual orders natively in Phase 5 (we used subscriptions), 
    // we can approximate ARR based on active Stripe organizations.
    const stripeRes = await pool.query(`
      SELECT SUM(sp.price_monthly) as mrr_cents
      FROM org_usage_quotas q
      JOIN organizations o ON o.id = q.org_id
      JOIN subscription_plans sp ON sp.id = q.plan_id
      WHERE o.billing_provider = 'STRIPE' AND q.stripe_subscription_id IS NOT NULL
    `);
    
    const stripeUsd = (parseInt(stripeRes.rows[0].mrr_cents || "0", 10) / 100);

    res.json({
      success: true,
      data: {
        stripe_usd: stripeUsd,
        razorpay_inr: rzpInr,
        total_usd_approx: stripeUsd + (rzpInr / 83.5) // Rough INR to USD conversion for combined dashboard
      }
    });

  } catch (err) {
    log.error("Titan.getRevenueStats failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// --- Active Governance (Phase 7.5) ---

export async function setMaintenanceMode(req: Request, res: Response) {
  const { active } = req.body;
  try {
    const redis = getSharedRedisClient();
    if (!redis) throw new Error("Redis unavailable");

    if (active) {
      await redis.set("system:maintenance_mode", "1");
      log.warn("Maintenance Mode ENABLED globally via HQ");
    } else {
      await redis.del("system:maintenance_mode");
      log.info("Maintenance Mode DISABLED globally via HQ");
    }
    res.json({ success: true, active });
  } catch (err) {
    log.error("Titan.setMaintenance failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export async function pushPolicy(req: Request, res: Response) {
  const { colang_content } = req.body;
  if (!colang_content) return res.status(400).json({ success: false, error: "Missing config" });

  try {
    // Write directly to the shared NeMo Config volume
    // Project root logic from overrideController
    const PROJECT_ROOT = path.resolve(import.meta.dirname ?? process.cwd(), "../../../../..");
    const configPath = path.join(PROJECT_ROOT, "packages/security/nemo/rails.co");

    await fs.writeFile(configPath, colang_content, "utf8");
    log.warn("NeMo Rails overwritten globally by HQ", { target: configPath });

    // Poke the python sidecar to reload
    const sidecarUrl = process.env.NEMO_GUARD_URL || "http://localhost:8001";
    try {
      await fetch(`${sidecarUrl}/v1/reload`, { method: "POST" });
      log.info("NeMo Sidecar hot-reloaded successfully");
    } catch (apiErr) {
       log.error("Sidecar reload API failed. Container may need manual bounce.", apiErr as Error);
    }

    res.json({ success: true });
  } catch (err) {
    log.error("Titan.pushPolicy failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export async function getChurnWarning(req: Request, res: Response) {
  try {
    // Organizations with NO usage in the last 7 days
    const { rows } = await pool.query(`
      SELECT o.id, o.name, o.slug, 
             MAX(u.timestamp) as last_activity,
             o.created_at
      FROM organizations o
      LEFT JOIN usage_logs u ON u.org_id = o.id
      GROUP BY o.id
      HAVING MAX(u.timestamp) < NOW() - INTERVAL '7 days' OR MAX(u.timestamp) IS NULL
      ORDER BY last_activity DESC NULLS LAST
      LIMIT 50
    `);
    
    res.json({ success: true, data: rows });
  } catch (err) {
    log.error("Titan.getChurnWarning failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
