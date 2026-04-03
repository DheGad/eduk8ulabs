/**
 * @file route.ts
 * @routes GET/PATCH /api/org/[orgId]/members
 * @description List members + update a member's role.
 *   PATCH requires ADMIN or OWNER. GET requires read:members.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const userId = _req.headers.get("x-streetmp-user-id");
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Verify caller is a member of this org
  const { rows: membership } = await pool.query(
    `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
    [userId, orgId]
  );
  if (!membership.length) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { rows: members } = await pool.query(`
    SELECT
      om.id,
      om.user_id,
      om.role,
      om.created_at,
      om.updated_at,
      u.email,
      u.display_name
    FROM organization_members om
    LEFT JOIN users u ON u.id = om.user_id
    WHERE om.org_id = $1
    ORDER BY
      CASE om.role
        WHEN 'OWNER'     THEN 1
        WHEN 'ADMIN'     THEN 2
        WHEN 'DEVELOPER' THEN 3
        WHEN 'VIEWER'    THEN 4
        ELSE 5
      END, om.created_at ASC
  `, [orgId]);

  return NextResponse.json({ success: true, members, caller_role: membership[0].role });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const userId = req.headers.get("x-streetmp-user-id");
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rows: caller } = await pool.query(
    `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
    [userId, orgId]
  );
  if (!caller.length || !["OWNER","ADMIN"].includes(caller[0].role)) {
    return NextResponse.json({ success: false, error: "Requires ADMIN or OWNER role" }, { status: 403 });
  }

  const body = await req.json() as { member_id: string; role: string };
  const allowed = ["OWNER","ADMIN","DEVELOPER","VIEWER"];
  if (!allowed.includes(body.role?.toUpperCase())) {
    return NextResponse.json({ success: false, error: `Invalid role: ${body.role}` }, { status: 400 });
  }
  // OWNER cannot be downgraded by an ADMIN
  if (caller[0].role === "ADMIN" && body.role.toUpperCase() === "OWNER") {
    return NextResponse.json({ success: false, error: "ADMINs cannot promote to OWNER" }, { status: 403 });
  }

  const { rows } = await pool.query(
    `UPDATE organization_members SET role = $1::org_role, updated_at = NOW()
     WHERE id = $2 AND org_id = $3 RETURNING id, role`,
    [body.role.toUpperCase(), body.member_id, orgId]
  );
  if (!rows.length) return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });

  return NextResponse.json({ success: true, member: rows[0] });
}
