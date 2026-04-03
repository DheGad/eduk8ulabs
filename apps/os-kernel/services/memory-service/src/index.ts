/**
 * @file index.ts
 * @service memory-service  (port 4007)
 * @description StreetMP OS v2 — The Learning Brain.
 *
 * Internal microservice that receives execution outcomes from the
 * Enforcer Service and upserts learned patterns into execution_memory.
 *
 * Over time this builds a "best model per schema" knowledge base that
 * future Router Service versions can use to pre-select the optimal LLM
 * for a given JSON schema before even attempting execution.
 *
 * Routes (internal — all protected by x-internal-service-token):
 *   POST /internal/memory/log        — upsert execution outcome
 *   GET  /internal/memory/recommend  — best model for a schema_hash
 *   GET  /health                     — liveness probe
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
  .then(() => console.log("[MemoryService] ✅ PostgreSQL connected"))
  .catch((err: Error) => {
    console.error("[MemoryService] ❌ DB connection failed:", err.message);
    process.exit(1);
  });

// ================================================================
// APP
// ================================================================

const app = express();
app.use(express.json({ limit: "32kb" }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// ================================================================
// INTERNAL SERVICE TOKEN GUARD
// ================================================================

const INTERNAL_SECRET = process.env.INTERNAL_ROUTER_SECRET;

function requireInternalToken(req: Request, res: Response, next: NextFunction): void {
  if (!INTERNAL_SECRET) {
    console.error("[MemoryService] FATAL: INTERNAL_ROUTER_SECRET not configured.");
    res.status(503).json({ success: false, error: { code: "MISCONFIGURED" } });
    return;
  }
  if (req.headers["x-internal-service-token"] !== INTERNAL_SECRET) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN" } });
    return;
  }
  next();
}

// ================================================================
// HEALTH PROBE
// ================================================================

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "memory-service", version: "2.0.0" });
});

// ================================================================
// POST /internal/memory/log
// Called by the Enforcer after every execution (fire-and-forget).
//
// Upserts the execution_memory row for this schema_hash:
//   - Increments total_runs
//   - Increments successful_runs (if success=true)
//   - Recomputes success_rate = successful_runs / total_runs
//   - Updates best_model if success=true AND this model+schema pair
//     has better success_rate than the current best
// ================================================================

const MemoryLogSchema = z.object({
  schema_hash:  z.string().min(64).max(64, "schema_hash must be a 64-char hex SHA-256"),
  model_used:   z.string().min(1).max(120),
  success:      z.boolean(),
  attempts:     z.number().int().min(1).max(10),
});

app.post(
  "/internal/memory/log",
  requireInternalToken,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = MemoryLogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors },
      });
      return;
    }

    const { schema_hash, model_used, success } = parsed.data;

    try {
      /**
       * UPSERT LOGIC:
       *   ON CONFLICT (schema_hash) DO UPDATE:
       *   1. Always increment total_runs
       *   2. Increment successful_runs only on success
       *   3. Recompute success_rate
       *   4. Update best_model if the incoming model achieved success
       *      AND the updated success_rate warrants it
       *      (simplest heuristic: last successful model wins, prevents thrashing)
       */
      const result = await pool.query<{ id: string; schema_hash: string; success_rate: string; best_model: string }>(
        `INSERT INTO execution_memory
           (schema_hash, success_rate, best_model, total_runs, successful_runs)
         VALUES
           ($1, $2::NUMERIC(5,4), $3, 1, $4::INTEGER)
         ON CONFLICT (schema_hash) DO UPDATE SET
           total_runs      = execution_memory.total_runs + 1,
           successful_runs = execution_memory.successful_runs + $4::INTEGER,
           success_rate    = (execution_memory.successful_runs + $4::INTEGER)::NUMERIC
                             / (execution_memory.total_runs + 1)::NUMERIC,
           best_model      = CASE
                               WHEN $5 = TRUE AND execution_memory.success_rate
                                    <= (execution_memory.successful_runs + $4::INTEGER)::NUMERIC
                                       / (execution_memory.total_runs + 1)::NUMERIC
                               THEN $3
                               ELSE execution_memory.best_model
                             END,
           updated_at      = NOW()
         RETURNING id, schema_hash, success_rate, best_model`,
        [
          schema_hash,
          success ? 1.0 : 0.0,    // Initial success_rate for new rows
          model_used,
          success ? 1 : 0,         // successful_runs increment
          success,                  // Whether to update best_model
        ]
      );

      const row = result.rows[0];
      console.log(
        `[MemoryService] Learned: schema=${schema_hash.slice(0, 8)}… ` +
        `model=${model_used} success=${success} ` +
        `→ rate=${parseFloat(row?.success_rate ?? "0").toFixed(3)} best=${row?.best_model}`
      );

      res.status(200).json({
        success: true,
        schema_hash,
        success_rate: parseFloat(row?.success_rate ?? "0"),
        best_model: row?.best_model ?? model_used,
      });
    } catch (err) {
      console.error("[MemoryService] DB upsert failed:", (err as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Memory log upsert failed." },
      });
    }
  }
);

// ================================================================
// GET /internal/memory/recommend?schema_hash=...
// Returns the best model for a given schema_hash.
// The Router Service can call this before selecting an LLM.
// ================================================================

app.get(
  "/internal/memory/recommend",
  requireInternalToken,
  async (req: Request, res: Response): Promise<void> => {
    const { schema_hash } = req.query as { schema_hash?: string };

    if (!schema_hash || schema_hash.length !== 64) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_SCHEMA_HASH", message: "schema_hash query param required (64-char hex)." },
      });
      return;
    }

    try {
      const result = await pool.query<{
        best_model: string;
        success_rate: string;
        total_runs: number;
      }>(
        `SELECT best_model, success_rate, total_runs
         FROM execution_memory
         WHERE schema_hash = $1`,
        [schema_hash]
      );

      if (result.rows.length === 0) {
        // No learning data yet — return null so the caller falls back to default
        res.status(200).json({
          success: true,
          recommendation: null,
          message: "No memory for this schema yet — use default model selection.",
        });
        return;
      }

      const row = result.rows[0]!;
      res.status(200).json({
        success: true,
        recommendation: {
          best_model: row.best_model,
          success_rate: parseFloat(row.success_rate),
          total_runs: Number(row.total_runs),
          confidence: Number(row.total_runs) >= 10 ? "high" : Number(row.total_runs) >= 5 ? "medium" : "low",
        },
      });
    } catch (err) {
      console.error("[MemoryService] Recommend query failed:", (err as Error).message);
      res.status(500).json({ success: false, error: { code: "DB_ERROR" } });
    }
  }
);

// ================================================================
// START
// ================================================================

const PORT = parseInt(process.env.PORT ?? "4007", 10);

app.listen(PORT, () => {
  console.log(`[MemoryService] 🧠 v2 Memory Service running on port ${PORT}`);
  console.log(`[MemoryService] Routes:`);
  console.log(`  POST /internal/memory/log`);
  console.log(`  GET  /internal/memory/recommend`);
  console.log(`  GET  /health`);
});

export default app;
