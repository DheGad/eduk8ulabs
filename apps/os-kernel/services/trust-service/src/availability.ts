/**
 * @file availability.ts
 * @service trust-service
 * @description MTBF/MTTR Availability Calculator — Sentinel Observability Suite
 *
 * Computes the system Availability Score using the standard SRE formula:
 *
 *   A = MTBF / (MTBF + MTTR)
 *
 * Where:
 *   MTBF = Mean Time Between Failures (seconds)
 *   MTTR = Mean Time To Repair / Recover (seconds)
 *
 * Data is read from the `service_incidents` table, which is written to
 * whenever the health check sweep detects a service failure.
 *
 * Usage in routes.ts:
 *   import { calculateAvailability, getAvailabilityReport } from "./availability.js";
 *   const report = await getAvailabilityReport(pool, 30); // last 30 days
 */

import { type Pool } from "pg";

// ================================================================
// TYPES
// ================================================================

export interface Incident {
  id:             string;
  service_name:   string;
  failure_at:     Date;
  recovery_at:    Date | null;
  /** Duration from failure_at to next failure_at (seconds) */
  time_to_next_failure_s?: number;
  /** Duration from failure_at to recovery_at (seconds) */
  time_to_repair_s?: number;
}

export interface ServiceAvailability {
  service_name:     string;
  mtbf_seconds:     number;
  mttr_seconds:     number;
  /** 0–1 (e.g. 0.9997 = 99.97%) */
  availability:     number;
  /** Human-readable (e.g. "99.97%") */
  availability_pct: string;
  /** SLA tier */
  sla_tier:         "five-nines" | "four-nines" | "three-nines" | "below-sla";
  incident_count:   number;
  window_days:      number;
}

export interface AvailabilityReport {
  generated_at:          string;  // ISO timestamp
  window_days:           number;
  services:              ServiceAvailability[];
  /** Aggregate across all services */
  system_availability:   ServiceAvailability;
}

// ================================================================
// CORE FORMULA
// ================================================================

/**
 * Computes availability from MTBF and MTTR.
 *   A = MTBF / (MTBF + MTTR)
 *
 * Edge cases:
 *   - No incidents (perfect): returns 1.0
 *   - Zero MTBF (instant failure, no recovery): returns 0.0
 */
export function computeAvailability(mtbf_s: number, mttr_s: number): number {
  if (mtbf_s === 0 && mttr_s === 0) return 1.0; // No data → assume perfect
  if (mtbf_s === 0) return 0.0;
  return mtbf_s / (mtbf_s + mttr_s);
}

function toPercent(a: number): string {
  return `${(a * 100).toFixed(4)}%`;
}

function slaClassify(a: number): ServiceAvailability["sla_tier"] {
  if (a >= 0.99999) return "five-nines";
  if (a >= 0.9999)  return "four-nines";
  if (a >= 0.999)   return "three-nines";
  return "below-sla";
}

// ================================================================
// POSTGRES CALCULATION
// ================================================================

/**
 * Computes MTBF and MTTR for one service from the incidents table.
 *
 * Table expected:
 *   CREATE TABLE IF NOT EXISTS service_incidents (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     service_name TEXT NOT NULL,
 *     failure_at   TIMESTAMPTZ NOT NULL,
 *     recovery_at  TIMESTAMPTZ,            -- NULL = still down
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */
async function computeForService(
  pool: Pool,
  serviceName: string,
  windowDays: number
): Promise<ServiceAvailability> {
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const { rows } = await pool.query<{
    failure_at:  string;
    recovery_at: string | null;
  }>(
    `SELECT failure_at, recovery_at
     FROM service_incidents
     WHERE service_name = $1 AND failure_at >= $2
     ORDER BY failure_at ASC`,
    [serviceName, since.toISOString()]
  );

  if (rows.length === 0) {
    // No recorded incidents → system treated as perfectly available
    return {
      service_name:     serviceName,
      mtbf_seconds:     windowDays * 86_400, // Entire window = uptime
      mttr_seconds:     0,
      availability:     1.0,
      availability_pct: "100.0000%",
      sla_tier:         "five-nines",
      incident_count:   0,
      window_days:      windowDays,
    };
  }

  // ── Calculate MTTR (per incident) ────────────────────────────
  const repairTimes: number[] = [];
  for (const row of rows) {
    if (row.recovery_at) {
      const failure = new Date(row.failure_at).getTime();
      const recovery = new Date(row.recovery_at).getTime();
      repairTimes.push((recovery - failure) / 1000);
    }
  }

  const mttr = repairTimes.length > 0
    ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length
    : 0;

  // ── Calculate MTBF (time between consecutive failures) ───────
  const betweenTimes: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].failure_at).getTime();
    const curr = new Date(rows[i].failure_at).getTime();
    betweenTimes.push((curr - prev) / 1000);
  }

  // If only one incident, MTBF = half the window (conservative estimate)
  const mtbf = betweenTimes.length > 0
    ? betweenTimes.reduce((a, b) => a + b, 0) / betweenTimes.length
    : (windowDays * 86_400) / 2;

  const availability = computeAvailability(mtbf, mttr);

  return {
    service_name:     serviceName,
    mtbf_seconds:     Math.round(mtbf),
    mttr_seconds:     Math.round(mttr),
    availability,
    availability_pct: toPercent(availability),
    sla_tier:         slaClassify(availability),
    incident_count:   rows.length,
    window_days:      windowDays,
  };
}

// ================================================================
// PUBLIC API
// ================================================================

const MONITORED_SERVICES = [
  "router-service",
  "enforcer-service",
  "vault-service",
  "usage-service",
  "sanitizer-service",
  "trust-service",
  "memory-service",
  "policy-service",
  "workflow-service",
];

/**
 * Generates the full system availability report for the God Mode dashboard.
 * Queries all services and aggregates a system-wide A score.
 *
 * @param pool      — Postgres connection pool
 * @param windowDays — Look-back window (default: 30 days)
 */
export async function getAvailabilityReport(
  pool: Pool,
  windowDays = 30
): Promise<AvailabilityReport> {
  const services = await Promise.all(
    MONITORED_SERVICES.map((s) => computeForService(pool, s, windowDays))
  );

  // System-wide aggregate: weighted harmonic mean of individual availabilities
  const totalMtbf = services.reduce((s, svc) => s + svc.mtbf_seconds, 0) / services.length;
  const totalMttr = services.reduce((s, svc) => s + svc.mttr_seconds, 0) / services.length;
  const sysAvail  = computeAvailability(totalMtbf, totalMttr);

  const system_availability: ServiceAvailability = {
    service_name:     "system",
    mtbf_seconds:     Math.round(totalMtbf),
    mttr_seconds:     Math.round(totalMttr),
    availability:     sysAvail,
    availability_pct: toPercent(sysAvail),
    sla_tier:         slaClassify(sysAvail),
    incident_count:   services.reduce((s, svc) => s + svc.incident_count, 0),
    window_days:      windowDays,
  };

  return {
    generated_at:        new Date().toISOString(),
    window_days:         windowDays,
    services,
    system_availability,
  };
}
