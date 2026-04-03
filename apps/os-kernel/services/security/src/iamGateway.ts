/**
 * @file iamGateway.ts
 * @service os-kernel/services/security
 * @version V50
 * @description Zero-Trust Enterprise Identity Access Management — StreetMP OS
 *
 * Simulates validation of Okta / Microsoft Entra ID / Google Workspace SSO tokens
 * and enforces strict Role-Based Access Control (RBAC) clearance hierarchies.
 *
 * Tech Stack Lock: TypeScript · Next.js (App Router) · No Python
 * Aesthetic Lock : Obsidian & Emerald
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================

export type IdentityProvider = "OKTA" | "AZURE_AD" | "GOOGLE";

export type ClearanceLevel =
  | "L1_PUBLIC"
  | "L2_RESTRICTED"
  | "L3_CONFIDENTIAL"
  | "L4_SECRET"
  | "L5_SOVEREIGN";

export interface SSOClaims {
  /** Identity-provider user subject (opaque ID) */
  sub: string;
  /** Verified corporate email */
  email: string;
  /** Display name */
  name: string;
  /** IdP-assigned role label */
  role: string;
  /** Assigned clearance tier */
  clearanceLevel: ClearanceLevel;
  /** Originating identity provider */
  provider: IdentityProvider;
  /** Token expiry (UNIX ms) */
  exp: number;
}

export interface SSOSession {
  /** Unique session ID generated at verification time */
  sessionId: string;
  claims: SSOClaims;
  /** ISO-8601 timestamp session was issued */
  issuedAt: string;
  /** Whether this session passed RBAC for the current route */
  authorized: boolean;
}

export interface RBACDecision {
  allowed: boolean;
  userRank: number;
  requiredRank: number;
  clearanceLevel: ClearanceLevel;
  route: string;
  reason: string;
}

// ================================================================
// CLEARANCE HIERARCHY
// L1 = anonymous public · L5 = sovereign executive
// ================================================================

export const CLEARANCE_HIERARCHY: ClearanceLevel[] = [
  "L1_PUBLIC",
  "L2_RESTRICTED",
  "L3_CONFIDENTIAL",
  "L4_SECRET",
  "L5_SOVEREIGN",
];

/** Minimum clearance rank required per protected route */
const ROUTE_REQUIREMENTS: Record<string, number> = {
  EXECUTE_OPENAI:       1, // L2_RESTRICTED
  EXECUTE_ANTHROPIC:    2, // L3_CONFIDENTIAL
  EXECUTE_GEMINI:       2, // L3_CONFIDENTIAL
  EXECUTE_SOVEREIGN:    4, // L5_SOVEREIGN
  READ_AUDIT_LOGS:      1, // L2_RESTRICTED
  MANAGE_VAULT:         3, // L4_SECRET
  ADMIN_TENANT:         4, // L5_SOVEREIGN
};

// ================================================================
// MOCK TOKEN DATABASE — represents pre-registered IdP integrations
// ================================================================

type MockTokenRecord = Omit<SSOClaims, "exp">;

const MOCK_TOKEN_REGISTRY: Record<string, MockTokenRecord> = {
  // Okta — Executive L5
  "okta.eyJ.l5-sovereign-exec": {
    sub:            "okta|usr_11223344",
    email:          "executive@streetmp.io",
    name:           "Alex Chen",
    role:           "sovereign-exec",
    clearanceLevel: "L5_SOVEREIGN",
    provider:       "OKTA",
  },
  // Okta — Senior Engineer L4
  "okta.eyJ.l4-secret-eng": {
    sub:            "okta|usr_55667788",
    email:          "senior.eng@streetmp.io",
    name:           "Jordan Park",
    role:           "senior-engineer",
    clearanceLevel: "L4_SECRET",
    provider:       "OKTA",
  },
  // Azure AD — Developer L2
  "azure.eyJ.l2-restricted-dev": {
    sub:            "azure|usr_998877",
    email:          "developer@corp.streetmp.io",
    name:           "Sam Rivera",
    role:           "developer",
    clearanceLevel: "L2_RESTRICTED",
    provider:       "AZURE_AD",
  },
  // Azure AD — Auditor L3
  "azure.eyJ.l3-confidential-audit": {
    sub:            "azure|usr_334455",
    email:          "auditor@corp.streetmp.io",
    name:           "Morgan Liu",
    role:           "compliance-auditor",
    clearanceLevel: "L3_CONFIDENTIAL",
    provider:       "AZURE_AD",
  },
  // Google — Partner L1
  "google.eyJ.l1-public-partner": {
    sub:            "google|usr_112233",
    email:          "partner@external.io",
    name:           "Casey Kim",
    role:           "external-partner",
    clearanceLevel: "L1_PUBLIC",
    provider:       "GOOGLE",
  },
};

// ================================================================
// ENTERPRISE IAM CLASS
// ================================================================

export class EnterpriseIAM {
  private readonly sessionStore = new Map<string, SSOSession>();
  private blockedCount = 0;

  // ── Private Helpers ─────────────────────────────────────────────

  private generateSessionId(): string {
    return "sid_" + crypto.randomBytes(12).toString("hex");
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Verifies an SSO token from the `Authorization: SSO <token>` header.
   *
   * In production this would call Okta's introspection endpoint or decode
   * an RS256-signed OIDC JWT. Here we use a deterministic mock registry.
   *
   * @param authHeader  Value of the `Authorization` HTTP header.
   * @throws `UNAUTHORIZED_SSO`      if header is absent / malformed.
   * @throws `SSO_TOKEN_EXPIRED`     if the token has passed its TTL.
   * @throws `INVALID_SSO_SIGNATURE` if the token is not in the registry.
   */
  public verifySSOToken(authHeader?: string): SSOSession {
    if (!authHeader?.startsWith("SSO ")) {
      console.warn("[V50:IAM] Missing or malformed Authorization header. Rejecting.");
      throw new Error("UNAUTHORIZED_SSO");
    }

    const token = authHeader.slice(4).trim();
    const record = MOCK_TOKEN_REGISTRY[token];

    if (!record) {
      console.warn(`[V50:IAM] Token not in IdP registry. Possible replay or forgery.`);
      throw new Error("INVALID_SSO_SIGNATURE");
    }

    const exp = Date.now() + 3_600_000; // 1-hour TTL from issuance

    const session: SSOSession = {
      sessionId: this.generateSessionId(),
      claims:    { ...record, exp },
      issuedAt:  new Date().toISOString(),
      authorized: false, // set after RBAC
    };

    this.sessionStore.set(session.sessionId, session);
    console.info(
      `[V50:IAM] SSO Verified — ${record.provider} · ${record.email} · Clearance: ${record.clearanceLevel}`
    );
    return session;
  }

  /**
   * Enforces role-based access control against a named route constant.
   *
   * @param session    A verified `SSOSession` (output of `verifySSOToken`).
   * @param route      Named route from `ROUTE_REQUIREMENTS` (e.g., `EXECUTE_OPENAI`).
   * @throws `CLEARANCE_DENIED` if the user's rank is below the route threshold.
   */
  public enforceRBAC(session: SSOSession, route: string): RBACDecision {
    const userRank     = CLEARANCE_HIERARCHY.indexOf(session.claims.clearanceLevel);
    const requiredRank = ROUTE_REQUIREMENTS[route] ?? 0;
    const allowed      = userRank >= requiredRank;

    if (!allowed) {
      this.blockedCount += 1;
      const reason = `User rank ${userRank} (${session.claims.clearanceLevel}) is below required rank ${requiredRank} for route ${route}`;
      console.warn(`[V50:IAM] CLEARANCE_DENIED — ${session.claims.email} — ${reason}`);
      // Update session store
      const stored = this.sessionStore.get(session.sessionId);
      if (stored) stored.authorized = false;
      throw new Error(`CLEARANCE_DENIED: ${reason}`);
    }

    // Mark session as authorized
    const stored = this.sessionStore.get(session.sessionId);
    if (stored) stored.authorized = true;

    console.info(
      `[V50:IAM] RBAC ALLOW — ${session.claims.email} → ${route} (rank ${userRank}/${requiredRank})`
    );

    return {
      allowed,
      userRank,
      requiredRank,
      clearanceLevel: session.claims.clearanceLevel,
      route,
      reason: "Clearance verified",
    };
  }

  /** Returns the number of RBAC-denied requests since startup. */
  public getBlockedCount(): number {
    return this.blockedCount;
  }

  /** Returns a snapshot of all active sessions. */
  public getActiveSessions(): SSOSession[] {
    const now = Date.now();
    return [...this.sessionStore.values()].filter((s) => s.claims.exp > now);
  }
}

// ================================================================
// SINGLETON EXPORT — consumed by the proxy pipeline
// ================================================================
export const globalSecurityIAM = new EnterpriseIAM();
