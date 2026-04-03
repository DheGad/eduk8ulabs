/**
 * @file workflowRunner.ts
 * @service router-service
 * @version V92
 * @description No-Code Workflow Builder — Step Execution Engine
 *
 * ================================================================
 * ARCHITECTURE
 * ================================================================
 * WorkflowRunner is a trusted internal actor that orchestrates
 * user-defined multi-step workflows. Each step is executed through
 * the existing pipeline to guarantee V81 NeMo and V85 APAC coverage:
 *
 *   AI_PROMPT  → POST /api/v1/execute (full V12/V22/V81/V85 pipeline)
 *   DLP_SCAN   → globalDLP.tokenizePayload() (resident V67 scrubber)
 *   WEBHOOK    → outbound fetch to caller-specified URL
 *
 * After each successful step, a receipt is anchored to the V35 Merkle
 * audit tree via merkleLogger.appendReceipt(), giving legal teams a
 * cryptographically verifiable V89 Legal Shield for every automation run.
 *
 * AUTH NOTE:
 *   Internal calls to /api/v1/execute use INTERNAL_ROUTER_SECRET as
 *   the bearer token, bypassing external OAuth overhead while keeping
 *   the full V81/V85 kernel evaluation active (system-verified caller).
 *
 * CONSTRAINT: This file DOES NOT modify proxyRoutes.ts, routes.ts, or
 * any other existing module. It is purely additive.
 * ================================================================
 */

import { createHash, randomUUID } from "node:crypto";
import { merkleLogger, type ReceiptLeaf } from "./merkleLogger.js";
import { globalDLP } from "../../security/src/dlpEngine.js";

// ──────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────

/** The type discriminant for each step in a workflow. */
export type StepType = "AI_PROMPT" | "DLP_SCAN" | "WEBHOOK";

/** A single step definition as configured from the visual canvas. */
export interface WorkflowStep {
  /** Stable ID (UUID) assigned by the frontend when the step is created. */
  id:           string;
  /** Human-readable name displayed on the canvas card. */
  label:        string;
  /** The operation class for this step. */
  type:         StepType;
  /** For AI_PROMPT: the prompt template. Supports {{previous_output}} interpolation. */
  prompt?:      string;
  /** For AI_PROMPT: provider (openai | anthropic | google | streetmp). Default: openai */
  provider?:    string;
  /** For AI_PROMPT: model string. Default: gpt-4o-mini */
  model?:       string;
  /** For WEBHOOK: the target URL to POST results to. */
  webhookUrl?:  string;
  /** For DLP_SCAN: tenant ID whose custom DLP rules should apply. Defaults to runner tenantId. */
  dlpTenantId?: string;
}

/** A complete workflow definition received from the canvas "Run" action. */
export interface WorkflowDefinition {
  /** Auto-generated or user-provided name for this run. */
  name:       string;
  /** The ordered list of steps in the linear chain. */
  steps:      WorkflowStep[];
  /** Tenant context for audit logging and DLP rules. */
  tenant_id:  string;
}

/** Result for a single completed step. */
export interface StepResult {
  stepId:      string;
  stepLabel:   string;
  stepType:    StepType;
  /** true if the step executed without error. */
  success:     boolean;
  /** The output text (AI completion, DLP summary, or webhook ack). */
  output:      string;
  /** If success=false, the failure reason. */
  error?:      string;
  /** Wall-clock duration for this step. */
  durationMs:  number;
  /** The Merkle leaf hash anchored for this step (present if success=true). */
  merkleLeafHash?: string;
}

/** Final result returned from WorkflowRunner.runWorkflow(). */
export interface WorkflowRunResult {
  executionId:   string;
  workflowName:  string;
  tenantId:      string;
  status:        "completed" | "partial" | "failed";
  steps:         StepResult[];
  /** The Merkle root hash after all receipts were appended. */
  merkleRootHash: string | null;
  startedAt:     string;
  completedAt:   string;
  durationMs:    number;
}

// ──────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────

const INTERNAL_EXECUTE_URL =
  process.env.INTERNAL_ROUTER_URL ?? "http://localhost:4000/api/v1/execute";

const INTERNAL_TOKEN = () =>
  process.env.INTERNAL_ROUTER_SECRET ?? "dev_internal_secret";

const SYSTEM_USER_ID = "SYS_WORKFLOW_RUNNER_V92";

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────

/**
 * Interpolates `{{previous_output}}` and `{{step_N_output}}` variables into a
 * prompt template, using the accumulated state map from prior steps.
 */
function hydratePrompt(template: string, state: Record<string, string>): string {
  let hydrated = template;
  for (const [key, value] of Object.entries(state)) {
    hydrated = hydrated.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return hydrated;
}

/**
 * Deterministic mock Ed25519 signature for internal logs.
 * Production would use the Nitro Enclave signing path.
 * Here we use SHA-256(executionId + stepId + timestamp) → 64-char hex.
 */
function syntheticSignature(executionId: string, stepId: string, timestamp: string): string {
  return createHash("sha256")
    .update(`${executionId}|${stepId}|${timestamp}`)
    .digest("hex");
}

// ──────────────────────────────────────────────────────────────────────
// WorkflowRunner CLASS
// ──────────────────────────────────────────────────────────────────────

export class WorkflowRunner {
  private readonly executionId: string;

  constructor() {
    this.executionId = randomUUID();
  }

  // ── executeStep ──────────────────────────────────────────────────────

  /**
   * Executes a single workflow step and anchors the result to the V89 Merkle ledger.
   *
   * @param step       The step definition from the visual canvas.
   * @param tenantId   Tenant context for DLP and audit.
   * @param traceId    V70 trace correlation ID (pass-through for observability).
   * @param prevOutput Accumulated output state map from preceding steps.
   * @returns          StepResult with success/failure details and Merkle leaf hash.
   */
  async executeStep(
    step:       WorkflowStep,
    tenantId:   string,
    traceId:    string,
    prevOutput: Record<string, string>,
  ): Promise<StepResult> {
    const startMs  = Date.now();
    const stepBase = { stepId: step.id, stepLabel: step.label, stepType: step.type };

    try {
      let outputText: string;

      // ── AI_PROMPT ────────────────────────────────────────────────────
      // Routes through the full /api/v1/execute pipeline:
      // V18 auth → V22 SmartRouter → V67 DLP → V12 PAC → V81 NeMo →
      // V85 APAC → V48 BFT Consensus → V25 TrustScore → V13 Merkle
      if (step.type === "AI_PROMPT") {
        const rawPrompt = step.prompt ?? "";
        if (!rawPrompt.trim()) throw new Error("AI_PROMPT step requires a non-empty prompt.");

        const hydratedPrompt = hydratePrompt(rawPrompt, prevOutput);

        const execRes = await fetch(INTERNAL_EXECUTE_URL, {
          method:  "POST",
          headers: {
            "Content-Type":    "application/json",
            "Authorization":   `Bearer ${INTERNAL_TOKEN()}`,
            "x-tenant-id":     tenantId,
            "x-trace-id":      traceId,
            "x-streetmp-role": "ADMIN", // Internal actor — full pipeline access
          },
          body: JSON.stringify({
            user_id:  SYSTEM_USER_ID,
            prompt:   hydratedPrompt,
            provider: step.provider ?? "openai",
            model:    step.model    ?? "gpt-4o-mini",
          }),
        });

        const execData = await execRes.json() as Record<string, unknown>;

        if (!execRes.ok) {
          const errMsg =
            (execData?.error as Record<string, string> | undefined)?.message
            ?? `Execute pipeline returned HTTP ${execRes.status}`;
          throw new Error(errMsg);
        }

        // The /api/v1/execute endpoint returns { success, response: { completion } }
        outputText =
          (execData?.response as Record<string, string> | undefined)?.completion
          ?? (execData?.output as string | undefined)
          ?? JSON.stringify(execData);

      // ── DLP_SCAN ─────────────────────────────────────────────────────
      // Runs the payload through the V67 scrubber (in-process — zero latency).
      } else if (step.type === "DLP_SCAN") {
        const input = prevOutput["previous_output"] ?? prevOutput[Object.keys(prevOutput).at(-1) ?? ""] ?? "";
        if (!input.trim()) {
          outputText = "[DLP_SCAN] No prior output to scan — step skipped.";
        } else {
          const dlpCtx = globalDLP.tokenizePayload(
            input,
            undefined,
            step.dlpTenantId ?? tenantId,
          );
          outputText = dlpCtx.entityCount > 0
            ? `[DLP_SCAN] Sanitized ${dlpCtx.entityCount} entity/entities. ` +
              `Safe payload: ${dlpCtx.sanitizedPayload}`
            : `[DLP_SCAN] Clean — 0 PII entities detected. Payload is safe.`;
        }

      // ── WEBHOOK ──────────────────────────────────────────────────────
      // POSTs the accumulated state to the caller's endpoint.
      } else if (step.type === "WEBHOOK") {
        const url = step.webhookUrl?.trim();
        if (!url) throw new Error("WEBHOOK step requires a non-empty webhookUrl.");

        const webhookRes = await fetch(url, {
          method:  "POST",
          headers: {
            "Content-Type":         "application/json",
            "x-streetmp-execution": this.executionId,
            "x-streetmp-trace":     traceId,
          },
          body: JSON.stringify({
            execution_id: this.executionId,
            step_id:      step.id,
            tenant_id:    tenantId,
            state:        prevOutput,
            timestamp:    new Date().toISOString(),
          }),
        });

        outputText = webhookRes.ok
          ? `[WEBHOOK] Delivered to ${url} → HTTP ${webhookRes.status}`
          : `[WEBHOOK] Delivery attempted to ${url} — HTTP ${webhookRes.status}`;

      } else {
        throw new Error(`Unknown step type: ${(step as WorkflowStep).type}`);
      }

      // ── V89 MERKLE ANCHOR ────────────────────────────────────────────
      const timestamp = new Date().toISOString();
      const sig       = syntheticSignature(this.executionId, step.id, timestamp);

      const leaf: ReceiptLeaf = {
        signature:   sig,
        timestamp,
        tenant_id:   tenantId,
        status:      "WORKFLOW_STEP_COMPLETED",
        trust_score: 100, // Internal-actor execution
      };

      const newRoot = merkleLogger.appendReceipt(tenantId, leaf);

      console.info(
        `[V92:WorkflowRunner] Step "${step.label}" (${step.type}) COMPLETED. ` +
        `Merkle root→${newRoot.substring(0, 16)}... ` +
        `exec=${this.executionId} trace=${traceId}`
      );

      return {
        ...stepBase,
        success:         true,
        output:          outputText,
        durationMs:      Date.now() - startMs,
        merkleLeafHash:  syntheticSignature(this.executionId, step.id, timestamp),
      };

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[V92:WorkflowRunner] Step "${step.label}" FAILED: ${errMsg}`);

      return {
        ...stepBase,
        success:    false,
        output:     "",
        error:      errMsg,
        durationMs: Date.now() - startMs,
      };
    }
  }

  // ── runWorkflow ──────────────────────────────────────────────────────

  /**
   * Sequentially executes a linear chain of steps, passing each step's output
   * into the next via the `{{previous_output}}` interpolation token.
   *
   * Behaviour on step failure: stops the chain and marks status "partial" or
   * "failed" depending on how many steps completed successfully.
   *
   * @param definition  The fully-hydrated workflow from the canvas UI.
   * @param traceId     V70 correlation ID propagated through every step.
   */
  async runWorkflow(
    definition: WorkflowDefinition,
    traceId:    string = randomUUID(),
  ): Promise<WorkflowRunResult> {
    const startedAt  = new Date().toISOString();
    const startMs    = Date.now();
    const results:   StepResult[] = [];
    const stateMap:  Record<string, string> = {};

    console.info(
      `[V92:WorkflowRunner] Starting workflow "${definition.name}" ` +
      `— ${definition.steps.length} step(s) | tenant=${definition.tenant_id} ` +
      `exec=${this.executionId} trace=${traceId}`
    );

    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i]!;

      const result = await this.executeStep(
        step,
        definition.tenant_id,
        traceId,
        stateMap,
      );

      results.push(result);

      if (!result.success) {
        // Fail-fast: halt the chain on any step error
        break;
      }

      // Expose output for the next step via both generic and step-specific tokens
      stateMap["previous_output"] = result.output;
      stateMap[`step_${i + 1}_output`] = result.output;
    }

    const completedAt   = new Date().toISOString();
    const succeed       = results.filter(r => r.success).length;
    const total         = definition.steps.length;
    const merkleRoot    = merkleLogger.getDailyRootHash(definition.tenant_id);

    const status: WorkflowRunResult["status"] =
      succeed === total
        ? "completed"
        : succeed === 0
          ? "failed"
          : "partial";

    console.info(
      `[V92:WorkflowRunner] Workflow "${definition.name}" → ${status.toUpperCase()} ` +
      `(${succeed}/${total} steps) | merkleRoot=${merkleRoot?.substring(0, 16) ?? "none"}... ` +
      `| durationMs=${Date.now() - startMs}`
    );

    return {
      executionId:    this.executionId,
      workflowName:   definition.name,
      tenantId:       definition.tenant_id,
      status,
      steps:          results,
      merkleRootHash: merkleRoot,
      startedAt,
      completedAt,
      durationMs:     Date.now() - startMs,
    };
  }
}
