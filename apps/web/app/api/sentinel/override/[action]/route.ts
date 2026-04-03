/**
 * @file route.ts
 * @routes
 *   POST /api/sentinel/override/block   — Force Block an IP
 *   POST /api/sentinel/override/unblock — Unblock an IP
 *
 * @description Manual Override endpoints consumed by the SentinelPulse UI.
 *   Both routes require an `x-admin-secret` header matching STREETMP_ADMIN_SECRET
 *   (same guard pattern as adminRoutes in the os-kernel).
 *
 *   Force Block: inserts a new firewall_blacklist row with 72-hour expiry.
 *   Unblock: sets unblocked_at / unblocked_by on the active block row,
 *            then calls the os-kernel cache invalidation endpoint (if available)
 *            so the Redis hot-cache is cleared immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// ── Auth guard ────────────────────────────────────────────────────────────────

function checkAdminSecret(req: NextRequest): boolean {
  const secret   = req.headers.get("x-admin-secret");
  const expected = process.env.STREETMP_ADMIN_SECRET;
  if (!expected || !secret) return false;
  // Constant-time compare (avoid timing attacks on admin secret)
  if (secret.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= secret.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── POST /api/sentinel/override/block ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { pathname } = new URL(req.url);
  const action = pathname.endsWith("/unblock") ? "unblock" : "block";

  if (!checkAdminSecret(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { ip_address?: string; reason?: string; engineer_id?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { ip_address, reason, engineer_id } = body;

  if (!ip_address) {
    return NextResponse.json({ success: false, error: "ip_address is required" }, { status: 400 });
  }

  // ── UNBLOCK ─────────────────────────────────────────────────────────────────
  if (action === "unblock") {
    try {
      const { rows } = await pool.query<{ id: string; ip_address: string }>(
        `UPDATE firewall_blacklist
            SET unblocked_at = NOW(),
                unblocked_by = $2,
                updated_at   = NOW()
          WHERE ip_address   = $1::INET
            AND unblocked_at IS NULL
            AND expires_at   > NOW()
          RETURNING id, ip_address::TEXT`,
        [ip_address, engineer_id ?? "manual-override"]
      );

      if (rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No active block found for ${ip_address}`,
        }, { status: 404 });
      }

      // Best-effort: tell the os-kernel to invalidate its Redis cache for this IP
      void notifyKernelCacheInvalidation(ip_address);

      return NextResponse.json({
        success: true,
        action:  "unblocked",
        ip:      ip_address,
        entry:   rows[0],
      });
    } catch (err) {
      console.error("[/api/sentinel/override/unblock]", err);
      return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
    }
  }

  // ── FORCE BLOCK ─────────────────────────────────────────────────────────────
  try {
    const { rows } = await pool.query<{ id: string; ip_address: string; expires_at: string }>(
      `INSERT INTO firewall_blacklist
        (ip_address, reason, blocked_by, risk_score, expires_at)
       VALUES
        ($1::INET, $2, $3, 100.0, NOW() + INTERVAL '72 hours')
       ON CONFLICT DO NOTHING
       RETURNING id, ip_address::TEXT, expires_at::TEXT`,
      [
        ip_address,
        reason ?? "Manual override — Force Block by engineer",
        engineer_id ? `engineer:${engineer_id}` : "manual-override",
      ]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `${ip_address} is already actively blocked or insert failed`,
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      action:  "blocked",
      ip:      ip_address,
      entry:   rows[0],
    });
  } catch (err) {
    console.error("[/api/sentinel/override/block]", err);
    return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
  }
}

// ── Cache invalidation helper ─────────────────────────────────────────────────

async function notifyKernelCacheInvalidation(ip: string): Promise<void> {
  const kernelUrl = process.env.OS_KERNEL_INTERNAL_URL ?? "http://localhost:4000";
  try {
    // The os-kernel exposes an internal-only endpoint for cache busting.
    // If this fails (kernel unreachable), the Redis cache will naturally
    // expire within 60 seconds — acceptable for a manual override scenario.
    await fetch(`${kernelUrl}/internal/firewall/invalidate`, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "x-admin-secret": process.env.STREETMP_ADMIN_SECRET ?? "",
      },
      body: JSON.stringify({ ip }),
    });
  } catch {
    // Non-fatal — Redis TTL will handle expiry
  }
}
