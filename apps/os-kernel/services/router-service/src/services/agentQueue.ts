/**
 * @file services/agentQueue.ts
 * @service router-service
 * @version V76
 * @description Asynchronous Agent Job Queue — Redis-backed task store
 *
 * ================================================================
 * DESIGN CONTRACT
 * ================================================================
 *
 * Breaks the synchronous HTTP request/response cycle for heavy
 * agentic tasks. Instead of holding the HTTP connection open while
 * the LLM iterates through multiple tool calls (potentially minutes),
 * the endpoint returns immediately with a job_id so the client
 * can poll for the result.
 *
 * KEY SPACES
 * ──────────
 *   agent:queue:pending           — Redis List  (LPUSH/BRPOP queue)
 *   agent:job:{job_id}:status     — Redis Hash  (JobRecord)
 *   agent:result:{job_id}         — Redis String (final LLM output)
 *
 * FAIL-OPEN GUARANTEE
 * ───────────────────
 *   If Redis is unavailable, enqueueAgentJob() returns a job_id
 *   but the job cannot be processed. updateJobStatus() is a no-op.
 *   The main Express server MUST NOT crash on queue failures.
 *
 * TTL POLICY
 * ──────────
 *   Job status records: 24h  (enough for any frontend polling window)
 *   Job result records: 24h  (consumer picks up once, but retry-safe)
 *
 * ================================================================
 */

import { randomUUID } from "node:crypto";
import { Redis, type RedisOptions } from "ioredis";

// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------

export const AGENT_QUEUE_KEY       = "agent:queue:pending";
export const JOB_STATUS_PREFIX     = "agent:job:";
export const JOB_RESULT_PREFIX     = "agent:result:";
export const JOB_TTL_SECONDS       = 24 * 60 * 60; // 24h

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export type JobStatus = "PENDING" | "PROCESSING" | "AWAITING_APPROVAL" | "COMPLETED" | "FAILED";

export interface AgentJobPayload {
  /** User who submitted the job */
  userId:      string;
  /** Tenant isolation boundary */
  tenantId:    string;
  /** The raw prompt to run through the full V76/V77 tool loop */
  prompt:      string;
  /** LLM provider: "openai" | "anthropic" */
  provider:    string;
  /** Model name, e.g. "gpt-4o" */
  model:       string;
  /** V70 trace ID inherited from the original HTTP request */
  traceId:     string;
  /** Millisecond timestamp the trace started */
  traceStartedAt: number;
  /** RBAC role from the session context */
  rbacRole:    string | null;
  /** Optional RBAC classification label */
  classification?: string;
  /**
   * Execution mode:
   *   "single" — V76 standard single-agent tool loop (default)
   *   "swarm"  — V77 multi-agent COORDINATOR→RESEARCHER→SYNTHESIZER pipeline
   */
  mode?: "single" | "swarm";
}

export interface JobRecord {
  job_id:        string;
  status:        JobStatus;
  tenant_id:     string;
  user_id:       string;
  trace_id:      string;
  queued_at:     string;     // ISO timestamp
  started_at?:   string;
  completed_at?: string;
  error?:        string;
}

// ----------------------------------------------------------------
// REDIS CLIENT (lazy singleton, fail-open)
// ----------------------------------------------------------------

let queueRedis: Redis | null = null;
let connectAttempted = false;

export function getQueueRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (!connectAttempted) {
      console.warn(
        "[V76:AgentQueue] REDIS_URL not set — async queue disabled. " +
        "Jobs will be rejected with 503."
      );
      connectAttempted = true;
    }
    return null;
  }

  if (queueRedis) return queueRedis;
  connectAttempted = true;

  try {
    queueRedis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 5) {
          console.warn(`[V76:AgentQueue] Redis retries exhausted (${times}) — queue offline.`);
          return null;
        }
        return Math.min(times * 300, 2000);
      },
      connectTimeout: 5000,
      commandTimeout: 3000,
      lazyConnect: false,
      enableOfflineQueue: false,
    } satisfies RedisOptions);

    queueRedis.on("connect", () => {
      console.log("[V76:AgentQueue] ✅ Redis connected — async agent queue active.");
    });
    queueRedis.on("error", (err: Error) => {
      // Non-fatal — queue offline, sync fallback still works
      console.warn(`[V76:AgentQueue] Redis error (non-fatal): ${err.message}`);
    });
    queueRedis.on("close", () => {
      console.warn("[V76:AgentQueue] Redis closed — queue inactive.");
      queueRedis = null;
    });
  } catch (err) {
    console.warn("[V76:AgentQueue] Failed to initialize Redis client:", (err as Error).message);
    return null;
  }

  return queueRedis;
}

// ----------------------------------------------------------------
// ENQUEUE
// ----------------------------------------------------------------

/**
 * Pushes an agent job payload onto the pending queue.
 * Returns a unique job_id immediately — never waits for the LLM.
 *
 * @returns job_id string, or throws if Redis is unavailable
 */
export async function enqueueAgentJob(
  payload:  AgentJobPayload
): Promise<string> {
  const redis = getQueueRedis();
  if (!redis) {
    throw new Error(
      "[V76:AgentQueue] Redis unavailable — cannot enqueue async job. " +
      "Use /api/v1/execute for synchronous execution."
    );
  }

  const job_id  = randomUUID();
  const queuedAt = new Date().toISOString();

  // 1. Write initial job status record
  const statusKey = `${JOB_STATUS_PREFIX}${job_id}:status`;
  const record: JobRecord = {
    job_id,
    status:    "PENDING",
    tenant_id: payload.tenantId,
    user_id:   payload.userId,
    trace_id:  payload.traceId,
    queued_at: queuedAt,
  };

  await redis.hset(statusKey, record as unknown as Record<string, string>);
  await redis.expire(statusKey, JOB_TTL_SECONDS);

  // 2. Serialize the full payload and push to the queue list
  const message = JSON.stringify({ job_id, ...payload, queued_at: queuedAt });
  await redis.lpush(AGENT_QUEUE_KEY, message);

  console.info(
    `[V76:AgentQueue] ✉️  Job enqueued — job_id=${job_id} ` +
    `tenant=${payload.tenantId} trace=${payload.traceId}`
  );

  return job_id;
}

// ----------------------------------------------------------------
// STATUS UPDATE
// ----------------------------------------------------------------

/**
 * Updates the job status hash in Redis.
 * Non-throwing — queue failures must NEVER affect the worker loop.
 */
export async function updateJobStatus(
  job_id:  string,
  status:  JobStatus,
  fields?: Partial<Pick<JobRecord, "started_at" | "completed_at" | "error">>
): Promise<void> {
  const redis = getQueueRedis();
  if (!redis) return;

  const statusKey = `${JOB_STATUS_PREFIX}${job_id}:status`;

  try {
    const update: Record<string, string> = { status };
    if (fields?.started_at)   update.started_at   = fields.started_at;
    if (fields?.completed_at) update.completed_at = fields.completed_at;
    if (fields?.error)        update.error         = fields.error;

    await redis.hset(statusKey, update);
    // Reset TTL on every update so long-running jobs don't expire mid-flight
    await redis.expire(statusKey, JOB_TTL_SECONDS);
  } catch (err) {
    console.warn(
      `[V76:AgentQueue] updateJobStatus failed (non-fatal): ${(err as Error).message}`
    );
  }
}

// ----------------------------------------------------------------
// RESULT STORE
// ----------------------------------------------------------------

/**
 * Saves the completed agent output to Redis with a 24h TTL.
 * Non-throwing — worker failures must not crash the daemon.
 */
export async function saveJobResult(job_id: string, output: string): Promise<void> {
  const redis = getQueueRedis();
  if (!redis) return;

  const resultKey = `${JOB_RESULT_PREFIX}${job_id}`;
  try {
    await redis.set(resultKey, output, "EX", JOB_TTL_SECONDS);
    console.info(`[V76:AgentQueue] 💾 Result saved — job_id=${job_id} len=${output.length}`);
  } catch (err) {
    console.warn(
      `[V76:AgentQueue] saveJobResult failed (non-fatal): ${(err as Error).message}`
    );
  }
}

// ----------------------------------------------------------------
// STATUS & RESULT READ
// ----------------------------------------------------------------

/**
 * Fetches the current job status record from Redis.
 * Returns null if the job is unknown or expired.
 */
export async function getJobStatus(job_id: string): Promise<JobRecord | null> {
  const redis = getQueueRedis();
  if (!redis) return null;

  const statusKey = `${JOB_STATUS_PREFIX}${job_id}:status`;
  try {
    const raw = await redis.hgetall(statusKey);
    if (!raw || Object.keys(raw).length === 0) return null;
    return raw as unknown as JobRecord;
  } catch (err) {
    console.warn(`[V76:AgentQueue] getJobStatus failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Fetches the final agent output string for a completed job.
 * Returns null if the job has not completed or the key has expired.
 */
export async function getJobResult(job_id: string): Promise<string | null> {
  const redis = getQueueRedis();
  if (!redis) return null;

  const resultKey = `${JOB_RESULT_PREFIX}${job_id}`;
  try {
    return await redis.get(resultKey);
  } catch (err) {
    console.warn(`[V76:AgentQueue] getJobResult failed: ${(err as Error).message}`);
    return null;
  }
}

// ----------------------------------------------------------------
// HITL STATE PERSISTENCE
// ----------------------------------------------------------------

/**
 * The serialized snapshot saved to Redis when the worker suspends
 * at a high-risk tool call waiting for human approval.
 */
export interface HitlPendingState {
  /** Serialized OpenAI message history at the point of suspension */
  messages:    string; // JSON.stringify(ChatCompletionMessageParam[])
  /** Index into tool_calls array that requires approval (usually 0) */
  toolCallIndex: number;
  /** The un-executed tool_call that needs approval */
  pendingToolCall: string; // JSON.stringify(ChatCompletionMessageToolCall)
  /** The assistant message containing the tool_calls array */
  assistantMessage: string; // JSON.stringify(ChatCompletionMessage)
  /** Remaining iterations allowed after resumption */
  remainingIterations: number;
  /** Original payload re-hydrated on resume */
  payload: string; // JSON.stringify(AgentJobPayload)
}

const HITL_STATE_PREFIX = "agent:hitl:";

/**
 * Persists the full conversation state to Redis so the worker
 * can suspend without holding an open process.
 */
export async function saveHitlState(
  job_id: string,
  state:  HitlPendingState
): Promise<void> {
  const redis = getQueueRedis();
  if (!redis) return;
  try {
    await redis.set(
      `${HITL_STATE_PREFIX}${job_id}`,
      JSON.stringify(state),
      "EX",
      JOB_TTL_SECONDS
    );
    console.info(`[V78:HITL] 💾 Suspended state saved — job_id=${job_id}`);
  } catch (err) {
    console.warn(`[V78:HITL] saveHitlState failed: ${(err as Error).message}`);
  }
}

/**
 * Loads the suspended HITL state for a job.
 * Returns null if the key has expired or doesn't exist.
 */
export async function loadHitlState(
  job_id: string
): Promise<HitlPendingState | null> {
  const redis = getQueueRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`${HITL_STATE_PREFIX}${job_id}`);
    if (!raw) return null;
    return JSON.parse(raw) as HitlPendingState;
  } catch (err) {
    console.warn(`[V78:HITL] loadHitlState failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Deletes the HITL suspended state after successful resumption.
 */
export async function deleteHitlState(job_id: string): Promise<void> {
  const redis = getQueueRedis();
  if (!redis) return;
  try {
    await redis.del(`${HITL_STATE_PREFIX}${job_id}`);
  } catch { /* non-fatal */ }
}

// ----------------------------------------------------------------
// RESUME QUEUE
// ----------------------------------------------------------------

export const AGENT_RESUME_QUEUE_KEY = "agent:queue:resume";

/**
 * Pushes a resume message onto the dedicated resume queue.
 * The worker's BLPOP loop also watches this key.
 */
export async function enqueueResume(
  job_id:   string,
  approved: boolean
): Promise<void> {
  const redis = getQueueRedis();
  if (!redis) {
    throw new Error("[V78:HITL] Redis unavailable — cannot enqueue resume.");
  }
  await redis.lpush(
    AGENT_RESUME_QUEUE_KEY,
    JSON.stringify({ job_id, approved, resumed_at: new Date().toISOString() })
  );
  console.info(`[V78:HITL] ▶️  Resume enqueued — job_id=${job_id} approved=${approved}`);
}

// ----------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ----------------------------------------------------------------

export async function closeQueueConnection(): Promise<void> {
  if (queueRedis) {
    await queueRedis.quit();
    queueRedis = null;
    console.log("[V76:AgentQueue] Redis connection closed gracefully.");
  }
}
