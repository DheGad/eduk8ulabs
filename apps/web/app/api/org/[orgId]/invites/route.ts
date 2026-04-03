/**
 * @file route.ts
 * @route POST /api/org/[orgId]/invites
 * @description Send an org invite. Requires ADMIN or OWNER.
 *   Generates a cryptographically random token and records the invite row.
 *   Email sending is delegated to a transactional email service via env vars.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ orgId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const userId = req.headers.get("x-streetmp-user-id");
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Verify caller is ADMIN or OWNER
  const { rows: caller } = await pool.query(
    `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
    [userId, orgId]
  );
  if (!caller.length || !["OWNER","ADMIN"].includes(caller[0].role)) {
    return NextResponse.json({ success: false, error: "Requires ADMIN or OWNER role" }, { status: 403 });
  }

  const body = await req.json() as { email: string; role?: string };
  if (!body.email?.includes("@")) {
    return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
  }

  const role   = (body.role?.toUpperCase() ?? "DEVELOPER") as string;
  const allowed = ["ADMIN","DEVELOPER","VIEWER"];
  if (!allowed.includes(role)) {
    return NextResponse.json({ success: false, error: `Cannot invite as ${role}` }, { status: 400 });
  }

  // Check if already a member
  const { rows: exists } = await pool.query(
    `SELECT om.id FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE u.email = $1 AND om.org_id = $2 LIMIT 1`,
    [body.email, orgId]
  );
  if (exists.length) {
    return NextResponse.json({ success: false, error: "User is already a member" }, { status: 409 });
  }

  // Invalidate any existing pending invite for this email+org
  await pool.query(
    `UPDATE organization_invites SET expires_at = NOW()
     WHERE email = $1 AND org_id = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
    [body.email, orgId]
  );

  const token = randomBytes(32).toString("hex");
  const { rows } = await pool.query(`
    INSERT INTO organization_invites (email, org_id, role, token, invited_by)
    VALUES ($1, $2, $3::org_role, $4, $5::UUID)
    RETURNING id, email, role, token, expires_at
  `, [body.email, orgId, role, token, userId]);

  const invite = rows[0] as { id: string; email: string; role: string; token: string; expires_at: string };

  // Best-effort email send (non-blocking)
  void sendInviteEmail(invite, orgId).catch((e: unknown) =>
    console.error("[OrgInvite] Email send failed:", (e as Error).message)
  );

  return NextResponse.json({ success: true, invite: { id: invite.id, email: invite.email, role: invite.role, expires_at: invite.expires_at } });
}

async function sendInviteEmail(
  invite: { email: string; token: string; role: string },
  orgId: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.streetmp.com";
  const link   = `${appUrl}/onboard/accept-invite?token=${invite.token}&org=${orgId}`;

  // Send via the configured email provider (Resend / SendGrid)
  const emailApiKey = process.env.EMAIL_API_KEY;
  if (!emailApiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${emailApiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    process.env.EMAIL_FROM ?? "noreply@streetmp.com",
      to:      [invite.email],
      subject: `You've been invited to join StreetMP OS`,
      html: `
        <p>You've been invited to join a StreetMP OS organization as <strong>${invite.role}</strong>.</p>
        <p><a href="${link}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Accept Invite</a></p>
        <p style="color:#666;font-size:12px">This invite expires in 7 days.</p>
      `,
    }),
  });
}
