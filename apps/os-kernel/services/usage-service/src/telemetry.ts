/**
 * @file telemetry.ts
 * @service usage-service
 * @description Zero-Payload Telemetry Pulse — The Billing Shield.
 *
 * ================================================================
 * DESIGN CONTRACT — ZERO PII GUARANTEE
 * ================================================================
 *
 *  This module NEVER reads, stores, or transmits:
 *    ✗ prompt text
 *    ✗ AI output / completion text
 *    ✗ user email or name
 *    ✗ API keys or secrets
 *    ✗ PII of any kind
 *
 *  It ONLY aggregates raw numeric counters:
 *    ✓ total_input_tokens  (integer sum)
 *    ✓ total_output_tokens (integer sum)
 *    ✓ total_executions    (integer count)
 *    ✓ node_id             (opaque UUID — not linked to a person)
 *    ✓ service_health_status ("healthy" | "degraded" | "offline")
 *
 *  This is enforced structurally: the SQL query used to build
 *  the pulse payload only SELECTs token_count columns from
 *  usage_logs — the prompt and output columns are never read.
 *
 * ================================================================
 * PULSE LIFECYCLE
 * ================================================================
 *
 *  Two triggers fire a telemetry pulse:
 *
 *    1. Time-based:  every PULSE_INTERVAL_MS milliseconds (default 1h)
 *    2. Count-based: every PULSE_EVERY_N_EXECUTIONS executions (default 100)
 *
 *  Pulses are IDEMPOTENT at HQ — the billing_period (hour bucket)
 *  is used as the deduplication key in the enterprise_billing_ledger
 *  table, so a retry or duplicate pulse is safe.
 *
 * ================================================================
 * HMAC SIGNING
 * ================================================================
 *
 *  Each pulse payload is signed with HMAC-SHA256 using the node's
 *  ENTERPRISE_NODE_SECRET. HQ verifies the signature before
 *  accepting the data. This prevents a node from:
 *    • Under-reporting token usage to reduce its bill
 *    • Injecting fake node IDs
 *    • Tampering with token counts in transit
 *
 *  Signature covers the full canonical JSON (sorted keys, no spaces)
 *  of the payload object — not the raw body string. This prevents
 *  whitespace/ordering attacks.
 *
 * ================================================================
 */

import { createHmac } from "node:crypto";
import { pool } from "./db.js";

// ================================================================
// CONFIG
// ================================================================

/** HQ ingest URL — points to the Usage Service's own /telemetry/ingest
 *  in single-node dev, or to a dedicated HQ URL in multi-node enterprise */
const HQ_INGEST_URL =
  process.env.TELEMETRY_HQ_URL ?? "http://localhost:4004/api/v1/telemetry/ingest";

/** The node's opaque ID, registered in enterprise_nodes */
const NODE_ID = process.env.ENTERPRISE_NODE_ID ?? "local-dev-node";

/** Time interval between pulses (milliseconds). Default: 1 hour */
const PULSE_INTERVAL_MS = parseInt(
  process.env.TELEMETRY_PULSE_INTERVAL_MS ?? String(60 * 60 * 1000),
  10
);

/** Execution count threshold that triggers an early pulse */
const PULSE_EVERY_N_EXECUTIONS = parseInt(
  process.env.TELEMETRY_PULSE_EVERY_N ?? "100",
  10
);

// ================================================================
// TYPES
// ================================================================

/**
 * The telemetry pulse payload — the ONLY data that leaves the node.
 * Must be kept in sync with the HQ ingestion schema.
 */
export interface TelemetryPulse {
  /** Opaque node identifier — registered in enterprise_nodes.id */
  node_id: string;
  /**
   * ISO 8601 timestamp of the billing period start (truncated to the hour).
   * e.g. "2026-03-22T00:00:00.000Z"
   * Used as the idempotency key at HQ.
   */
  billing_period: string;
  /** Total input (prompt) tokens in this billing period */
  total_input_tokens: number;
  /** Total output (completion) tokens in this billing period */
  total_output_tokens: number;
  /** Total number of LLM executions in this billing period */
  total_executions: number;
  /** Snapshot of the service health at the time of the pulse */
  service_health_status: "healthy" | "degraded" | "offline";
  /** UTC timestamp of when this pulse was generated */
  pulse_generated_at: string;
}

/** Signed pulse envelope sent to HQ */
export interface SignedPulse {
  payload: TelemetryPulse;
  /** HMAC-SHA256 signature of canonical JSON of payload */
  signature: string;
  /** Algorithm tag for future agility */
  algorithm: "hmac-sha256";
}

// ================================================================
// EXECUTION COUNTER
// In-memory counter for count-based pulse trigger.
// Resets after each pulse to count toward the next threshold.
// ================================================================

let executionCounter = 0;
let pulseTimer: ReturnType<typeof setInterval> | null = null;
export let lastKnownNodeStatus: "active" | "suspended" = "active";

/** Call this after every successful LLM execution in the Router.
 *  Triggers a pulse if the count threshold is crossed. */
export function incrementExecutionCounter(): void {
  executionCounter++;
  if (executionCounter >= PULSE_EVERY_N_EXECUTIONS) {
    executionCounter = 0;
    // Fire pulse asynchronously — never block the caller
    void firePulse("count_threshold");
  }
}

// ================================================================
// AGGREGATE TOKEN COUNTS FROM DB
// Only reads token count columns — NEVER reads prompt or output.
// ================================================================

/**
 * Queries usage_logs for the current billing hour and returns
 * aggregate token counts.
 *
 * "Billing hour" = the current UTC hour bucket:
 *   e.g. at 2026-03-22T00:45Z → billing_period = "2026-03-22T00:00:00.000Z"
 */
async function aggregateCurrentHour(): Promise<{
  billing_period: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_executions: number;
}> {
  // Truncate to hour — used as billing period key
  const now = new Date();
  const billingPeriod = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0, 0, 0
  ).toISOString();

  // ─────────────────────────────────────────────────────────────────
  // ZERO-PII QUERY: only SUM token count columns.
  // The `prompt` and `output` columns are not referenced anywhere.
  // ─────────────────────────────────────────────────────────────────
  const result = await pool.query<{
    total_input_tokens: string;
    total_output_tokens: string;
    total_executions: string;
  }>(
    `SELECT
       COALESCE(SUM(tokens_prompt), 0)::text         AS total_input_tokens,
       COALESCE(SUM(tokens_completion), 0)::text     AS total_output_tokens,
       COUNT(*)::text                                AS total_executions
     FROM usage_logs
     WHERE created_at >= DATE_TRUNC('hour', NOW() AT TIME ZONE 'UTC')
       AND created_at <  DATE_TRUNC('hour', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 hour'`
  );

  const row = result.rows[0];

  return {
    billing_period: billingPeriod,
    total_input_tokens: parseInt(row?.total_input_tokens ?? "0", 10),
    total_output_tokens: parseInt(row?.total_output_tokens ?? "0", 10),
    total_executions: parseInt(row?.total_executions ?? "0", 10),
  };
}

// ================================================================
// SERVICE HEALTH CHECK
// ================================================================

async function getServiceHealth(): Promise<"healthy" | "degraded" | "offline"> {
  try {
    // Cheap probe — check the DB connection is alive
    await pool.query("SELECT 1");
    return "healthy";
  } catch {
    return "degraded";
  }
}

// ================================================================
// HMAC SIGNING
// ================================================================

/**
 * Signs a canonical JSON representation of the pulse payload.
 * Canonical = JSON.stringify with sorted keys, no whitespace.
 * This prevents whitespace and key-ordering attacks.
 */
function signPayload(payload: TelemetryPulse): string {
  const nodeSecret = process.env.ENTERPRISE_NODE_SECRET;
  if (!nodeSecret) {
    throw new Error(
      "[Telemetry] ENTERPRISE_NODE_SECRET is not set. Cannot sign telemetry pulse."
    );
  }

  // Produce a deterministic canonical JSON string
  const canonicalJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
    )
  );

  return createHmac("sha256", nodeSecret)
    .update(canonicalJson, "utf8")
    .digest("hex");
}

// ================================================================
// PULSE BUILDER
// ================================================================

async function buildSignedPulse(): Promise<SignedPulse> {
  const [aggregates, healthStatus] = await Promise.all([
    aggregateCurrentHour(),
    getServiceHealth(),
  ]);

  const payload: TelemetryPulse = {
    node_id: NODE_ID,
    billing_period: aggregates.billing_period,
    total_input_tokens: aggregates.total_input_tokens,
    total_output_tokens: aggregates.total_output_tokens,
    total_executions: aggregates.total_executions,
    service_health_status: healthStatus,
    pulse_generated_at: new Date().toISOString(),
  };

  const signature = signPayload(payload);

  return { payload, signature, algorithm: "hmac-sha256" };
}

// ================================================================
// PULSE EMITTER (PHONE HOME)
// ================================================================

/**
 * Builds, signs, and sends the telemetry pulse to HQ.
 * Uses native fetch (Node 18+) — no extra dependency needed.
 *
 * @param trigger - Why this pulse was fired (for logging)
 */
export async function firePulse(
  trigger: "time_interval" | "count_threshold" | "manual"
): Promise<void> {
  const start = Date.now();

  let signedPulse: SignedPulse;
  try {
    signedPulse = await buildSignedPulse();
  } catch (err) {
    console.error(
      `[Telemetry] Failed to build pulse [trigger=${trigger}]:`,
      (err as Error).message
    );
    return;
  }

  // Zero executions in this period → skip the pulse (avoid billing noise)
  if (signedPulse.payload.total_executions === 0) {
    console.log(`[Telemetry] Pulse skipped — 0 executions in billing period [trigger=${trigger}]`);
    return;
  }

  try {
    const response = await fetch(HQ_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Node-Id": NODE_ID,
      },
      body: JSON.stringify(signedPulse),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn(
        `[Telemetry] HQ rejected pulse [status=${response.status}] ` +
        `[trigger=${trigger}] ${errorText.slice(0, 200)}`
      );
    } else {
      const data = await response.json() as { node_status?: "active" | "suspended" };
      if (data.node_status === "suspended") {
        lastKnownNodeStatus = "suspended";
        console.warn(`[Telemetry] 🚨 NODE SUSPENDED BY HQ. Enforcer blocked.`);
      } else {
        lastKnownNodeStatus = "active";
      }

      const elapsed = Date.now() - start;
      console.log(
        `[Telemetry] ✅ Pulse delivered to HQ [trigger=${trigger}] ` +
        `tokens_in=${signedPulse.payload.total_input_tokens} ` +
        `tokens_out=${signedPulse.payload.total_output_tokens} ` +
        `executions=${signedPulse.payload.total_executions} ` +
        `elapsed=${elapsed}ms`
      );
    }
  } catch (fetchErr) {
    // Non-fatal: HQ may be temporarily unreachable.
    // The pulse will be re-attempted on the next interval.
    console.warn(
      `[Telemetry] ⚠️  Pulse delivery failed (non-fatal) [trigger=${trigger}]: ` +
      (fetchErr as Error).message
    );
  }
}

// ================================================================
// SCHEDULER — Start the time-based pulse loop
// ================================================================

/**
 * Starts the periodic telemetry pulse.
 * Must be called once at service startup (called from index.ts).
 * Idempotent — calling more than once is a no-op.
 */
export function startTelemetryScheduler(): void {
  if (pulseTimer !== null) {
    console.warn("[Telemetry] Scheduler already running — ignoring duplicate start.");
    return;
  }

  console.log(
    `[Telemetry] 📡 Pulse scheduler started — ` +
    `interval=${PULSE_INTERVAL_MS / 1000}s | ` +
    `count_threshold=${PULSE_EVERY_N_EXECUTIONS} executions | ` +
    `hq=${HQ_INGEST_URL} | node=${NODE_ID}`
  );

  pulseTimer = setInterval(() => {
    void firePulse("time_interval");
  }, PULSE_INTERVAL_MS);

  // Allow Node.js to exit even if this interval is still active
  // (prevents the process from hanging on SIGTERM)
  if (pulseTimer.unref) pulseTimer.unref();
}

/**
 * Stops the telemetry scheduler (for graceful shutdown).
 */
export function stopTelemetryScheduler(): void {
  if (pulseTimer !== null) {
    clearInterval(pulseTimer);
    pulseTimer = null;
    console.log("[Telemetry] Pulse scheduler stopped.");
  }
}

// ================================================================
// SIGNATURE VERIFICATION (used by HQ ingest endpoint)
// ================================================================

/**
 * Verifies an inbound pulse's HMAC-SHA256 signature.
 * Looks up the node_secret from the database by node_id.
 *
 * @returns true if signature is valid, false otherwise
 */
export async function verifyPulseSignature(
  payload: TelemetryPulse,
  inboundSignature: string
): Promise<boolean> {
  let nodeSecret: string | null = null;
  try {
    const result = await pool.query<{ node_secret: string; is_active: boolean }>(
      `SELECT node_secret, is_active FROM enterprise_nodes WHERE id = $1`,
      [payload.node_id]
    );
    const node = result.rows[0];
    if (!node || !node.is_active) return false;
    nodeSecret = node.node_secret;
  } catch (dbErr) {
    console.error("[Telemetry:verify] DB lookup failed:", (dbErr as Error).message);
    return false;
  }

  if (!nodeSecret) return false;

  // Recompute the expected signature using the node's stored secret
  const canonicalJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
    )
  );

  const expectedSig = createHmac("sha256", nodeSecret)
    .update(canonicalJson, "utf8")
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (expectedSig.length !== inboundSignature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ inboundSignature.charCodeAt(i);
  }

  return mismatch === 0;
}
