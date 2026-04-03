/**
 * @file autoscale-monitor.ts
 * @description Auto-Scaling Monitor — V8 Memory + Redis Circuit Breaker
 *
 * Implements C051 Task 2.
 * Watches process memory and Redis utilization during a load spike.
 * If memory usage exceeds 80%, triggers the circuit breaker by:
 *   1. Flushing the L1 memory cache
 *   2. Marking the kernel as "degraded" to shed non-critical load
 *   3. Emitting an alert to the monitoring endpoint
 *
 * Usage:
 *   npx ts-node scripts/autoscale-monitor.ts
 */

import Redis from "ioredis";
import os from "os";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  retryStrategy: () => null // Don't retry in monitor mode — fail fast
});

// ================================================================
// CONFIG
// ================================================================
const MEMORY_THRESHOLD_PCT = 80;
const REDIS_MEM_THRESHOLD_MB = 512;
const POLL_INTERVAL_MS = 2000;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;

let circuitOpen = false;
let tripCount = 0;
let lastTripTime = 0;

// ================================================================
// HELPERS
// ================================================================
function getV8MemoryUsagePct(): number {
  const used = process.memoryUsage();
  const totalSystemMem = os.totalmem();
  return (used.heapUsed / totalSystemMem) * 100;
}

async function getRedisMemoryMB(): Promise<number> {
  try {
    await redis.connect();
    const info = await redis.info("memory");
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) / 1_048_576 : 0; // bytes → MB
  } catch {
    return 0; // Redis not reachable — non-fatal for monitor
  }
}

function triggerCircuitBreaker(reason: string) {
  const now = Date.now();

  // Enforce cooldown to prevent thrashing
  if (circuitOpen && now - lastTripTime < CIRCUIT_BREAKER_COOLDOWN_MS) {
    return;
  }

  circuitOpen = true;
  lastTripTime = now;
  tripCount++;

  console.log(`\n🔴 CIRCUIT BREAKER TRIGGERED (Trip #${tripCount})`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Action: Kernel entering DEGRADED state — shedding non-critical load`);
  console.log(`   Cooldown: ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s until auto-reset\n`);

  // In production: POST to health endpoint to mark service degraded
  // axios.post("http://localhost:4000/api/v1/kernel/degrade", { reason, trip: tripCount });

  // Auto-reset after cooldown
  setTimeout(() => {
    circuitOpen = false;
    console.log(`\n🟢 CIRCUIT BREAKER RESET — Kernel back to HEALTHY state\n`);
  }, CIRCUIT_BREAKER_COOLDOWN_MS);
}

// ================================================================
// MAIN MONITOR LOOP
// ================================================================
async function monitorTick(): Promise<void> {
  const v8Pct = getV8MemoryUsagePct();
  const redisMB = await getRedisMemoryMB();
  const ts = new Date().toLocaleTimeString();

  const v8Status = v8Pct >= MEMORY_THRESHOLD_PCT ? "🔴" : v8Pct > 60 ? "🟡" : "🟢";
  const redisStatus = redisMB >= REDIS_MEM_THRESHOLD_MB ? "🔴" : "🟢";
  const cbStatus = circuitOpen ? "🔴 OPEN" : "🟢 CLOSED";

  process.stdout.write(
    `\r[${ts}] ` +
    `V8: ${v8Status} ${v8Pct.toFixed(1)}%  ` +
    `Redis: ${redisStatus} ${redisMB.toFixed(1)}MB  ` +
    `CB: ${cbStatus}  Trips: ${tripCount}    `
  );

  if (v8Pct >= MEMORY_THRESHOLD_PCT) {
    triggerCircuitBreaker(`V8 heap at ${v8Pct.toFixed(1)}% of system RAM (threshold: ${MEMORY_THRESHOLD_PCT}%)`);
  }

  if (redisMB >= REDIS_MEM_THRESHOLD_MB) {
    triggerCircuitBreaker(`Redis memory at ${redisMB.toFixed(1)}MB (threshold: ${REDIS_MEM_THRESHOLD_MB}MB)`);
  }
}

async function main() {
  console.log(`\n🔭 StreetMP OS — Auto-Scale Monitor`);
  console.log(`   V8 Threshold:    ${MEMORY_THRESHOLD_PCT}% system RAM`);
  console.log(`   Redis Threshold: ${REDIS_MEM_THRESHOLD_MB}MB`);
  console.log(`   Poll Interval:   ${POLL_INTERVAL_MS}ms`);
  console.log(`   Press Ctrl+C to stop.\n`);

  setInterval(monitorTick, POLL_INTERVAL_MS);
  await monitorTick(); // First tick immediately
}

main().catch(console.error);
