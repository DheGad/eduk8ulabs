/**
 * @file routes.ts
 * @service trust-service
 * @description Trust Service routes:
 *
 *   INTERNAL (x-internal-service-token auth):
 *     POST /internal/trust/trace   — Flight recorder + HCQ upsert
 *
 *   PUBLIC (no auth — marketplace readable):
 *     GET  /api/v1/trust/hcq/:userId — HCQ scorecard for a user
 *
 * ================================================================
 * THE ATOMIC TRANSACTION DESIGN
 * ================================================================
 * The flight recorder endpoint runs two DB writes inside a single
 * psql transaction:
 *   1. INSERT INTO execution_traces
 *   2. INSERT ... ON CONFLICT DO UPDATE in hcq_profiles
 *
 * If either fails, the transaction is rolled back atomically.
 * The DB triggers (hcq_score_recompute + hcq_profile_sync_users)
 * fire inside the same transaction, so users.current_hcq_score is
 * also updated atomically.
 *
 * No separate UPDATE is needed for global_hcq_score — the Phase 2
 * BEFORE INSERT/UPDATE trigger computes it automatically.
 * ================================================================
 */

import { Router, Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "./db.js";

export const trustRouter = Router();

// ================================================================
// INTERNAL TOKEN GUARD
// ================================================================

/**
 * Validates the x-internal-service-token header.
 * This middleware is applied to all /internal/* routes.
 * Fails with 503 if INTERNAL_ROUTER_SECRET is not configured —
 * the service refuses to operate in an insecure state.
 */
function requireInternalToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.INTERNAL_ROUTER_SECRET;
  if (!secret) {
    console.error("[TrustService] FATAL: INTERNAL_ROUTER_SECRET not set — cannot authenticate internal requests.");
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_MISCONFIGURED",
        message: "Internal auth secret is not configured.",
      },
    });
    return;
  }

  const token = req.headers["x-internal-service-token"];
  if (!token || token !== secret) {
    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Invalid internal service token.",
      },
    });
    return;
  }

  next();
}


// ================================================================
// TASK 2: THE INTERNAL FLIGHT RECORDER
// POST /internal/trust/trace
// ================================================================

const TracePayloadSchema = z.object({
  user_id:       z.string().uuid("user_id must be a valid UUID"),
  usage_log_id:  z.string().uuid("usage_log_id must be a valid UUID"),
  prompt:        z.string().min(1, "prompt cannot be empty"),
  required_keys: z.array(z.string()).min(1, "required_keys must have at least one key"),
  final_output:  z.record(z.unknown()),
  attempts_taken: z.number().int().min(1).max(3),
});

trustRouter.post(
  "/internal/trust/trace",
  requireInternalToken,
  async (req: Request, res: Response): Promise<void> => {
    // ── 1. Validate payload ──────────────────────────────────────
    const parsed = TracePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid trace payload.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const {
      user_id,
      usage_log_id,
      prompt,
      required_keys,
      final_output,
      attempts_taken,
    } = parsed.data;

    // ── 2. SHA-256 hash of the prompt ─────────────────────────────
    // Normalize whitespace before hashing so "  foo  " and "foo"
    // produce the same signature — critical for Phase 3 cache hits.
    const prompt_signature = createHash("sha256")
      .update(prompt.trim().replace(/\s+/g, " "))
      .digest("hex");

    // Determine HCQ delta based on whether this was a clean execution
    const isCleanExecution = attempts_taken === 1;

    // ── 3. Acquire a dedicated client for the transaction ─────────
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // ── 3a. INSERT execution_traces ──────────────────────────────
      const traceResult = await client.query<{ id: string }>(
        `INSERT INTO execution_traces
           (usage_log_id, user_id, prompt_signature, required_keys_schema,
            final_output_payload, attempts_taken)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          usage_log_id,
          user_id,
          prompt_signature,
          JSON.stringify(required_keys),   // array stored as JSONB
          JSON.stringify(final_output),
          attempts_taken,
        ]
      );

      const trace_id = traceResult.rows[0]!.id;

      // ── 3b. UPSERT hcq_profiles ───────────────────────────────────
      // ON CONFLICT: if a profile exists, atomically increment the
      // correct counters.  The DB trigger fires on the UPDATE and
      // recalculates global_hcq_score automatically.
      //
      // Column mapping:
      //   clean execution  → total_executions++, successful_first_try++
      //   hallucinated     → total_executions++, hallucination_faults++
      await client.query(
        `INSERT INTO hcq_profiles
           (user_id, total_executions, successful_first_try, hallucination_faults)
         VALUES ($1, 1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET total_executions     = hcq_profiles.total_executions + 1,
               successful_first_try = hcq_profiles.successful_first_try + $2,
               hallucination_faults = hcq_profiles.hallucination_faults + $3`,
        [
          user_id,
          isCleanExecution ? 1 : 0,   // successful_first_try delta
          isCleanExecution ? 0 : 1,   // hallucination_faults delta
        ]
      );

      await client.query("COMMIT");

      console.log(
        `[TrustService] ✅ Trace logged: ${trace_id} | user=${user_id} | ` +
        `attempts=${attempts_taken} | clean=${isCleanExecution}`
      );

      res.status(200).json({
        success: true,
        message: "Trace logged and HCQ updated.",
        trace_id,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      const error = err as Error;
      console.error("[TrustService] Transaction rolled back:", error.message);

      // Duplicate usage_log_id: the Router already logged this trace
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({
          success: false,
          error: {
            code: "TRACE_ALREADY_EXISTS",
            message: "An execution trace for this usage_log_id already exists.",
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: "TRACE_LOG_FAILED",
          message: "Failed to persist execution trace.",
        },
      });
    } finally {
      client.release();
    }
  }
);


// ================================================================
// TASK 3: THE PUBLIC HCQ SCORECARD
// GET /api/v1/trust/hcq/:userId
// ================================================================

/**
 * Public endpoint — no JWT required.
 * The Next.js marketplace calls this to show a freelancer's HCQ badge.
 *
 * Returns default 100.00 score if no profile exists yet
 * (new users haven't run any executions — benefit of the doubt).
 */
trustRouter.get(
  "/api/v1/trust/hcq/:userId",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    // Basic UUID format check — prevents malformed queries hitting the DB
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId ?? "")) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_USER_ID",
          message: "userId must be a valid UUID.",
        },
      });
      return;
    }

    try {
      const result = await pool.query<{
        user_id: string;
        total_executions: number;
        successful_first_try: number;
        hallucination_faults: number;
        global_hcq_score: string;
        updated_at: string;
      }>(
        `SELECT
           user_id,
           total_executions,
           successful_first_try,
           hallucination_faults,
           global_hcq_score,
           updated_at
         FROM hcq_profiles
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // No profile yet — new user, default to perfect score
        res.status(200).json({
          success: true,
          data: {
            user_id:              userId,
            total_executions:     0,
            successful_first_try: 0,
            hallucination_faults: 0,
            global_hcq_score:     "100.00",
            updated_at:           null,
            is_default:           true, // client can display "New user" badge
          },
        });
        return;
      }

      const profile = result.rows[0]!;
      res.status(200).json({
        success: true,
        data: {
          user_id:              profile.user_id,
          total_executions:     Number(profile.total_executions),
          successful_first_try: Number(profile.successful_first_try),
          hallucination_faults: Number(profile.hallucination_faults),
          // global_hcq_score is NUMERIC — pg returns it as a string; cast to float for JSON
          global_hcq_score:     parseFloat(profile.global_hcq_score).toFixed(2),
          updated_at:           profile.updated_at,
          is_default:           false,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error("[TrustService] HCQ scorecard query failed:", error.message);
      res.status(500).json({
        success: false,
        error: {
          code: "SCORECARD_FETCH_FAILED",
          message: "Failed to retrieve HCQ profile.",
        },
      });
    }
  }
);

// ================================================================
// TASK 4: THE PUBLIC MARKETPLACE DISCOVERY ENDPOINT
// GET /api/v1/trust/marketplace
// ================================================================

/**
 * Public endpoint — no JWT required.
 *
 * Returns a paginated list of verified, payment-enabled freelancers
 * sorted by HCQ score descending (elite engineers first).
 *
 * Query params:
 *   min_hcq      — minimum global_hcq_score (default: 0)
 *   limit        — results per page (default: 20, max: 50)
 *   offset       — pagination offset (default: 0)
 *   search       — partial match on email prefix (safe, no full PII)
 */
trustRouter.get(
  "/api/v1/trust/marketplace",
  async (req: Request, res: Response): Promise<void> => {
    const {
      min_hcq = "0",
      limit = "20",
      offset = "0",
      search = "",
    } = req.query as Record<string, string>;

    const minHcq = Math.max(0, Math.min(100, parseFloat(min_hcq) || 0));
    const rowLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const rowOffset = Math.max(0, parseInt(offset, 10) || 0);

    try {
      const result = await pool.query<{
        user_id: string;
        display_name: string;
        account_tier: string;
        total_executions: number;
        successful_first_try: number;
        hallucination_faults: number;
        global_hcq_score: string;
        most_used_model: string | null;
        hcq_updated_at: string | null;
      }>(
        `SELECT
           u.id                         AS user_id,
           -- Display name: show first part of email before @, never full email
           SPLIT_PART(u.email::text, '@', 1)    AS display_name,
           u.account_tier,
           COALESCE(h.total_executions, 0)       AS total_executions,
           COALESCE(h.successful_first_try, 0)   AS successful_first_try,
           COALESCE(h.hallucination_faults, 0)   AS hallucination_faults,
           COALESCE(h.global_hcq_score, 100.00)  AS global_hcq_score,
           -- Most used model (the LLM they work with best)
           (
             SELECT model_used
             FROM usage_logs ul
             WHERE ul.user_id = u.id
             GROUP BY model_used
             ORDER BY COUNT(*) DESC
             LIMIT 1
           )                            AS most_used_model,
           h.updated_at                 AS hcq_updated_at
         FROM users u
         LEFT JOIN hcq_profiles h ON h.user_id = u.id
         WHERE u.payouts_enabled = true
           AND COALESCE(h.global_hcq_score, 100.00) >= $1
           AND ($4 = '' OR SPLIT_PART(u.email::text, '@', 1) ILIKE $4)
         ORDER BY
           COALESCE(h.global_hcq_score, 100.00) DESC,
           COALESCE(h.total_executions, 0) DESC
         LIMIT $2
         OFFSET $3`,
        [minHcq, rowLimit, rowOffset, search ? `%${search}%` : ""]
      );

      const profiles = result.rows.map((row) => {
        const hcq = parseFloat(row.global_hcq_score ?? "100");
        const total = Number(row.total_executions);
        const successes = Number(row.successful_first_try);
        const successRate = total > 0 ? Math.round((successes / total) * 100) : 100;

        // Tier badge logic
        let tier_badge: "Elite" | "Verified" | "Rising";
        if (hcq >= 95) tier_badge = "Elite";
        else if (hcq >= 80) tier_badge = "Verified";
        else tier_badge = "Rising";

        // Model expertise label
        const modelMap: Record<string, string> = {
          "gpt-4o": "GPT-4o Expert",
          "gpt-4-turbo": "GPT-4 Turbo Expert",
          "gpt-3.5-turbo": "GPT-3.5 Specialist",
          "claude-3-5-sonnet-20241022": "Claude 3.5 Specialist",
          "claude-3-opus-20240229": "Claude 3 Opus Expert",
        };
        const expertise = row.most_used_model
          ? (modelMap[row.most_used_model] ?? `${row.most_used_model} Specialist`)
          : "Multi-Model";

        return {
          user_id: row.user_id,
          display_name: row.display_name,
          account_tier: row.account_tier,
          hcq_score: hcq.toFixed(2),
          tier_badge,
          total_executions: total,
          first_try_success_rate: successRate,
          expertise,
          bank_verified: true, // All results are payouts_enabled=true
          hcq_updated_at: row.hcq_updated_at,
        };
      });

      res.status(200).json({
        success: true,
        count: profiles.length,
        offset: rowOffset,
        profiles,
      });
    } catch (err) {
      console.error("[TrustService] Marketplace query failed:", (err as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve marketplace profiles." },
      });
    }
  }
);

// ================================================================
// THE PUBLIC ENGINEER PROFILE ENDPOINT
// GET /api/v1/trust/engineer/:userId
// ================================================================
/**
 * Public endpoint — no JWT required.
 * Returns a single engineer's full public profile + their last 5
 * first-try execution trace schemas (enforced_schema only, zero PII).
 *
 * Used by: SSR profile page generateMetadata + content, sitemap
 */
trustRouter.get(
  "/api/v1/trust/engineer/:userId",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId ?? "")) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_USER_ID", message: "userId must be a valid UUID." },
      });
      return;
    }

    try {
      const profileResult = await pool.query<{
        user_id: string;
        display_name: string;
        account_tier: string;
        payouts_enabled: boolean;
        global_hcq_score: string;
        total_executions: number;
        successful_first_try: number;
        hallucination_faults: number;
        most_used_model: string | null;
        hcq_updated_at: string | null;
      }>(
        `SELECT
           u.id                                  AS user_id,
           SPLIT_PART(u.email::text, '@', 1)     AS display_name,
           u.account_tier,
           u.payouts_enabled,
           COALESCE(h.global_hcq_score, 100.00)  AS global_hcq_score,
           COALESCE(h.total_executions, 0)        AS total_executions,
           COALESCE(h.successful_first_try, 0)    AS successful_first_try,
           COALESCE(h.hallucination_faults, 0)    AS hallucination_faults,
           (
             SELECT model_used FROM usage_logs ul
             WHERE ul.user_id = u.id
             GROUP BY model_used ORDER BY COUNT(*) DESC LIMIT 1
           )                                      AS most_used_model,
           h.updated_at                           AS hcq_updated_at
         FROM users u
         LEFT JOIN hcq_profiles h ON h.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );

      if (profileResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Engineer not found." },
        });
        return;
      }

      const row = profileResult.rows[0]!;
      const hcq = parseFloat(row.global_hcq_score ?? "100");
      const total = Number(row.total_executions);
      const successes = Number(row.successful_first_try);

      const modelMap: Record<string, string> = {
        "gpt-4o": "GPT-4o Expert",
        "gpt-4-turbo": "GPT-4 Turbo Expert",
        "gpt-3.5-turbo": "GPT-3.5 Specialist",
        "claude-3-5-sonnet-20241022": "Claude 3.5 Specialist",
        "claude-3-opus-20240229": "Claude 3 Opus Expert",
      };

      const expertise = row.most_used_model
        ? (modelMap[row.most_used_model] ?? `${row.most_used_model} Specialist`)
        : "Multi-Model";

      let tier_badge: "Elite" | "Verified" | "Rising";
      if (hcq >= 95) tier_badge = "Elite";
      else if (hcq >= 80) tier_badge = "Verified";
      else tier_badge = "Rising";

      // Execution Proof: last 5 first-try traces (schema only — zero PII)
      const tracesResult = await pool.query<{
        id: string;
        required_keys_schema: unknown;
        attempts_taken: number;
        created_at: string;
      }>(
        `SELECT et.id, et.required_keys_schema, et.attempts_taken, et.created_at
         FROM execution_traces et
         WHERE et.user_id = $1 AND et.attempts_taken = 1
         ORDER BY et.created_at DESC
         LIMIT 5`,
        [userId]
      );

      const execution_proofs = tracesResult.rows.map((t) => ({
        id: t.id,
        enforced_schema: t.required_keys_schema, // JSONB array of required keys
        verified_at: t.created_at,
      }));

      res.status(200).json({
        success: true,
        profile: {
          user_id: row.user_id,
          display_name: row.display_name,
          account_tier: row.account_tier,
          bank_verified: row.payouts_enabled,
          hcq_score: hcq.toFixed(2),
          tier_badge,
          expertise,
          total_executions: total,
          first_try_success_rate: total > 0 ? Math.round((successes / total) * 100) : 100,
          hallucination_faults: Number(row.hallucination_faults),
          hcq_updated_at: row.hcq_updated_at,
          execution_proofs,
        },
      });
    } catch (err) {
      console.error("[TrustService] Engineer profile query failed:", (err as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve engineer profile." },
      });
    }
  }
);

// ================================================================
// GET /api/v1/trust/verify/:proof_id
// Public Proof of Execution Verification — The Trust Receipt
// ================================================================
// Anyone (clients, auditors, third parties) can verify a given
// execution proof without authentication. Privacy is preserved:
//   - prompt and output are NEVER returned
//   - only the SHA-256 hashes are exposed
//   - the HMAC signature is recomputed server-side to detect tampering
// ================================================================

trustRouter.get(
  "/api/v1/trust/verify/:proof_id",
  async (req: Request, res: Response): Promise<void> => {
    const { proof_id } = req.params as { proof_id: string };

    // Basic UUID format guard
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(proof_id)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PROOF_ID", message: "proof_id must be a valid UUID." },
      });
      return;
    }

    try {
      const result = await pool.query<{
        id: string;
        usage_log_id: string;
        prompt_hash: string;
        output_hash: string;
        model_used: string;
        schema_hash: string;
        signature: string;
        created_at: string;
      }>(
        `SELECT id, usage_log_id, prompt_hash, output_hash, model_used, schema_hash, signature, created_at
         FROM execution_proofs
         WHERE id = $1`,
        [proof_id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: "PROOF_NOT_FOUND", message: "No execution proof found for this ID." },
        });
        return;
      }

      const proof = result.rows[0]!;

      // ── Cryptographic Revalidation ───────────────────────────
      // Recompute the expected HMAC-SHA256 signature from the stored
      // hashes and compare to the stored signature.
      // A mismatch means the DB record was tampered with after insertion.
      const poeSecret = process.env.POE_SECRET;
      let is_cryptographically_valid = false;
      let validation_note = "POE_SECRET not configured on this node — signature check skipped.";

      if (poeSecret) {
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected = createHmac("sha256", poeSecret)
          .update(`${proof.prompt_hash}|${proof.output_hash}`, "utf-8")
          .digest("hex");

        try {
          is_cryptographically_valid = timingSafeEqual(
            Buffer.from(expected, "hex"),
            Buffer.from(proof.signature, "hex")
          );
          validation_note = is_cryptographically_valid
            ? "Signature verified: record has not been tampered with since insertion."
            : "⚠ SIGNATURE MISMATCH: this record may have been tampered with.";
        } catch {
          is_cryptographically_valid = false;
          validation_note = "Signature comparison failed (buffer length mismatch).";
        }
      }

      console.log(
        `[TrustService] Proof verified: id=${proof_id} valid=${is_cryptographically_valid}`
      );

      res.status(200).json({
        success: true,
        proof: {
          proof_id:                 proof.id,
          usage_log_id:             proof.usage_log_id,
          prompt_hash:              proof.prompt_hash,
          output_hash:              proof.output_hash,
          schema_hash:              proof.schema_hash,
          model_used:               proof.model_used,
          created_at:               proof.created_at,
          is_cryptographically_valid,
          validation_note,
        },
      });
    } catch (err) {
      console.error("[TrustService] Proof verification failed:", (err as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Proof verification query failed." },
      });
    }
  }
);
