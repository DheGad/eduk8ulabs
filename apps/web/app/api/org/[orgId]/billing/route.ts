/**
 * @file app/api/org/[orgId]/billing/route.ts
 * @route GET/PATCH /api/org/[orgId]/billing
 * @description Organization billing profile — including GSTIN for Indian tax invoices.
 *   PATCH requires OWNER role only.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ orgId: string }> };

// ── GET current billing profile ───────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const userId = req.headers.get("x-streetmp-user-id");
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rows: member } = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members WHERE user_id = $1::UUID AND org_id = $2::UUID LIMIT 1`,
    [userId, orgId]
  );
  if (!member.length) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT
      o.id, o.name, o.slug, o.plan_tier,
      o.billing_provider, o.billing_currency, o.billing_country,
      o.gstin, o.created_at,
      q.current_month_executions,
      q.limit_reached_at,
      q.stripe_subscription_id,
      sp.display_name   AS plan_display_name,
      sp.monthly_limit,
      sp.price_monthly
    FROM   organizations    o
    LEFT   JOIN org_usage_quotas   q  ON q.org_id = o.id
    LEFT   JOIN subscription_plans sp ON sp.id    = q.plan_id
    WHERE  o.id = $1::UUID
    LIMIT  1
  `, [orgId]);

  return NextResponse.json({ success: true, billing: rows[0] ?? null, caller_role: member[0].role });
}

// ── PATCH: update billing details ─────────────────────────────────────────────

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const userId = req.headers.get("x-streetmp-user-id");
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rows: member } = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members WHERE user_id = $1::UUID AND org_id = $2::UUID LIMIT 1`,
    [userId, orgId]
  );
  if (!member.length || member[0].role !== "OWNER") {
    return NextResponse.json({ success: false, error: "Only the OWNER can update billing details" }, { status: 403 });
  }

  const body = await req.json() as {
    gstin?:            string | null;
    billing_country?:  string;
    billing_currency?: string;
  };

  // Validate GSTIN
  if (body.gstin) {
    const g = body.gstin.trim().toUpperCase();
    if (!GSTIN_RE.test(g)) {
      return NextResponse.json({ success: false, error: "Invalid GSTIN format (expected 15-char alphanumeric)" }, { status: 400 });
    }
    body.gstin = g;
  }

  // Build dynamic SET clause
  const updates: string[]    = [];
  const values:  unknown[]   = [];
  let   idx = 1;

  if ("gstin" in body)            { updates.push(`gstin = $${idx++}`);            values.push(body.gstin ?? null); }
  if (body.billing_country)       { updates.push(`billing_country = $${idx++}`);  values.push(body.billing_country.toUpperCase()); }
  if (body.billing_currency)      { updates.push(`billing_currency = $${idx++}`); values.push(body.billing_currency.toUpperCase()); }

  if (!updates.length) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  updates.push(`updated_at = NOW()`);
  values.push(orgId);

  const { rows } = await pool.query(
    `UPDATE organizations SET ${updates.join(", ")} WHERE id = $${idx}::UUID RETURNING id, gstin, billing_provider, billing_country, billing_currency`,
    values
  );

  return NextResponse.json({ success: true, billing: rows[0] });
}
