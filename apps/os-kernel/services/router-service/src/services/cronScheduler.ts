/**
 * @file services/cronScheduler.ts
 * @service router-service
 * @version V80
 * @description Distributed Autonomous Heartbeat (Cron Scheduler)
 *
 * Implements a horizontally scalable cron engine utilizing a Redis ZSET
 * to guarantee that recurring agent jobs fire reliably and never execute
 * twice across multiple router-service instances.
 */

import { randomUUID } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import { getQueueRedis, enqueueAgentJob, type AgentJobPayload } from "./agentQueue.js";
import { appendTraceEvent } from "../middleware/traceProvider.js";

// ----------------------------------------------------------------
// KEYS & CONFIG
// ----------------------------------------------------------------

const ZSET_SCHEDULE_KEY = "agent:cron:schedule";
const HASH_DATA_PREFIX  = "agent:schedules:data:";
const POLLING_INTERVAL_MS = 15000; // Poll every 15 seconds

let daemonTimer: NodeJS.Timeout | null = null;
let isPolling = false;

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export interface ScheduleData {
  schedule_id: string;
  tenantId:    string;
  userId:      string;
  cron_expression: string;
  /** Encoded JSON of the base AgentJobPayload to duplicate */
  payload_json: string; 
  created_at:  number;
}

// ----------------------------------------------------------------
// DAEMON CORE
// ----------------------------------------------------------------

export function startCronDaemon(): void {
  if (daemonTimer) {
    console.warn("[V80:CronDaemon] ⚠️  Daemon is already running.");
    return;
  }

  const redis = getQueueRedis();
  if (!redis) {
    console.warn("[V80:CronDaemon] ⚠️  Redis unavailable — Cron daemon disabled.");
    return;
  }

  // Fire immediately, then on interval
  pollSchedules().catch((err) => console.error(`[V80:CronDaemon] Initial poll error: ${(err as Error).message}`));

  daemonTimer = setInterval(() => {
    pollSchedules().catch((err) => console.error(`[V80:CronDaemon] Poll error: ${(err as Error).message}`));
  }, POLLING_INTERVAL_MS);

  console.log("[V80:CronDaemon] ⏱️  Distributed ZSET Scheduler Active.");
}

export function stopCronDaemon(): void {
  if (daemonTimer) {
    clearInterval(daemonTimer);
    daemonTimer = null;
    console.log("[V80:CronDaemon] 🛑  Daemon stopped gracefully.");
  }
}

/**
 * Sweeps the ZSET for due jobs, atomically claims them, pushes them to the
 * agent queue, and re-schedules them for their next interval.
 */
async function pollSchedules(): Promise<void> {
  if (isPolling) return; // Prevent overlapped sweeps
  isPolling = true;

  const redis = getQueueRedis();
  if (!redis) {
    isPolling = false;
    return;
  }

  try {
    const nowMs = Date.now();

    // 1. Find all schedule_ids whose score (next run ms) is <= now
    // Taking 10 at a time to prevent blocking the event loop or Redis too long
    const dueJobs = await redis.zrangebyscore(ZSET_SCHEDULE_KEY, "-inf", nowMs, "LIMIT", 0, 10);

    if (dueJobs.length === 0) {
      isPolling = false;
      return;
    }

    for (const schedule_id of dueJobs) {
      // 2. ATOMIC LOCK: Try to remove it from the ZSET
      // If we remove it successfully (returns 1), we own this execution.
      // If another instance removed it first (returns 0), we skip it.
      const removeCount = await redis.zrem(ZSET_SCHEDULE_KEY, schedule_id);
      if (removeCount !== 1) {
        continue; // Someone else claimed it
      }

      // 3. FETCH PAYLOAD
      const dataKey = `${HASH_DATA_PREFIX}${schedule_id}`;
      const rawData = await redis.get(dataKey);

      if (!rawData) {
        console.warn(`[V80:CronDaemon] ⚠️  Claimed schedule ${schedule_id} but no Hash data found. Discarding.`);
        continue; // Orphaned ZSET member
      }

      let data: ScheduleData;
      try {
        data = JSON.parse(rawData);
      } catch {
        console.warn(`[V80:CronDaemon] ⚠️  Corrupted Hash data for ${schedule_id}. Discarding.`);
        await redis.del(dataKey);
        continue;
      }

      console.info(`[V80:CronDaemon] 📥 Claimed schedule ${schedule_id} execution.`);

      // 4. GENERATE NEW TRACE & ENQUEUE
      let basePayload: Partial<AgentJobPayload> = {};
      try {
        basePayload = JSON.parse(data.payload_json);
      } catch { /* Handled gracefully below */ }

      // We stamp a FRESH trace ID and timestamp onto the cron-triggered payload
      const runTraceId = randomUUID();
      const runTraceStartedAt = Date.now();

      const freshPayload: AgentJobPayload = {
        userId:         data.userId,
        tenantId:       data.tenantId,
        prompt:         basePayload.prompt         ?? "No prompt provided",
        provider:       basePayload.provider       ?? "openai",
        model:          basePayload.model          ?? "gpt-4o",
        mode:           basePayload.mode           ?? "single",
        rbacRole:       basePayload.rbacRole       ?? null,
        classification: basePayload.classification ?? undefined,
        traceId:        runTraceId,
        traceStartedAt: runTraceStartedAt,
      };

      appendTraceEvent(runTraceId, runTraceStartedAt, "CRON_TRIGGER_FIRED", {
        schedule_id,
        cron_expression: data.cron_expression,
      });

      // Fire it into the standard V76 queue pipeline
      try {
        const jobId = await enqueueAgentJob(freshPayload);
        appendTraceEvent(runTraceId, runTraceStartedAt, "ASYNC_JOB_QUEUED", {
          job_id: jobId,
          mode: freshPayload.mode,
          via: "CRON_DAEMON",
        });
        console.info(`[V80:CronDaemon] 🚀 Spawned CRON job_id=${jobId} (schedule=${schedule_id})`);
      } catch (enqueueErr) {
        console.error(`[V80:CronDaemon] ❌ Failed to enqueue cron job: ${(enqueueErr as Error).message}`);
      }

      // 5. CALCULATE NEXT TICK AND RESCHEDULE
      // We do this EVEN IF enqueue fails, to prevent the schedule from dying forever.
      try {
        const interval = CronExpressionParser.parse(data.cron_expression);
        const nextMs = interval.next().getTime();

        await redis.zadd(ZSET_SCHEDULE_KEY, nextMs, schedule_id);
      } catch (parseErr) {
        console.error(`[V80:CronDaemon] ❌ Failed to parse cron "${data.cron_expression}" for schedule ${schedule_id}. Dropping from ZSET.`);
        // Note: we don't ZADD, effectively retiring the invalid schedule.
      }
    }

  } catch (err) {
    console.error(`[V80:CronDaemon] ❌ Fatal sweep error: ${(err as Error).message}`);
  } finally {
    isPolling = false;
  }
}

// ----------------------------------------------------------------
// PUBLIC API INTERFACES
// ----------------------------------------------------------------

/**
 * Registers a new recurring schedule and inserts it into the ZSET.
 */
export async function scheduleAgentJob(
  tenantId: string,
  userId: string,
  cronExpression: string,
  basePayload: Omit<AgentJobPayload, "traceId" | "traceStartedAt">
): Promise<{ schedule_id: string; next_run_epochms: number }> {
  const redis = getQueueRedis();
  if (!redis) {
    throw new Error("Queue Redis is currently offline.");
  }

  // 1. Validate Cron Expression
  let nextDate: Date;
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    nextDate = interval.next().toDate();
  } catch (err) {
    throw new Error(`Invalid cron_expression: ${(err as Error).message}`);
  }

  const schedule_id = `sched_${randomUUID()}`;
  const nextMs = nextDate.getTime();

  // 2. Build Persistence Structure
  const data: ScheduleData = {
    schedule_id,
    tenantId,
    userId,
    cron_expression: cronExpression,
    payload_json: JSON.stringify(basePayload),
    created_at: Date.now(),
  };

  const dataKey = `${HASH_DATA_PREFIX}${schedule_id}`;

  // 3. Atomically persist data and add to ZSET
  const multi = redis.multi();
  multi.set(dataKey, JSON.stringify(data));
  multi.zadd(ZSET_SCHEDULE_KEY, nextMs, schedule_id);

  const results = await multi.exec();
  if (!results) {
    throw new Error("Failed to execute Redis transaction for scheduling.");
  }

  for (const [err] of results) {
    if (err) throw err;
  }

  console.info(`[V80:CronSchedule] 🗓️  New schedule created: ${schedule_id} running at "${cronExpression}"`);

  return { schedule_id, next_run_epochms: nextMs };
}

/**
 * Deletes a schedule, preventing it from ever firing again.
 */
export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  const redis = getQueueRedis();
  if (!redis) {
    throw new Error("Queue Redis is currently offline.");
  }

  // Atomically remove from ZSET and delete Hash metadata
  const multi = redis.multi();
  multi.zrem(ZSET_SCHEDULE_KEY, scheduleId);
  multi.del(`${HASH_DATA_PREFIX}${scheduleId}`);

  const results = await multi.exec();
  if (!results) {
    throw new Error("Failed to execute Redis transaction for deletion.");
  }

  for (const [err] of results) {
    if (err) throw err;
  }

  console.info(`[V80:CronSchedule] 🗑️  Deleted schedule: ${scheduleId}`);
  // If the ZREM returned 1, it means it was actively queued. We consider it success regardless.
  return true;
}
