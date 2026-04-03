/**
 * @file route.ts
 * @route GET /api/sentinel/threats
 * @description Returns the latest SUSPICIOUS_ENTITY records from threat_events
 *   along with agent heartbeat activity (event counts per 5-min bucket for 1 hour).
 *   The SentinelPulse component polls this every 15 seconds.
 */

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ── Recent suspicious entities (last 24 h) ────────────────────────────
    const { rows: entities } = await pool.query(`
      SELECT
        id,
        event_type,
        tenant_id,
        payload,
        severity,
        created_at
      FROM threat_events
      WHERE
        event_type = 'SUSPICIOUS_ENTITY'
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 50
    `);

    // ── Heartbeat: combined event volume per 5-min bucket for the last 60 min
    //    Used by the SentinelPulse line chart. Each bucket = a data point.
    const { rows: heartbeat } = await pool.query(`
      WITH buckets AS (
        SELECT
          date_trunc('hour', created_at)
            + (EXTRACT(MINUTE FROM created_at)::INT / 5) * INTERVAL '5 minutes'  AS bucket,
          COUNT(*) AS events
        FROM (
          SELECT created_at FROM compliance_events
            WHERE created_at >= NOW() - INTERVAL '60 minutes'
          UNION ALL
          SELECT created_at FROM threat_events
            WHERE created_at >= NOW() - INTERVAL '60 minutes'
              AND event_type != 'SUSPICIOUS_ENTITY'
        ) combined
        GROUP BY bucket
        ORDER BY bucket ASC
      )
      SELECT
        to_char(bucket AT TIME ZONE 'UTC', 'HH24:MI') AS label,
        events::INT                                    AS count
      FROM buckets
      LIMIT 12
    `);

    return NextResponse.json({
      success:   true,
      entities,
      heartbeat,
    });
  } catch (err) {
    console.error("[/api/sentinel/threats] DB error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch threat data" },
      { status: 500 }
    );
  }
}
