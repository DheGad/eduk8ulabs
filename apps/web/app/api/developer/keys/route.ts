/**
 * @file app/api/developer/keys/route.ts
 * @routes GET / POST /api/developer/keys
 * @description Public API Key management for the Developer Portal.
 *   Keys are prefixed `smp_live_` (live) or `smp_test_` (dev mode).
 *   Only the full key is returned ONCE at creation time.
 *   The DB stores a SHA-256 hash of the key — never the raw value.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const KEY_PREFIX = process.env.NODE_ENV === "production" ? "smp_live_" : "smp_test_";
const MAX_KEYS_PER_ORG = 10;

function generateApiKey(): { raw: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  const raw   = `${KEY_PREFIX}${token}`;
  const hash  = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

// ── GET: list all keys for this org ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  const orgId  = req.headers.get("x-streetmp-org-id");
  if (!userId || !orgId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(`
    SELECT
      id,
      name,
      -- Show only prefix to confirm key type, never the full hash
      LEFT(key_hash, 8) || '...' AS key_preview,
      role,
      org_id,
      last_used_at,
      created_at,
      revoked_at
    FROM api_keys
    WHERE org_id = $1::UUID
    ORDER BY created_at DESC
    LIMIT 100
  `, [orgId]);

  return NextResponse.json({ success: true, keys: rows });
}

// ── POST: create a new key ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  const orgId  = req.headers.get("x-streetmp-org-id");
  if (!userId || !orgId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Verify caller is DEVELOPER, ADMIN, or OWNER
  const { rows: membership } = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members WHERE user_id = $1::UUID AND org_id = $2::UUID LIMIT 1`,
    [userId, orgId]
  );
  if (!membership.length || !["OWNER","ADMIN","DEVELOPER"].includes(membership[0].role)) {
    return NextResponse.json({ success: false, error: "Requires DEVELOPER, ADMIN, or OWNER role" }, { status: 403 });
  }

  // Enforce key limit
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM api_keys WHERE org_id = $1::UUID AND revoked_at IS NULL`,
    [orgId]
  );
  if (parseInt(countRows[0]?.count ?? "0", 10) >= MAX_KEYS_PER_ORG) {
    return NextResponse.json(
      { success: false, error: `Maximum ${MAX_KEYS_PER_ORG} active keys per organization` },
      { status: 429 }
    );
  }

  const body = await req.json() as { name?: string; role?: string };
  const name  = body.name?.trim() || "Untitled Key";
  const role  = ["OWNER","ADMIN","DEVELOPER","VIEWER"].includes(body.role?.toUpperCase() ?? "")
    ? body.role!.toUpperCase()
    : "DEVELOPER";

  const { raw, hash } = generateApiKey();

  const { rows } = await pool.query<{ id: string; name: string; role: string; created_at: string }>(
    `INSERT INTO api_keys (name, key_hash, role, org_id, created_by)
     VALUES ($1, $2, $3, $4::UUID, $5::UUID)
     RETURNING id, name, role, created_at`,
    [name, hash, role, orgId, userId]
  );

  // Return the raw key ONCE — it cannot be retrieved again
  return NextResponse.json({
    success: true,
    key: {
      ...rows[0],
      raw_key: raw,   // ← only ever returned here
      warning: "Copy this key now. It will never be shown again.",
    },
  });
}
