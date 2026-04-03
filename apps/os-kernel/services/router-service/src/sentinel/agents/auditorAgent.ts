/**
 * @file auditorAgent.ts
 * @service router-service
 * @phase Phase 3 — The Sentinel Layer
 * @agent Sentinel-01 / The Auditor
 *
 * @description
 * The Security Auditor agent detects "Low-and-Slow" attack patterns by
 * correlating compliance_events and threat_events from the last 24 hours.
 *
 * Pattern detected:
 *   5 or more UNIQUE source IP addresses hitting the SAME endpoint within
 *   a 24-hour window — a classic credential-stuffing / distributed probe pattern.
 *
 * Action on detection:
 *   Writes a `SUSPICIOUS_ENTITY` record to the `threat_events` table so the
 *   Engineer Dashboard (and any alert pipeline) can pick it up in real time.
 *
 * Execution model:
 *   - All reads go through the SentinelSandbox READ-ONLY pool.
 *   - The single write (flagging) goes through ctx.writeThrough() — the only
 *     approved write escape-hatch in the sandbox.
 *   - This function is exported as an AgentFn and should be called via:
 *       runInSandbox(AUDITOR_SENTINEL_ID, runAuditor);
 */

import type { SandboxContext } from "../sentinelSandbox.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** UUID that matches the seeded row in sentinel_registry */
export const AUDITOR_SENTINEL_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/** Minimum unique IPs probing a single endpoint within the window to trigger a flag */
const LOW_AND_SLOW_THRESHOLD = 5;

/** Window for pattern detection */
const WINDOW_HOURS = 24;

// ── Types ─────────────────────────────────────────────────────────────────────

interface EndpointProbeCluster {
  endpoint:   string;
  unique_ips: number;
  first_seen: string;
  last_seen:  string;
}

interface SuspiciousEntity {
  id:         string;
  tenant_id:  string | null;
  event_type: string;
  payload:    object;
  severity:   string;
  created_at: string;
}

// ── SQL helpers ───────────────────────────────────────────────────────────────

/**
 * Query compliance_events and threat_events to find endpoints with 5+ unique IPs
 * within the last WINDOW_HOURS hours. Returns candidate clusters.
 */
const DETECT_LOW_AND_SLOW_SQL = `
  WITH combined AS (
    -- compliance_events records AI prompt attempts with their source_ip
    SELECT
      payload->>'endpoint'  AS endpoint,
      payload->>'source_ip' AS source_ip,
      created_at
    FROM compliance_events
    WHERE
      created_at >= NOW() - INTERVAL '${WINDOW_HOURS} hours'
      AND payload->>'source_ip' IS NOT NULL
      AND payload->>'endpoint'  IS NOT NULL

    UNION ALL

    -- threat_events records blocked / suspicious calls
    SELECT
      payload->>'endpoint'  AS endpoint,
      payload->>'source_ip' AS source_ip,
      created_at
    FROM threat_events
    WHERE
      created_at >= NOW() - INTERVAL '${WINDOW_HOURS} hours'
      AND event_type != 'SUSPICIOUS_ENTITY'   -- avoid counting our own flags
      AND payload->>'source_ip' IS NOT NULL
      AND payload->>'endpoint'  IS NOT NULL
  )
  SELECT
    endpoint,
    COUNT(DISTINCT source_ip)::INT  AS unique_ips,
    MIN(created_at)::TEXT           AS first_seen,
    MAX(created_at)::TEXT           AS last_seen
  FROM combined
  GROUP BY endpoint
  HAVING COUNT(DISTINCT source_ip) >= ${LOW_AND_SLOW_THRESHOLD}
  ORDER BY unique_ips DESC;
`;

/**
 * Check whether a SUSPICIOUS_ENTITY flag for this exact endpoint already
 * exists within the last hour (de-dup guard — don't re-flag every cron tick).
 */
const DEDUP_CHECK_SQL = `
  SELECT id FROM threat_events
  WHERE
    event_type = 'SUSPICIOUS_ENTITY'
    AND payload->>'flagged_endpoint' = $1
    AND created_at >= NOW() - INTERVAL '1 hour'
  LIMIT 1;
`;

/**
 * Insert a SUSPICIOUS_ENTITY record into threat_events.
 * The dashboard polls this table for severity = 'HIGH'.
 */
const FLAG_ENTITY_SQL = `
  INSERT INTO threat_events (event_type, tenant_id, payload, severity)
  VALUES (
    'SUSPICIOUS_ENTITY',
    NULL,
    $1::jsonb,
    'HIGH'
  )
  RETURNING id, tenant_id, event_type, payload::text, severity, created_at;
`;

// ── Agent logic ───────────────────────────────────────────────────────────────

/**
 * Main agent function — execute inside runInSandbox().
 *
 * @example
 *   import { runInSandbox } from "./sentinelSandbox";
 *   import { runAuditor, AUDITOR_SENTINEL_ID } from "./agents/auditorAgent";
 *
 *   await runInSandbox(AUDITOR_SENTINEL_ID, runAuditor);
 */
export async function runAuditor(ctx: SandboxContext): Promise<void> {
  console.info("[Sentinel-01:Auditor] Starting Low-and-Slow detection scan...");

  // ── Step 1: Detect clusters ────────────────────────────────────────────────
  const { rows: clusters } = await ctx.query<EndpointProbeCluster>(
    DETECT_LOW_AND_SLOW_SQL
  );

  if (clusters.length === 0) {
    console.info("[Sentinel-01:Auditor] No suspicious clusters detected. System clean.");
    return;
  }

  console.warn(
    `[Sentinel-01:Auditor] ${clusters.length} suspicious endpoint cluster(s) detected.`
  );

  // ── Step 2: Flag each cluster (with de-dup) ───────────────────────────────
  let flagged = 0;

  for (const cluster of clusters) {
    // De-dup: skip if already flagged in the last hour
    const { rows: existing } = await ctx.query<{ id: string }>(
      DEDUP_CHECK_SQL,
      [cluster.endpoint]
    );

    if (existing.length > 0) {
      console.info(
        `[Sentinel-01:Auditor] Endpoint "${cluster.endpoint}" already flagged recently — skipping.`
      );
      continue;
    }

    // Build the payload that the dashboard will read
    const flagPayload = {
      flagged_endpoint:  cluster.endpoint,
      unique_ip_count:   cluster.unique_ips,
      detection_window:  `${WINDOW_HOURS}h`,
      threshold:         LOW_AND_SLOW_THRESHOLD,
      pattern:           "LOW_AND_SLOW",
      first_seen:        cluster.first_seen,
      last_seen:         cluster.last_seen,
      flagged_by:        "Sentinel-01/Auditor",
      flagged_at:        new Date().toISOString(),
    };

    // Write through the sandbox's approved write gate
    const inserted = await ctx.writeThrough<SuspiciousEntity>(
      FLAG_ENTITY_SQL,
      [JSON.stringify(flagPayload)]
    );

    if (inserted.length > 0) {
      flagged++;
      console.warn(
        `[Sentinel-01:Auditor] ⚠ SUSPICIOUS_ENTITY flagged — endpoint: "${cluster.endpoint}" ` +
        `(${cluster.unique_ips} unique IPs) — threat_event.id: ${inserted[0].id}`
      );
    }
  }

  console.info(
    `[Sentinel-01:Auditor] Scan complete. Clusters detected: ${clusters.length}, Flagged: ${flagged}.`
  );
}
