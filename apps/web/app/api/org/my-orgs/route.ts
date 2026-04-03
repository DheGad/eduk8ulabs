/**
 * @file route.ts
 * @route GET /api/org/my-orgs
 * @description Returns all organizations the current user belongs to.
 *   Used by the OrgSwitcher dropdown in the sidebar.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.plan_tier,
      o.created_at,
      om.role AS member_role
    FROM organizations o
    JOIN organization_members om ON om.org_id = o.id
    WHERE
      om.user_id   = $1::UUID
      AND o.archived_at IS NULL
    ORDER BY
      CASE om.role WHEN 'OWNER' THEN 0 ELSE 1 END,
      o.name ASC
  `, [userId]);

  return NextResponse.json({ success: true, orgs: rows });
}
