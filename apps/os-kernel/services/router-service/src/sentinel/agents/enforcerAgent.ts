/**
 * @file enforcerAgent.ts
 * @service router-service
 * @phase Phase 3.2 — Sentinel-02: The Enforcer
 * @agent Sentinel-02 / The Enforcer
 *
 * @description
 * The Enforcer agent gives the Sentinel Layer automated "teeth".
 * It scans `threat_events` for SUSPICIOUS_ENTITY flags with risk_score > 85
 * and calls `enforceBlock()` to write the offending IP to `firewall_blacklist`.
 *
 * Execution model (identical to Sentinel-01):
 *   - All reads  → SentinelSandbox read-only pool (via ctx.query)
 *   - All writes → ctx.writeThrough() — the only approved write gate
 *   - Scheduler  → sentinelRunner.ts calls runInSandbox(ENFORCER_SENTINEL_ID, runEnforcer)
 *                  every 5 minutes.
 *
 * Block policy:
 *   - Block duration: 24 hours by default (configurable via SENTINEL_BLOCK_TTL_HOURS env var)
 *   - De-dup: if an IP is already actively blocked, the run is skipped for that IP
 *   - A separate DB function `purge_expired_firewall_blocks()` handles cleanup
 */

import type { SandboxContext } from "../sentinelSandbox.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** UUID that matches the seeded row in sentinel_registry */
export const ENFORCER_SENTINEL_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

/** Risk score threshold above which a SUSPICIOUS_ENTITY triggers an auto-block */
const RISK_SCORE_THRESHOLD = 85;

/** How long a block lasts. Override with SENTINEL_BLOCK_TTL_HOURS env var. */
const BLOCK_TTL_HOURS = parseInt(process.env.SENTINEL_BLOCK_TTL_HOURS ?? "24", 10);

// ── Types ─────────────────────────────────────────────────────────────────────

interface SuspiciousThreatEvent {
  id:         string;
  payload:    {
    flagged_endpoint?: string;
    unique_ip_count?:  number;
    pattern?:          string;
    flagged_by?:       string;
    // The source IPs are stored as an array in the payload by the Auditor
    // via the compliance_events/threat_events aggregation. When available
    // we use them; otherwise we extract from the flagged_endpoint context.
    source_ips?:       string[];
  };
  risk_score: number | null;
  created_at: string;
}

interface FirewallEntry {
  id:         string;
  ip_address: string;
  reason:     string;
  expires_at: string;
  created_at: string;
}

// ── SQL ───────────────────────────────────────────────────────────────────────

/**
 * Fetch unresolved SUSPICIOUS_ENTITY events with risk_score > threshold
 * that don't already have an active block in firewall_blacklist.
 */
const SCAN_HIGH_RISK_SQL = `
  SELECT
    te.id,
    te.payload,
    te.risk_score,
    te.created_at
  FROM threat_events te
  WHERE
    te.event_type  = 'SUSPICIOUS_ENTITY'
    AND te.risk_score > $1
    AND te.created_at >= NOW() - INTERVAL '24 hours'
    -- Exclude events we've already actioned
    AND NOT EXISTS (
      SELECT 1 FROM firewall_blacklist fb
      WHERE
        fb.threat_ref    = te.id
        AND fb.unblocked_at IS NULL
        AND fb.expires_at   > NOW()
    )
  ORDER BY te.risk_score DESC, te.created_at DESC
  LIMIT 50;
`;

/**
 * De-dup: check if a specific IP is already actively blocked.
 */
const IP_ALREADY_BLOCKED_SQL = `
  SELECT id FROM firewall_blacklist
  WHERE
    ip_address   = $1::INET
    AND unblocked_at IS NULL
    AND expires_at   > NOW()
  LIMIT 1;
`;

/**
 * Insert a new block into firewall_blacklist.
 * Returns the created row.
 */
const INSERT_BLOCK_SQL = `
  INSERT INTO firewall_blacklist
    (ip_address, reason, blocked_by, risk_score, threat_ref, expires_at)
  VALUES
    ($1::INET, $2, 'Sentinel-02/Enforcer', $3, $4::UUID, NOW() + ($5 || ' hours')::INTERVAL)
  RETURNING id, ip_address::TEXT, reason, expires_at::TEXT, created_at::TEXT;
`;

// ── enforceBlock() ────────────────────────────────────────────────────────────

/**
 * Add an IP address to the firewall_blacklist.
 * Called for each confirmed high-risk threat event.
 *
 * @param ctx        SandboxContext (write goes through ctx.writeThrough)
 * @param ipAddress  The source IP to block (INET format)
 * @param reason     Human-readable block reason
 * @param riskScore  Numeric score from threat_events.risk_score
 * @param threatRef  threat_events.id that triggered the block
 * @returns          The inserted firewall entry, or null if already blocked
 */
export async function enforceBlock(
  ctx:        SandboxContext,
  ipAddress:  string,
  reason:     string,
  riskScore:  number,
  threatRef:  string
): Promise<FirewallEntry | null> {
  // De-dup check (read via sandbox read-only pool)
  const { rows: existing } = await ctx.query<{ id: string }>(
    IP_ALREADY_BLOCKED_SQL,
    [ipAddress]
  );

  if (existing.length > 0) {
    console.info(
      `[Sentinel-02:Enforcer] IP ${ipAddress} already actively blocked — skipping.`
    );
    return null;
  }

  // Write the block through the approved write gate
  const [entry] = await ctx.writeThrough<FirewallEntry>(
    INSERT_BLOCK_SQL,
    [ipAddress, reason, riskScore, threatRef, BLOCK_TTL_HOURS.toString()]
  );

  return entry ?? null;
}

// ── Main agent function ────────────────────────────────────────────────────────

/**
 * Main agent function — execute inside runInSandbox().
 *
 * @example
 *   import { runInSandbox } from "../sentinelSandbox.js";
 *   import { runEnforcer, ENFORCER_SENTINEL_ID } from "./enforcerAgent.js";
 *
 *   await runInSandbox(ENFORCER_SENTINEL_ID, runEnforcer);
 */
export async function runEnforcer(ctx: SandboxContext): Promise<void> {
  console.info(
    `[Sentinel-02:Enforcer] Starting auto-block scan (threshold: risk_score > ${RISK_SCORE_THRESHOLD})...`
  );

  // ── Step 1: Scan for high-risk unblocked threats ───────────────────────────
  const { rows: threats } = await ctx.query<SuspiciousThreatEvent>(
    SCAN_HIGH_RISK_SQL,
    [RISK_SCORE_THRESHOLD]
  );

  if (threats.length === 0) {
    console.info("[Sentinel-02:Enforcer] No high-risk threats requiring enforcement. Clear.");
    return;
  }

  console.warn(
    `[Sentinel-02:Enforcer] ${threats.length} high-risk threat(s) require enforcement.`
  );

  let blocked = 0;
  let skipped = 0;

  for (const threat of threats) {
    const riskScore   = threat.risk_score ?? RISK_SCORE_THRESHOLD + 1;
    const sourceIps   = threat.payload?.source_ips ?? [];
    const endpoint    = threat.payload?.flagged_endpoint ?? "unknown endpoint";
    const blockedBy   = threat.payload?.flagged_by ?? "Sentinel-01/Auditor";

    if (sourceIps.length === 0) {
      // No IPs available in payload — log and skip (can't block without an IP)
      console.warn(
        `[Sentinel-02:Enforcer] threat ${threat.id} has no source_ips in payload — skipping block.`
      );
      skipped++;
      continue;
    }

    // Block each unique source IP associated with this threat event
    for (const ip of sourceIps) {
      const reason =
        `Auto-blocked by Sentinel-02: Low-and-Slow probe detected on ` +
        `${endpoint} (risk_score: ${riskScore.toFixed(1)}, flagged by ${blockedBy})`;

      try {
        const entry = await enforceBlock(ctx, ip, reason, riskScore, threat.id);

        if (entry) {
          blocked++;
          console.warn(
            `[Sentinel-02:Enforcer] 🔴 BLOCKED ${ip} ` +
            `— expires: ${entry.expires_at} — firewall_blacklist.id: ${entry.id}`
          );
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(
          `[Sentinel-02:Enforcer] Failed to block ${ip} for threat ${threat.id}:`,
          (err as Error).message
        );
        skipped++;
      }
    }
  }

  console.info(
    `[Sentinel-02:Enforcer] Enforcement complete. ` +
    `Threats processed: ${threats.length}, IPs blocked: ${blocked}, Skipped: ${skipped}.`
  );
}
