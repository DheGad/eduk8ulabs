/**
 * @file middleware/orgScopeGuard.ts
 * @service router-service
 * @phase Phase 4 — The Enterprise Layer
 * @description
 *   Tenant Isolation Middleware — Two-stage protection:
 *
 *   STAGE 1 — orgContextMiddleware (mount globally after auth):
 *     Extracts `org_id` from the JWT/session (x-streetmp-org-id header set
 *     by the Next.js BFF after token verification, or directly from x-api-key
 *     context). Injects it into req.orgId and req.orgRole.
 *
 *   STAGE 2 — requireOrgScope (mount per-route):
 *     A factory that wraps route handlers and validates that any `org_id`
 *     present in the request body, query params, or URL path matches the
 *     session org_id (req.orgId). Cross-org access → 403 Forbidden.
 *
 *   STAGE 3 — scopedQuery helper:
 *     Exported utility for route handlers. Automatically appends
 *     `AND org_id = $N` to any SQL query string and its params array,
 *     ensuring every DB read/write is hard-scoped to the session org.
 *
 * Request augmentation (adds to Express.Request):
 *   req.orgId      — UUID of the active organization
 *   req.orgRole    — org_role enum value for the current user
 *   req.userId     — UUID of the authenticated user
 */

import { Request, Response, NextFunction } from "express";
import { pool } from "../db.js";

// ── Express Request augmentation ──────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** UUID of the active organization — set by orgContextMiddleware */
      orgId?:   string | null;
      /** org_role of the authenticated user in this org */
      orgRole?: OrgRole | null;
      /** UUID of the authenticated user */
      userId?:  string | null;
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrgRole = "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";

export interface OrgContext {
  orgId:   string;
  userId:  string;
  orgRole: OrgRole;
}

// ── DB membership verification ────────────────────────────────────────────────

const VERIFY_MEMBERSHIP_SQL = `
  SELECT om.role::TEXT AS role
  FROM   organization_members om
  WHERE  om.user_id = $1::UUID
    AND  om.org_id  = $2::UUID
  LIMIT 1;
`;

// ── STAGE 1: orgContextMiddleware ─────────────────────────────────────────────

/**
 * Extracts org context from the request and injects it into req.orgId,
 * req.orgRole, req.userId.
 *
 * Header contract (set by Next.js BFF after JWT verification):
 *   x-streetmp-user-id  — UUID of the authenticated user
 *   x-streetmp-org-id   — UUID of the organization selected by the user
 *
 * If either header is missing the middleware calls next() with nulls —
 * routes that require org context must also mount requireOrgScope().
 *
 * If headers are present, we VERIFY membership in the DB so a tampered
 * header cannot bypass isolation (the JWT is trusted for identity, but
 * the DB is the source of truth for membership).
 */
export async function orgContextMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  const userId = req.headers["x-streetmp-user-id"] as string | undefined;
  const orgId  = req.headers["x-streetmp-org-id"]  as string | undefined;

  // No org context present — let unauthenticated / API-key routes continue
  if (!userId || !orgId) {
    req.orgId   = null;
    req.orgRole = null;
    req.userId  = userId ?? null;
    next();
    return;
  }

  try {
    // Verify the user is actually a member of this org — prevents header spoofing
    const { rows } = await pool.query<{ role: string }>(
      VERIFY_MEMBERSHIP_SQL,
      [userId, orgId]
    );

    if (rows.length === 0) {
      // User claims org membership but DB says otherwise → hard stop
      res.status(403).json({
        success: false,
        error: {
          code:    "ORG_ACCESS_DENIED",
          message: "You are not a member of the requested organization.",
        },
      });
      return;
    }

    req.userId  = userId;
    req.orgId   = orgId;
    req.orgRole = rows[0].role as OrgRole;

    next();
  } catch (err) {
    // DB failure — fail closed for org-scoped requests
    console.error("[OrgScope] Membership verification failed:", (err as Error).message);
    res.status(500).json({
      success: false,
      error: { code: "ORG_SCOPE_ERROR", message: "Failed to verify organization membership." },
    });
  }
}

// ── STAGE 2: requireOrgScope ──────────────────────────────────────────────────

/**
 * Route-level scope guard factory.
 *
 * Checks that any org_id present in:
 *   - req.body.org_id
 *   - req.query.org_id
 *   - req.params.org_id
 *
 * ...matches the session-verified req.orgId. A mismatch → 403.
 *
 * @param requireMembership  If true (default), also requires req.orgId to
 *                           be set (rejects requests with no org context).
 */
export function requireOrgScope(requireMembership = true) {
  return function orgScopeGuard(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): void {
    if (requireMembership && !req.orgId) {
      res.status(403).json({
        success: false,
        error: {
          code:    "NO_ORG_CONTEXT",
          message: "This endpoint requires an active organization context.",
        },
      });
      return;
    }

    // Extract any org_id the caller is trying to access
    const requestedOrgId =
      (req.body as Record<string, unknown>)?.org_id as string | undefined ??
      req.query.org_id as string | undefined ??
      req.params.org_id;

    if (requestedOrgId && requestedOrgId !== req.orgId) {
      console.warn(
        `[OrgScope] 🚫 SCOPE VIOLATION — session org: ${req.orgId} ` +
        `requested org: ${requestedOrgId} user: ${req.userId} path: ${req.method} ${req.path}`
      );
      res.status(403).json({
        success: false,
        error: {
          code:    "ORG_SCOPE_VIOLATION",
          message: "Cross-organization data access is not permitted.",
        },
      });
      return;
    }

    next();
  };
}

// ── STAGE 3: scopedQuery helper ───────────────────────────────────────────────

/**
 * Appends `AND org_id = $N` to a SQL query string, binding the session
 * org_id as the next parameter. Use this in every route handler to ensure
 * hard data isolation — even if a bug passes requireOrgScope.
 *
 * @example
 *   const { sql, params } = scopedQuery(
 *     req,
 *     "SELECT * FROM threat_events WHERE severity = $1",
 *     ["HIGH"]
 *   );
 *   const { rows } = await pool.query(sql, params);
 *
 * @throws  If req.orgId is null (programming error — mount requireOrgScope first)
 */
export function scopedQuery(
  req:    Request,
  sql:    string,
  params: unknown[] = []
): { sql: string; params: unknown[] } {
  if (!req.orgId) {
    throw new Error(
      "[OrgScope] scopedQuery called without an org context. " +
      "Ensure requireOrgScope middleware is mounted before this handler."
    );
  }
  const nextIndex = params.length + 1;
  return {
    sql:    `${sql} AND org_id = $${nextIndex}`,
    params: [...params, req.orgId],
  };
}

// ── Role capability guard ─────────────────────────────────────────────────────

/**
 * Require a minimum org role on the current request.
 * Used alongside requirePermission() for belt-and-suspenders protection.
 *
 * @example
 *   router.delete("/members/:id",
 *     requireOrgRole("ADMIN"),
 *     deleteMemberHandler
 *   );
 */
export function requireOrgRole(...allowedRoles: OrgRole[]) {
  return function orgRoleGuard(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): void {
    if (!req.orgRole || !allowedRoles.includes(req.orgRole)) {
      res.status(403).json({
        success: false,
        error: {
          code:    "INSUFFICIENT_ORG_ROLE",
          message: `This action requires one of: ${allowedRoles.join(", ")}.`,
          your_role: req.orgRole ?? null,
        },
      });
      return;
    }
    next();
  };
}
