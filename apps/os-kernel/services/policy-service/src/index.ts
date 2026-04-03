/**
 * @file index.ts
 * @service policy-service  (port 4008)
 * @description StreetMP OS v2 — The Policy Engine (Enterprise Governance).
 *
 * Acts as the organizational gatekeeper BEFORE any AI execution.
 * Enforces per-organization rules defined in enterprise_policies:
 *   • Model allow-lists      — block disallowed LLMs
 *   • Daily spend caps       — block when budget exhausted
 *   • Forced sanitization    — mandate PII scrubbing
 *   • Keyword blocking       — reject prompts containing flagged terms
 *
 * Routes:
 *   PUBLIC/ADMIN (JWT required):
 *     POST /api/v1/policies              — create / update organization policy
 *     GET  /api/v1/policies/:orgId       — fetch policy for an org
 *     DELETE /api/v1/policies/:orgId     — deactivate policy
 *
 *   INTERNAL (x-internal-service-token):
 *     POST /internal/policy/evaluate     — Gatekeeper evaluation
 *
 *   HEALTH:
 *     GET  /health
 */

import "@streetmp-os/config/env";
import express, { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { z } from "zod";

// ================================================================
// DATABASE
// ================================================================

const pool = new Pool({
  host:     process.env.DB_HOST ?? "localhost",
  port:     parseInt(process.env.DB_PORT ?? "5432", 10),
  database: process.env.DB_NAME ?? "streetmp_os",
  user:     process.env.DB_USER ?? "streetmp",
  password: process.env.DB_PASS ?? "",
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.connect()
  .then(() => console.log("[PolicyService] ✅ PostgreSQL connected"))
  .catch((err: Error) => {
    console.error("[PolicyService] ❌ DB connection failed:", err.message);
    process.exit(1);
  });

// ================================================================
// TYPES
// ================================================================

interface PolicyRules {
  allowed_models?:    string[];           // If set, only these models are permitted
  max_daily_spend?:  number;             // USD — daily cap across the org
  force_sanitization?: boolean;          // If true, ALL prompts go through sanitizer
  blocked_keywords?: string[];           // Prompt is rejected if any keyword found (case-insensitive)
}

interface EnterprisePolicy {
  id:              string;
  organization_id: string;
  rules:           PolicyRules;
  is_active:       boolean;
  created_at:      string;
  updated_at:      string;
}

// ================================================================
// APP + MIDDLEWARE
// ================================================================

const app = express();
app.use(express.json({ limit: "32kb" }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// ── Internal token guard ─────────────────────────────────────────
const INTERNAL_SECRET = process.env.INTERNAL_ROUTER_SECRET;

function requireInternalToken(req: Request, res: Response, next: NextFunction): void {
  if (!INTERNAL_SECRET) {
    res.status(503).json({ success: false, error: { code: "MISCONFIGURED" } });
    return;
  }
  if (req.headers["x-internal-service-token"] !== INTERNAL_SECRET) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN" } });
    return;
  }
  next();
}

// ── JWT admin guard (minimal — checks presence of Authorization header) ──
function requireJwt(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED" } });
    return;
  }
  next();
}

// ================================================================
// HEALTH
// ================================================================

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "policy-service", version: "2.0.0" });
});

// ================================================================
// POLICY CRUD — ADMIN ROUTES
// ================================================================

const PolicyRulesSchema = z.object({
  allowed_models:    z.array(z.string().min(1)).optional(),
  max_daily_spend:  z.number().positive().optional(),
  force_sanitization: z.boolean().optional(),
  blocked_keywords: z.array(z.string().min(1)).optional(),
});

const CreatePolicySchema = z.object({
  organization_id: z.string().min(1).max(255),
  rules:           PolicyRulesSchema,
  is_active:       z.boolean().optional().default(true),
});

/** POST /api/v1/policies — Create or replace organization policy */
app.post("/api/v1/policies", requireJwt, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreatePolicySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors },
    });
    return;
  }

  const { organization_id, rules, is_active } = parsed.data;

  try {
    const result = await pool.query<EnterprisePolicy>(
      `INSERT INTO enterprise_policies (organization_id, rules, is_active)
       VALUES ($1, $2::JSONB, $3)
       ON CONFLICT (organization_id)
       DO UPDATE SET
         rules      = EXCLUDED.rules,
         is_active  = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [organization_id, JSON.stringify(rules), is_active]
    );

    const policy = result.rows[0]!;
    console.log(`[PolicyService] 📋 Policy upserted: org=${organization_id}`);

    res.status(200).json({ success: true, policy });
  } catch (err) {
    console.error("[PolicyService] Policy upsert failed:", (err as Error).message);
    res.status(500).json({ success: false, error: { code: "DB_ERROR" } });
  }
});

/** GET /api/v1/policies/:orgId — Fetch policy for an organization */
app.get("/api/v1/policies/:orgId", requireJwt, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params as { orgId: string };

  const result = await pool.query<EnterprisePolicy>(
    `SELECT * FROM enterprise_policies WHERE organization_id = $1`,
    [orgId]
  ).catch((err: Error) => {
    console.error("[PolicyService] Fetch failed:", err.message);
    return null;
  });

  if (!result || result.rows.length === 0) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    return;
  }

  res.status(200).json({ success: true, policy: result.rows[0] });
});

/** DELETE /api/v1/policies/:orgId — Deactivate (soft-delete) policy */
app.delete("/api/v1/policies/:orgId", requireJwt, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params as { orgId: string };

  await pool.query(
    `UPDATE enterprise_policies SET is_active = FALSE, updated_at = NOW()
     WHERE organization_id = $1`,
    [orgId]
  ).catch((err: Error) => console.error("[PolicyService] Deactivate failed:", err.message));

  res.status(200).json({ success: true, message: `Policy for org '${orgId}' deactivated.` });
});

// ================================================================
// POST /internal/policy/evaluate — THE GATEKEEPER
// ================================================================
// Called by the Enforcer BEFORE memory interceptor and sanitizer.
// Returns a structured decision object — never throws.

const EvaluateRequestSchema = z.object({
  user_id:      z.string().uuid(),
  organization_id: z.string().min(1),           // Passed by Enforcer from JWT claims
  model:        z.string().min(1),              // The model the user wants (or auto-selected)
  prompt:       z.string().min(1),              // Raw prompt — for keyword check
  prompt_size:  z.number().int().nonnegative(), // Character count
});

interface EvaluateResponse {
  allowed:          boolean;
  modified_model?:  string;   // If policy restricts the requested model, substitute this one
  force_sanitizer:  boolean;  // Override enterprise_mode to force PII scrubbing
  block_reason?:    string;   // Human-readable reason when allowed = false
  policy_id?:       string;   // Which policy was evaluated (for audit trails)
  evaluation_ms:    number;   // Round-trip evaluation latency
}

app.post(
  "/internal/policy/evaluate",
  requireInternalToken,
  async (req: Request, res: Response): Promise<void> => {
    const t0 = Date.now();

    const parsed = EvaluateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors },
      });
      return;
    }

    const { organization_id, model, prompt, prompt_size } = parsed.data;

    // ── Fetch the active policy for this organization ─────────────
    let policy: EnterprisePolicy | null = null;
    try {
      const result = await pool.query<EnterprisePolicy>(
        `SELECT * FROM enterprise_policies
         WHERE organization_id = $1 AND is_active = TRUE
         LIMIT 1`,
        [organization_id]
      );
      policy = result.rows[0] ?? null;
    } catch (err) {
      // DB error → fail open (allow execution, no policy applied)
      console.warn("[PolicyService] DB lookup failed, failing open:", (err as Error).message);
      res.status(200).json({
        success: true,
        evaluation: {
          allowed: true,
          force_sanitizer: false,
          evaluation_ms: Date.now() - t0,
        } satisfies EvaluateResponse,
      });
      return;
    }

    // ── No policy for this org → allow everything ─────────────────
    if (!policy) {
      res.status(200).json({
        success: true,
        evaluation: {
          allowed: true,
          force_sanitizer: false,
          evaluation_ms: Date.now() - t0,
        } satisfies EvaluateResponse,
      });
      return;
    }

    const rules = policy.rules;
    const evaluation: EvaluateResponse = {
      allowed:         true,
      force_sanitizer: rules.force_sanitization ?? false,
      policy_id:       policy.id,
      evaluation_ms:   0, // set at end
    };

    // ── RULE 1: Keyword Block ─────────────────────────────────────
    // If the prompt contains ANY blocked keyword → reject immediately.
    if (rules.blocked_keywords && rules.blocked_keywords.length > 0) {
      const lowerPrompt = prompt.toLowerCase();
      const hit = rules.blocked_keywords.find((kw) => lowerPrompt.includes(kw.toLowerCase()));
      if (hit) {
        evaluation.allowed = false;
        evaluation.block_reason = `Policy violation: prompt contains blocked keyword "${hit}".`;
        console.warn(
          `[PolicyService] 🚫 BLOCKED: org=${organization_id} keyword="${hit}"`
        );
        evaluation.evaluation_ms = Date.now() - t0;
        res.status(200).json({ success: true, evaluation });
        return;
      }
    }

    // ── RULE 2: Model Allow-List ──────────────────────────────────
    // If the requested model is not on the allow-list, either substitute
    // the first allowed model or block entirely if no alternatives.
    if (rules.allowed_models && rules.allowed_models.length > 0) {
      const isAllowed = rules.allowed_models.includes(model);
      if (!isAllowed) {
        // Substitute with the first allowed model instead of blocking
        const substitute = rules.allowed_models[0]!;
        evaluation.modified_model = substitute;
        console.log(
          `[PolicyService] 🔄 Model substitution: ${model} → ${substitute} (org=${organization_id})`
        );
      }
    }

    // ── RULE 3: Daily Spend Cap ───────────────────────────────────
    // Sum today's usage costs from enterprise_billing_ledger.
    if (rules.max_daily_spend != null) {
      try {
        const spendResult = await pool.query<{ daily_spend: string }>(
          `SELECT COALESCE(SUM(total_cost_usd), 0) AS daily_spend
           FROM enterprise_billing_ledger
           WHERE organization_id = $1
             AND period_start >= CURRENT_DATE`,
          [organization_id]
        );
        const dailySpend = parseFloat(spendResult.rows[0]?.daily_spend ?? "0");

        if (dailySpend >= rules.max_daily_spend) {
          evaluation.allowed = false;
          evaluation.block_reason =
            `Daily budget cap exceeded: $${dailySpend.toFixed(2)} spent of $${rules.max_daily_spend.toFixed(2)} limit.`;
          console.warn(
            `[PolicyService] 🚫 BLOCKED: org=${organization_id} spend=$${dailySpend.toFixed(2)} cap=$${rules.max_daily_spend}`
          );
          evaluation.evaluation_ms = Date.now() - t0;
          res.status(200).json({ success: true, evaluation });
          return;
        }
      } catch (err) {
        // Spend check failure → allow (fail open, log warning)
        console.warn("[PolicyService] Spend check failed (fail open):", (err as Error).message);
      }
    }

    // ── RULE 4: Prompt Size Guard (implicit safety) ───────────────
    // Block extremely large prompts (> 100k chars) regardless of policy
    // to protect against token-stuffing attacks.
    const MAX_PROMPT_SIZE = 100_000;
    if (prompt_size > MAX_PROMPT_SIZE) {
      evaluation.allowed = false;
      evaluation.block_reason = `Prompt exceeds maximum size of ${MAX_PROMPT_SIZE.toLocaleString()} characters (got ${prompt_size.toLocaleString()}).`;
      evaluation.evaluation_ms = Date.now() - t0;
      res.status(200).json({ success: true, evaluation });
      return;
    }

    // ── ALL RULES PASSED ──────────────────────────────────────────
    evaluation.evaluation_ms = Date.now() - t0;

    console.log(
      `[PolicyService] ✅ ALLOWED: org=${organization_id} model=${evaluation.modified_model ?? model} ` +
      `force_sanitizer=${evaluation.force_sanitizer} (${evaluation.evaluation_ms}ms)`
    );

    res.status(200).json({ success: true, evaluation });
  }
);

// ================================================================
// START
// ================================================================

const PORT = parseInt(process.env.PORT ?? "4008", 10);

app.listen(PORT, () => {
  console.log(`[PolicyService] 🏛  v2 Policy Engine running on port ${PORT}`);
  console.log(`[PolicyService] Routes:`);
  console.log(`  POST   /api/v1/policies`);
  console.log(`  GET    /api/v1/policies/:orgId`);
  console.log(`  DELETE /api/v1/policies/:orgId`);
  console.log(`  POST   /internal/policy/evaluate`);
  console.log(`  GET    /health`);
});

export default app;
