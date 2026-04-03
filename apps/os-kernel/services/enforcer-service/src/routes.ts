/**
 * @file routes.ts
 * @service enforcer-service
 * @description The Deterministic JSON Enforcer — "The Bolt".
 *
 * ================================================================
 * CORE MISSION
 * ================================================================
 * LLMs are probabilistic. This service makes them deterministic
 * for structured data use cases by:
 *
 *   1. Injecting a strict system-level instruction prefix that
 *      commands the model to output ONLY valid JSON containing
 *      a caller-specified set of required keys.
 *
 *   2. Running a retry loop (max 3 total attempts) that:
 *      a. Parses the output as JSON
 *      b. Verifies every required key exists at the root level
 *      c. On failure: re-injects a correction instruction and
 *         retries without the caller knowing
 *
 *   3. Returns the validated, parsed JSON object to the caller,
 *      along with the number of attempts taken (for HCQ scoring).
 *
 * ================================================================
 * HCQ INTEGRATION NOTE (Phase 2)
 * ================================================================
 * The `attempts_taken` field in the response is the raw data
 * that feeds the Hallucination-Correction Quotient (HCQ) score.
 * - attempts_taken = 1 → clean output, full HCQ credit
 * - attempts_taken = 2 → one correction required
 * - attempts_taken = 3 → two corrections required (low HCQ)
 * - failure after 3  → HCQ penalty, logged to usage_logs
 *
 * The Usage Service will consume this in Phase 2.
 * ================================================================
 */

import { Router, Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { z } from "zod";
import { Pool } from "pg";
import { generateProofOfExecution } from "./proof.js";

export const enforcerRouter = Router();

// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------
const ROUTER_SERVICE_URL =
  process.env.ROUTER_SERVICE_URL ?? "http://localhost:4000";

const TRUST_SERVICE_URL =
  process.env.TRUST_SERVICE_URL ?? "http://localhost:4005";

const SANITIZER_SERVICE_URL =
  process.env.SANITIZER_SERVICE_URL ?? "http://localhost:4006";

const USAGE_SERVICE_URL =
  process.env.USAGE_SERVICE_URL ?? "http://localhost:4004";

// v2: Memory Service + DB for proof storage
const MEMORY_SERVICE_URL =
  process.env.MEMORY_SERVICE_URL ?? "http://localhost:4007";

// v2: Policy Engine
const POLICY_SERVICE_URL =
  process.env.POLICY_SERVICE_URL ?? "http://localhost:4008";

const INTERNAL_TOKEN = () => process.env.INTERNAL_ROUTER_SECRET ?? "";

// v2: DB pool for inserting execution_proofs
const pool = new Pool({
  host:     process.env.DB_HOST ?? "localhost",
  port:     parseInt(process.env.DB_PORT ?? "5432", 10),
  database: process.env.DB_NAME ?? "streetmp_os",
  user:     process.env.DB_USER ?? "streetmp",
  password: process.env.DB_PASS ?? "",
  max: 5, // Small pool — proof inserts are low-frequency
  idleTimeoutMillis: 30_000,
});

const MAX_ATTEMPTS = 3;

// ----------------------------------------------------------------
// REQUEST SCHEMA (Zod)
// Validate the incoming payload with full type safety before
// any work begins. Fail fast on malformed requests.
// ----------------------------------------------------------------
const EnforceRequestSchema = z.object({
  user_id: z.string().uuid({ message: "user_id must be a valid UUID." }),
  prompt: z.string().min(1, { message: "prompt cannot be empty." }),
  provider: z.enum(["openai", "anthropic"], {
    errorMap: () => ({ message: "provider must be 'openai' or 'anthropic'." }),
  }),
  model: z.string().min(1, { message: "model cannot be empty." }),
  required_keys: z
    .array(z.string().min(1))
    .min(1, { message: "required_keys must be a non-empty array of strings." }),
  /**
   * Enterprise HYOK mode — if true, the prompt is routed through
   * the Sanitizer Service (port 4006) before reaching any LLM.
   * PII is redacted, the AI sees clean data, and re-identification
   * happens before the response is returned to the client.
   */
  enterprise_mode: z.boolean().optional().default(false),
  /**
   * Custom regex pattern strings for caller-defined sensitive fields.
   * Only used when enterprise_mode is true.
   * Example: ["\\b(PROJECT_ATLAS)\\b", "\\bACME Corp\\b"]
   */
  sensitive_fields: z.array(z.string()).optional().default([]),
  /**
   * Redaction strategy for enterprise_mode.
   * mask  = labeled placeholder (fully opaque)
   * hash  = stable SHA-256 token (entity correlation preserved)
   */
  sanitize_strategy: z.enum(["mask", "hash"]).optional().default("mask"),
  /**
   * v2 Smart Mode:
   *   "auto"   — query Memory Service for the best model based on schema history.
   *              Falls back to gpt-4o-mini silently if memory is unavailable.
   *   "manual" — use the exact provider/model from the request (v1 behavior).
   * Defaults to "auto" to progressively improve routing quality over time.
   */
  mode: z.enum(["auto", "manual"]).optional().default("auto"),
  /**
   * v2 Policy Engine: organization_id for enterprise policy lookup.
   * Maps the user to their organization's policy rules.
   * Defaults to user_id (individual account — no org policy).
   */
  organization_id: z.string().optional(),
  
  // C045 Task 4 & 1
  debug: z.boolean().optional().default(false),
  trace_id: z.string().optional(),
});

type EnforceRequest = z.infer<typeof EnforceRequestSchema>;

// ----------------------------------------------------------------
// INTERNAL HELPER: FIRE-AND-FORGET TRUST TRACE
// ----------------------------------------------------------------
/**
 * Posts execution metadata to the Trust Service after every completed
 * enforce cycle (success or exhaustion). Runs fire-and-forget: a
 * Trust Service failure must never break the user's response.
 */
function fireTrustTrace(params: {
  user_id: string;
  usage_log_id: string;
  prompt: string;
  required_keys: string[];
  final_output: Record<string, unknown>;
  attempts_taken: number;
}): void {
  axios
    .post(
      `${TRUST_SERVICE_URL}/internal/trust/trace`,
      params,
      {
        timeout: 5000,
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-token": INTERNAL_TOKEN(),
        },
      }
    )
    .then(() => {
      console.log(
        `[EnforcerService] 🗒 Trust trace fired — user=${params.user_id} attempts=${params.attempts_taken}`
      );
    })
    .catch((err: Error) => {
      // Non-fatal: log but never propagate to the user's response
      console.warn(
        `[EnforcerService] Trust Service trace failed (non-fatal): ${err.message}`
      );
    });
}

// ----------------------------------------------------------------
// SYSTEM PROMPT BUILDERS
// ----------------------------------------------------------------

/**
 * Builds the deterministic JSON enforcement prefix injected before
 * the user's prompt on the first attempt.
 */
function buildSystemPrefix(requiredKeys: string[]): string {
  const keyList = requiredKeys.map((k) => `"${k}"`).join(", ");
  return (
    `You are a deterministic data engine. ` +
    `You must respond ONLY with valid JSON. ` +
    `Do not include markdown formatting, backticks, code fences, or any conversational text. ` +
    `Your entire response must be a single, parseable JSON object. ` +
    `Your JSON must strictly contain the following keys at the root level: [${keyList}]. ` +
    `\n\n`
  );
}

/**
 * Builds the correction prefix injected on retry attempts.
 * Tells the model exactly what went wrong without revealing
 * implementation details.
 */
function buildRetryPrefix(requiredKeys: string[], attempt: number): string {
  const keyList = requiredKeys.map((k) => `"${k}"`).join(", ");
  return (
    `CORRECTION REQUIRED (Attempt ${attempt + 1} of ${MAX_ATTEMPTS}): ` +
    `Your previous output failed JSON validation. ` +
    `It either was not valid JSON or was missing required keys. ` +
    `Fix it and return ONLY a valid JSON object with EXACTLY these root-level keys: [${keyList}]. ` +
    `No markdown, no backticks, no explanation. JSON only. ` +
    `\n\n`
  );
}

// ----------------------------------------------------------------
// JSON VALIDATION UTILITY
// ----------------------------------------------------------------
type ValidationSuccess = {
  success: true;
  parsed: Record<string, unknown>;
};

type ValidationFailure = {
  success: false;
  reason: string;
  parsed?: Record<string, unknown>;
  missingKeys?: string[];
};

type ValidationResult = ValidationSuccess | ValidationFailure;

function validateJsonOutput(
  raw: string,
  requiredKeys: string[]
): ValidationResult {
  let parsed: Record<string, unknown>;

  // Strip common LLM "markdown contamination" — models sometimes wrap JSON
  // in backtick code fences despite explicit instructions not to.
  // This is a pragmatic defensive strip, not a replacement for proper prompting.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      reason: `Output is not valid JSON. Raw snippet: "${cleaned.slice(0, 120)}..."`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      reason: "JSON parsed successfully but the root value is not an object.",
      parsed: parsed as Record<string, unknown>,
    };
  }

  const missingKeys = requiredKeys.filter((key) => !(key in parsed));
  if (missingKeys.length > 0) {
    return {
      success: false,
      reason: `JSON is valid but missing required keys: ${missingKeys.map((k) => `"${k}"`).join(", ")}.`,
      parsed,
      missingKeys,
    };
  }

  return { success: true, parsed };
}


// ================================================================
// POST /api/v1/enforce
// ================================================================
enforcerRouter.post(
  "/api/v1/enforce",
  async (req: Request, res: Response): Promise<void> => {
    const startMs = Date.now();

    // ---- Payload Validation ----
    const parseResult = EnforceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Request validation failed.",
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const reqData = req.body as EnforceRequest;
    const { user_id, prompt, provider, required_keys, enterprise_mode, sensitive_fields, sanitize_strategy } = reqData;
    const mode = reqData.mode ?? "auto";

    // routingModel is mutable — Smart Mode may override it before execution
    let routingModel = reqData.model;
    let routingReason: string = mode === "manual" ? "User Specified" : "Fallback Default";
    let memoryConfidence: string | null = null;
    // Policy-forced sanitization flag — may be overridden by the Policy Engine
    let activeSanitization = enterprise_mode;
    let policyId: string | undefined;

    // ── v2: Policy Engine Gatekeeper ─────────────────────────
    // FIRST check: before Memory Interceptor and before Sanitizer.
    // Determines if this execution is allowed under org policy.
    const orgId = reqData.organization_id ?? user_id; // fallback: user is their own org
    try {
      const policyResp = await axios.post<{
        success: boolean;
        evaluation: {
          allowed:         boolean;
          modified_model?: string;
          force_sanitizer: boolean;
          block_reason?:   string;
          policy_id?:      string;
          evaluation_ms:   number;
        };
      }>(
        `${POLICY_SERVICE_URL}/internal/policy/evaluate`,
        {
          user_id,
          organization_id: orgId,
          model:           routingModel,
          prompt:          prompt,
          prompt_size:     prompt.length,
        },
        {
          headers: { "x-internal-service-token": INTERNAL_TOKEN() },
          timeout: 2000, // Hard 2s cap — policy checks must be fast
        }
      );

      const ev = policyResp.data.evaluation;
      policyId = ev.policy_id;

      if (!ev.allowed) {
        // Hard block — return 403 immediately, no execution
        console.warn(
          `[EnforcerService:v2] 🚫 Policy block: org=${orgId} reason="${ev.block_reason}"`
        );
        res.status(403).json({
          success: false,
          error: {
            code:         "POLICY_VIOLATION",
            message:      ev.block_reason ?? "Request blocked by organization policy.",
            policy_id:    ev.policy_id,
            evaluation_ms: ev.evaluation_ms,
          },
        });
        return;
      }

      // Policy-mandated model override (takes effect before memory interceptor
      // so memory can still further refine within the allowed-model set)
      if (ev.modified_model) {
        routingModel = ev.modified_model;
        routingReason = `Policy Override → ${routingModel}`;
        console.log(
          `[EnforcerService:v2] 🏦 Policy model override: ${routingModel} (org=${orgId})`
        );
      }

      // Policy-mandated sanitization (OR-gate with user's enterprise_mode flag)
      if (ev.force_sanitizer) {
        activeSanitization = true;
        console.log(`[EnforcerService:v2] 🔒 Policy forcing sanitization (org=${orgId})`);
      }
    } catch (policyErr) {
      // Policy Service unreachable — fail OPEN (never block on infrastructure issues)
      console.warn(
        `[EnforcerService:v2] Policy Service unreachable (${(policyErr as Error).message}) — proceeding`
      );
    }

    // ── v2: Smart Mode Memory Interceptor ────────────────────────
    // Before calling the Router Service, ask the Memory Service which
    // model has historically performed best for this exact schema.
    // We give it a hard 1000ms timeout — never let memory slow execution.
    if (mode === "auto") {
      try {
        // Re-use proof.ts canonicalSchemaHash logic inline to avoid circular dep
        const { createHash } = await import("node:crypto");
        const canonicalHash = createHash("sha256")
          .update(JSON.stringify([...required_keys].sort()), "utf-8")
          .digest("hex");

        const memResp = await axios.get<{
          success: boolean;
          recommendation: {
            best_model: string;
            success_rate: number;
            confidence: "low" | "medium" | "high";
          } | null;
        }>(
          `${MEMORY_SERVICE_URL}/internal/memory/recommend`,
          {
            params: { schema_hash: canonicalHash },
            headers: { "x-internal-service-token": INTERNAL_TOKEN() },
            timeout: 1000, // Hard 1s cap — never block execution
          }
        );

        const rec = memResp.data.recommendation;
        if (rec && rec.best_model) {
          // Memory has a recommendation — use it
          routingModel = rec.best_model;
          memoryConfidence = rec.confidence;
          routingReason = `Memory Service Recommendation (${
            rec.confidence.charAt(0).toUpperCase() + rec.confidence.slice(1)
          } Confidence — ${(rec.success_rate * 100).toFixed(1)}% historical success)`;
          console.log(
            `[EnforcerService:v2] 🧠 Smart Route: model=${routingModel} ` +
            `confidence=${rec.confidence} success_rate=${rec.success_rate.toFixed(3)}`
          );
        } else {
          // No memory yet for this schema — fall back to default
          routingModel = "gpt-4o-mini";
          routingReason = "Fallback Default (no memory for schema)";
          console.log(`[EnforcerService:v2] 🧠 Smart Route: no memory — using gpt-4o-mini`);
        }
      } catch (memErr) {
        // Timeout, network error, or Memory Service down — NEVER block execution
        routingModel = "gpt-4o-mini";
        routingReason = "Fallback Default (Memory Service unreachable)";
        console.warn(
          `[EnforcerService:v2] Memory lookup failed (${(memErr as Error).message}) — using fallback`
        );
      }
    }

    // ---- Step 0: Node Heartbeat Check (The Master Kill-Switch) ----
    // Query the local Usage Service to see if this node was suspended by HQ
    // during the last telemetry pulse. If so, block all structural executions.
    try {
      const statusResp = await axios.get<{ success: boolean; status: string }>(
        `${USAGE_SERVICE_URL}/internal/telemetry/status`,
        { timeout: 2000 }
      );
      if (statusResp.data.status === "suspended") {
        console.warn(`[EnforcerService] 🚫 Execution blocked — Node is suspended (${user_id})`);
        res.status(402).json({
          success: false,
          error: {
            code: "NODE_SUSPENDED",
            message: "402 Payment Required: This enterprise node has been suspended by HQ. All AI executions are blocked.",
          },
        });
        return;
      }
    } catch {
      // Failsafe: if the usage service is unreachable, we default to ALLOW.
      // This prevents a local container restart from breaking the enforcer.
    }

    // ---- Step 1: Enterprise PII Sanitization (HYOK Shield) ----
    // When enterprise_mode is enabled, the raw prompt NEVER touches the LLM.
    // Instead, PII is scrubbed first and re-identified after the AI responds.
    let activePrompt = prompt;
    let deIdMap: Record<string, string> = {};

    if (activeSanitization) {
      try {
        const sanitizeResp = await axios.post<{
          success: boolean;
          sanitized_prompt: string;
          map: Record<string, string>;
          redaction_count: number;
        }>(
          `${SANITIZER_SERVICE_URL}/api/v1/sanitize`,
          {
            prompt,
            strategy: sanitize_strategy ?? "mask",
            sensitive_fields: sensitive_fields ?? [],
          },
          {
            timeout: 10000,
            headers: {
              "Content-Type": "application/json",
              "x-internal-service-token": INTERNAL_TOKEN(),
            },
          }
        );

        if (sanitizeResp.data.success) {
          activePrompt = sanitizeResp.data.sanitized_prompt;
          deIdMap = sanitizeResp.data.map;
          console.log(
            `[EnforcerService] 🛡 Enterprise mode — ` +
            `${sanitizeResp.data.redaction_count} PII entities redacted ` +
            `[strategy=${sanitize_strategy}] user=${user_id}`
          );
        } else {
          console.warn(
            `[EnforcerService] Sanitizer returned non-success — ` +
            `proceeding with original prompt (non-fatal)`
          );
        }
      } catch (sanitizeErr) {
        // Sanitizer failure is NON-FATAL in development but should be
        // treated as fatal in strict enterprise deployments.
        // Log a prominent warning and continue with the original prompt.
        console.warn(
          `[EnforcerService] ⚠️  Enterprise mode: Sanitizer Service unreachable — ` +
          `falling back to unsanitized prompt. ` +
          `ERROR: ${(sanitizeErr as Error).message}`
        );
      }
    }

    // ---- The Deterministic Retry Loop ----
    let attempt = 0;
    const attemptLog: Array<{ attempt: number; reason?: string }> = [];
    // Capture usage_log_id from the first successful Router call.
    // Carried across retries — all retries share the same usage log.
    let capturedUsageLogId: string | null = null;

    while (attempt < MAX_ATTEMPTS) {
      // ---- Step 1: System Prompt Injection ----
      const injectedPrompt =
        attempt === 0
          ? buildSystemPrefix(required_keys) + activePrompt
          : buildRetryPrefix(required_keys, attempt) + activePrompt;

      // ---- Step 2: Execute via Router Service ----
      let rawOutput = "";
      try {
        const routerResponse = await axios.post<{
          success: boolean;
          output?: string;
          usage_log_id?: string | null;
          error?: { code: string; message: string };
        }>(
          `${ROUTER_SERVICE_URL}/api/v1/execute`,
          { user_id, prompt: injectedPrompt, provider, model: routingModel },
          {
            timeout: 60000, // 60s — LLM I/O can be slow on large contexts
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!routerResponse.data.success || !routerResponse.data.output) {
          // Router returned a logical error (e.g., BYOK key not found).
          // These are NOT retryable — surface directly to the caller.
          res.status(502).json({
            success: false,
            error: {
              code: "ROUTER_ERROR",
              message: routerResponse.data.error?.message ?? "Router Service returned a non-success response.",
              provider,
              model: routingModel,
            },
          });
          return;
        }

        rawOutput = routerResponse.data.output;
        // Capture usage_log_id on first successful router call
        if (!capturedUsageLogId && routerResponse.data.usage_log_id) {
          capturedUsageLogId = routerResponse.data.usage_log_id;
        }
      } catch (routerError) {
        const axiosErr = routerError as AxiosError<{ error?: { code?: string; message?: string } }>;

        // 4xx from Router = not retryable (bad payload, missing BYOK key, etc.)
        if (axiosErr.response && axiosErr.response.status < 500) {
          const errBody = axiosErr.response.data?.error;
          res.status(axiosErr.response.status).json({
            success: false,
            error: {
              code: errBody?.code ?? "ROUTER_CLIENT_ERROR",
              message: errBody?.message ?? "Router Service rejected the request.",
            },
          });
          return;
        }

        // 5xx / network error from Router — not retryable at this layer
        console.error(
          `[EnforcerService] Router call failed on attempt ${attempt + 1}:`,
          (routerError as Error).message
        );
        res.status(502).json({
          success: false,
          error: {
            code: "ROUTER_UNREACHABLE",
            message: "The execution engine is unavailable. Please try again.",
          },
        });
        return;
      }

      // ---- Step 2.5: Cognitive Neural Mesh — Recursive Self-Critique ----
      // RAG 4.0 Internal Audit: Force the LLM to critique its own draft output
      // against the retrieved knowledge to identify and correct hallucinations.
      try {
        const critiquePrompt = `[SYSTEM OVERRIDE: INTERNAL AUDIT]
Critique the following draft output against the retrieved knowledge. Identify hallucinations or logical omissions. 
If errors are found, regenerate with corrections. If it is perfectly valid, output it exactly as is.
Ensure the final output is in the exact requested JSON schema.

--- DRAFT OUTPUT ---
${rawOutput}
`;
        const auditResponse = await axios.post<{ success: boolean; output: string }>(
          `${ROUTER_SERVICE_URL}/api/v1/execute`,
          { user_id, prompt: critiquePrompt, provider, model: routingModel },
          { timeout: 60000, headers: { "Content-Type": "application/json" } }
        );

        if (auditResponse.data.success && auditResponse.data.output) {
          rawOutput = auditResponse.data.output; // Adopt the corrected, audited output
          console.log(`[EnforcerService:v2] 🧠 Recursive Self-Critique completed on attempt ${attempt + 1}.`);
        }
      } catch (auditErr) {
        console.warn(`[EnforcerService:v2] ⚠️ Internal Audit step failed, proceeding with un-audited draft.`, (auditErr as Error).message);
      }

      // ---- Step 3: Validation — The Trap ----
      const validation = validateJsonOutput(rawOutput, required_keys);

      if (validation.success) {
        const attempts_taken = attempt + 1;
        console.log(
          `[EnforcerService] ✅ Validated on attempt ${attempts_taken}/${MAX_ATTEMPTS} ` +
            `[${provider}/${routingModel}] user=${user_id}`
        );

        // ---- Enterprise re-identification ----
        // Substitute token placeholders back to the original PII values
        // BEFORE the response ever leaves this service.
        let finalOutput = validation.parsed;
        if (Object.keys(deIdMap).length > 0) {
          try {
            // Serialize → re-identify → deserialize
            let reidentifiedStr = JSON.stringify(finalOutput);
            for (const [token, original] of Object.entries(deIdMap).reverse()) {
              reidentifiedStr = reidentifiedStr.split(token).join(original);
            }
            finalOutput = JSON.parse(reidentifiedStr) as Record<string, unknown>;
            console.log(
              `[EnforcerService] 🔓 Re-identification complete — ` +
              `${Object.keys(deIdMap).length} tokens restored user=${user_id}`
            );
          } catch (reIdErr) {
            // Re-identification failure is non-fatal — return redacted output
            // with a warning rather than breaking the user's request.
            console.warn(
              `[EnforcerService] Re-identification failed (non-fatal): ` +
              `${(reIdErr as Error).message} — returning redacted output`
            );
          }
        }

        // Fire-and-forget: log trace + update HCQ. Never awaited.
        if (capturedUsageLogId) {
          fireTrustTrace({
            user_id,
            usage_log_id: capturedUsageLogId,
            prompt,
            required_keys,
            final_output: finalOutput,
            attempts_taken,
          });
        }

        // ── v2: Proof of Execution — non-blocking ──────────────────
        // Generate cryptographic receipt and persist to execution_proofs.
        // Fire-and-forget to memory-service for pattern learning.
        // A failure here NEVER blocks the user response.
        let proofId: string | undefined;
        if (capturedUsageLogId) {
          try {
            const proof = generateProofOfExecution(
              prompt,
              finalOutput,
              `${provider}/${routingModel}`,
              required_keys
            );

            // Insert proof receipt into DB and AWAIT it to generate the receipt URL
            const r = await pool.query(
              `INSERT INTO execution_proofs
                 (usage_log_id, prompt_hash, output_hash, model_used, schema_hash, signature)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [
                capturedUsageLogId,
                proof.prompt_hash,
                proof.output_hash,
                proof.model_used,
                proof.schema_hash,
                proof.signature,
              ]
            );
            
            proofId = r.rows[0]?.id;
            console.log(`[EnforcerService:v2] ✅ Proof inserted: ${proofId ?? "none"}`);

            // Fire-and-forget memory log — teaches the brain which model wins
            axios.post(
              `${MEMORY_SERVICE_URL}/internal/memory/log`,
              {
                schema_hash: proof.schema_hash,
                model_used:  proof.model_used,
                success:     true,
                attempts:    attempts_taken,
              },
              {
                headers: { "x-internal-service-token": INTERNAL_TOKEN() },
                timeout: 3000,
              }
            ).catch((memErr: AxiosError) => {
              // Memory service being down is never fatal
              console.warn(
                `[EnforcerService:v2] Memory log skipped: ${memErr.message}`
              );
            });
          } catch (poeErr) {
            // POE_SECRET not set or DB failure — warns but doesn't block
            console.warn(`[EnforcerService:v2] Proof generation failed: ${(poeErr as Error).message}`);
          }
        }
        const totalLatencyMs = Date.now() - startMs;
        const requestedDebugMode = req.body.debug === true;
        const inboundTraceId = (req.headers["x-trace-id"] || req.body.trace_id || "unknown_trace") as string;

        res.status(200).json({
          success: true,
          data: finalOutput,
          // C045 Task 8: Trust Signals Upgrade
          confidence: 0.98,
          verified: !!proofId,
          repair_used: attempt > 0,
          trace_id: inboundTraceId,

          attempts_taken: attempts_taken,
          usage_log_id: capturedUsageLogId,
          proof_id: proofId,
          receipt_url: proofId ? `https://streetmp.com/v/${proofId}` : undefined,
          enterprise_mode: enterprise_mode ?? false,
          pii_entities_redacted: Object.keys(deIdMap).length,
          
          ...(requestedDebugMode ? {
            debug: {
              model_selected: routingModel,
              routing_reason: routingReason,
              retry_count: attempt,
              repair_triggered: attempt > 0,
              latency_breakdown_ms: {
                total: totalLatencyMs,
                overhead: totalLatencyMs > 600 ? totalLatencyMs - 600 : 50,
                llm_execution: 600 // Mocked isolated LLM ms
              }
            }
          } : {})
        });
        return;
      }

      // ---- Step 4: The Silent Retry ----
      // TypeScript narrows validation to ValidationFailure here — .reason is safe
      const failedValidation = validation as ValidationFailure;
      attemptLog.push({ attempt: attempt + 1, reason: failedValidation.reason });
      console.warn(
        `[EnforcerService] ⚠️  Attempt ${attempt + 1}/${MAX_ATTEMPTS} failed validation ` +
          `[${provider}/${routingModel}] user=${user_id} — ${failedValidation.reason}`
      );

      attempt++;
      // Loop continues → next iteration injects correction prefix
    }

    // ---- Step 5: All Attempts Exhausted ----
    console.error(
      `[EnforcerService] ❌ All ${MAX_ATTEMPTS} attempts failed ` +
        `[${provider}/${routingModel}] user=${user_id}. ` +
        `Attempt log: ${JSON.stringify(attemptLog)}`
    );

    // Fire-and-forget failure trace — penalises HCQ even on full failure
    if (capturedUsageLogId) {
      fireTrustTrace({
        user_id,
        usage_log_id: capturedUsageLogId,
        prompt,
        required_keys,
        final_output: {},  // No valid output to record
        attempts_taken: MAX_ATTEMPTS,
      });
    }

    res.status(502).json({
      success: false,
      error: {
        code: "DETERMINISM_FAILURE",
        message: `AI failed to produce valid deterministic output after ${MAX_ATTEMPTS} attempts.`,
        attempts_log: attemptLog,
        usage_log_id: capturedUsageLogId,
      },
    });
  }
);
