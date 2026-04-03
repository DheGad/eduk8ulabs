/**
 * @file routes.ts
 * @service sanitizer-service
 * @description Sanitization endpoint — receives a prompt, runs the
 *              redactor engine, and returns sanitized text + de-id map.
 *
 * ================================================================
 * ENDPOINT
 * ================================================================
 *
 *   POST /api/v1/sanitize
 *
 *   Payload:
 *     {
 *       prompt:           string       — raw text to sanitize
 *       strategy:         'mask' | 'hash'   — redaction strategy
 *       sensitive_fields: string[]     — caller-supplied custom regex patterns
 *                                        (optional, defaults to [])
 *     }
 *
 *   Response (200):
 *     {
 *       success: true,
 *       sanitized_prompt: string,      — PII-redacted text
 *       map: Record<string, string>,   — token → original (de-id map)
 *       redaction_count: number,       — total entities redacted
 *       strategy: string
 *     }
 *
 * ================================================================
 * SECURITY
 * ================================================================
 *
 *   • This is an INTERNAL service — it must only be called by
 *     the Enforcer Service via x-internal-service-token.
 *   • The de-identification map is returned in the response body
 *     and is the Enforcer's responsibility to store in memory.
 *     It is NEVER persisted to disk or database.
 *   • The 'hash' strategy token is deterministic (SHA-256) so the
 *     AI can track entities across a multi-turn conversation.
 * ================================================================
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { redactPayload } from "./redactor.js";

export const sanitizerRouter = Router();

// ================================================================
// INTERNAL TOKEN GUARD
// ================================================================

function requireInternalToken(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.INTERNAL_ROUTER_SECRET;
  if (!secret) {
    res.status(503).json({
      success: false,
      error: { code: "SERVICE_MISCONFIGURED", message: "Internal auth not configured." },
    });
    return;
  }
  const token = req.headers["x-internal-service-token"];
  if (!token || token !== secret) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Invalid internal service token." },
    });
    return;
  }
  next();
}

// ================================================================
// REQUEST SCHEMA
// ================================================================

const SanitizeRequestSchema = z.object({
  /** The raw prompt text to sanitize */
  prompt: z.string().min(1, "prompt cannot be empty"),

  /**
   * Redaction strategy:
   *   mask  — labeled placeholder tokens (fully opaque, no entity tracking)
   *   hash  — stable SHA-256 tokens (entity correlation preserved, identity hidden)
   */
  strategy: z.enum(["mask", "hash"], {
    errorMap: () => ({ message: "strategy must be 'mask' or 'hash'" }),
  }),

  /**
   * Caller-supplied custom regex pattern strings.
   * Each must be a valid JavaScript regex source string.
   * Example: ["\\b(PROJECT_ATLAS)\\b", "\\bACME Corp\\b"]
   */
  sensitive_fields: z.array(z.string()).default([]),
});

// ================================================================
// POST /api/v1/sanitize
// ================================================================

sanitizerRouter.post(
  "/api/v1/sanitize",
  requireInternalToken,
  (req: Request, res: Response): void => {
    const start = Date.now();

    // ── 1. Validate ─────────────────────────────────────────────
    const parsed = SanitizeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid sanitize payload.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { prompt, strategy, sensitive_fields } = parsed.data;

    // ── 2. Run the redactor ─────────────────────────────────────
    let redactResult: ReturnType<typeof redactPayload>;
    try {
      redactResult = redactPayload(prompt, strategy, sensitive_fields);
    } catch (err) {
      console.error("[SanitizerService] Redactor threw unexpectedly:", (err as Error).message);
      res.status(500).json({
        success: false,
        error: {
          code: "REDACTION_ERROR",
          message: "The redaction engine encountered an unexpected error.",
        },
      });
      return;
    }

    const elapsed = Date.now() - start;

    console.log(
      `[SanitizerService] ✅ Sanitized — strategy=${strategy} ` +
      `entities=${redactResult.redactionCount} elapsed=${elapsed}ms`
    );

    // ── 3. Return sanitized prompt + de-id map ──────────────────
    res.status(200).json({
      success: true,
      sanitized_prompt: redactResult.sanitized,
      map: redactResult.deIdMap,
      redaction_count: redactResult.redactionCount,
      strategy,
    });
  }
);

// ================================================================
// GET /api/v1/sanitize/health
// Lightweight endpoint to verify the NLP engine loads correctly.
// ================================================================

sanitizerRouter.get("/api/v1/sanitize/health", (_req: Request, res: Response): void => {
  // Run a tiny test redaction to verify the engine is warm
  try {
    const test = redactPayload("Contact john@example.com at 555-123-4567", "mask");
    res.status(200).json({
      success: true,
      service: "sanitizer-service",
      engine: "operational",
      test_redaction_count: test.redactionCount,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      service: "sanitizer-service",
      engine: "degraded",
      error: (err as Error).message,
    });
  }
});
