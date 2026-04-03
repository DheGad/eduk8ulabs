/**
 * @file app/api/developer/webhooks/route.ts
 * @routes GET / POST /api/developer/webhooks
 * @description Webhook endpoint management for orgs via the Developer Portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.headers.get("x-streetmp-org-id");
  if (!orgId) return NextResponse.json({ success: false, error: "No org context" }, { status: 401 });

  const { rows } = await pool.query(`
    SELECT id, url, description, is_active, last_triggered_at,
           last_status_code, failure_count, disabled_at, created_at
    FROM   org_webhook_endpoints
    WHERE  org_id = $1::UUID
    ORDER  BY created_at DESC
  `, [orgId]);

  return NextResponse.json({ success: true, endpoints: rows });
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  const orgId  = req.headers.get("x-streetmp-org-id");
  if (!userId || !orgId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rows: membership } = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members WHERE user_id = $1::UUID AND org_id = $2::UUID LIMIT 1`,
    [userId, orgId]
  );
  if (!membership.length || !["OWNER","ADMIN"].includes(membership[0].role)) {
    return NextResponse.json({ success: false, error: "Requires ADMIN or OWNER" }, { status: 403 });
  }

  const body = await req.json() as { url: string; description?: string };
  if (!body.url?.startsWith("https://")) {
    return NextResponse.json({ success: false, error: "URL must use HTTPS" }, { status: 400 });
  }

  const secret = randomBytes(32).toString("hex");
  const { rows } = await pool.query<{ id: string; url: string; created_at: string }>(
    `INSERT INTO org_webhook_endpoints (org_id, url, signing_secret_hash, description)
     VALUES ($1::UUID, $2, $3, $4)
     RETURNING id, url, created_at`,
    [orgId, body.url, secret, body.description ?? ""]
  );

  return NextResponse.json({
    success: true,
    endpoint: {
      ...rows[0],
      signing_secret: secret,
      warning: "Copy this signing secret now. It will never be shown again.",
    },
  });
}
