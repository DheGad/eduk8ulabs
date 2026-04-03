/**
 * @file middleware/adminSecretGuard.ts
 * @service router-service
 * @version Phase1-SEC-01
 * @description Strict STREETMP_ADMIN_SECRET enforcement middleware.
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 *
 *  Every request hitting /api/v1/admin/* MUST present the
 *  STREETMP_ADMIN_SECRET value in the `x-admin-secret` header.
 *
 *  Failure modes:
 *    • Secret not configured in env  → 503 Service Unavailable
 *      (prevents misconfigured deployments from silently being open)
 *    • Header absent or wrong value  → 401 Unauthorized
 *      (constant-time comparison to prevent timing attacks)
 *
 *  On success: attaches `req.adminVerified = true` and calls next().
 *
 * ================================================================
 * SECURITY PROPERTIES
 * ================================================================
 *
 *  1. Constant-time comparison — uses Node's `timingSafeEqual` to
 *     prevent secret-oracle timing attacks.
 *  2. Fail-closed — if STREETMP_ADMIN_SECRET is unset the route
 *     returns 503 rather than allowing open access.
 *  3. No secret leakage — header value is never echoed in responses
 *     or logged.
 *
 * ================================================================
 * USAGE
 * ================================================================
 *
 *    import { adminSecretGuard } from "../middleware/adminSecretGuard.js";
 *
 *    // Mount globally before all admin routes:
 *    app.use("/api/v1/admin", adminSecretGuard, adminRouter);
 *
 * ================================================================
 */

import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

// Extend Express Request to carry the admin-verified flag
declare global {
  namespace Express {
    interface Request {
      /** Set to true by adminSecretGuard when the caller passes the admin secret. */
      adminVerified?: boolean;
    }
  }
}

/**
 * Reads STREETMP_ADMIN_SECRET at startup (once) and returns a Buffer.
 * Returns null if the env var is unset — callers must handle this.
 */
function getExpectedSecret(): Buffer | null {
  const secret = process.env.STREETMP_ADMIN_SECRET;
  if (!secret || !secret.trim()) return null;
  return Buffer.from(secret.trim(), "utf8");
}

// Compute once at module load time
const EXPECTED_SECRET_BUF: Buffer | null = getExpectedSecret();

if (!EXPECTED_SECRET_BUF) {
  console.error(
    "[Phase1:adminSecretGuard] ⚠️  CRITICAL: STREETMP_ADMIN_SECRET is not set!\n" +
    "  All /api/v1/admin/* routes will return 503 until this is configured.\n" +
    "  Set it in your .env file or deployment secrets manager."
  );
}

/**
 * Express middleware that enforces the STREETMP_ADMIN_SECRET on every request.
 *
 * - Returns 503 if STREETMP_ADMIN_SECRET is not configured
 * - Returns 401 if x-admin-secret header is absent or incorrect
 * - Calls next() if the secret matches
 */
export function adminSecretGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ── Fail-closed: secret not configured ──────────────────────────
  if (!EXPECTED_SECRET_BUF) {
    console.error(
      `[Phase1:adminSecretGuard] 503 — STREETMP_ADMIN_SECRET not configured ` +
      `for ${req.method} ${req.path}`
    );
    res.status(503).json({
      success: false,
      error: {
        code: "ADMIN_NOT_CONFIGURED",
        message:
          "Admin API is not available: STREETMP_ADMIN_SECRET is not configured " +
          "on this server. Contact the platform administrator.",
      },
    });
    return;
  }

  // ── Extract the presented secret ────────────────────────────────
  const presented = req.headers["x-admin-secret"];

  if (!presented || typeof presented !== "string" || !presented.trim()) {
    console.warn(
      `[Phase1:adminSecretGuard] 401 — Missing x-admin-secret header ` +
      `${req.method} ${req.path} from ${req.ip}`
    );
    res.status(401).json({
      success: false,
      error: {
        code: "MISSING_ADMIN_SECRET",
        message:
          "Unauthorized: x-admin-secret header is required for admin API access.",
      },
    });
    return;
  }

  // ── Constant-time comparison ─────────────────────────────────────
  const presentedBuf = Buffer.from(presented.trim(), "utf8");

  // timingSafeEqual requires same-length buffers; pad to prevent length leak
  let match = false;
  try {
    // If lengths differ, compare against itself (always false) to spend equal time
    const a = presented.trim().length === EXPECTED_SECRET_BUF.length
      ? presentedBuf
      : Buffer.alloc(EXPECTED_SECRET_BUF.length);
    match = timingSafeEqual(a, EXPECTED_SECRET_BUF) &&
            presented.trim().length === EXPECTED_SECRET_BUF.length;
  } catch {
    match = false;
  }

  if (!match) {
    console.warn(
      `[Phase1:adminSecretGuard] 401 — Invalid admin secret ` +
      `${req.method} ${req.path} from ${req.ip}`
    );
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_ADMIN_SECRET",
        message:
          "Unauthorized: The provided x-admin-secret is incorrect.",
      },
    });
    return;
  }

  // ── ALLOW ────────────────────────────────────────────────────────
  req.adminVerified = true;
  console.debug(
    `[Phase1:adminSecretGuard] ✅ Admin verified — ${req.method} ${req.path}`
  );
  next();
}
