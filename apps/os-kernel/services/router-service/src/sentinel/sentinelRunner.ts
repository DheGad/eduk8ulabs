/**
 * @file sentinelRunner.ts
 * @service router-service
 * @phase Phase 3 / 3.2 — The Sentinel Layer
 * @description
 *   Cron-style runner that schedules all registered Sentinel agents.
 *   Import and call `startSentinelRunner()` from index.ts to activate.
 *
 *   Default schedule:
 *     - Sentinel-01 / The Auditor  runs every 15 minutes.
 *     - Sentinel-02 / The Enforcer runs every 5 minutes.
 *
 *   The runner catches all errors from `runInSandbox` so that agent failures
 *   never crash the main OS kernel process.
 */

import { runInSandbox } from "./sentinelSandbox.js";
import { runAuditor,  AUDITOR_SENTINEL_ID  } from "./agents/auditorAgent.js";
import { runEnforcer, ENFORCER_SENTINEL_ID } from "./agents/enforcerAgent.js";

const AUDITOR_INTERVAL_MS  = 15 * 60 * 1000; //  15 minutes
const ENFORCER_INTERVAL_MS =  5 * 60 * 1000; //   5 minutes

let _started = false;
const _timers: NodeJS.Timeout[] = [];

/**
 * Start the Sentinel agent scheduler.
 * Safe to call multiple times — idempotent after first call.
 */
export function startSentinelRunner(): void {
  if (_started) return;
  _started = true;

  console.info("[SentinelRunner] 🛡  Phase 3 Sentinel Layer is LIVE.");

  // ── Sentinel-01: The Auditor ────────────────────────────────────────────────
  const runAuditorSafe = async () => {
    try {
      await runInSandbox(AUDITOR_SENTINEL_ID, runAuditor);
    } catch (err) {
      console.error("[SentinelRunner] Auditor run failed:", (err as Error).message);
    }
  };

  // First run: slight delay so DB pools can warm up after process start
  _timers.push(setTimeout(() => void runAuditorSafe(), 10_000));
  _timers.push(setInterval(() => void runAuditorSafe(), AUDITOR_INTERVAL_MS));

  console.info(
    `[SentinelRunner] Sentinel-01/Auditor scheduled — first run in 10 s, ` +
    `then every ${AUDITOR_INTERVAL_MS / 60_000} minutes.`
  );

  // ── Sentinel-02: The Enforcer ───────────────────────────────────────────────
  const runEnforcerSafe = async () => {
    try {
      await runInSandbox(ENFORCER_SENTINEL_ID, runEnforcer);
    } catch (err) {
      console.error("[SentinelRunner] Enforcer run failed:", (err as Error).message);
    }
  };

  // Offset by 30 s so Auditor and Enforcer don't start at the same instant
  _timers.push(setTimeout(() => void runEnforcerSafe(), 30_000));
  _timers.push(setInterval(() => void runEnforcerSafe(), ENFORCER_INTERVAL_MS));

  console.info(
    `[SentinelRunner] Sentinel-02/Enforcer scheduled — first run in 30 s, ` +
    `then every ${ENFORCER_INTERVAL_MS / 60_000} minutes.`
  );
}

/**
 * Stop all sentinel timers. Call during graceful shutdown.
 */
export function stopSentinelRunner(): void {
  _timers.forEach((t) => clearTimeout(t));
  _timers.length = 0;
  _started = false;
  console.info("[SentinelRunner] Sentinel Layer shut down.");
}
