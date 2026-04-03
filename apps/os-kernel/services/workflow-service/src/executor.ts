/**
 * @file executor.ts
 * @service workflow-service
 * @description DAG Workflow Executor — The Orchestration Core.
 *
 * Processes a workflow definition as a directed acyclic graph (DAG):
 *   1. Topological sort — determines safe execution order respecting depends_on
 *   2. For each step: render the prompt template, call the Enforcer, capture results
 *   3. Each step's validated JSON output becomes context for all downstream steps
 *   4. On any step failure: halt immediately, set workflow to 'failed'
 *   5. On success: mark 'completed', persist full step_results to DB
 *
 * Template interpolation:
 *   {{input}}           → the user's initial_input value
 *   {{step_id.key}}     → a specific key from a prior step's output
 *   {{step_id}}         → the entire JSON output of a prior step (stringified)
 *
 * The Enforcer is called per-step via internal HTTP — this means every step
 * gets full PoE generation, Policy Engine evaluation, and Memory routing.
 */

import axios, { AxiosError } from "axios";
import { Pool } from "pg";

// ================================================================
// TYPES
// ================================================================

export interface WorkflowStep {
  /** Unique identifier for this step — referenced in depends_on and templates */
  id: string;
  /** Prompt template with {{input}} and {{step_id.key}} placeholders */
  prompt_template: string;
  /** JSON keys the Enforcer must validate in the response */
  required_keys: string[];
  /** LLM provider */
  provider: "openai" | "anthropic";
  /** LLM model identifier */
  model: string;
  /** Step IDs this step depends on (must complete first) */
  depends_on: string[];
  /** Optional: routing mode for the Enforcer */
  mode?: "auto" | "manual";
}

export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

export interface StepResult {
  /** The validated JSON output from the Enforcer */
  output:       Record<string, unknown>;
  /** Proof of Execution receipt ID */
  proof_id?:    string;
  /** Number of Enforcer retry attempts */
  attempts:     number;
  /** Wall-clock duration for this step in ms */
  duration_ms:  number;
  /** Which model actually ran this step */
  model_used:   string;
}

export type StepResultMap = Record<string, StepResult>;

export interface ExecutionContext {
  /** DB connection pool for persisting state */
  pool:         Pool;
  /** The execution row ID to update as steps complete */
  executionId:  string;
  /** UUID of the requesting user (passed to the Enforcer) */
  userId:       string;
  /** The raw initial input provided by the user */
  initialInput: Record<string, unknown>;
  /** Enforcer Service base URL */
  enforcerUrl:  string;
  /** Internal service token */
  internalToken: string;
}

// ================================================================
// TOPOLOGICAL SORT
// ================================================================

/**
 * Performs Kahn's algorithm to topologically sort the DAG steps.
 * Throws if a cycle is detected — cycles would cause infinite loops.
 * Returns steps in a safe execution order.
 */
export function topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
  const idToStep = new Map(steps.map((s) => [s.id, s]));
  const inDegree = new Map(steps.map((s) => [s.id, s.depends_on.length]));
  const queue: string[] = [];
  const sorted: WorkflowStep[] = [];

  // Seed: all steps with no dependencies
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = idToStep.get(currentId)!;
    sorted.push(current);

    // Reduce in-degree for every step that depends on this one
    for (const step of steps) {
      if (step.depends_on.includes(currentId)) {
        const newDegree = (inDegree.get(step.id) ?? 1) - 1;
        inDegree.set(step.id, newDegree);
        if (newDegree === 0) queue.push(step.id);
      }
    }
  }

  if (sorted.length !== steps.length) {
    throw new Error(
      "Workflow definition contains a cycle — DAGs must be acyclic. " +
      `Only ${sorted.length}/${steps.length} steps could be ordered.`
    );
  }

  return sorted;
}

// ================================================================
// TEMPLATE RENDERER
// ================================================================

/**
 * Renders a prompt template by substituting placeholders:
 *   {{input}}        → JSON.stringify(initialInput) or string if primitive
 *   {{step_id.key}}  → specific key from a prior step's output
 *   {{step_id}}      → JSON.stringify of the entire step output
 *
 * Unknown placeholders are left as-is so the LLM sees them literally.
 */
export function renderTemplate(
  template: string,
  initialInput: Record<string, unknown>,
  stepResults: StepResultMap
): string {
  return template.replace(/{{([^}]+)}}/g, (match, path: string) => {
    path = path.trim();

    // {{input}} — the user's initial input
    if (path === "input") {
      return typeof initialInput === "object"
        ? JSON.stringify(initialInput)
        : String(initialInput);
    }

    // {{input.key}} — a specific field from initial input
    if (path.startsWith("input.")) {
      const key = path.slice(6);
      const val = (initialInput as Record<string, unknown>)[key];
      return val !== undefined ? String(val) : match;
    }

    // {{step_id}} or {{step_id.key}} — prior step results
    const dotIdx = path.indexOf(".");
    if (dotIdx === -1) {
      // Entire step output
      const result = stepResults[path];
      return result ? JSON.stringify(result.output) : match;
    }

    const stepId = path.slice(0, dotIdx);
    const key = path.slice(dotIdx + 1);
    const result = stepResults[stepId];
    if (!result) return match;

    const val = result.output[key];
    return val !== undefined
      ? typeof val === "object" ? JSON.stringify(val) : String(val)
      : match;
  });
}

// ================================================================
// STEP EXECUTOR — calls the Enforcer for a single step
// ================================================================

async function executeStep(
  step: WorkflowStep,
  ctx: ExecutionContext,
  stepResults: StepResultMap
): Promise<StepResult> {
  const prompt = renderTemplate(step.prompt_template, ctx.initialInput, stepResults);
  const t0 = Date.now();

  console.log(
    `[WorkflowExecutor] ⚙  Step "${step.id}" starting — ` +
    `provider=${step.provider} model=${step.model} ` +
    `prompt_len=${prompt.length}`
  );

  // Update current_step in DB so the status endpoint reflects live progress
  await ctx.pool.query(
    `UPDATE workflow_executions SET current_step = $1 WHERE id = $2`,
    [step.id, ctx.executionId]
  ).catch((e: Error) => console.warn(`[WorkflowExecutor] current_step update failed: ${e.message}`));

  const response = await axios.post<{
    success:         boolean;
    data?:           Record<string, unknown>;
    attempts_taken?: number;
    proof_id?:       string;
    explainability?: { model_selected: string };
    error?: { code: string; message: string };
  }>(
    `${ctx.enforcerUrl}/api/v1/enforce`,
    {
      user_id:       ctx.userId,
      prompt,
      provider:      step.provider,
      model:         step.model,
      required_keys: step.required_keys,
      mode:          step.mode ?? "auto",
    },
    {
      timeout: 120_000, // 2-minute max per step — complex analyses may need time
      headers: {
        "Content-Type":            "application/json",
        "x-internal-service-token": ctx.internalToken,
      },
    }
  );

  if (!response.data.success || !response.data.data) {
    const errMsg = response.data.error?.message ?? "Enforcer returned non-success.";
    throw new Error(`Step "${step.id}" failed: ${errMsg}`);
  }

  const duration_ms = Date.now() - t0;
  const result: StepResult = {
    output:     response.data.data,
    proof_id:   response.data.proof_id,
    attempts:   response.data.attempts_taken ?? 1,
    duration_ms,
    model_used: response.data.explainability?.model_selected ?? step.model,
  };

  console.log(
    `[WorkflowExecutor] ✅ Step "${step.id}" completed in ${duration_ms}ms ` +
    `(attempts=${result.attempts} model=${result.model_used})`
  );

  return result;
}

// ================================================================
// MAIN EXPORT: executeWorkflow
// ================================================================

/**
 * Orchestrates a full DAG workflow execution:
 *   1. Topological sort the steps
 *   2. Execute each step sequentially (respecting dependency order)
 *   3. Persist step_results to DB after each step (incremental saves)
 *   4. On any failure: mark execution 'failed' and re-throw
 *   5. On success: mark 'completed' with final step_results
 *
 * @param definition   The parsed workflow DAG
 * @param ctx          Execution context (DB, userId, enforcerUrl, etc.)
 * @returns            The complete step result map on success
 */
export async function executeWorkflow(
  definition: WorkflowDefinition,
  ctx: ExecutionContext
): Promise<StepResultMap> {
  // ── Phase 0: Validate and sort the DAG ───────────────────────
  let sortedSteps: WorkflowStep[];
  try {
    sortedSteps = topologicalSort(definition.steps);
  } catch (err) {
    await markFailed(ctx.pool, ctx.executionId, (err as Error).message);
    throw err;
  }

  console.log(
    `[WorkflowExecutor] 🚀 Starting execution ${ctx.executionId} — ` +
    `${sortedSteps.length} steps: [${sortedSteps.map((s) => s.id).join(" → ")}]`
  );

  // ── Phase 1: Execute steps in topological order ───────────────
  const stepResults: StepResultMap = {};

  for (const step of sortedSteps) {
    try {
      const result = await executeStep(step, ctx, stepResults);
      stepResults[step.id] = result;

      // Incremental persistence — saves partial results on each step
      // so a failure later still preserves completed-step data
      await ctx.pool.query(
        `UPDATE workflow_executions
         SET step_results = step_results || $1::JSONB
         WHERE id = $2`,
        [JSON.stringify({ [step.id]: result }), ctx.executionId]
      ).catch((e: Error) =>
        console.warn(`[WorkflowExecutor] Incremental save failed (non-fatal): ${e.message}`)
      );
    } catch (stepErr: any) {
      // ── Step failure: halt execution, mark failed ─────────────
      const errMsg = stepErr instanceof AxiosError
        ? `HTTP ${stepErr.response?.status ?? "?"}: ${stepErr.response?.data?.error?.message ?? stepErr.message}`
        : (stepErr as Error).message;

      console.error(
        `[WorkflowExecutor] ❌ Step "${step.id}" failed (execution=${ctx.executionId}): ${errMsg}`
      );

      // Persist whatever partial results we have before failing
      await ctx.pool.query(
        `UPDATE workflow_executions
         SET status        = 'failed',
             error_message = $1,
             current_step  = $2,
             step_results  = $3::JSONB,
             completed_at  = NOW()
         WHERE id = $4`,
        [errMsg, step.id, JSON.stringify(stepResults), ctx.executionId]
      ).catch((e: Error) =>
        console.error(`[WorkflowExecutor] Failed-state persist error: ${e.message}`)
      );

      throw new Error(
        `Workflow halted at step "${step.id}": ${errMsg}`
      );
    }
  }

  // ── Phase 2: Mark workflow completed ─────────────────────────
  await ctx.pool.query(
    `UPDATE workflow_executions
     SET status       = 'completed',
         step_results = $1::JSONB,
         current_step = NULL,
         completed_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(stepResults), ctx.executionId]
  );

  const totalMs = Object.values(stepResults).reduce((acc, r) => acc + r.duration_ms, 0);
  console.log(
    `[WorkflowExecutor] 🏁 Workflow ${ctx.executionId} completed — ` +
    `${sortedSteps.length} steps, ${totalMs}ms total`
  );

  return stepResults;
}

// ================================================================
// HELPERS
// ================================================================

async function markFailed(pool: Pool, executionId: string, message: string): Promise<void> {
  await pool.query(
    `UPDATE workflow_executions
     SET status = 'failed', error_message = $1, completed_at = NOW()
     WHERE id = $2`,
    [message, executionId]
  ).catch((e: Error) =>
    console.error(`[WorkflowExecutor] markFailed DB error: ${e.message}`)
  );
}
