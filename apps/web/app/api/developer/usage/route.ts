/**
 * @file app/api/developer/usage/route.ts
 * @route GET /api/developer/usage
 * @description Returns current org quota data for the Developer Portal Usage tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.headers.get("x-streetmp-org-id");
  if (!orgId) return NextResponse.json({ success: false, error: "No org context" }, { status: 401 });

  const { rows } = await pool.query(`
    SELECT
      sp.name                          AS plan_name,
      sp.display_name,
      sp.monthly_limit,
      sp.features,
      q.current_month_executions,
      q.month_start,
      q.limit_reached_at,
      q.stripe_subscription_id
    FROM   org_usage_quotas    q
    JOIN   subscription_plans  sp ON sp.id = q.plan_id
    WHERE  q.org_id = $1::UUID
    LIMIT  1
  `, [orgId]);

  if (!rows.length) {
    // No quota row yet — org is on free, return defaults
    return NextResponse.json({
      success: true,
      quota: {
        plan_name:                "free",
        display_name:             "Free",
        monthly_limit:            500,
        current_month_executions: 0,
        limit_reached_at:         null,
      },
    });
  }

  return NextResponse.json({ success: true, quota: rows[0] });
}
