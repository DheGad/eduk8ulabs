/**
 * @file workers/agentWorker.ts
 * @service router-service
 * @version V76
 * @description Background Agent Worker — BLPOP daemon for the async job queue
 *
 * ================================================================
 * ARCHITECTURE
 * ================================================================
 *
 * This module runs as a daemon inside the same Node.js process as
 * the Express server. It uses a BLOCKING POP (BLPOP) loop rather
 * than polling intervals to achieve zero-latency job pickup without
 * CPU spin.
 *
 *   BLPOP agent:queue:pending 5   — blocks up to 5s, then loops
 *
 * The worker executes the FULL V75 Tool Loop (identical to
 * /api/v1/execute) with RBAC-governed tool calling, and saves
 * the result back to Redis via agentQueue.saveJobResult().
 *
 * ================================================================
 * ISOLATION GUARANTEE
 * ================================================================
 *
 * Every job runs in a try/catch envelope. A crash inside the tool
 * loop, an LLM timeout, or a bad payload marks the job FAILED and
 * never propagates an unhandled rejection to the main event loop.
 *
 * ================================================================
 * V70 TRACE PROPAGATION
 * ================================================================
 *
 * The original traceId (from the HTTP request that submitted the
 * job) is inherited and attached to every trace event emitted by
 * the worker. The dashboard shows the exact millisecond the task
 * was queued, picked up, and completed.
 *
 * ================================================================
 */

import OpenAI from "openai";
import {
  AGENT_QUEUE_KEY,
  AGENT_RESUME_QUEUE_KEY,
  AgentJobPayload,
  HitlPendingState,
  updateJobStatus,
  saveJobResult,
  saveHitlState,
  loadHitlState,
  deleteHitlState,
  enqueueResume as _unusedImport, // ensure module is loaded
  getQueueRedis,
  closeQueueConnection,
} from "../services/agentQueue.js";
import { appendTraceEvent } from "../middleware/traceProvider.js";
import { ToolRegistry, executeToolWithRbac, type ToolContext } from "../services/toolRegistry.js";
import { parseRole } from "../security/rbacEngine.js";
import { runSwarmLoop } from "../services/agentSwarm.js";

// Re-export so index.ts can import from a single worker module
export { closeQueueConnection } from "../services/agentQueue.js";

// ----------------------------------------------------------------
// WORKER CONFIG
// ----------------------------------------------------------------

const BLPOP_TIMEOUT_SECONDS = 5;       // Block for up to 5s per iteration
const MAX_TOOL_ITERATIONS   = 5;       // Mirror limit in routes.ts
const LLM_REQUEST_TIMEOUT   = 120_000; // 2 min — long-running agent tasks

let workerRunning = false;
let workerStopped = false;

// ----------------------------------------------------------------
// HITL SUSPENSION SIGNAL
// ----------------------------------------------------------------

/**
 * Thrown by runAgentLoop when the LLM requests a high-risk tool
 * and the loop must suspend. The worker catches this, serializes
 * state to Redis, and marks the job AWAITING_APPROVAL.
 */
class HitlSuspendSignal extends Error {
  constructor(
    public readonly job_id:              string,
    public readonly state:               HitlPendingState,
    public readonly pendingToolName:     string,
    public readonly traceId:             string,
    public readonly traceStartedAt:      number
  ) {
    super(`[V78:HITL] Suspended — waiting for approval of tool: ${pendingToolName}`);
    this.name = "HitlSuspendSignal";
  }
}

// ----------------------------------------------------------------
// CORE EXECUTION ENGINE
// ----------------------------------------------------------------

/**
 * Runs the full agentic tool loop for a single job.
 * Mirrors executeOpenAI in routes.ts but is decoupled from Express.
 *
 * V78: If the LLM requests a tool with requiresApproval=true, throws
 * a HitlSuspendSignal instead of executing it. The caller (processJob)
 * catches this, serializes the state, and suspends the job.
 *
 * @param payload        - Original job payload
 * @param resumeMessages - Pre-populated message history when resuming from HITL
 * @param startIteration - Iteration counter to resume from (default 0)
 */
async function runAgentLoop(
  payload:         AgentJobPayload & { job_id?: string },
  resumeMessages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  startIteration?: number
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set — cannot execute agent job.");
  }

  const client = new OpenAI({ apiKey, timeout: LLM_REQUEST_TIMEOUT });

  // Build the tool context for RBAC enforcement
  const toolCtx: ToolContext = {
    tenantId: payload.tenantId,
    userId:   payload.userId,
    role:     parseRole(payload.rbacRole ?? null),
    traceId:  payload.traceId,
    traceStartedAt: payload.traceStartedAt,
  };

  // Map registry tools → OpenAI function definitions
  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    Object.values(ToolRegistry).map((t) => ({
      type: "function" as const,
      function: {
        name:        t.name,
        description: t.description,
        parameters:  t.parameters,
      },
    }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = resumeMessages ? [...resumeMessages] : [];

  if (!resumeMessages) {
    // V79: Memory Injection (only on initial run, hitl-resume carries state)
    const { getMemoryKeys } = await import("../services/agentMemory.js");
    const memoryKeys = await getMemoryKeys(payload.tenantId, payload.userId);

    if (memoryKeys.length > 0) {
      messages.push({
        role: "system",
        content: `You have access to previous memories via the core_recall_memory tool. Known memory keys: [${memoryKeys.join(", ")}]`,
      });
    }
    messages.push({ role: "user", content: payload.prompt });
  }

  let iterations = startIteration ?? 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // V70 trace: LLM call started
    appendTraceEvent(payload.traceId, payload.traceStartedAt, "AGENT_LLM_CALL", {
      iteration: iterations,
      model:     payload.model,
    });

    const completion = await client.chat.completions.create({
      model:      payload.model,
      messages,
      max_tokens: 4096,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      throw new Error(`LLM returned empty response on iteration ${iterations}.`);
    }

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // ----------------------------------------------------------------
      // V78 HITL GATE: scan every tool call BEFORE executing any of them
      // ----------------------------------------------------------------
      for (let i = 0; i < responseMessage.tool_calls.length; i++) {
        const toolCall  = responseMessage.tool_calls[i]!;
        const toolDef   = ToolRegistry[toolCall.function.name];

        if (toolDef?.requiresApproval) {
          // SUSPEND: serialize current conversation state to Redis
          const hitlState: HitlPendingState = {
            messages:            JSON.stringify([...messages, responseMessage]),
            toolCallIndex:       i,
            pendingToolCall:     JSON.stringify(toolCall),
            assistantMessage:    JSON.stringify(responseMessage),
            remainingIterations: MAX_TOOL_ITERATIONS - iterations,
            payload:             JSON.stringify(payload),
          };

          // Throw the suspension signal — processJob catches it
          throw new HitlSuspendSignal(
            payload.job_id ?? "unknown",
            hitlState,
            toolCall.function.name,
            payload.traceId,
            payload.traceStartedAt
          );
        }
      }

      // All tool calls are pre-approved — execute them
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const result = await executeToolWithRbac(
          toolCall.function.name,
          toolCall.function.arguments,
          toolCtx
        );
        messages.push({
          role:         "tool",
          tool_call_id: toolCall.id,
          content:      result,
        });
      }

    } else {
      // No more tool calls — this is the final synthesized response
      appendTraceEvent(payload.traceId, payload.traceStartedAt, "AGENT_LLM_DONE", {
        iterations,
        finish_reason: completion.choices[0]?.finish_reason ?? "stop",
      });
      return responseMessage.content ?? "";
    }
  }

  throw new Error(`Agent exceeded max tool iterations (${MAX_TOOL_ITERATIONS}).`);
}

// ----------------------------------------------------------------
// RESUME ENGINE (V78 HITL)
// ----------------------------------------------------------------

/**
 * Re-hydrates a suspended job from its Redis state snapshot and
 * continues the agent loop from where it paused.
 *
 * @param job_id   - The job to resume
 * @param approved - true: execute the paused tool; false: inject denial message
 */
async function resumeAgentLoop(job_id: string, approved: boolean): Promise<void> {
  // Load serialized state
  const hitlState = await loadHitlState(job_id);
  if (!hitlState) {
    console.error(`[V78:HITL] No suspended state found for job_id=${job_id} — cannot resume.`);
    await updateJobStatus(job_id, "FAILED", {
      completed_at: new Date().toISOString(),
      error: "HITL suspended state expired or missing.",
    });
    return;
  }

  const payload      = JSON.parse(hitlState.payload) as AgentJobPayload & { job_id: string };
  const messages     = JSON.parse(hitlState.messages) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  const toolCall     = JSON.parse(hitlState.pendingToolCall) as OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
  const assistantMsg = JSON.parse(hitlState.assistantMessage) as OpenAI.Chat.Completions.ChatCompletionMessage;

  appendTraceEvent(payload.traceId, payload.traceStartedAt, "HITL_RESUMED", {
    job_id,
    approved,
    tool_name: toolCall.function.name,
  });

  await updateJobStatus(job_id, "PROCESSING", {});

  if (!approved) {
    // Inject a denial system message — let the LLM find an alternative
    messages.push(assistantMsg);
    messages.push({
      role:         "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        denied: true,
        reason: "An administrator denied this action. Find an alternative approach that does not require fund deduction.",
      }),
    });
    console.info(`[V78:HITL] ❌ Tool denied by admin — resuming loop with denial context.`);
  } else {
    // Execute the approved tool and inject the real result
    const toolCtx: ToolContext = {
      tenantId:      payload.tenantId,
      userId:        payload.userId,
      role:          parseRole(payload.rbacRole ?? null),
      traceId:       payload.traceId,
      traceStartedAt: payload.traceStartedAt,
    };

    console.info(`[V78:HITL] ✅ Tool approved by admin — executing ${toolCall.function.name}`);
    const result = await executeToolWithRbac(
      toolCall.function.name,
      toolCall.function.arguments,
      toolCtx
    );

    messages.push(assistantMsg);
    messages.push({
      role:         "tool",
      tool_call_id: toolCall.id,
      content:      result,
    });
  }

  // Clean up suspended state before resuming (prevent double-resume)
  await deleteHitlState(job_id);

  try {
    // Continue the agent loop from the hydrated message history
    const output = await runAgentLoop(
      payload,
      messages,
      MAX_TOOL_ITERATIONS - hitlState.remainingIterations
    );

    const completedAt = new Date().toISOString();
    await saveJobResult(job_id, output);
    await updateJobStatus(job_id, "COMPLETED", { completed_at: completedAt });

    appendTraceEvent(payload.traceId, payload.traceStartedAt, "AGENT_JOB_COMPLETED", {
      job_id,
      via: "HITL_RESUME",
      completed_at: completedAt,
      output_length: output.length,
    });

    console.info(`[V78:HITL] ✅ Resumed job_id=${job_id} completed (${output.length} chars)`);

  } catch (resumeErr: unknown) {
    const errMsg = resumeErr instanceof HitlSuspendSignal
      ? `[V78:HITL] Nested approval required: ${resumeErr.pendingToolName}`
      : (resumeErr instanceof Error ? resumeErr.message : String(resumeErr));

    console.error(`[V78:HITL] ❌ Resume failed job_id=${job_id}: ${errMsg}`);

    await updateJobStatus(job_id, "FAILED", {
      completed_at: new Date().toISOString(),
      error: errMsg.slice(0, 512),
    }).catch(() => {});
  }
}

// ----------------------------------------------------------------
// SINGLE JOB PROCESSOR
// ----------------------------------------------------------------

/**
 * Extended payload shape — includes the optional mode field.
 * Deserialized from the Redis queue message.
 */
type QueuedJobPayload = AgentJobPayload & {
  job_id: string;
  /** "single" (default) | "swarm" */
  mode?: "single" | "swarm";
};

async function processJob(raw: string): Promise<void> {
  let job_id = "unknown";

  try {
    const payload = JSON.parse(raw) as QueuedJobPayload;
    job_id = payload.job_id;
    const mode = payload.mode ?? "single";

    const pickedAt = new Date().toISOString();
    console.info(
      `[V76:Worker] 🔄 Processing job_id=${job_id} mode=${mode} tenant=${payload.tenantId}`
    );

    await updateJobStatus(job_id, "PROCESSING", { started_at: pickedAt });

    appendTraceEvent(payload.traceId, payload.traceStartedAt, "AGENT_JOB_STARTED", {
      job_id, mode, worker_picked_at: pickedAt,
    });

    let output: string;

    if (mode === "swarm") {
      console.info(`[V76:Worker] 🐝 Routing to V77 Swarm pipeline...`);
      appendTraceEvent(payload.traceId, payload.traceStartedAt, "SWARM_JOB_STARTED", { job_id });
      output = await runSwarmLoop(payload);
    } else {
      output = await runAgentLoop(payload);
    }

    const completedAt = new Date().toISOString();
    await saveJobResult(job_id, output);
    await updateJobStatus(job_id, "COMPLETED", { completed_at: completedAt });

    appendTraceEvent(payload.traceId, payload.traceStartedAt, "AGENT_JOB_COMPLETED", {
      job_id, mode, completed_at: completedAt, output_length: output.length,
    });

    console.info(`[V76:Worker] ✅ job_id=${job_id} mode=${mode} completed (${output.length} chars)`);

  } catch (err: unknown) {
    // ----------------------------------------------------------------
    // V78 HITL SUSPENSION — not an error, graceful suspend
    // ----------------------------------------------------------------
    if (err instanceof HitlSuspendSignal) {
      console.info(
        `[V78:HITL] ⏸️  Suspending job_id=${job_id} — awaiting approval for: ${err.pendingToolName}`
      );

      // Persist conversation state
      await saveHitlState(job_id, err.state).catch(() => {});

      // Transition job status
      await updateJobStatus(job_id, "AWAITING_APPROVAL", {});

      // V70 trace event
      appendTraceEvent(err.traceId, err.traceStartedAt, "HITL_PAUSE_TRIGGERED", {
        job_id,
        pending_tool: err.pendingToolName,
        approve_url:  `/api/v1/execute/approve/${job_id}`,
      });

      console.info(
        `[V78:HITL] Job suspended. Admin must POST to ` +
        `/api/v1/execute/approve/${job_id} with { "approved": true/false }`
      );
      return; // Worker exits cleanly — not a crash
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[V76:Worker] ❌ job_id=${job_id} FAILED: ${errorMsg}`);

    await updateJobStatus(job_id, "FAILED", {
      completed_at: new Date().toISOString(),
      error: errorMsg.slice(0, 512),
    }).catch(() => {});
  }
}

// ----------------------------------------------------------------
// WORKER DAEMON LOOP
// ----------------------------------------------------------------

/**
 * Starts the background worker daemon using BLPOP.
 * MUST be called once from index.ts after Express starts.
 *
 * The daemon blocks on Redis for up to BLPOP_TIMEOUT_SECONDS per
 * iteration, so it never spins the CPU when the queue is empty.
 *
 * Any unhandled error inside processJob() is caught here — the
 * daemon continues running regardless.
 */
export async function startAgentWorker(): Promise<void> {
  if (workerRunning) {
    console.warn("[V76:Worker] Worker already running — startAgentWorker() called twice.");
    return;
  }

  const redis = getQueueRedis();
  if (!redis) {
    console.warn(
      "[V76:Worker] Redis unavailable — agent worker not started. " +
      "Async /execute/async endpoint will return 503."
    );
    return;
  }

  // Use a separate Redis connection for BLPOP — blocking commands must
  // NOT share a connection with regular commands (ioredis constraint).
  const { Redis: RedisClass } = await import("ioredis");
  const blockingRedis = new RedisClass(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // Required for BLPOP (long-running commands)
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
    connectTimeout: 5000,
    lazyConnect: false,
    enableOfflineQueue: true,  // Buffer if Redis briefly disconnects
  });

  blockingRedis.on("connect", () =>
    console.log("[V76:Worker] 🟢 Blocking Redis connected — daemon listening for jobs.")
  );
  blockingRedis.on("error", (err: Error) =>
    console.warn(`[V76:Worker] Blocking Redis error: ${err.message}`)
  );

  workerRunning = true;
  console.log("[V76:Worker] 🚀 Agent worker daemon started (V76 single + V77 swarm + V78 HITL).");

  // The BLPOP loop — watches both pending and resume queues
  const loop = async (): Promise<void> => {
    while (!workerStopped) {
      try {
        // BLPOP blocks on BOTH queues. Resume queue has priority (listed first).
        const result = await blockingRedis.blpop(
          AGENT_RESUME_QUEUE_KEY,
          AGENT_QUEUE_KEY,
          BLPOP_TIMEOUT_SECONDS
        );

        if (result) {
          const [listKey, raw] = result;

          if (listKey === AGENT_RESUME_QUEUE_KEY) {
            // ── V78 HITL RESUME MESSAGE ─────────────────────────
            const msg = JSON.parse(raw) as { job_id: string; approved: boolean };
            console.info(
              `[V78:HITL] ▶️  Resuming job_id=${msg.job_id} approved=${msg.approved}`
            );
            resumeAgentLoop(msg.job_id, msg.approved).catch((err: unknown) => {
              console.error(
                "[V78:HITL] Unhandled resumeAgentLoop rejection:",
                (err as Error)?.message
              );
            });
          } else {
            // ── Standard job from pending queue ────────────────────
            processJob(raw).catch((err: unknown) => {
              console.error(
                "[V76:Worker] Unhandled processJob rejection (non-fatal):",
                (err as Error)?.message
              );
            });
          }
        }
      } catch (err: unknown) {
        if (workerStopped) break;
        const errMsg = (err as Error)?.message ?? String(err);
        console.warn(`[V76:Worker] BLPOP loop error (retrying): ${errMsg}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    await blockingRedis.quit().catch(() => {});
    console.log("[V76:Worker] Daemon stopped.");
  };

  loop().catch((err: unknown) => {
    console.error(
      "[V76:Worker] FATAL: daemon loop crashed:",
      (err as Error)?.message
    );
    workerRunning = false;
  });
}

/**
 * Signals the worker daemon to stop after the current BLPOP timeout.
 * Call from SIGTERM handler.
 */
export function stopAgentWorker(): void {
  workerStopped = true;
}
