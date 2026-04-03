/**
 * @file security/rbacEngine.ts
 * @service router-service
 * @phase Phase 4 — The Enterprise Layer (replaces V65)
 * @description
 *   Capability-Based RBAC — Phase 4 rewrite.
 *
 *   Roles (Phase 4 additions in bold):
 *     OWNER     — Full billing, member management, system access
 *     ADMIN     — Manage members, view all logs/costs
 *     DEVELOPER — Manage API keys, view technical traces         ← NEW
 *     VIEWER    — Read-only access to dashboards
 *     MEMBER    — Legacy alias for DEVELOPER (backward-compat)
 *
 * ================================================================
 * `can(user, action, resource)` convenience helper (Phase 4):
 * ================================================================
 *   A fluent, resource-aware check that co-locates org context
 *   validation with permission checking. All authorization decisions
 *   route through this single function in Phase 4 code.
 *
 *   Usage:
 *     can(req.orgRole, "write:members", { org_id: org.id, req })
 *     // returns { allowed: boolean, reason?: string }
 *
 * ================================================================
 * BACKWARD COMPATIBILITY:
 *   All V65 exports (isAuthorized, parseRole, requirePermission, etc.)
 *   are preserved. Existing route handlers need zero changes.
 * ================================================================
 */

// ── Role enum ─────────────────────────────────────────────────────────────────

export enum Role {
  OWNER     = "OWNER",
  ADMIN     = "ADMIN",
  DEVELOPER = "DEVELOPER",    // Phase 4: replaces MEMBER semantically
  VIEWER    = "VIEWER",
  // Legacy alias — kept for backward compat with V65 API key role mapping
  MEMBER    = "MEMBER",
}

// ── Action namespace ──────────────────────────────────────────────────────────

export type RbacAction =
  // ── Execution ───────────────────────────────────────────────────────────────
  | "execute:llm"
  // ── Observability ───────────────────────────────────────────────────────────
  | "read:telemetry"
  | "read:audit_log"
  | "read:traces"              // Phase 4: developer-level trace access
  // ── Billing ─────────────────────────────────────────────────────────────────
  | "read:billing"
  | "write:billing"
  | "read/write:billing"
  // ── Quota ───────────────────────────────────────────────────────────────────
  | "read:quota"
  | "write:quota"
  // ── Secret Wall / Keys ──────────────────────────────────────────────────────
  | "read:secret_wall"
  | "write:secret_wall"
  | "read:keys"
  | "write:keys"               // Phase 4: DEVELOPER can manage their own keys
  // ── Members & Invites ───────────────────────────────────────────────────────
  | "read:members"
  | "write:members"
  | "write:invites"            // Phase 4: send org invites
  // ── Compliance ──────────────────────────────────────────────────────────────
  | "read:compliance"
  | "write:compliance"
  // ── Workflows ───────────────────────────────────────────────────────────────
  | "read:workflows"
  | "write:workflows"
  // ── Organization ────────────────────────────────────────────────────────────
  | "read:org"                 // Phase 4: view org settings
  | "write:org"                // Phase 4: update org name/slug (OWNER only)
  // ── Marketplace / Market ────────────────────────────────────────────────────
  | "read:market"
  // ── System ──────────────────────────────────────────────────────────────────
  | "admin:system";

// ── Permissions matrix ────────────────────────────────────────────────────────

const PERMISSIONS: Record<Role, ReadonlySet<RbacAction>> = {

  // VIEWER: read-only lens — dashboards, quota, compliance status
  [Role.VIEWER]: new Set<RbacAction>([
    "read:telemetry",
    "read:audit_log",
    "read:quota",
    "read:compliance",
    "read:workflows",
    "read:org",
  ]),

  // MEMBER: legacy alias → same as VIEWER for backward compat
  // (previous V65 MEMBER had execute:llm; DEVELOPER now owns that)
  [Role.MEMBER]: new Set<RbacAction>([
    "execute:llm",
    "read:quota",
    "read:workflows",
    "read:org",
  ]),

  // DEVELOPER: can build — API keys, traces, LLM execution, workflows
  [Role.DEVELOPER]: new Set<RbacAction>([
    "execute:llm",
    "read:telemetry",
    "read:traces",
    "read:audit_log",
    "read:quota",
    "read:keys",
    "write:keys",
    "read:workflows",
    "write:workflows",
    "read:org",
    "read:market",
  ]),

  // ADMIN: operate — member management, all logs, costs visibility
  [Role.ADMIN]: new Set<RbacAction>([
    "execute:llm",
    "read:telemetry",
    "read:traces",
    "read:audit_log",
    "read:quota",
    "read:billing",             // view costs but cannot change billing method
    "read:secret_wall",
    "write:secret_wall",
    "read:members",
    "write:members",
    "write:invites",
    "read:compliance",
    "write:compliance",
    "read:keys",
    "write:keys",
    "read:workflows",
    "write:workflows",
    "read:org",
    "read:market",
  ]),

  // OWNER: unrestricted — all ADMIN + billing control + org settings + system
  [Role.OWNER]: new Set<RbacAction>([
    "execute:llm",
    "read:telemetry",
    "read:traces",
    "read:audit_log",
    "read:billing",
    "write:billing",
    "read/write:billing",
    "read:quota",
    "write:quota",
    "read:secret_wall",
    "write:secret_wall",
    "read:members",
    "write:members",
    "write:invites",
    "read:compliance",
    "write:compliance",
    "read:keys",
    "write:keys",
    "read:workflows",
    "write:workflows",
    "read:org",
    "write:org",
    "read:market",
    "admin:system",
  ]),
};

// ── Core authorization ────────────────────────────────────────────────────────

export function parseRole(raw: string | undefined | null): Role | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper in Role) return upper as Role;
  return null;
}

export function isAuthorized(role: Role | null, action: RbacAction): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.has(action) ?? false;
}

export function getPermissionsForRole(role: Role | null): RbacAction[] {
  if (!role) return [];
  return Array.from(PERMISSIONS[role] ?? []);
}

export function getRolesWithPermission(action: RbacAction): Role[] {
  return (Object.values(Role) as Role[]).filter(
    (r) => PERMISSIONS[r]?.has(action)
  );
}

// ── Role ordering ─────────────────────────────────────────────────────────────

const ROLE_WEIGHT: Record<Role, number> = {
  [Role.VIEWER]:    10,
  [Role.MEMBER]:    15,   // legacy — sits between VIEWER and DEVELOPER
  [Role.DEVELOPER]: 20,
  [Role.ADMIN]:     30,
  [Role.OWNER]:     40,
};

export function isAtLeast(actorRole: Role | null, targetRole: Role): boolean {
  if (!actorRole) return false;
  return (ROLE_WEIGHT[actorRole] ?? 0) >= (ROLE_WEIGHT[targetRole] ?? Infinity);
}

// ── Phase 4: can(user, action, resource) ─────────────────────────────────────

export interface CanResource {
  /** org_id of the resource being accessed */
  org_id?: string | null;
  /** The Express Request, used for org context verification */
  req?: { orgId?: string | null };
}

export interface CanResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Capability check — the single source of truth for Phase 4 authorization.
 *
 * Evaluates BOTH:
 *   1. Role permission (does this role have this action in its matrix?)
 *   2. Org scope (is the resource in the same org as the session?)
 *
 * @example
 *   const { allowed, reason } = can(req.orgRole, "write:members", {
 *     org_id: targetOrgId,
 *     req,
 *   });
 *   if (!allowed) return res.status(403).json({ error: reason });
 */
export function can(
  role:     Role | string | null | undefined,
  action:   RbacAction,
  resource: CanResource = {}
): CanResult {
  // 1. Parse and validate role
  const resolvedRole = typeof role === "string" ? parseRole(role) : role;
  if (!resolvedRole) {
    return { allowed: false, reason: "Unauthenticated: no role present." };
  }

  // 2. Permission matrix check
  if (!isAuthorized(resolvedRole, action)) {
    return {
      allowed: false,
      reason:  `Role '${resolvedRole}' does not have the '${action}' permission.`,
    };
  }

  // 3. Org scope check (if resource.org_id and req context provided)
  if (resource.org_id && resource.req?.orgId) {
    if (resource.org_id !== resource.req.orgId) {
      return {
        allowed: false,
        reason:  "Cross-organization access is not permitted.",
      };
    }
  }

  return { allowed: true };
}

// ── Matrix introspection (V65 compat) ─────────────────────────────────────────

export const PERMISSIONS_MATRIX: Readonly<Record<Role, readonly RbacAction[]>> =
  Object.fromEntries(
    Object.entries(PERMISSIONS).map(([role, set]) => [role, Array.from(set)])
  ) as unknown as Record<Role, readonly RbacAction[]>;
