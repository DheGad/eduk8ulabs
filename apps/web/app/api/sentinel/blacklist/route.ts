/**
 * @file route.ts
 * @route GET /api/sentinel/blacklist
 * @description Returns the current firewall_blacklist for the SentinelPulse UI.
 *   Engineers can see all active + recently expired blocks.
 */

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        ip_address::TEXT         AS ip_address,
        reason,
        blocked_by,
        risk_score,
        expires_at,
        unblocked_at,
        unblocked_by,
        created_at,
        -- is the block currently active?
        (unblocked_at IS NULL AND expires_at > NOW()) AS is_active
      FROM firewall_blacklist
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ success: true, blocks: rows });
  } catch (err) {
    console.error("[/api/sentinel/blacklist GET]", err);
    return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
  }
}
