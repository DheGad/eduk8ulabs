/**
 * @file app/api/iam/feed/route.ts
 * @description Zero-Trust IAM event feed API
 *
 * GET /api/iam/feed?limit=20
 *   Returns the latest IAM access events from iam_access_events table.
 *   Also returns aggregate stats (active sessions from NextAuth, block count).
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 0;

export interface IAMEvent {
  id:         string;
  userId:     string | null;
  email:      string | null;
  provider:   string;
  role:       string | null;
  clearance:  string;
  route:      string;
  action:     "AUTHORIZED" | "BLOCKED" | "ESCALATED";
  reason:     string | null;
  sourceIp:   string | null;
  createdAt:  string;
}

export interface IAMFeedResponse {
  events: IAMEvent[];
  stats: {
    activeSessions: number;   // live NextAuth sessions
    blockedTotal:   number;   // all-time BLOCKED count
    last24hEvents:  number;   // events in last 24h
    feedLatencyMs:  number;
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const limit = Math.min(parseInt(new URL(req.url).searchParams.get("limit") ?? "20", 10), 100);
  const t0 = Date.now();

  try {
    const [eventsRes, statsRes] = await Promise.all([
      pool.query<{
        id: string; user_id: string | null; email: string | null;
        provider: string; role: string | null; clearance: string;
        route: string; action: string; reason: string | null;
        source_ip: string | null; created_at: Date;
      }>(`
        SELECT id, user_id, email, provider, role, clearance, route,
               action, reason, source_ip, created_at
        FROM iam_access_events
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]),

      pool.query<{
        active_sessions: string;
        blocked_total:   string;
        last24h_events:  string;
      }>(`
        SELECT
          (SELECT COUNT(*) FROM sessions WHERE expires > NOW())          AS active_sessions,
          (SELECT COUNT(*) FROM iam_access_events WHERE action = 'BLOCKED') AS blocked_total,
          (SELECT COUNT(*) FROM iam_access_events
           WHERE created_at >= NOW() - INTERVAL '24 hours')              AS last24h_events
      `),
    ]);

    const s = statsRes.rows[0];
    const feedLatencyMs = Date.now() - t0;

    return NextResponse.json({
      events: eventsRes.rows.map(r => ({
        id:        r.id,
        userId:    r.user_id ?? null,
        email:     r.email   ?? null,
        provider:  r.provider,
        role:      r.role    ?? null,
        clearance: r.clearance,
        route:     r.route,
        action:    r.action  as IAMEvent["action"],
        reason:    r.reason  ?? null,
        sourceIp:  r.source_ip ?? null,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      stats: {
        activeSessions: parseInt(s?.active_sessions ?? "0", 10) || 0,
        blockedTotal:   parseInt(s?.blocked_total   ?? "0", 10) || 0,
        last24hEvents:  parseInt(s?.last24h_events  ?? "0", 10) || 0,
        feedLatencyMs,
      },
    } satisfies IAMFeedResponse);
  } catch (err) {
    console.error("[/api/iam/feed]", err);
    return NextResponse.json({ error: "Failed to load IAM feed." }, { status: 500 });
  }
}
