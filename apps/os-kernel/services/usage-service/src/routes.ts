/**
 * @file routes.ts
 * @service usage-service
 * @description Internal usage logging endpoint.
 *
 * ================================================================
 * SECURITY BOUNDARY
 * ================================================================
 * This entire service is INTERNAL ONLY. It must never be
 * reachable from the public internet. Access is controlled by:
 *
 *   1. Network layer: Deploy behind an internal VPC subnet.
 *      No public load balancer should route to port 4004.
 *   2. Application layer: Every route is gated by
 *      `requireInternalServiceToken` which validates the
 *      `x-internal-service-token` header against INTERNAL_ROUTER_SECRET.
 *
 * ================================================================
 * APPEND-ONLY CONTRACT
 * ================================================================
 * The `usage_logs` table is an immutable audit ledger.
 * This service only ever INSERTs — no UPDATE or DELETE.
 * The DB user for this service should be granted INSERT + SELECT
 * only, making UPDATE/DELETE physically impossible even under
 * a compromised service.
 * ================================================================
 */

import { Router, Request, Response, NextFunction } from "express";
import { pool } from "./db.js";
import { calculateCost } from "./pricing.js";
import { verifyPulseSignature, type TelemetryPulse } from "./telemetry.js";

export const usageRouter = Router();

// ----------------------------------------------------------------
// VALIDATION STATUS ALLOWLIST
// Must match the `validation_status` enum in schema.sql
// ----------------------------------------------------------------
const VALID_STATUSES = ["success", "hallucinated_retry", "failed"] as const;
type ValidationStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: string): value is ValidationStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

// ----------------------------------------------------------------
// INTERNAL SERVICE AUTH MIDDLEWARE
// Identical to vault-service pattern — enforced on ALL routes here.
// ----------------------------------------------------------------
function requireInternalServiceToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalSecret = process.env.INTERNAL_ROUTER_SECRET;

  if (!internalSecret) {
    console.error(
      "[UsageService:auth] FATAL: INTERNAL_ROUTER_SECRET is not set. " +
        "All internal routes are disabled until this is configured."
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_MISCONFIGURED",
        message: "Internal routing secret not configured.",
      },
    });
    return;
  }

  const providedToken = req.headers["x-internal-service-token"];

  if (!providedToken || providedToken !== internalSecret) {
    console.warn(
      `[UsageService:auth] 403 — Unauthorized internal access from ${req.ip} ` +
        `to ${req.method} ${req.originalUrl}`
    );
    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Access denied. Internal endpoint requires a valid service token.",
      },
    });
    return;
  }

  next();
}

// ================================================================
// POST /internal/usage/log
// ================================================================
/**
 * Receives an execution trace summary from the Router Service,
 * calculates the exact cost using the pricing engine, and persists
 * a single immutable record to the `usage_logs` table.
 *
 * Called by: Router Service immediately after each LLM completion.
 *
 * Payload:
 *   user_id           — UUID of the authenticated user
 *   prompt_id         — UUID uniquely identifying this execution trace
 *   model_used        — Model identifier (e.g., "gpt-4o")
 *   tokens_prompt     — Input token count from the LLM response
 *   tokens_completion — Output token count from the LLM response
 *   validation_status — 'success' | 'hallucinated_retry' | 'failed'
 *
 * Response:
 *   200 { message, id: UUID, cost: number }
 */
usageRouter.post(
  "/internal/usage/log",
  requireInternalServiceToken,
  async (req: Request, res: Response): Promise<void> => {
    const {
      user_id,
      prompt_id,
      model_used,
      tokens_prompt,
      tokens_completion,
      validation_status,
    } = req.body as {
      user_id?: string;
      prompt_id?: string;
      model_used?: string;
      tokens_prompt?: unknown;
      tokens_completion?: unknown;
      validation_status?: string;
    };

    // ---- Payload Validation ----
    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: user_id." },
      });
      return;
    }

    if (!prompt_id || typeof prompt_id !== "string" || !prompt_id.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: prompt_id." },
      });
      return;
    }

    if (!model_used || typeof model_used !== "string" || !model_used.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: model_used." },
      });
      return;
    }

    const parsedTokensPrompt = Number(tokens_prompt);
    const parsedTokensCompletion = Number(tokens_completion);

    if (
      !Number.isInteger(parsedTokensPrompt) ||
      parsedTokensPrompt < 0
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "tokens_prompt must be a non-negative integer.",
        },
      });
      return;
    }

    if (
      !Number.isInteger(parsedTokensCompletion) ||
      parsedTokensCompletion < 0
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "tokens_completion must be a non-negative integer.",
        },
      });
      return;
    }

    if (!validation_status || !isValidStatus(validation_status)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: `validation_status must be one of: ${VALID_STATUSES.join(", ")}.`,
        },
      });
      return;
    }

    // ---- Step 1: Calculate Cost ----
    let costBreakdown: ReturnType<typeof calculateCost>;
    try {
      costBreakdown = calculateCost(
        model_used,
        parsedTokensPrompt,
        parsedTokensCompletion
      );
    } catch (pricingError) {
      console.error("[UsageService:log] Pricing calculation error:", (pricingError as Error).message);
      res.status(500).json({
        success: false,
        error: {
          code: "PRICING_ERROR",
          message: "Failed to calculate cost for this usage record.",
        },
      });
      return;
    }

    // ---- Step 2: Persist to usage_logs ----
    // The INSERT is intentionally verbose — all fields explicit, no wildcards.
    // prompt_id is provided by the caller (Router Service generates it per-request).
    const INSERT_QUERY = `
      INSERT INTO usage_logs (
        user_id,
        prompt_id,
        model_used,
        tokens_prompt,
        tokens_completion,
        total_cost,
        validation_status,
        is_a2a
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    let usageLogId: string;
    try {
      const is_a2a = (req.body as any).is_a2a === true;
      const insertResult = await pool.query<{ id: string }>(INSERT_QUERY, [
        user_id.trim(),
        prompt_id.trim(),
        model_used.trim(),
        parsedTokensPrompt,
        parsedTokensCompletion,
        costBreakdown.totalCost.toFixed(8), // Match NUMERIC(12,8) precision in schema
        validation_status,
        is_a2a
      ]);
      usageLogId = insertResult.rows[0]!.id;
    } catch (dbError) {
      const pgError = dbError as { code?: string; message?: string };

      // Duplicate prompt_id — idempotent: treat as success to allow safe retries
      if (pgError.code === "23505") {
        console.warn(
          `[UsageService:log] Duplicate prompt_id "${prompt_id}" — already logged. ` +
            `Returning cached cost.`
        );
        // Retrieve the existing id for the caller
        const existingRow = await pool.query<{ id: string }>(
          `SELECT id FROM usage_logs WHERE prompt_id = $1`,
          [prompt_id.trim()]
        );
        res.status(200).json({
          success: true,
          message: "Usage already logged (idempotent).",
          id: existingRow.rows[0]?.id ?? null,
          cost: costBreakdown.totalCost,
        });
        return;
      }

      // FK violation — user_id not in users table
      if (pgError.code === "23503") {
        res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: `Cannot log usage: user_id "${user_id}" does not exist.`,
          },
        });
        return;
      }

      console.error("[UsageService:log] Database insert failed:", pgError.message);
      res.status(500).json({
        success: false,
        error: {
          code: "DB_ERROR",
          message: "Failed to persist usage record.",
        },
      });
      return;
    }

    console.log(
      `[UsageService:log] ✅ Logged usage — user=${user_id} | ` +
        `model=${model_used} | ` +
        `tokens_in=${parsedTokensPrompt} | tokens_out=${parsedTokensCompletion} | ` +
        `cost=$${costBreakdown.totalCost.toFixed(8)} | status=${validation_status}` +
        (!costBreakdown.isKnownModel ? " ⚠️ [unknown model, fallback pricing applied]" : "")
    );

    res.status(200).json({
      success: true,
      message: "Usage logged successfully.",
      id: usageLogId,
      cost: costBreakdown.totalCost,
    });
  }
);

// ================================================================
// GET /internal/usage/summary/:user_id
// Returns aggregate cost and token totals for a user.
// Useful for Phase 2 billing dashboard and rate-limit checks.
// ================================================================
usageRouter.get(
  "/internal/usage/summary/:user_id",
  requireInternalServiceToken,
  async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PARAMS", message: "user_id path parameter is required." },
      });
      return;
    }

    const SUMMARY_QUERY = `
      SELECT
        COUNT(*)::int                        AS total_requests,
        COALESCE(SUM(tokens_prompt), 0)::int AS total_tokens_prompt,
        COALESCE(SUM(tokens_completion), 0)::int AS total_tokens_completion,
        COALESCE(SUM(total_cost), 0)         AS total_cost_usd,
        COUNT(*) FILTER (WHERE validation_status = 'success')::int AS success_count,
        COUNT(*) FILTER (WHERE validation_status = 'hallucinated_retry')::int AS retry_count,
        COUNT(*) FILTER (WHERE validation_status = 'failed')::int AS failed_count
      FROM usage_logs
      WHERE user_id = $1
    `;

    try {
      const result = await pool.query(SUMMARY_QUERY, [user_id]);
      const summary = result.rows[0];

      res.status(200).json({
        success: true,
        user_id,
        summary: {
          total_requests: summary.total_requests,
          total_tokens_prompt: summary.total_tokens_prompt,
          total_tokens_completion: summary.total_tokens_completion,
          total_cost_usd: parseFloat(summary.total_cost_usd),
          validation_breakdown: {
            success: summary.success_count,
            hallucinated_retry: summary.retry_count,
            failed: summary.failed_count,
          },
        },
      });
    } catch (dbError) {
      console.error("[UsageService:summary] Query failed:", (dbError as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve usage summary." },
      });
    }
  }
);
// ================================================================
// POST /api/v1/telemetry/ingest
// ================================================================
/**
 * HQ-side telemetry ingestion endpoint.
 *
 * Accepts a signed pulse from an enterprise node, verifies the
 * HMAC-SHA256 signature against the node's stored secret, and
 * upserts the aggregate token counts into enterprise_billing_ledger.
 *
 * IDEMPOTENT: ON CONFLICT(node_id, billing_period) accumulates
 * token counts — a retry or duplicate pulse adds to existing
 * values rather than duplicating rows. This means nodes can
 * safely retry failed deliveries.
 *
 * BAD SIGNATURES: The pulse is accepted but flagged with
 * signature_verified=false for ops audit. We don't silently
 * drop bad-signature pulses because the count data may still
 * be legitimate (e.g. key rotation in progress). Ops teams
 * monitor the partial index idx_billing_ledger_unverified.
 *
 * Called by: Enterprise nodes via firePulse() in telemetry.ts
 */

usageRouter.post(
  "/api/v1/telemetry/ingest",
  requireInternalServiceToken,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;

    // ── 1. Structural validation ─────────────────────────────────
    if (
      typeof body !== "object" ||
      body === null ||
      typeof body.payload !== "object" ||
      typeof body.signature !== "string" ||
      body.algorithm !== "hmac-sha256"
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PULSE_ENVELOPE",
          message: "Expected { payload: TelemetryPulse, signature: string, algorithm: 'hmac-sha256' }",
        },
      });
      return;
    }

    const payload = body.payload as TelemetryPulse;
    const inboundSignature = body.signature as string;

    // ── 2. Payload field validation ───────────────────────────────
    if (
      !payload.node_id ||
      typeof payload.billing_period !== "string" ||
      typeof payload.total_input_tokens !== "number" ||
      typeof payload.total_output_tokens !== "number" ||
      typeof payload.total_executions !== "number" ||
      payload.total_input_tokens < 0 ||
      payload.total_output_tokens < 0 ||
      payload.total_executions < 0
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PULSE_PAYLOAD",
          message: "Pulse payload missing required fields or contains negative token counts.",
        },
      });
      return;
    }

    // ── 3. Verify HMAC signature ──────────────────────────────────
    let signatureValid: boolean;
    try {
      signatureValid = await verifyPulseSignature(payload, inboundSignature);
    } catch (verifyErr) {
      console.error(
        "[UsageService:telemetry] Signature verification threw unexpectedly:",
        (verifyErr as Error).message
      );
      res.status(500).json({
        success: false,
        error: { code: "VERIFICATION_ERROR", message: "Internal signature verification failure." },
      });
      return;
    }

    if (!signatureValid) {
      console.warn(
        `[UsageService:telemetry] ⚠️  Bad signature for node=${payload.node_id} ` +
        `period=${payload.billing_period} — storing with signature_verified=false`
      );
    } else {
      console.log(
        `[UsageService:telemetry] ✅ Verified pulse from node=${payload.node_id} ` +
        `period=${payload.billing_period} ` +
        `tokens_in=${payload.total_input_tokens} ` +
        `tokens_out=${payload.total_output_tokens} ` +
        `executions=${payload.total_executions}`
      );
    }

    // ── 4. Upsert into enterprise_billing_ledger ──────────────────
    // ON CONFLICT accumulates tokens — each pulse adds to the bucket.
    // This makes retries and duplicate deliveries safe.
    try {
      await pool.query(
        `INSERT INTO enterprise_billing_ledger
           (node_id, billing_period,
            total_input_tokens, total_output_tokens, total_executions,
            service_health_status, signature_verified)
         VALUES ($1, $2::TIMESTAMPTZ, $3, $4, $5, $6, $7)
         ON CONFLICT (node_id, billing_period) DO UPDATE
           SET total_input_tokens  = enterprise_billing_ledger.total_input_tokens
                                     + EXCLUDED.total_input_tokens,
               total_output_tokens = enterprise_billing_ledger.total_output_tokens
                                     + EXCLUDED.total_output_tokens,
               total_executions    = enterprise_billing_ledger.total_executions
                                     + EXCLUDED.total_executions,
               service_health_status = EXCLUDED.service_health_status,
               -- If any pulse had a bad signature, flag the row
               signature_verified  = enterprise_billing_ledger.signature_verified
                                     AND EXCLUDED.signature_verified,
               updated_at          = NOW()`,
        [
          payload.node_id,
          payload.billing_period,
          payload.total_input_tokens,
          payload.total_output_tokens,
          payload.total_executions,
          payload.service_health_status ?? "healthy",
          signatureValid,
        ]
      );
    } catch (dbErr) {
      console.error("[UsageService:telemetry] Ledger upsert failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to persist telemetry data." },
      });
      return;
    }

    // ── 5. Check Node Status (Kill-Switch) ────────────────────────
    let nodeStatus: "active" | "suspended" = "active";
    try {
      const nodeCheck = await pool.query<{ is_active: boolean }>(
        "SELECT is_active FROM enterprise_nodes WHERE id = $1",
        [payload.node_id]
      );
      if (nodeCheck.rows.length > 0 && !nodeCheck.rows[0].is_active) {
        nodeStatus = "suspended";
      }
    } catch {
       // Fallback active to not break everything on momentary DB hiccup
    }

    res.status(200).json({
      success: true,
      status: "ok",
      node_status: nodeStatus,
      message: "Pulse ingested.",
      node_id: payload.node_id,
      billing_period: payload.billing_period,
      signature_verified: signatureValid,
    });
  }
);

// ================================================================
// GET /api/v1/telemetry/nodes/:nodeId/ledger
// ================================================================
/**
 * Returns the billing ledger for a specific enterprise node.
 * Optionally filtered by a date range (from/to query params).
 *
 * Called by: HQ billing dashboard / admin tools.
 */

usageRouter.get(
  "/api/v1/telemetry/nodes/:nodeId/ledger",
  requireInternalServiceToken,
  async (req: Request, res: Response): Promise<void> => {
    const { nodeId } = req.params;
    const { from, to, limit } = req.query as {
      from?: string;
      to?: string;
      limit?: string;
    };

    const rowLimit = Math.min(parseInt(limit ?? "100", 10), 1000);

    try {
      const result = await pool.query(
        `SELECT
           id, node_id, billing_period,
           total_input_tokens, total_output_tokens, total_executions,
           service_health_status, amount_due, signature_verified,
           received_at, updated_at
         FROM enterprise_billing_ledger
         WHERE node_id = $1
           AND ($2::TIMESTAMPTZ IS NULL OR billing_period >= $2::TIMESTAMPTZ)
           AND ($3::TIMESTAMPTZ IS NULL OR billing_period <= $3::TIMESTAMPTZ)
         ORDER BY billing_period DESC
         LIMIT $4`,
        [nodeId, from ?? null, to ?? null, rowLimit]
      );

      res.status(200).json({
        success: true,
        node_id: nodeId,
        count: result.rows.length,
        ledger: result.rows,
      });
    } catch (dbErr) {
      console.error("[UsageService:ledger] Query failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve billing ledger." },
      });
    }
  }
);

// ================================================================
// COMMAND 061: AGENTIC GDP TELEMETRY
// GET /api/v1/telemetry/gdp
// Returns total volume traded between machines
// ================================================================
usageRouter.get(
  "/api/v1/telemetry/gdp",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Calculate Agentic GDP — total cost moved through A2A executed requests
      const result = await pool.query(`
        SELECT 
          COALESCE(SUM(total_cost), 0)::numeric as total_agentic_gdp,
          COUNT(*)::int as total_a2a_executions,
          SUM(tokens_prompt + tokens_completion)::int as total_a2a_tokens
        FROM usage_logs 
        WHERE is_a2a = true 
          AND validation_status = 'success'
      `);

      // And separately human executions for comparison
      const humanResult = await pool.query(`
        SELECT 
          COALESCE(SUM(total_cost), 0)::numeric as total_human_gdp,
          COUNT(*)::int as total_human_executions
        FROM usage_logs 
        WHERE is_a2a = false 
          AND validation_status = 'success'
      `);

      res.status(200).json({
        success: true,
        data: {
          agentic_gdp: result.rows[0].total_agentic_gdp,
          total_a2a_executions: result.rows[0].total_a2a_executions,
          total_a2a_tokens: result.rows[0].total_a2a_tokens,
          human_gdp_comparison: humanResult.rows[0].total_human_gdp,
          human_executions: humanResult.rows[0].total_human_executions,
        }
      });
    } catch (err: any) {
      console.error("[UsageService:GDP] Query failed:", err.message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve Agentic GDP." }
      });
    }
  }
);
