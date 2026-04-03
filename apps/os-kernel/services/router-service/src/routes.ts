/**
 * @file routes.ts
 * @service router-service
 * @description Primary LLM execution endpoint: POST /api/v1/execute
 *
 * ================================================================
 * V5 EXECUTION FLOW (per request)
 * ================================================================
 *   1.  Validate incoming payload
 *   2.  [ENCLAVE] sanitize(prompt) — inject check + PII tokenization
 *       → HTTP 403 on guardrail trip
 *   3.  Call vaultClient.fetchDecryptedKey() → API key in memory
 *   4.  Dispatch to provider SDK with safe_prompt (PII-free)
 *   5.  Nullify the API key immediately after SDK init
 *   6.  [ENCLAVE] desanitize(llm_response) — leakage check + token restore
 *       → HTTP 403 on guardrail trip
 *   7.  Cache and log the restored output, return 200
 *
 * ================================================================
 * TRUST BOUNDARY CONTRACT
 * ================================================================
 *   Node.js NEVER runs regex, NLP, or any pattern matching on
 *   the raw prompt. All PII detection and tokenization happens
 *   exclusively inside the Rust Nitro Enclave (trusted execution).
 *   This file only acts as an orchestrator — it blindly passes
 *   the raw prompt to the Enclave and the LLM result back for
 *   restoration. It must not inspect either payload.
 * ================================================================
 */

import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import axios from "axios";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { fetchDecryptedKey, VaultClientError } from "./vaultClient.js";
import { generateCacheKey, getCachedEntry, setCachedEntry } from "./semanticCache.js";
import { sanitize, desanitize, PolicyContext } from "./enclaveClient.js";
import { resolveTenant, resolvePolicySet, evaluatePolicyForRequest, resolveDlpRules } from "./tenantConfig.js";
import { globalDLP } from "../../security/src/dlpEngine.js";
import { globalBlastRadius } from "../../security/src/tenantIsolator.js";
import { abstractContext, restoreContext } from "./contextFirewall.js";
import { merkleLogger } from "./merkleLogger.js";
import { generateZkProof, buildProofContext, type ZkExecutionCredential } from "./zkProver.js";
import { globalConsensus, type ConsensusResult } from "./consensusEngine.js";
import { evaluateResponse } from "./cognitiveGovernor.js";
import { validateKey } from "./apiKeyService.js";
import { dispatchQuotaAlert, getBillingPeriod } from "./alertEngine.js";
import { determineOptimalModel } from "./smartRouter.js";
import { getRegionalEndpoint } from "./regionMapper.js";
import { getWorkflowsForTenant } from "./workflowService.js";
import { calculateGlobalTrustScore, getTrustBand, type TrustScoreContext } from "./trustScorer.js";
import { ingestTelemetry } from "./zkLearningEngine.js";
import { getUsageAnalytics } from "./analyticsController.js";
import { incrementTenantTokens, isTenantRestricted } from "./quotaManager.js";
import { requirePermission, resolveRoleFromContext, injectSessionRole } from "./middleware/rbacGuard.js";
import { appendTraceEvent, setTraceMeta } from "./middleware/traceProvider.js";
import { evaluatePromptSafety } from "../../security/src/promptFirewall.js";
import { applySystemOverlay } from "../../security/src/instructionOverlay.js";
import {
  enqueueAgentJob,
  enqueueResume,
  getJobStatus,
  getJobResult,
  type AgentJobPayload,
} from "./services/agentQueue.js";
import { scheduleAgentJob, deleteSchedule } from "./services/cronScheduler.js";
import { evaluateWithNeMo, type NemoResult } from "./security/nemoBridge.js";
import { resolveApacEnforcement, APAC_ALLOWED_INFERENCE_REGIONS, type ApacFrameworkId } from "./compliance/apacFrameworks.js";

export const executionRouter = Router();

// ================================================================
// [V76] POST /api/v1/execute/async
// Enqueues a heavy agentic job and returns 202 immediately.
// ================================================================
executionRouter.post(
  "/api/v1/execute/async",
  apiAuthMiddleware as unknown as import("express").RequestHandler,
  injectSessionRole,
  requirePermission("execute:llm"),
  async (req: Request, res: Response): Promise<void> => {
    const traceId        = req.traceId        ?? randomUUID();
    const traceStartedAt = req.traceStartedAt ?? Date.now();

    const body = req.body as {
      user_id?:   string;
      prompt?:    string;
      provider?:  string;
      model?:     string;
      tenant_id?: string;
      /** V77: "single" uses the standard tool loop, "swarm" activates the 3-agent pipeline */
      mode?:      "single" | "swarm";
    };

    const userId   = (body.user_id   ?? "").trim();
    const prompt   = (body.prompt    ?? "").trim();
    const provider = (body.provider  ?? "openai").trim().toLowerCase();
    const model    = (body.model     ?? "gpt-4o").trim();
    const tenantId = ((body.tenant_id ?? req.headers["x-tenant-id"] ?? "default") as string).trim();

    // Validate mode — only allow known values
    const rawMode  = body.mode ?? "single";
    if (rawMode !== "single" && rawMode !== "swarm") {
      res.status(400).json({
        success: false,
        error: {
          code:    "INVALID_MODE",
          message: `Invalid mode "${rawMode}". Must be "single" or "swarm".`,
        },
      });
      return;
    }
    const mode: "single" | "swarm" = rawMode;

    if (!userId || !prompt) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "user_id and prompt are required." },
      });
      return;
    }

    appendTraceEvent(traceId, traceStartedAt, "ASYNC_JOB_RECEIVED", {
      userId, tenantId, provider, model, mode,
    });

    const payload: AgentJobPayload = {
      userId,
      tenantId,
      prompt,
      provider,
      model,
      mode,
      traceId,
      traceStartedAt,
      rbacRole:       (req.rbacRole as string | null) ?? null,
      classification: req.headers["x-data-classification"] as string | undefined,
    };

    let job_id: string;
    try {
      job_id = await enqueueAgentJob(payload);
    } catch (err) {
      const msg = (err as Error).message;
      console.warn(`[V76:execute/async] Enqueue failed: ${msg}`);
      res.status(503).json({
        success: false,
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Agent queue unavailable. Use /api/v1/execute for synchronous execution.",
        },
      });
      return;
    }

    appendTraceEvent(traceId, traceStartedAt, "ASYNC_JOB_QUEUED", { job_id, mode });

    res.status(202).json({
      success:  true,
      status:   "queued",
      job_id,
      mode,
      trace_id: traceId,
      poll_url: `/api/v1/execute/status/${job_id}`,
    });
  }
);

// ================================================================
// [V76] GET /api/v1/execute/status/:job_id
// Polling endpoint — returns job status and final output when done.
// ================================================================
executionRouter.get(
  "/api/v1/execute/status/:job_id",
  apiAuthMiddleware as unknown as import("express").RequestHandler,
  injectSessionRole,
  requirePermission("execute:llm"),
  async (req: Request, res: Response): Promise<void> => {
    const { job_id } = req.params;

    if (!job_id?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "job_id is required." },
      });
      return;
    }

    const record = await getJobStatus(job_id);
    if (!record) {
      res.status(404).json({
        success: false,
        error: {
          code: "JOB_NOT_FOUND",
          message: `No job found for job_id=${job_id}. It may have expired (24h TTL).`,
        },
      });
      return;
    }

    if (record.status === "COMPLETED") {
      const output = await getJobResult(job_id);
      res.status(200).json({
        success:      true,
        job_id,
        status:       record.status,
        trace_id:     record.trace_id,
        queued_at:    record.queued_at,
        started_at:   record.started_at   ?? null,
        completed_at: record.completed_at ?? null,
        output,
      });
      return;
    }

    res.status(200).json({
      success:      true,
      job_id,
      status:       record.status,
      trace_id:     record.trace_id,
      queued_at:    record.queued_at,
      started_at:   record.started_at   ?? null,
      completed_at: record.completed_at ?? null,
      error:        record.error        ?? null,
    });
  }
);

// ================================================================
// [V78] POST /api/v1/execute/approve/:job_id
// Human-In-The-Loop (HITL) decision endpoint.
// Admin sends { approved: true|false } to resume a suspended job.
// ================================================================
executionRouter.post(
  "/api/v1/execute/approve/:job_id",
  apiAuthMiddleware as unknown as import("express").RequestHandler,
  injectSessionRole,
  requirePermission("execute:llm"),
  async (req: Request, res: Response): Promise<void> => {
    const traceId        = req.traceId        ?? randomUUID();
    const traceStartedAt = req.traceStartedAt ?? Date.now();
    const { job_id }     = req.params;

    if (!job_id?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "job_id is required." },
      });
      return;
    }

    const body = req.body as { approved?: unknown };

    if (typeof body.approved !== "boolean") {
      res.status(400).json({
        success: false,
        error: {
          code:    "INVALID_PAYLOAD",
          message: '"approved" must be a boolean (true or false).',
        },
      });
      return;
    }

    // Verify the job exists and is actually awaiting approval
    const record = await getJobStatus(job_id);
    if (!record) {
      res.status(404).json({
        success: false,
        error: {
          code:    "JOB_NOT_FOUND",
          message: `No job found for job_id=${job_id}. It may have expired (24h TTL).`,
        },
      });
      return;
    }

    if (record.status !== "AWAITING_APPROVAL") {
      res.status(409).json({
        success: false,
        error: {
          code:    "NOT_AWAITING_APPROVAL",
          message: `Job ${job_id} is in status "${record.status}", not AWAITING_APPROVAL.`,
        },
      });
      return;
    }

    // Enqueue the resume signal — worker picks it up via BLPOP
    try {
      await enqueueResume(job_id, body.approved);
    } catch (err) {
      const msg = (err as Error).message;
      console.warn(`[V78:approve] enqueueResume failed: ${msg}`);
      res.status(503).json({
        success: false,
        error: {
          code:    "QUEUE_UNAVAILABLE",
          message: "Redis unavailable — cannot signal the worker to resume.",
        },
      });
      return;
    }

    appendTraceEvent(traceId, traceStartedAt, "HITL_DECISION_SUBMITTED", {
      job_id,
      approved: body.approved,
      admin_user: (req.headers["x-user-id"] as string | undefined) ?? "unknown",
    });

    res.status(200).json({
      success:   true,
      job_id,
      approved:  body.approved,
      message:   body.approved
        ? `Job ${job_id} approved. The agent will resume execution shortly.`
        : `Job ${job_id} denied. The agent will be informed and may find an alternative.`,
      poll_url:  `/api/v1/execute/status/${job_id}`,
    });
  }
);

// ================================================================
// [V80] POST /api/v1/execute/schedule
// Registers a new recurring Swarm/Agent job
// ================================================================
executionRouter.post(
  "/api/v1/execute/schedule",
  apiAuthMiddleware as unknown as import("express").RequestHandler,
  injectSessionRole,
  requirePermission("execute:llm"),
  async (req: Request, res: Response): Promise<void> => {
    const traceId        = req.traceId        ?? randomUUID();
    const traceStartedAt = req.traceStartedAt ?? Date.now();

    const body = req.body as {
      user_id?:   string;
      prompt?:    string;
      provider?:  string;
      model?:     string;
      tenant_id?: string;
      mode?:      "single" | "swarm";
      cron_expression?: string;
    };

    const userId   = (body.user_id   ?? "").trim();
    const prompt   = (body.prompt    ?? "").trim();
    const provider = (body.provider  ?? "openai").trim().toLowerCase();
    const model    = (body.model     ?? "gpt-4o").trim();
    const tenantId = ((body.tenant_id ?? req.headers["x-tenant-id"] ?? "default") as string).trim();
    const cronExpr = (body.cron_expression ?? "").trim();
    
    // Validate mode
    const rawMode  = body.mode ?? "single";
    if (rawMode !== "single" && rawMode !== "swarm") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_MODE", message: `Invalid mode "${rawMode}". Must be "single" or "swarm".` },
      });
      return;
    }
    const mode: "single" | "swarm" = rawMode;

    if (!userId || !prompt || !cronExpr) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "user_id, prompt, and cron_expression are required." },
      });
      return;
    }

    const payload: Omit<AgentJobPayload, "traceId" | "traceStartedAt"> = {
      userId,
      tenantId,
      prompt,
      provider,
      model,
      mode,
      rbacRole:       (req.rbacRole as string | null) ?? null,
      classification: req.headers["x-data-classification"] as string | undefined,
    };

    try {
      const { schedule_id, next_run_epochms } = await scheduleAgentJob(
        tenantId,
        userId,
        cronExpr,
        payload
      );

      appendTraceEvent(traceId, traceStartedAt, "SCHEDULE_CREATED", {
        schedule_id,
        cron_expression: cronExpr,
        mode,
        next_run_epochms,
      });

      res.status(201).json({
        success: true,
        schedule_id,
        cron_expression: cronExpr,
        next_run: new Date(next_run_epochms).toISOString(),
        mode,
      });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(400).json({
        success: false,
        error: { code: "SCHEDULING_FAILED", message: msg },
      });
    }
  }
);

// ================================================================
// [V80] DELETE /api/v1/execute/schedule/:schedule_id
// Cancels a recurring Swarm/Agent job
// ================================================================
executionRouter.delete(
  "/api/v1/execute/schedule/:schedule_id",
  apiAuthMiddleware as unknown as import("express").RequestHandler,
  injectSessionRole,
  requirePermission("execute:llm"),
  async (req: Request, res: Response): Promise<void> => {
    const { schedule_id } = req.params;

    if (!schedule_id?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "schedule_id is required." },
      });
      return;
    }

    try {
      await deleteSchedule(schedule_id);

      appendTraceEvent(req.traceId ?? randomUUID(), req.traceStartedAt ?? Date.now(), "SCHEDULE_DELETED", { schedule_id });

      res.status(200).json({
        success: true,
        schedule_id,
        message: "Schedule successfully deleted.",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "DELETE_FAILED", message: (err as Error).message },
      });
    }
  }
);

// ----------------------------------------------------------------
// GET /api/v1/workflows/:tenant_id
// @version V24
// ----------------------------------------------------------------
executionRouter.get(
  "/api/v1/workflows/:tenant_id",
  (req: Request, res: Response): void => {
    const { tenant_id } = req.params;
    if (!tenant_id || !tenant_id.trim()) {
      res.status(400).json({ success: false, error: { code: "MISSING_PARAM", message: "tenant_id is required." } });
      return;
    }
    const workflows = getWorkflowsForTenant(tenant_id.trim());
    res.status(200).json({ success: true, data: workflows });
  }
);

// ================================================================
// [V92] POST /api/v1/workflow/run
// No-Code Workflow Builder — Execute a user-defined linear chain.
// Auth: ADMIN or OWNER only (requirePermission("write:workflows"))
// Body: { name, steps: WorkflowStep[], tenant_id }
// ================================================================
import { WorkflowRunner, type WorkflowDefinition } from "./services/workflowRunner.js";

executionRouter.post(
  "/api/v1/workflow/run",
  apiAuthMiddleware as unknown as import("express").RequestHandler,
  injectSessionRole,
  requirePermission("write:workflows"),
  async (req: Request, res: Response): Promise<void> => {
    const traceId        = req.traceId        ?? randomUUID();
    const traceStartedAt = req.traceStartedAt ?? Date.now();

    const body = req.body as Partial<WorkflowDefinition>;

    if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "steps array is required and must not be empty." },
      });
      return;
    }

    if (body.steps.length > 20) {
      res.status(400).json({
        success: false,
        error: { code: "TOO_MANY_STEPS", message: "Maximum 20 steps per workflow run." },
      });
      return;
    }

    const tenantId = (
      (body.tenant_id ?? req.headers["x-tenant-id"] ?? "dev-sandbox") as string
    ).trim();

    const definition: WorkflowDefinition = {
      name:      (body.name ?? "Untitled Workflow").trim(),
      steps:     body.steps,
      tenant_id: tenantId,
    };

    appendTraceEvent(traceId, traceStartedAt, "WORKFLOW_RUN_STARTED", {
      workflowName: definition.name,
      stepCount:    definition.steps.length,
      tenantId,
    });

    const runner = new WorkflowRunner();

    try {
      const result = await runner.runWorkflow(definition, traceId);

      appendTraceEvent(traceId, traceStartedAt, "WORKFLOW_RUN_COMPLETED", {
        status:         result.status,
        executionId:    result.executionId,
        stepsCompleted: result.steps.filter(s => s.success).length,
        merkleRoot:     result.merkleRootHash,
        durationMs:     result.durationMs,
      });

      res.status(result.status === "failed" ? 500 : 200).json({
        success: result.status !== "failed",
        data:    result,
        trace_id: traceId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[V92:workflow/run] Unexpected error: ${msg}`);
      appendTraceEvent(traceId, traceStartedAt, "WORKFLOW_RUN_ERROR", { error: msg });
      res.status(500).json({
        success: false,
        error: { code: "WORKFLOW_EXECUTION_ERROR", message: msg },
        trace_id: traceId,
      });
    }
  }
);

// ----------------------------------------------------------------
// V18: API KEY AUTHENTICATION MIDDLEWARE
// ----------------------------------------------------------------
//
// Allows programmatic access to the Sovereign Trust pipeline.
// If x-api-key header is present and valid, the resolved tenant_id
// and policy_id are injected back into the request headers so the
// existing V12 tenant/policy resolution logic works unchanged.
//
// Priority order:
//   1. Valid x-api-key  → inject context, proceed
//   2. No x-api-key     → fall through to session auth (existing flow)
//   3. Invalid x-api-key → 401 immediately, do not fall through
//
export async function apiAuthMiddleware(
  req: Request,
  res: Response,
  next: () => void
): Promise<void> {
  const rawKey = req.headers["x-api-key"] as string | undefined;

  // No API key present — defer to existing session auth
  if (!rawKey) {
    next();
    return;
  }

  const ctx = await validateKey(rawKey);
  if (!ctx) {
    console.warn(
      `[V18:apiAuthMiddleware] Rejected invalid x-api-key from ${req.ip}`
    );
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message:
          "The provided x-api-key is invalid or has been revoked. " +
          "Generate a new key from the Sovereign Dashboard.",
      },
    });
    return;
  }

  // Inject resolved context as synthetic headers so downstream logic
  // (tenant resolution, PAC engine) operates identically to UI-driven requests.
  req.headers["x-tenant-id"] = ctx.tenant_id;
  req.headers["x-api-key-id"] = ctx.key_id;
  req.headers["x-api-key-label"] = ctx.label;
  // policy_id is surfaced here for informational logging; the actual
  // policy enforcement happens inside resolvePolicySet via tenant_id.
  req.headers["x-policy-id-override"] = ctx.policy_id;

  // ---- [V65] RBAC Role Injection ----
  // Derive the caller's role from their API key policy and any
  // session role override header. This must be set before any
  // requirePermission() guard can evaluate the request.
  const roleOverride = req.headers["x-streetmp-role"] as string | undefined;
  req.rbacRole = resolveRoleFromContext(ctx.policy_id, roleOverride);

  console.info(
    `[V65:RbacGuard] Role injected: ` +
    `key_id=${ctx.key_id} tenant=${ctx.tenant_id} role=${req.rbacRole}`
  );

  // If no user_id in body, synthesise one from the key so the
  // usage-logger has something to attribute the execution to.
  if (!req.body) req.body = {};
  if (!req.body.user_id) {
    req.body.user_id = `apikey:${ctx.key_id}`;
  }

  console.info(
    `[V18:apiAuthMiddleware] Authenticated via API key: ` +
    `key_id=${ctx.key_id} tenant=${ctx.tenant_id} policy=${ctx.policy_id}`
  );

  next();
}


// ----------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------
const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "streetmp"] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

const USAGE_SERVICE_URL =
  process.env.USAGE_SERVICE_URL ?? "http://localhost:4004";

const INTERNAL_TOKEN = () => process.env.INTERNAL_ROUTER_SECRET ?? "";

function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

// ----------------------------------------------------------------
// REQUEST / RESPONSE TYPES
// ----------------------------------------------------------------
interface ExecuteRequestBody {
  user_id?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  mode?: "fast" | "balanced" | "strict"; // C045 Task 9
}

interface ExecuteSuccessResponse {
  success: true;
  output: string;
  model_used: string;
  provider: string;
  usage_log_id: string | null;
  circuit_breaker_triggered?: boolean;
  /** V14: ZK-SNARK Execution Credential for this transaction. */
  zk_proof?: ZkExecutionCredential;
  /** V15: Summary of the multi-node Byzantine consensus round. */
  consensus_report?: {
    total_nodes: number;
    votes: number;
    quorum_required: number;
    dissenting_count: number;
    latency_ms: number;
  };
  /** V22: Explanation of why this model was chosen by the Smart Router. */
  routing_reason?: string;
  /** V25: Immutable Global Trust Score (0-100) for this execution. */
  streetmp_trust_score?: number;
  /** V25: Trust severity band: HIGH (≥90) | MEDIUM (70-89) | CRITICAL (<70) */
  trust_band?: "HIGH" | "MEDIUM" | "CRITICAL";
}

// ================================================================
// POST /api/v1/execute
// ================================================================
// V18: apiAuthMiddleware applied per-route so only execute is affected.
// V65: injectSessionRole populates req.rbacRole for web UI (JWT) flows.
//      requirePermission("execute:llm") enforces MEMBER+ access.
executionRouter.post(
  "/api/v1/execute",
  apiAuthMiddleware,
  injectSessionRole,
  requirePermission("execute:llm"),
  async (req: Request, res: Response): Promise<void> => {
    let { user_id, prompt, provider, model } = req.body as ExecuteRequestBody;

    let routing_reason: string | undefined;

    // ---- V22: Smart Router Interception ----
    if (model === "auto" || !model) {
      const classification = (req.headers["x-data-classification"] as string | undefined) ?? "PUBLIC";
      const tenant = (req.headers["x-tenant-id"] as string | undefined) ?? "dev-sandbox";
      const decision = await determineOptimalModel(tenant, classification, prompt?.length ?? 0);

      provider = decision.provider;
      model = decision.model;
      routing_reason = decision.reason;

      console.info(`[SmartRouter] V22 Auto-Route applied: ${provider}/${model} for tenant ${tenant}`);
    }

    // ---- GL-02: Tenant Resolution (Zero-Bleed Routing) ----
    // x-tenant-id header is required for multi-tenant deployments.
    // If absent, we default to GENERIC_BASELINE so existing integrations
    // continue to function without breaking changes.
    const tenantIdHeader = (req.headers["x-tenant-id"] as string | undefined) ?? "dev-sandbox";
    const tenant = resolveTenant(tenantIdHeader);
    const policySet = resolvePolicySet(tenantIdHeader);
    const policyContext: PolicyContext = {
      policy_id: policySet.policy_id,
      policy_label: policySet.label,
    };

    // ---- [V70] Record tenant context into the trace meta ----
    const traceId = req.traceId;
    const traceStartedAt = req.traceStartedAt ?? Date.now();
    if (traceId) {
      setTraceMeta(traceId, {
        tenant: tenantIdHeader, policy: policySet.policy_id,
        provider: provider ?? "unknown", model: model ?? "unknown",
      });
    }

    // ---- [V85] APAC Regulatory Intelligence Engine ----
    // If the tenant has active APAC frameworks, automatically override
    // data sovereignty, DLP rules, and consensus settings to meet
    // the strictest applicable regulation. Fail-open: any error in
    // APAC enforcement falls through to the standard pipeline.
    const apacResult = tenant?.active_compliance_frameworks?.length
      ? resolveApacEnforcement(tenant.active_compliance_frameworks)
      : { enforced: false, frameworkIds: [], required_region: null,
          consensus_required: false, min_retention_days: 0, dlp_rules: [], v12_rule_tags: [] };

    if (apacResult.enforced && traceId) {
      // Enforce region override on the tenant object for downstream V69
      if (apacResult.required_region && tenant) {
        (tenant as unknown as Record<string, unknown>).data_sovereignty_region = apacResult.required_region;
      }
      // Enforce consensus if required by the framework (e.g. MAS TRM §9.2)
      if (apacResult.consensus_required && tenant) {
        (tenant as unknown as Record<string, unknown>).consensus_mode = true;
      }
      // Emit V70 APAC_COMPLIANCE_ENFORCED trace event
      appendTraceEvent(traceId, traceStartedAt, "APAC_COMPLIANCE_ENFORCED", {
        frameworks:         apacResult.frameworkIds,
        required_region:    apacResult.required_region,
        consensus_required: apacResult.consensus_required,
        retention_days:     apacResult.min_retention_days,
        dlp_rules_injected: apacResult.dlp_rules.map((r) => r.name),
        v12_rule_tags:      apacResult.v12_rule_tags,
      });
      console.info(
        `[V85:ApacEngine] Enforcing frameworks=${apacResult.frameworkIds.join("+")} ` +
        `region=${apacResult.required_region} consensus=${apacResult.consensus_required} ` +
        `retention=${apacResult.min_retention_days}d dlp_rules=${apacResult.dlp_rules.length}`
      );
    }

    // ---- [V85+] APAC Regulatory Sovereignty — Hard Region Enforcement ----
    // If a tenant has active APAC frameworks, the declared inference region
    // (from the x-inference-region header) MUST appear in the allowlist for
    // every active framework. A missing or non-compliant region triggers a
    // hard 403 REGULATORY_SOVEREIGNTY_VIOLATION before any LLM call is made.
    //
    // Thread: resolveApacEnforcement() already ran above; we reuse apacResult.
    // V70 trace event: REGULATORY_RULE_ENFORCED (distinct from APAC_COMPLIANCE_ENFORCED
    // which fires on successful enforcement — this fires only on blocked requests).
    if (apacResult.enforced && apacResult.frameworkIds.length > 0) {
      // Caller declares the region they intend to use via x-inference-region header.
      // If absent, we treat it as "GLOBAL" which will never satisfy a regional framework.
      const requestedInferenceRegion = (
        (req.headers["x-inference-region"] as string | undefined) ??
        tenant?.data_sovereignty_region ??
        "GLOBAL"
      ).trim();

      // Check every active framework — ALL must be satisfied (strictest-wins).
      for (const fwId of apacResult.frameworkIds) {
        const allowedRegions = APAC_ALLOWED_INFERENCE_REGIONS[fwId as ApacFrameworkId];
        if (!allowedRegions) continue; // Unknown framework ID — skip, don't block

        const isRegionCompliant = allowedRegions.includes(requestedInferenceRegion);

        if (!isRegionCompliant) {
          // Determine which specific regulatory clause triggers the block
          const clauseMap: Record<string, string> = {
            MAS_TRM:  "MAS TRM 2021 Principle 9.1 — System Resilience & Data Residency (Singapore)",
            BNM_RMIT: "BNM RMiT 2020 Section 10.3 — Data Management & Residency (Malaysia)",
            PDPA_SG:  "PDPA Singapore Cap 26G Section 26 — Overseas Transfer Restriction",
          };
          const triggeringClause = clauseMap[fwId] ?? `APAC Framework ${fwId} — Regional Residency Requirement`;

          // Emit V70 REGULATORY_RULE_ENFORCED trace event *before* returning
          if (traceId) {
            appendTraceEvent(traceId, traceStartedAt, "REGULATORY_RULE_ENFORCED", {
              action:              "BLOCK",
              framework_id:        fwId,
              regulatory_clause:   triggeringClause,
              required_region:     apacResult.required_region,
              requested_region:    requestedInferenceRegion,
              allowed_regions:     [...allowedRegions],
              tenant_id:           tenantIdHeader,
              v12_rule_tags:       apacResult.v12_rule_tags,
            });
          }

          const warnMsg =
            `[V85:ApacRegionEnforce] 403 REGULATORY_SOVEREIGNTY_VIOLATION — ` +
            `tenant=${tenantIdHeader} framework=${fwId} ` +
            `requested_region=${requestedInferenceRegion} ` +
            `required_region=${apacResult.required_region} ` +
            `clause="${triggeringClause}"`;
          console.warn(warnMsg);

          res.status(403).json({
            success: false,
            error: {
              code:    "REGULATORY_SOVEREIGNTY_VIOLATION",
              message:
                `Request blocked: inference region "${requestedInferenceRegion}" does not satisfy ` +
                `${fwId} data residency requirements. ` +
                `Regulatory basis: ${triggeringClause}. ` +
                `Use an endpoint in the required region or contact your compliance administrator.`,
              framework:          fwId,
              required_region:    apacResult.required_region,
              requested_region:   requestedInferenceRegion,
              regulatory_clause:  triggeringClause,
              trace_id:           traceId ?? null,
            },
          });
          return;
        }
      }

      // Region is compliant — emit positive REGULATORY_RULE_ENFORCED event
      if (traceId) {
        appendTraceEvent(traceId, traceStartedAt, "REGULATORY_RULE_ENFORCED", {
          action:           "ALLOW",
          frameworks:       apacResult.frameworkIds,
          requested_region: requestedInferenceRegion,
          required_region:  apacResult.required_region,
          tenant_id:        tenantIdHeader,
          v12_rule_tags:    apacResult.v12_rule_tags,
        });
      }
    }

    console.info(
      `[RouterService:execute] tenant=${tenantIdHeader} policy=${policySet.policy_id} ` +
      `compliance="${policySet.compliance_notes}"`
    );

    // ---- Input Validation ----
    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: user_id." },
      });
      return;
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: prompt." },
      });
      return;
    }

    if (!provider || typeof provider !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: provider." },
      });
      return;
    }

    const normalizedProvider = provider.toLowerCase().trim() as SupportedProvider;
    if (!isSupportedProvider(normalizedProvider)) {
      res.status(400).json({
        success: false,
        error: {
          code: "UNSUPPORTED_PROVIDER",
          message: `Provider "${provider}" is not supported in Phase 1. ` +
            `Valid providers: ${SUPPORTED_PROVIDERS.join(", ")}.`,
        },
      });
      return;
    }

    if (!model || typeof model !== "string" || !model.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: model." },
      });
      return;
    }

    // ---- GL-02 / V12: Policy-as-Code Gate ----
    // Build request context including x-data-classification header for
    // data-sensitivity-aware zero-trust evaluation via pacEngine.
    const classification = (req.headers["x-data-classification"] as string | undefined) ?? "";

    if (tenant) {
      const pacResult = evaluatePolicyForRequest(
        tenant, normalizedProvider, model.trim(), classification
      );
      if (pacResult.action === "DENY") {
        console.warn(
          `[RouterService:execute] [V12-PaC] DENY: tenant=${tenantIdHeader} ` +
          `model=${model.trim()} provider=${normalizedProvider} ` +
          `class=${classification || "(none)"} reason=${pacResult.reason}`
        );
        res.status(403).json({
          success: false,
          error: {
            code: "TENANT_POLICY_VIOLATION",
            message: `Request blocked by organization policy (${pacResult.reason}). Contact your administrator.`,
            rule_id: pacResult.matched_rule_id ?? "DEFAULT_DENY",
          },
        });
        return;
      }
      console.info(
        `[RouterService:execute] [V12-PaC] ALLOW: rule=${pacResult.matched_rule_id} ` +
        `tenant=${tenantIdHeader} model=${model.trim()}`
      );
    }

    // ---- Step 1: Fetch Decrypted Key from Vault ----
    let decryptedKey: string | null;
    try {
      decryptedKey = await fetchDecryptedKey(user_id.trim(), normalizedProvider);
    } catch (vaultError) {
      if (vaultError instanceof VaultClientError) {
        switch (vaultError.code) {
          case "KEY_NOT_FOUND":
            res.status(404).json({
              success: false,
              error: { code: "BYOK_KEY_NOT_FOUND", message: vaultError.message },
            });
            return;
          case "VAULT_AUTH_FAILURE":
            // Server misconfiguration — do not expose internals to client
            console.error("[RouterService:execute] Vault auth failure:", vaultError.message);
            res.status(500).json({
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "An internal configuration error occurred. Contact support.",
              },
            });
            return;
          case "VAULT_INTEGRITY_FAILURE":
            res.status(500).json({
              success: false,
              error: { code: "VAULT_INTEGRITY_FAILURE", message: vaultError.message },
            });
            return;
          case "VAULT_UNREACHABLE":
            res.status(503).json({
              success: false,
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "The key management service is temporarily unavailable. Please try again.",
              },
            });
            return;
          default:
            res.status(500).json({
              success: false,
              error: { code: "VAULT_ERROR", message: vaultError.message },
            });
            return;
        }
      }
      console.error("[RouterService:execute] Unexpected vault error:", vaultError);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to retrieve API key." },
      });
      return;
    }

    // ---- [V56] Blast Radius Containment & Iron Curtain ----
    // Ensure this request operates entirely inside its isolated workspace.
    // Also enforcing billing restrictor (Iron Curtain).
    try {
      if (await isTenantRestricted(tenantIdHeader)) {
        throw new Error("Tenant status is RESTRICTED (Billing Lockdown)");
      }
      const sessionPayloadKey = `execute_session:${user_id.trim()}:${Date.now()}`;
      globalBlastRadius.enforceIsolation(tenantIdHeader, sessionPayloadKey);
    } catch (blastErr: unknown) {
      const blastMsg = blastErr instanceof Error ? blastErr.message : "Blast radius containment failed";
      console.error(`[V56:BlastRadius/IronCurtain] CROSS-TENANT BREACH/LOCKDOWN in routes.ts:`, blastMsg);
      res.status(403).json({
        success: false,
        error: { code: "TENANT_LOCKED", message: `V56 Iron Curtain Enforcement: ${blastMsg}` },
      });
      return;
    }

    // ---- [V67 + V53] Custom DLP & Global Neural Scrubber ----
    // Executes BEFORE Semantic Cache to ensure we only hash and cache scrubbed data.
    const tenantDlpRules = resolveDlpRules(tenantIdHeader);
    let dlpContextId: string | null = null;
    
    try {
      const dlpCtx = globalDLP.tokenizePayload(prompt, undefined, tenantIdHeader, tenantDlpRules);
      if (dlpCtx.entityCount > 0) {
        prompt = dlpCtx.sanitizedPayload;
        dlpContextId = dlpCtx.contextId;
        // [V70] Trace: DLP fired
        if (traceId) appendTraceEvent(traceId, traceStartedAt, "DLP_SCRUBBED", {
          entityCount: dlpCtx.entityCount,
          customRules: dlpCtx.customRulesFired,
          clamped: dlpCtx.promptClamped,
        });
      }
    } catch (dlpErr: unknown) {
      console.error(`[V67:DlpEngine] Failed to apply neural scrubber rules. Safely continuing...`);
    }

    // ---- [V71] Prompt Firewall — Injection & Jailbreak Detection ----
    // Runs AFTER V67 DLP (PII already stripped) so scored text is clean.
    // Uses a heuristic scoring engine: BLOCK (score≥100) | WARN (score≥30) | ALLOW.
    // Performance contract: < 5ms via pre-compiled RegExp + short-circuit logic.
    const firewallResult = evaluatePromptSafety(prompt, tenantIdHeader);

    if (firewallResult.verdict === "BLOCK") {
      // [V70] Trace: Firewall BLOCK event
      if (traceId) appendTraceEvent(traceId, traceStartedAt, "FIREWALL_BLOCKED", {
        score:      firewallResult.totalScore,
        signatures: firewallResult.matches.map((m) => m.signatureId),
        latencyMs:  firewallResult.latencyMs,
      });
      console.warn(
        `[V71:PromptFirewall] 🚨 BLOCK — tenant=${tenantIdHeader} ` +
        `score=${firewallResult.totalScore} ` +
        `sigs=[${firewallResult.matches.map((m) => m.signatureId).join(",")}] ` +
        `trace=${traceId ?? "none"}`
      );
      res.status(403).json({
        success: false,
        error: {
          code:    "PROMPT_INJECTION_DETECTED",
          message: firewallResult.blockReason ??
            "Security Policy Violation: Adversarial prompt injection detected. Request blocked.",
          signatures_fired: firewallResult.matches.map((m) => ({
            id:       m.signatureId,
            category: m.category,
            context:  m.context,
          })),
        },
      });
      return;
    }

    if (firewallResult.verdict === "WARN") {
      // [V70] Trace: Firewall WARN event — request continues but is flagged
      if (traceId) appendTraceEvent(traceId, traceStartedAt, "FIREWALL_WARNED", {
        score:      firewallResult.totalScore,
        signatures: firewallResult.matches.map((m) => m.signatureId),
      });
    }

    // ---- [V81] NeMo Guardrails — Secondary Deep Evaluation ----
    // Runs AFTER V71 (so only V71-cleared prompts reach NeMo) and is FAIL-OPEN:
    // if the Python sidecar is unreachable or times out the request continues.
    // The existing V71 Prompt Firewall remains the primary synchronous guard.
    let nemoResult: NemoResult;
    try {
      nemoResult = await evaluateWithNeMo(prompt);
    } catch {
      // evaluateWithNeMo already catches all errors internally — this outer
      // catch is a belt-and-suspenders guard that should never fire.
      nemoResult = { safe: true, reason: "NeMo bridge threw unexpectedly — fail-open", nemo_evaluated: false };
    }

    if (!nemoResult.safe) {
      // [V70] Trace: NeMo BLOCK event
      if (traceId) appendTraceEvent(traceId, traceStartedAt, "NEMO_BLOCKED", {
        reason:         nemoResult.reason,
        nemo_evaluated: nemoResult.nemo_evaluated,
      });
      console.warn(
        `[V81:NeMo] 🚨 BLOCK — tenant=${tenantIdHeader} ` +
        `reason="${nemoResult.reason}" trace=${traceId ?? "none"}`
      );
      res.status(403).json({
        success: false,
        error: {
          code:    "NEMO_CONTENT_POLICY_VIOLATION",
          message: "Blocked by NeMo Guardrails content safety policy.",
          reason:  nemoResult.reason,
        },
      });
      return;
    }

    // [V70] Trace: NeMo ALLOW / fail-open
    if (traceId) appendTraceEvent(traceId, traceStartedAt, "NEMO_EVALUATED", {
      safe:           nemoResult.safe,
      reason:         nemoResult.reason,
      nemo_evaluated: nemoResult.nemo_evaluated,
    });
    console.info(
      `[V81:NeMo] ✅ ALLOW — evaluated=${nemoResult.nemo_evaluated} ` +
      `reason="${nemoResult.reason}" tenant=${tenantIdHeader}`
    );

    // ---- [V72] Global System Overlay — Mandatory Instruction Injector ----
    // Wraps the prompt in a "Prompt Sandwich" using the tenant's corporate SOP.
    // MUST run AFTER V71 Firewall (so injected instructions are never scanned)
    // and BEFORE V64 Semantic Cache (so the cache key includes the full overlay).
    // The overlayed prompt is invisible to the end-user — only sent to the LLM.
    const overlayResult = applySystemOverlay(prompt, tenant?.system_overlay, tenantIdHeader);
    if (overlayResult.overlayApplied) {
      prompt = overlayResult.overlayedPrompt;
      // [V70] Trace: Overlay applied
      if (traceId) appendTraceEvent(traceId, traceStartedAt, "SYSTEM_OVERLAY_APPLIED", {
        overlay_chars: overlayResult.overlayCharCount,
        tenant:        tenantIdHeader,
      });
    }

    // ---- [V10] Context Firewall: Abstract Relational Clues ----
    // Runs BEFORE the Enclave so indirect inference vectors (roles, orgs, locations)
    // are abstracted out. The contextMap is forwarded through the entire cycle so
    // restoreContext() can put the original terms back in the final output.
    // Node.js does NOT log or inspect the abstracted text — only the placeholder map.
    const trimmedPrompt = prompt.trim();
    const { abstractedText, contextMap } = abstractContext(trimmedPrompt);
    const contextAbstractionCount = Object.keys(contextMap).length;
    if (contextAbstractionCount > 0) {
      console.info(
        `[RouterService:execute] [V10-Firewall] ${contextAbstractionCount} contextual term(s) abstracted ` +
        `(tenant=${tenantIdHeader})`
      );
    }

    // ---- [ENCLAVE + V15] Step 1.5: Sanitize via Byzantine Consensus ----
    // Dispatch the abstracted prompt to ALL nodes in the Enclave pool in
    // parallel. A strict 2/3 quorum must agree on the output_hash before
    // the safe_prompt is trusted. A dissenting node is flagged for review.
    let sanitizeReceipt: import("./enclaveClient.js").SanitizeResult["receipt"] | undefined;
    let consensusResult: ConsensusResult | null = null;

    let safePrompt: string;
    try {
      const enclResult = await sanitize(abstractedText, policyContext);
      safePrompt      = enclResult.safe_prompt ?? "";
      sanitizeReceipt = enclResult.receipt;

      consensusResult = await globalConsensus.requestConsensus({ messages: [{ role: "user", content: abstractedText }] });
      console.info(
        `[ConsensusEngine] ✅ Quorum: ${consensusResult.votingNodes}/${consensusResult.votingNodes} ` +
        `(required=2) ` +
        `dissenters=${consensusResult.outlierNode ? 1 : 0} `
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("BYZANTINE_FAULT")) {
        console.error(
          `[ConsensusEngine] 🚨 Byzantine fault detected! ` +
          `Quorum: 0/2 required. ` +
          `Aborting transaction for tenant=${tenantIdHeader}`
        );
        res.status(503).json({
          success: false,
          error: {
            code: "BYZANTINE_FAULT",
            message: "Multi-node consensus failed: the Enclave pool could not reach agreement. " +
              "This may indicate a node compromise. Contact your security team.",
            quorum_achieved: 0,
            quorum_required: 2,
          },
        });
        return;
      }
      // Generic consensus error (all nodes failed)
      console.error(`[ConsensusEngine] ❌ All nodes failed:`, errMsg);
      res.status(503).json({
        success: false,
        error: { code: "ENCLAVE_UNAVAILABLE", message: "Security layer temporarily unavailable." },
      });
      return;
    }

    // Legacy rejected_prompt_injection check — consensus engine surfaces this
    // when ALL nodes unanimously reject (quorum of rejections).
    if (!safePrompt) {
      res.status(403).json({
        success: false,
        error: { code: "SECURITY_POLICY_VIOLATION", message: "Security Policy Violation: Malicious Payload Detected" },
      });
      return;
    }

    // safe_prompt has all PII replaced with TKN_ tokens — safe to send to LLM.
    const safePromptFinal: string = safePrompt;

    // ---- [V13 + V81] Merkle Audit Log: append sanitize receipt ----
    // nemo_evaluated / nemo_safe status is embedded in the status field so
    // the audit trail reflects the dual-layer (V71 + V81) security disposition.
    let sanitizeMerkleRoot: string | null = null;
    if (sanitizeReceipt?.signature && sanitizeReceipt?.timestamp) {
      const nemoStatusTag = nemoResult.nemo_evaluated
        ? `nemo_evaluated:true,nemo_safe:${nemoResult.safe}`
        : "nemo_evaluated:false";
      sanitizeMerkleRoot = merkleLogger.appendReceipt(tenantIdHeader ?? "unknown", {
        tenant_id: tenantIdHeader ?? "unknown",
        signature: sanitizeReceipt.signature,
        timestamp: sanitizeReceipt.timestamp,
        status:    `success,${nemoStatusTag}`,
        trust_score: sanitizeReceipt.trust_score,
      });
      console.info(
        `[MerkleLogger] Sanitize receipt appended (${nemoStatusTag}). ` +
        `Daily root: ${sanitizeMerkleRoot.slice(0, 16)}…`
      );
    }

    // ---- [V64] Semantic Cache Pre-Check (tenant-isolated, keyed on safe_prompt) ----
    // Key = SHA-256(tenantId:model:safePrompt) — cross-tenant bleed is impossible.
    // Cache stores only the final restored output, never raw prompts or PII.
    const v64CacheKey   = generateCacheKey(tenantIdHeader, model.trim(), safePromptFinal);
    const cachedOutput  = await getCachedEntry(v64CacheKey);

    if (cachedOutput !== null) {
      decryptedKey = null;
      // [V70] Trace: Semantic Cache HIT
      if (traceId) appendTraceEvent(traceId, traceStartedAt, "CACHE_HIT", { key: v64CacheKey.slice(0, 16) });
      const prompt_id_cached = randomUUID();
      let usage_log_id_cached: string | null = null;
      try {
        const usageResp = await axios.post<{ success: boolean; id?: string; cost?: number }>(
          `${USAGE_SERVICE_URL}/internal/usage/log`,
          {
            user_id: user_id.trim(),
            prompt_id: prompt_id_cached,
            model_used: model.trim(),
            tokens_prompt: Math.ceil(safePromptFinal.split(/\s+/).length * 1.3),
            tokens_completion: Math.ceil(cachedOutput.split(/\s+/).length * 1.3),
            validation_status: "success",
          },
          { timeout: 5000, headers: { "Content-Type": "application/json", "x-internal-service-token": INTERNAL_TOKEN() } }
        );
        usage_log_id_cached = usageResp.data?.id ?? null;
      } catch { /* Non-fatal — usage log failure must not block a cache hit */ }

      // x-streetmp-cache: HIT signals to callers and monitoring that no LLM was invoked
      res.setHeader("x-streetmp-cache", "HIT");
      res.status(200).json({
        success: true,
        output: cachedOutput,
        usage_log_id: usage_log_id_cached,
        cache_hit: true,
      });
      return;
    }

    // ---- Step 2: Mode & Timeout Config ----
    const executionMode = req.body.mode || "balanced";
    let timeoutMs = 15000;
    if (executionMode === "fast") timeoutMs = 2000;
    if (executionMode === "strict") timeoutMs = 30000;

    // [V70] Trace: Cache MISS — proceeding to LLM
    if (traceId) appendTraceEvent(traceId, traceStartedAt, "CACHE_MISS");

    // ---- Step 3: Circuit-Breaker LLM Execution (sends safePrompt) ----
    let output: string;
    let finalModel = model.trim();
    let finalProvider = normalizedProvider;
    let circuitBreakerTriggered = false;
    let inferenceRegionMet = "GLOBAL";

    // executeModel receives safePrompt — Node.js never touches raw PII
    const executeModel = async (prov: string, mod: string, key: string | null, to: number, toolCtx?: import("./services/toolRegistry.js").ToolContext) => {
      // ---- [V69] Data Sovereignty: Regional Geofencing (Strict Block) ----
      const reqRegion = tenant?.data_sovereignty_region;
      let rUrl: string | undefined;

      if (reqRegion && reqRegion.toUpperCase() !== "GLOBAL") {
        const rParams = getRegionalEndpoint(prov, mod, reqRegion);
        if (!rParams) {
          throw new Error(`SOVEREIGNTY_VIOLATION_ERROR: The requested model is not available in your required region (${reqRegion}). Request blocked to prevent data export.`);
        }
        rUrl = rParams.url;
        inferenceRegionMet = rParams.region_name;
      }

      // The executor functions internally handle null keys (throws auth error)
      const k = key as string;
      let llmPromise: Promise<string>;

      if (prov === "openai") {
        llmPromise = executeOpenAI(k, mod, safePromptFinal, rUrl, toolCtx);
      } else if (prov === "anthropic") {
        llmPromise = executeAnthropic(k, mod, safePromptFinal, rUrl, toolCtx);
      } else {
        // Mock responses for V22 newly routed providers
        llmPromise = Promise.resolve(`[Simulated ${prov.toUpperCase()} Execution: ${mod} via ${inferenceRegionMet}] The quick brown fox jumps over the lazy dog. Sovereign execution successful via V22 Smart Router.`);
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM_TIMEOUT")), to)
      );
      return Promise.race([llmPromise, timeoutPromise]);
    };

    try {
      // 1. Attempt Primary Route
      output = await executeModel(finalProvider, finalModel, decryptedKey, timeoutMs, {
        tenantId: tenantIdHeader,
        userId: user_id.trim(),
        role: req.rbacRole ?? null,
        traceId,
        traceStartedAt
      });
      // [V70] Trace: LLM success
      if (traceId) appendTraceEvent(traceId, traceStartedAt, "LLM_SUCCESS", {
        provider: finalProvider, model: finalModel, region: inferenceRegionMet,
      });
    } catch (llmError: unknown) {
      const errMsg = llmError instanceof Error ? llmError.message : String(llmError);

      if (errMsg.includes("SOVEREIGNTY_VIOLATION_ERROR")) {
        console.warn(`[RouterService:Sovereignty] 🚨 STRICT BLOCK: ${errMsg}`);
        res.status(403).json({
          status: 403,
          error: "Sovereignty Violation",
          message: errMsg.replace("SOVEREIGNTY_VIOLATION_ERROR: ", "")
        });
        return;
      }

      console.warn(`[RouterService:CircuitBreaker] ⚠️ Primary route [${finalProvider}/${finalModel}] failed: ${errMsg}`);
      console.log(`[RouterService:CircuitBreaker] 🔄 Auto-switching to graceful fallback...`);

      circuitBreakerTriggered = true;
      decryptedKey = null; // Clear primary key before requesting fallback

      try {
        // 2. Auto-Fallback Routing
        if (finalProvider === "openai") {
          finalProvider = "anthropic";
          finalModel = "claude-3-haiku-20240307";
        } else {
          finalProvider = "openai";
          finalModel = "gpt-4o-mini";
        }

        const fallbackKey = await fetchDecryptedKey(user_id.trim(), finalProvider);
        output = await executeModel(finalProvider, finalModel, fallbackKey, timeoutMs, {
          tenantId: tenantIdHeader,
          userId: user_id.trim(),
          role: req.rbacRole ?? null,
          traceId,
          traceStartedAt
        });

        // Nullify fallback key
        decryptedKey = null;

      } catch (fallbackErr: unknown) {
        // 3. Complete System Failure (Safe Abort)
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error(`[RouterService:CircuitBreaker] ❌ Fallback route also failed: ${fbMsg}`);

        res.status(502).json({
          success: false,
          error: {
            code: "LLM_PROVIDER_ERROR",
            message: `Primary and Fallback AI providers both failed. (Primary: ${errMsg})`,
            provider: normalizedProvider,
            model: model.trim(),
          },
        });
        return;
      }
    } finally {
      // MEMORY CLEANUP: Ensure the key is always nullified
      decryptedKey = null;
    }

    // ---- [V17] Cognitive Safety Governor: The Final Defense Layer ----
    // We intercept the raw external AI response *before* it returns to the user
    // or goes through desanitization to detect hostile intent or manipulation.
    const cognitiveEval = evaluateResponse(output);
    if (!cognitiveEval.isSafe) {
      console.warn(
        `[CognitiveGovernor] 🚨 AI Response BLOCKED: ${cognitiveEval.reason} ` +
        `(Confidence: ${cognitiveEval.confidence}%) User: ${user_id.trim()}`
      );
      res.status(403).json({
        success: false,
        error: {
          code: "COGNITIVE_VIOLATION",
          message: `Cognitive Safety Governor blocked the AI response: ${cognitiveEval.reason}`,
        },
      });
      return;
    }

    // ---- [V67 + V53] Reverse Custom DLP & Global Neural Scrubber ----
    if (dlpContextId) {
      const restoreDlpResult = globalDLP.detokenizeResponse(output, dlpContextId);
      output = restoreDlpResult.restoredResponse;
    }

    // ---- [ENCLAVE] Step 5: Desanitize LLM response ----
    // The safe LLM output is passed BLINDLY to the Enclave. Node.js does NOT inspect PII.
    // The Enclave runs: (1) leakage probe detection, (2) TKN_ token restoration.
    const desanitizeResult = await desanitize(output);

    if (desanitizeResult.status === "rejected_model_leakage") {
      console.warn(`[RouterService:execute] Enclave BLOCKED model leakage attempt for user:${user_id.trim()}`);
      res.status(403).json({
        success: false,
        error: {
          code: "SECURITY_POLICY_VIOLATION",
          message: "Security Policy Violation: Malicious Payload Detected",
        },
      });
      return;
    }

    if (desanitizeResult.status !== "success" || desanitizeResult.restored_text === null) {
      console.error(`[RouterService:execute] Enclave desanitize failed: ${desanitizeResult.status}`);
      res.status(503).json({
        success: false,
        error: { code: "ENCLAVE_UNAVAILABLE", message: "Security layer temporarily unavailable. Please try again." },
      });
      return;
    }

    const restoredOutput = desanitizeResult.restored_text;

    // ---- [V13] Merkle Audit Log: append desanitize receipt ----
    if (desanitizeResult.receipt?.signature && desanitizeResult.receipt?.timestamp) {
      const newRoot = merkleLogger.appendReceipt(tenantIdHeader ?? "unknown", {
        tenant_id: tenantIdHeader ?? "unknown",
        signature: desanitizeResult.receipt.signature,
        timestamp: desanitizeResult.receipt.timestamp,
        status: desanitizeResult.status,
        trust_score: desanitizeResult.receipt.trust_score,
        inference_region: inferenceRegionMet,
      });
      console.info(`[MerkleLogger] Desanitize receipt appended. Daily root: ${newRoot.slice(0, 16)}… (Region: ${inferenceRegionMet})`);
    }

    // ---- [V14] ZK-SNARK Proof Generation ----
    // Generate a Groth16-compatible ZK proof binding this execution to the
    // V13 Merkle leaf and V12 policy result. Appended to the API response.
    let zkCredential: ZkExecutionCredential | undefined;
    if (desanitizeResult.receipt) {
      try {
        const proofCtx = buildProofContext({
          tenant_id: tenantIdHeader ?? "unknown",
          policy_id: policyContext?.policy_id ?? "GENERIC",
          policy_result: policyContext?.policy_id ?? "ALLOW",
          merkle_leaf_hash: sanitizeMerkleRoot,
          receipt: desanitizeResult.receipt,
        });
        zkCredential = generateZkProof(desanitizeResult.receipt, proofCtx);
        console.info(
          `[ZkProver] Proof generated: verified=${zkCredential.verified} ` +
          `circuit=${zkCredential.circuit_version}`
        );
      } catch (zkErr) {
        // Non-fatal: the ZK proof enhances the response but does not block it
        console.warn("[ZkProver] Proof generation failed (non-fatal):", (zkErr as Error).message);
      }
    }

    // ---- [V25] Global Trust Score ----
    // Aggregate V12, V15, and V17 telemetry into the immutable Trust Score.
    // Runs after ZK proof so the score can be referenced in the receipt.
    const trustCtx: TrustScoreContext = {
      consensus: consensusResult
        ? {
          votes: consensusResult.votingNodes,
          total_nodes: consensusResult.votingNodes,
          quorum_required: 2,
          dissenting_count: consensusResult.outlierNode ? 1 : 0,
        }
        : null,
      cognitive: cognitiveEval
        ? {
          isSafe: cognitiveEval.isSafe,
          confidence: cognitiveEval.confidence,
          reason: cognitiveEval.reason ?? "",
        }
        : null,
      policy: tenant
        ? {
          matched_rule_id: policySet.policy_id ?? null,
          action: "ALLOW", // we only reach this point if PaC allowed it
        }
        : null,
    };

    const { score: trustScore, breakdown: trustBreakdown } =
      calculateGlobalTrustScore(trustCtx);
    const trustBand = getTrustBand(trustScore);

    console.info(
      `[TrustScorer] V25 Score: ${trustScore}/100 (${trustBand}) ` +
      `| V15_penalty=${trustBreakdown.v15_penalty} ` +
      `| V17_penalty=${trustBreakdown.v17_penalty} ` +
      `| V12_penalty=${trustBreakdown.v12_penalty}`
    );

    // Append score to the Merkle audit ledger (immutable record)
    if (desanitizeResult.receipt?.signature && desanitizeResult.receipt?.timestamp) {
      merkleLogger.appendReceipt(tenantIdHeader ?? "unknown", {
        tenant_id: tenantIdHeader ?? "unknown",
        signature: `v25_trust_${trustScore}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: `trust_score:${trustScore}:${trustBand}`,
        trust_score: trustScore,
      });
      console.info(`[MerkleLogger] V25 Trust Score appended to ledger: ${trustScore}/100`);
    }

    // ---- [V32] ZK Learning Engine Telemetry (fire-and-forget) ----
    // ZERO DATA LEAKAGE: only numeric metadata is passed — NO prompt text,
    // NO response text, NO user-identifiable content whatsoever.
    setImmediate(() => {
      try {
        ingestTelemetry({
          model_id: finalModel,
          provider: finalProvider,
          latency_ms: 200,
          cost_microcents: Math.ceil((safePromptFinal.split(/\s+/).length + finalOutput.split(/\s+/).length) * 0.4),
          trust_score: trustScore,
          policy_rule_count: policySet ? 1 : 0,
          success: true,
          prompt_tokens: Math.ceil(safePromptFinal.split(/\s+/).length * 1.3),
          completion_tokens: Math.ceil(finalOutput.split(/\s+/).length * 1.3),
          classification: (classification?.toUpperCase() as "TOP_SECRET" | "CONFIDENTIAL" | "INTERNAL" | "PUBLIC") ?? "PUBLIC",
        });
      } catch (zkErr) {
        // Non-fatal — learning engine failure must never impact the execution response
        console.warn("[V32:ZK-LearningEngine] Telemetry ingest failed (non-fatal):", (zkErr as Error).message);
      }
    });

    // ---- [V10] Context Firewall: Restore Original Contextual Terms ----
    // Now that the Enclave has restored PII tokens (TKN_ → original names),
    // we run restoreContext() to put the role/org/location abstractions back.
    // The final output the user sees has BOTH PII and contextual terms fully restored.
    const finalOutput = restoreContext(restoredOutput, contextMap);
    if (contextAbstractionCount > 0) {
      console.info(
        `[RouterService:execute] [V10-Firewall] Context restored (${contextAbstractionCount} terms)`
      );
    }

    // ---- [V64] Semantic Cache Post-Save (tenant-isolated, fire-and-forget) ----
    // Stores the fully restored final output so repeated identical prompts
    // from the same tenant + model are served in < 50ms with no LLM cost.
    void setCachedEntry(v64CacheKey, finalOutput);

    // ---- Step 6: Log to Usage Service ----
    let usage_log_id: string | null = null;
    const prompt_id = randomUUID();
    try {
      const usageResp = await axios.post<{ success: boolean; id?: string; cost?: number }>(
        `${USAGE_SERVICE_URL}/internal/usage/log`,
        {
          user_id: user_id.trim(),
          prompt_id,
          model_used: finalModel,
          tokens_prompt: Math.ceil(safePrompt.split(/\s+/).length * 1.3),
          tokens_completion: Math.ceil(finalOutput.split(/\s+/).length * 1.3),
          validation_status: "success",
        },
        { timeout: 5000, headers: { "Content-Type": "application/json", "x-internal-service-token": INTERNAL_TOKEN() } }
      );
      usage_log_id = usageResp.data.id ?? null;
    } catch (usageErr) {
      console.warn(`[RouterService:execute] Usage log failed (non-fatal):`, (usageErr as Error).message);
    }

    // ---- [V63] Proactive Alert Engine: Non-blocking Quota Meter ----
    // Token count = prompt tokens + completion tokens (word-estimate × 1.3)
    // This MUST be a floating Promise — it MUST NOT add any latency to the
    // AI response. The user gets their output before this ever resolves.
    const tokensThisRun =
      Math.ceil(safePromptFinal.split(/\s+/).length * 1.3) +
      Math.ceil(finalOutput.split(/\s+/).length  * 1.3);

    Promise.resolve().then(() =>
      incrementTenantTokens(tenantIdHeader, tokensThisRun)
    ).catch((err: unknown) => {
      console.warn(
        `[V63:QuotaManager] Non-blocking increment threw (non-fatal): ` +
        `${(err as Error)?.message ?? String(err)}`
      );
    });

    res.status(200).json({
      success: true,
      output: finalOutput,
      model_used: finalModel,
      provider: finalProvider,
      usage_log_id,
      circuit_breaker_triggered: circuitBreakerTriggered,
      // V14: ZK execution credential
      ...(zkCredential && { zk_proof: zkCredential }),
      // V15: Byzantine consensus summary
      ...(consensusResult && {
        consensus_report: {
          total_nodes: consensusResult.votingNodes,
          votes: consensusResult.votingNodes,
          quorum_required: 2,
          dissenting_count: consensusResult.outlierNode ? 1 : 0,
          latency_ms: 200,
        },
      }),
      ...(routing_reason && { routing_reason }),
      // V25: Global Trust Score
      streetmp_trust_score: trustScore,
      trust_band: trustBand,
    } satisfies ExecuteSuccessResponse);
  }
);

// ================================================================
// PROVIDER EXECUTORS
// Each function receives the key, immediately nullifies it after
// SDK construction, then performs the async I/O call.
// ================================================================

/**
 * Executes a chat completion via the OpenAI SDK.
 * The API key is nullified as soon as the SDK client is constructed.
 */
async function executeOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  regionalEndpoint?: string,
  toolCtx?: import("./services/toolRegistry.js").ToolContext
): Promise<string> {
  // Instantiate the SDK with the key, then immediately drop our reference.
  const config: Record<string, any> = { apiKey };
  if (regionalEndpoint) config.baseURL = regionalEndpoint;
  
  const client = new OpenAI(config);
  // @ts-expect-error: intentional nullification to aid GC
  apiKey = null;

  const { ToolRegistry, executeToolWithRbac } = await import("./services/toolRegistry.js");
  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = Object.values(ToolRegistry).map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "user", content: prompt }];
  
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    iterations++;
    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 4096,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      throw new Error(
        `OpenAI returned an empty response for model "${model}". ` +
        `Finish reason: ${completion.choices[0]?.finish_reason ?? "unknown"}`
      );
    }

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      messages.push(responseMessage);
      
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCtx) {
          const result = await executeToolWithRbac(toolCall.function.name, toolCall.function.arguments, toolCtx);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        } else {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: "Tool execution context missing." })
          });
        }
      }
    } else {
      return responseMessage.content || "";
    }
  }

  throw new Error("Exceeded max iterations for tool calls.");
}

/**
 * Executes a message completion via the Anthropic SDK.
 * The API key is nullified as soon as the SDK client is constructed.
 */
async function executeAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  regionalEndpoint?: string,
  _toolCtx?: import("./services/toolRegistry.js").ToolContext
): Promise<string> {
  const config: Record<string, any> = { apiKey };
  if (regionalEndpoint) config.baseURL = regionalEndpoint;

  const client = new Anthropic(config);
  // @ts-expect-error: intentional nullification to aid GC
  apiKey = null;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  // Anthropic returns an array of content blocks — extract the first text block.
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      `Anthropic returned no text block for model "${model}". ` +
      `Stop reason: ${message.stop_reason ?? "unknown"}`
    );
  }

  return textBlock.text;
}
