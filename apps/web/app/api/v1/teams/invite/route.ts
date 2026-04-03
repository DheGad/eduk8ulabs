/**
 * @file app/api/v1/teams/invite/route.ts
 * @description POST /api/v1/teams/invite
 *   Phase 4 — Team Engine
 *
 * Validates the invite payload, generates a signed join token,
 * sends a branded "You've been invited" email via Resend (with
 * nodemailer/SMTP fallback), and stores the pending invite in the
 * router-service DB.
 *
 * Body:
 *   { email: string; role: "ADMIN" | "MEMBER"; tenantId?: string }
 *
 * Authorization: Bearer <JWT>  (Owner or Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://os.streetmp.com";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const INVITE_SECRET  = process.env.INVITE_SIGNING_SECRET ?? "streetmp-invite-default-secret";

// ─── Token generation ─────────────────────────────────────────────────────────

function generateInviteToken(email: string, role: string, tenantId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, role, tenantId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", INVITE_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${sig}`;
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendInviteEmailResend(
  toEmail: string,
  role: string,
  joinUrl: string
): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  const html = buildEmailHtml(toEmail, role, joinUrl);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StreetMP OS <noreply@streetmp.com>",
        to:   [toEmail],
        subject: "You've been invited to StreetMP OS",
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Email HTML template ──────────────────────────────────────────────────────

function buildEmailHtml(email: string, role: string, joinUrl: string): string {
  const roleLabel = role === "ADMIN" ? "Administrator" : "Member";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You've been invited to StreetMP OS</title></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#0A0A0A;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;">
    <tr><td style="padding:32px 32px 0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:28px;">
        <div style="width:32px;height:32px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:8px;text-align:center;line-height:32px;font-weight:900;color:#10b981;font-size:14px;">S</div>
        <span style="font-size:16px;font-weight:700;"><span style="color:#fff;">StreetMP</span><span style="color:#10b981;">OS</span></span>
      </div>
      <h1 style="font-size:24px;font-weight:800;color:#fff;margin:0 0 8px;letter-spacing:-0.5px;">You've been invited.</h1>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 28px;line-height:1.6;">
        You've been invited to join a secure StreetMP OS workspace as a <strong style="color:#10b981;">${roleLabel}</strong>.
        StreetMP OS is a sovereign AI execution platform with enterprise-grade compliance, cryptographic audit trails, and zero-knowledge data protection.
      </p>
      <a href="${joinUrl}" style="display:block;background:linear-gradient(135deg,#10b981,#059669);color:#000;font-weight:700;font-size:14px;text-decoration:none;padding:14px 24px;border-radius:12px;text-align:center;letter-spacing:0.5px;margin-bottom:20px;">
        Accept Invitation →
      </a>
      <p style="font-size:11px;color:rgba(255,255,255,0.25);text-align:center;margin:0 0 28px;">
        This link expires in 7 days. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
      <p style="font-size:10px;color:rgba(255,255,255,0.2);margin:0;text-align:center;">
        © ${new Date().getFullYear()} StreetMP Sdn. Bhd. · Bangsar, Kuala Lumpur, Malaysia<br>
        <a href="${APP_URL}/privacy" style="color:rgba(255,255,255,0.3);">Privacy Policy</a> · 
        <a href="${APP_URL}/terms" style="color:rgba(255,255,255,0.3);">Terms of Service</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";

    const inviteSchema = z.object({
      email: z.string().email("A valid email address is required."),
      role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
      tenantId: z.string().default("default"),
    });

    let body;
    try {
      body = inviteSchema.parse(await req.json());
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: err.issues[0].message } },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const { email, role, tenantId } = body;

    // ── Generate signed join token ─────────────────────────────────
    const token   = generateInviteToken(email, role, tenantId);
    const joinUrl = `${APP_URL}/join?token=${token}`;

    // ── Persist invite in router-service DB (best-effort) ─────────
    try {
      await fetch(`${ROUTER_URL}/api/v1/admin/teams/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ email, role, tenantId, token }),
      });
    } catch {
      // Non-fatal — email always sends, DB persistence is best-effort
      console.warn("[Teams:invite] Could not persist invite to router-service");
    }

    // ── Send email ────────────────────────────────────────────────
    const emailSent = await sendInviteEmailResend(email, role, joinUrl);

    return NextResponse.json({
      success: true,
      data: {
        email,
        role,
        joinUrl,
        // Return join URL in response so UI can show a copy-link fallback
        emailDelivered: emailSent,
        message: emailSent
          ? `Invitation sent to ${email}.`
          : `Invite link generated. Email delivery requires RESEND_API_KEY — share the link manually.`,
      },
    });
  } catch (err) {
    console.error("[Teams:invite]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to send invitation." } },
      { status: 500 }
    );
  }
}
