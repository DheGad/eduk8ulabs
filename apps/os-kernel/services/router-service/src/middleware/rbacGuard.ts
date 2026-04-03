/**
 * @file middleware/rbacGuard.ts
 * @service router-service
 * @version V65
 * @description RBAC Guard Middleware — Permission Enforcement at Route Level
 *
 * ================================================================
 * USAGE
 * ================================================================
 *
 *  Import the factory and wrap any route that needs protection:
 *
 *    import { requirePermission } from "../middleware/rbacGuard.js";
 *
 *    router.get(
 *      "/api/v1/admin/analytics/usage",
 *      requirePermission("read:telemetry"),
 *      getUsageAnalytics
 *    );
 *
 *  The middleware reads the caller's role from `req.rbacRole`,
 *  which is set by the RBAC role injection layer (see below).
 *
 * ================================================================
 * ROLE INJECTION CONTRACT
 * ================================================================
 *
 *  The guard does NOT resolve the role itself — that's separation
 *  of concerns. Role injection happens in two places:
 *
 *    1. apiAuthMiddleware (routes.ts) — for x-api-key requests:
 *       after validating the API key, it reads the key record's
 *       `role` field and sets req.rbacRole.
 *
 *    2. sessionAuthMiddleware (future) — for session-cookie requests:
 *       reads the JWT/session and sets req.rbacRole.
 *
 *  If req.rbacRole is absent or null → DEFAULT DENY (403).
 *  If the resolved role lacks the required action → DEFAULT DENY (403).
 *
 * ================================================================
 * DEFAULT DENY GUARANTEE
 * ================================================================
 *
 *  This middleware NEVER calls next() unless ALL of the following
 *  are true:
 *    • req.rbacRole is a recognized Role enum value
 *    • The role's permission set explicitly contains the action
 *
 *  Any ambiguity, undefined state, or unrecognized string = 403.
 *
 * ================================================================
 */

import { Request, Response, NextFunction } from "express";
import {
  Role,
  isAuthorized,
  parseRole,
  type RbacAction,
} from "../security/rbacEngine.js";

// ----------------------------------------------------------------
// Express Request Augmentation
// ----------------------------------------------------------------
// Extends the Express Request type to carry the resolved RBAC role.
// Set by apiAuthMiddleware (or any auth layer) BEFORE rbacGuard runs.
// ----------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      /**
       * The resolved RBAC role for the authenticated caller.
       * Set by apiAuthMiddleware or session auth.
       * null = unauthenticated / unknown → DEFAULT DENY.
       */
      rbacRole?: Role | null;
      /**
       * V70: Unique correlation trace ID for this request lifecycle.
       * Set by traceProviderMiddleware before all route handlers.
       */
      traceId?: string;
      /**
       * V70: Unix timestamp (ms) when this request arrived.
       * Used to compute relative event offsets in the trace timeline.
       */
      traceStartedAt?: number;
    }
  }
}

// ----------------------------------------------------------------
// MIDDLEWARE FACTORY
// ----------------------------------------------------------------

/**
 * requirePermission
 * -----------------
 * Express middleware factory that enforces a single RBAC action.
 *
 * Usage:
 *   router.get("/path", requirePermission("read:telemetry"), handler)
 *
 * The middleware:
 *   1. Reads req.rbacRole (set by upstream auth middleware)
 *   2. Checks the RBAC matrix for the required action
 *   3. Calls next() on ALLOW
 *   4. Returns 403 on DENY (no logging of the protected resource path)
 *
 * @param action - The RbacAction string required to access this route
 * @returns Express RequestHandler
 */
export function requirePermission(action: RbacAction) {
  return function rbacGuard(req: Request, res: Response, next: NextFunction): void {
    // Read the pre-resolved role from the request context.
    // parseRole() guards against invalid strings — returns null on unknown.
    // req.rbacRole is already a typed Role | null | undefined — use it directly.
    // parseRole() handles any stale string values defensively.
    const role: Role | null =
      req.rbacRole != null && (Object.values(Role) as string[]).includes(req.rbacRole as string)
        ? (req.rbacRole as Role)
        : parseRole(req.rbacRole as string | undefined | null);

    if (!req.rbacRole) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized: Missing or invalid authentication token/key.",
        },
      });
      return;
    }

    if (!isAuthorized(role, action)) {
      const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? "unknown";
      const callerId = (req.headers["x-api-key-id"] as string | undefined) ??
                       (req.headers["x-session-id"]  as string | undefined) ??
                       "anonymous";

      console.warn(
        `[V65:RbacGuard] 🚫 DENY — action="${action}" ` +
        `role="${role ?? "none"}" tenant="${tenantId}" caller="${callerId}" ` +
        `path="${req.method} ${req.path}"`
      );

      res.status(403).json({
        success: false,
        error: {
          code:    "INSUFFICIENT_PERMISSIONS",
          message: `Forbidden: your role does not have the "${action}" permission. ` +
                   `Contact your workspace OWNER or ADMIN to request access.`,
          required_permission: action,
          your_role:           role ?? null,
        },
      });
      return; // Do NOT call next()
    }

    // ALLOW — log at debug level and proceed
    console.debug(
      `[V65:RbacGuard] ✅ ALLOW — action="${action}" role="${role}" ` +
      `path="${req.method} ${req.path}"`
    );

    next();
  };
}

// ----------------------------------------------------------------
// ROLE INJECTION HELPER (called by apiAuthMiddleware in routes.ts)
// ----------------------------------------------------------------

/**
 * Maps an API key's policy_id to an RBAC Role.
 *
 * In V65, role assignment is derived from the key's policy_id.
 * In a future iteration, role will be a first-class field on the
 * ApiKeyRecord itself (see apiKeyService.ts upgrade path below).
 *
 * Mapping logic:
 *   SOVEREIGN_DEFENSE / FINANCIAL_GRADE → ADMIN  (elevated trust keys)
 *   ACADEMIC_INTEGRITY / GENERIC_BASELINE → MEMBER (standard keys)
 *   TEST_POLICY → MEMBER  (dev/test keys get least-privilege)
 *   x-role-override header → parsed if set (for session-based auth)
 *   Fallback → MEMBER (not OWNER or VIEWER — middle of the road)
 *
 * @param policyId       - The policy_id from the validated ApiKeyContext
 * @param roleOverride   - Optional explicit role string from session auth
 */
export function resolveRoleFromContext(
  policyId:    string | undefined | null,
  roleOverride?: string | undefined
): Role {
  // If session auth has injected an explicit role header, honour it.
  // This supports UI/dashboard flows where a JWT carries the role.
  if (roleOverride) {
    const parsed = parseRole(roleOverride);
    if (parsed) return parsed;
  }

  // Derive from API key policy until role is a first-class DB field
  switch (policyId?.toUpperCase()) {
    case "SOVEREIGN_DEFENSE":
    case "FINANCIAL_GRADE":
      return Role.ADMIN;

    case "ACADEMIC_INTEGRITY":
    case "GENERIC_BASELINE":
      return Role.MEMBER;

    case "TEST_POLICY":
      return Role.MEMBER;

    default:
      // Unknown policy → minimum privilege (MEMBER allows execute:llm only)
      return Role.MEMBER;
  }
}

// ----------------------------------------------------------------
// SESSION-BASED ROLE INJECTION MIDDLEWARE
// ----------------------------------------------------------------
// Reads x-streetmp-role header (set by the Next.js BFF after JWT
// verification). If present and valid, injects req.rbacRole so
// the requirePermission guards work the same way as API key auth.
//
// Mount this ONCE globally in index.ts (before routes) or inline
// per-router as needed.
// ----------------------------------------------------------------

/**
 * Middleware that reads the x-streetmp-role header and populates
 * req.rbacRole for session-authenticated requests (web UI flow).
 *
 * For API key flow, role injection is handled inside apiAuthMiddleware.
 * Both flows converge on req.rbacRole → requirePermission() works
 * identically regardless of how the caller authenticated.
 */
export function injectSessionRole(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Only inject if not already set by API key auth
  if (req.rbacRole === undefined) {
    const rawRole = req.headers["x-streetmp-role"] as string | undefined;
    req.rbacRole = parseRole(rawRole); // null if missing/invalid → DEFAULT DENY
  }
  next();
}
