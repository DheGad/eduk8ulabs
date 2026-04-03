/**
 * @file route.ts
 * @route GET /api/sentinel/registry
 * @description Next.js Route Handler — streams the sentinel_registry rows to the
 *   SentinelPulse dashboard component. Returns live DB data. No caching.
 */

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        name,
        capability,
        status,
        last_run,
        success_rate,
        updated_at
      FROM sentinel_registry
      ORDER BY updated_at DESC
    `);

    return NextResponse.json({ success: true, agents: rows });
  } catch (err) {
    console.error("[/api/sentinel/registry] DB error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sentinel registry" },
      { status: 500 }
    );
  }
}
