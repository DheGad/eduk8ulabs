/**
 * @file app/api/intel/feed/route.ts
 * @description Threat Intelligence feed API
 *
 * GET /api/intel/feed
 *   Returns the last N threat events from the threat_events table.
 *   Also returns aggregate stats (monitored count, blocked count, feed latency).
 *
 * Query params:
 *   limit  — number of events to return (default 20, max 100)
 *   status — filter by status: CLEAR | IDENTITY_COMPROMISED | MONITORING
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 0; // Always fresh — this is a live security feed

export interface ThreatEvent {
  id:            string;
  type:          string;
  severity:      "LOW" | "MED" | "HIGH" | "CRITICAL";
  userId:        string | null;
  email:         string | null;
  sourceIp:      string | null;
  country:       string | null;
  status:        "CLEAR" | "MONITORING" | "IDENTITY_COMPROMISED";
  breachSource:  string | null;
  exposedFields: string[];
  riskScore:     number;
  payloadHash:   string;
  latencyMs:     number | null;
  createdAt:     string;
}

export interface ThreatFeedResponse {
  events:    ThreatEvent[];
  stats: {
    total:        number;   // total rows in threat_events
    blocked:      number;   // IDENTITY_COMPROMISED count
    monitoring:   number;   // MONITORING count
    feedLatencyMs: number;  // measured round-trip time for this query
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const rawLimit  = parseInt(searchParams.get("limit")  ?? "20", 10);
  const limit     = Math.min(Math.max(rawLimit, 1), 100);
  const statusFilter = searchParams.get("status"); // optional

  const t0 = Date.now();

  try {
    // ── Main event feed ──────────────────────────────────────
    const feedQuery = statusFilter
      ? `SELECT id, type, severity, user_id, email, source_ip, country,
                status, breach_source, exposed_fields, risk_score,
                payload_hash, latency_ms, created_at
           FROM threat_events
          WHERE status = $1
          ORDER BY created_at DESC
          LIMIT $2`
      : `SELECT id, type, severity, user_id, email, source_ip, country,
                status, breach_source, exposed_fields, risk_score,
                payload_hash, latency_ms, created_at
           FROM threat_events
          ORDER BY created_at DESC
          LIMIT $1`;

    const feedArgs = statusFilter ? [statusFilter, limit] : [limit];
    const feedResult = await pool.query(feedQuery, feedArgs);

    // ── Aggregate stats ──────────────────────────────────────
    const statsResult = await pool.query(`
      SELECT
        COUNT(*)                                                    AS total,
        COUNT(*) FILTER (WHERE status = 'IDENTITY_COMPROMISED')    AS blocked,
        COUNT(*) FILTER (WHERE status = 'MONITORING')              AS monitoring
      FROM threat_events
    `);

    const feedLatencyMs = Date.now() - t0;
    const stats = statsResult.rows[0];

    const events: ThreatEvent[] = feedResult.rows.map(row => ({
      id:            row.id,
      type:          row.type,
      severity:      row.severity,
      userId:        row.user_id   ?? null,
      email:         row.email     ?? null,
      sourceIp:      row.source_ip ?? null,
      country:       row.country   ?? null,
      status:        row.status,
      breachSource:  row.breach_source   ?? null,
      exposedFields: row.exposed_fields  ?? [],
      riskScore:     row.risk_score      ?? 0,
      payloadHash:   row.payload_hash,
      latencyMs:     row.latency_ms      ?? null,
      createdAt:     new Date(row.created_at).toISOString(),
    }));

    const response: ThreatFeedResponse = {
      events,
      stats: {
        total:        parseInt(stats.total,     10) || 0,
        blocked:      parseInt(stats.blocked,    10) || 0,
        monitoring:   parseInt(stats.monitoring, 10) || 0,
        feedLatencyMs,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/intel/feed] DB error:", err);
    return NextResponse.json(
      { error: "Failed to load threat intelligence feed." },
      { status: 500 }
    );
  }
}
