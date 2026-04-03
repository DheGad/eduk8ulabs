/**
 * @file middleware.ts
 * @package @streetmp-os/security
 * @description JWT Authentication Middleware — The Security Bridge.
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 * This middleware is the central trust boundary for the entire
 * OS Kernel. It is the single, shared function that every
 * microservice uses to verify a client's identity before
 * processing their request.
 *
 * When applied to a route, it:
 *   1. Extracts the Bearer token from the Authorization header
 *   2. Verifies it cryptographically against JWT_SECRET
 *   3. Injects the decoded payload into req.user
 *   4. Calls next() — or short-circuits with 401 if invalid
 *
 * ================================================================
 * USAGE IN A MICROSERVICE
 * ================================================================
 *
 *   import { requireAuth } from "@streetmp-os/security";
 *
 *   // Protect a single route:
 *   router.post("/api/v1/execute", requireAuth, async (req, res) => {
 *     const userId = req.user!.sub;   // UUID — verified, safe to use
 *     const tier   = req.user!.tier;  // "free" | "pro" | "enterprise"
 *     // ... proceed with LLM call
 *   });
 *
 *   // Protect all routes on a router:
 *   router.use(requireAuth);
 *
 * ================================================================
 * SECURITY NOTES
 * ================================================================
 * - Tokens signed with HS256 using JWT_SECRET (min 32 bytes).
 * - Expired tokens produce `TokenExpiredError` — caught and mapped
 *   to 401 with a specific message to guide client refresh logic.
 * - We never reveal WHY a token failed (beyond expired vs invalid)
 *   to avoid leaking signature or structure information.
 * - The middleware reads JWT_SECRET at call time (not module load)
 *   so it is safe to use across service boundaries where the env
 *   var might not be set during package import.
 * ================================================================
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@streetmp-os/types";

// ----------------------------------------------------------------
// TOKEN EXTRACTION UTILITY
// ----------------------------------------------------------------

/**
 * Parses the raw Authorization header value and returns the
 * Bearer token string, or null if the header is missing/malformed.
 *
 * Valid format:  "Authorization: Bearer eyJhbGci..."
 * Invalid:       "Authorization: eyJhbGci..."   (missing "Bearer ")
 * Invalid:       "Authorization: Basic abc123"  (wrong scheme)
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  // Must be exactly ["Bearer", "<token>"] — two parts, correct scheme
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1];
  return token && token.length > 0 ? token : null;
}

// ----------------------------------------------------------------
// requireAuth MIDDLEWARE
// ----------------------------------------------------------------

/**
 * Express middleware that enforces JWT authentication.
 *
 * On success: decodes the JWT payload and attaches it to `req.user`,
 * then calls `next()`.
 *
 * On failure: responds immediately with `401 Unauthorized` and does
 * NOT call `next()`, preventing the route handler from executing.
 *
 * @example
 *   router.post("/api/v1/vault/keys", requireAuth, vaultHandler);
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ---- Step 1: Validate JWT_SECRET is configured ----
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Service misconfiguration — fail closed, log loudly
    console.error(
      "[Security:requireAuth] FATAL: JWT_SECRET is not set. " +
        "All protected routes are inaccessible until this is configured."
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_MISCONFIGURED",
        message: "Authentication service is not properly configured.",
      },
    });
    return;
  }

  // ---- Step 2: Extract Bearer token ----
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: "MISSING_AUTH_HEADER",
        message: "Missing or invalid authorization header. Expected: Authorization: Bearer <token>",
      },
    });
    return;
  }

  // ---- Step 3: Verify token signature and expiry ----
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"], // Explicitly allowlist algorithm — prevents "alg: none" attack
    }) as JwtPayload;

    // Sanity-check the decoded payload has the required claims
    if (!decoded.sub || !decoded.tier) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN_PAYLOAD",
          message: "Token payload is missing required claims.",
        },
      });
      return;
    }

    // ---- Step 4: Inject verified user into request ----
    // req.user is now fully typed as JwtPayload via the module
    // augmentation in @streetmp-os/types.
    req.user = decoded;

    // ---- Step 5: Pass to route handler ----
    next();
  } catch (err) {
    // Distinguish expired tokens from other failures — clients use
    // the specific "EXPIRED" code to trigger a token refresh flow.
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Token expired or invalid.",
        },
      });
      return;
    }

    // JsonWebTokenError covers: invalid signature, malformed JWT,
    // wrong algorithm, or any other structural failure.
    res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_INVALID",
        message: "Token expired or invalid.",
      },
    });
  }
}
