/**
 * @file adminRoutes.ts
 * @service router-service
 * @version V19
 * @description Enterprise Admin API — API Key & Policy Management
 *
 * Endpoints:
 *   GET    /api/v1/admin/keys         — List all keys for the authenticated tenant
 *   POST   /api/v1/admin/keys         — Generate a new API key
 *   DELETE /api/v1/admin/keys/:key_id — Revoke a key immediately
 *
 * Auth: These routes require a valid session token (x-internal-token)
 * or are scoped by x-tenant-id header (injected by apiAuthMiddleware).
 * In production, add RBAC so only "admin" role can call these routes.
 */

import { Router, Request, Response } from "express";
import {
  generateKey,
  validateKey,
  revokeKey,
  listKeys,
  type ApiKeyRecord,
} from "./apiKeyService.js";
import { generateTelemetry } from "./telemetryService.js";
import { getUsageAnalytics } from "./analyticsController.js";
import { getTraceTimeline } from "./traceController.js";
import { requirePermission, injectSessionRole } from "./middleware/rbacGuard.js";
// Lazy load globalOpsAgent inside the route to break ESM circular dependency
import { gpuManager } from "./hardware/gpuManager.js";

export const adminRouter = Router();

// ----------------------------------------------------------------
// GET /api/v1/admin/analytics/usage
// @version V61 — Telemetry Engine
// @version V65 — RBAC: read:telemetry (VIEWER, ADMIN, OWNER)
// Admin-gated: aggregates per-tenant token burn from Redis quota store.
// Requires x-admin-secret header matching STREETMP_ADMIN_SECRET.
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/admin/analytics/usage",
  injectSessionRole,
  requirePermission("read:telemetry"),
  getUsageAnalytics
);

// ----------------------------------------------------------------
// GET /api/v1/admin/trace/:traceId
// @version V70 — Correlation Trace Engine
// @version V65 — RBAC: read:telemetry (VIEWER, ADMIN, OWNER)
// Returns the full V70 event timeline for a specific request ID.
// Requires x-admin-secret header matching STREETMP_ADMIN_SECRET.
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/admin/trace/:traceId",
  injectSessionRole,
  requirePermission("read:telemetry"),
  getTraceTimeline
);

// Valid policy IDs that can be attached to a key (mirrors V12 pacEngine)
const VALID_POLICY_IDS = [
  "FINANCIAL_GRADE",
  "ACADEMIC_INTEGRITY",
  "SOVEREIGN_DEFENSE",
  "GENERIC_BASELINE",
  "TEST_POLICY",
] as const;

// ----------------------------------------------------------------
// GET /api/v1/admin/keys
// @version V65 — RBAC: read:keys (ADMIN, OWNER)
// Returns all keys for the requesting tenant filtered by x-tenant-id.
// If no tenant header, returns all keys (dev mode only).
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/admin/keys",
  injectSessionRole,
  requirePermission("read:keys"),
  (_req: Request, res: Response): void => {
    const tenantId = _req.headers["x-tenant-id"] as string | undefined;

    const all = listKeys();
    const keys = tenantId
      ? all.filter((k) => k.tenant_id === tenantId)
      : all; // dev mode — return all

    res.status(200).json({
      success: true,
      data: keys,
      meta: {
        total: keys.length,
        tenant: tenantId ?? "all",
      },
    });
  }
);

// ----------------------------------------------------------------
// POST /api/v1/admin/keys
// @version V65 — RBAC: write:keys (ADMIN, OWNER)
// Body: { tenant_id: string, policy_id: string, label?: string }
// Returns: the new key record + plaintext (shown ONCE)
// ----------------------------------------------------------------
adminRouter.post(
  "/api/v1/admin/keys",
  injectSessionRole,
  requirePermission("write:keys"),
  (req: Request, res: Response): void => {
    const { tenant_id, policy_id, label } = req.body as {
      tenant_id?: string;
      policy_id?: string;
      label?: string;
    };

    // --- Validation ---
    if (!tenant_id || typeof tenant_id !== "string" || !tenant_id.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "tenant_id is required." },
      });
      return;
    }

    if (!policy_id || typeof policy_id !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "policy_id is required." },
      });
      return;
    }

    if (!(VALID_POLICY_IDS as readonly string[]).includes(policy_id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_POLICY",
          message: `policy_id "${policy_id}" is not valid. Allowed: ${VALID_POLICY_IDS.join(", ")}.`,
        },
      });
      return;
    }

    const { plaintext, record } = generateKey(
      tenant_id.trim(),
      policy_id,
      label?.trim() ?? `API Key — ${new Date().toISOString().split("T")[0]}`
    );

    console.info(
      `[V19:adminRoutes] Key generated: key_id=${record.key_id} ` +
        `tenant=${tenant_id} policy=${policy_id}`
    );

    res.status(201).json({
      success: true,
      data: {
        ...record,
        // The plaintext is returned ONCE here. It is never stored.
        plaintext,
      },
      warning:
        "Store this key securely. It will not be shown again.",
    });
  }
);

// ----------------------------------------------------------------
// DELETE /api/v1/admin/keys/:key_id
// @version V65 — RBAC: write:keys (ADMIN, OWNER)
// Immediately revokes the key from the in-memory store.
// ----------------------------------------------------------------
adminRouter.delete(
  "/api/v1/admin/keys/:key_id",
  injectSessionRole,
  requirePermission("write:keys"),
  (req: Request, res: Response): void => {
    const { key_id } = req.params;

    if (!key_id) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "key_id is required." },
      });
      return;
    }

    const revoked = revokeKey(key_id);

    if (!revoked) {
      res.status(404).json({
        success: false,
        error: {
          code: "KEY_NOT_FOUND",
          message: `No active key found for key_id="${key_id}".`,
        },
      });
      return;
    }

    console.info(`[V19:adminRoutes] Key revoked: key_id=${key_id}`);

    res.status(200).json({
      success: true,
      message: `Key ${key_id} has been permanently revoked.`,
    });
  }
);

// ----------------------------------------------------------------
// GET /api/v1/admin/analytics/:tenant_id
// @version V20
// @version V65 — RBAC: read:telemetry (VIEWER, ADMIN, OWNER)
// Returns aggregated trust analytics for a specific tenant.
// Supports ?period=7|14|30 for different time windows.
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/admin/analytics/:tenant_id",
  injectSessionRole,
  requirePermission("read:telemetry"),
  (req: Request, res: Response): void => {
    const { tenant_id } = req.params;
    const period = parseInt((req.query["period"] as string | undefined) ?? "7", 10);
    const periodDays = [7, 14, 30].includes(period) ? period : 7;

    if (!tenant_id || !tenant_id.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "tenant_id is required." },
      });
      return;
    }

    const payload = generateTelemetry(tenant_id.trim(), periodDays);

    console.info(
      `[V20:adminRoutes] Analytics generated: tenant=${tenant_id} ` +
        `period=${periodDays}d requests=${payload.total_requests} ` +
        `threats=${payload.threats_blocked}`
    );

    res.status(200).json({ success: true, data: payload });
  }
);

import { getAllFrameworksForTenant, toggleFramework, generateAuditReport } from "./complianceService.js";
import { pool } from "./db.js";

// ----------------------------------------------------------------
// GET /api/v1/admin/compliance/:tenant_id
// @version V21
// @version V65 — RBAC: read:compliance (VIEWER, ADMIN, OWNER)
// Returns all compliance frameworks and their active status for a tenant.
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/admin/compliance/:tenant_id",
  injectSessionRole,
  requirePermission("read:compliance"),
  (req: Request, res: Response): void => {
    const { tenant_id } = req.params;
    if (!tenant_id || !tenant_id.trim()) {
      res.status(400).json({ success: false, error: { code: "MISSING_PARAM", message: "tenant_id is required." } });
      return;
    }
    const frameworks = getAllFrameworksForTenant(tenant_id.trim());
    res.status(200).json({ success: true, data: frameworks });
  }
);

// ----------------------------------------------------------------
// POST /api/v1/admin/compliance/:tenant_id/toggle
// @version V21
// @version V65 — RBAC: write:compliance (ADMIN, OWNER)
// Subscribes or unsubscribes a tenant from a compliance framework.
// ----------------------------------------------------------------
adminRouter.post(
  "/api/v1/admin/compliance/:tenant_id/toggle",
  injectSessionRole,
  requirePermission("write:compliance"),
  (req: Request, res: Response): void => {
    const { tenant_id } = req.params;
    const { framework_id, active } = req.body as { framework_id?: string; active?: boolean };

    if (!tenant_id || !framework_id || typeof active !== "boolean") {
      res.status(400).json({ success: false, error: { code: "INVALID_BODY", message: "tenant_id, framework_id, and active boolean are required." } });
      return;
    }

    try {
      toggleFramework(tenant_id.trim(), framework_id, active);
      res.status(200).json({ success: true, message: `Framework ${framework_id} set to ${active}` });
    } catch (e: any) {
      res.status(400).json({ success: false, error: { code: "TOGGLE_ERROR", message: e.message } });
    }
  }
);

// ----------------------------------------------------------------
// GET /api/v1/admin/compliance/:tenant_id/report
// @version V21
// @version V65 — RBAC: read:audit_log (ADMIN, OWNER)
// Generates a mock "Audit Report" JSON string.
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/admin/compliance/:tenant_id/report",
  injectSessionRole,
  requirePermission("read:audit_log"),
  (req: Request, res: Response): void => {
    const { tenant_id } = req.params;
    if (!tenant_id || !tenant_id.trim()) {
      res.status(400).json({ success: false, error: { code: "MISSING_PARAM", message: "tenant_id is required." } });
      return;
    }

    const report = generateAuditReport(tenant_id.trim());
    res.setHeader('Content-disposition', `attachment; filename=audit-report-${tenant_id}-${Date.now()}.json`);
    res.setHeader('Content-type', 'application/json');
    res.status(200).send(report);
  }
);

// ----------------------------------------------------------------
// POST /api/v1/admin/ops/query
// @version V98 — Ops Agent
// @version V65 — RBAC: read:telemetry / Support (ADMIN, OWNER)
// Invokes the Ops Agent to respond to queries or resolve tickets using system metrics.
// ----------------------------------------------------------------
adminRouter.post(
  "/api/v1/admin/ops/query",
  injectSessionRole,
  requirePermission("read:telemetry"), // Using read:telemetry as a proxy for Ops access, or we wait for RBAC Owner specific checks. The user role is additionally checked inside OpsAgent.
  async (req: Request, res: Response): Promise<void> => {
    const { query, ticketContent } = req.body as { query?: string; ticketContent?: string };
    const userRole = (req as any).userRole || "ADMIN"; // Simplified for now; relies on injectSessionRole adding user role or defaults to ADMIN in dev.

    try {
      const { globalOpsAgent } = await import("../../ops-agent/src/opsAgent.js");
      if (ticketContent) {
        // Resolve a ticket
        const result = await globalOpsAgent.resolveTicket(ticketContent, userRole);
        res.status(200).json({ success: true, data: result });
      } else if (query) {
        // Answer a natural language query
        const result = await globalOpsAgent.query(query, userRole);
        res.status(200).json({ success: true, data: result });
      } else {
        res.status(400).json({ success: false, error: "Must specify query or ticketContent" });
      }
    } catch (e: any) {
      console.error(`[V98:OpsAgent] Route error: ${e.message}`);
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// ----------------------------------------------------------------
// GET /api/v1/health/gpu
// @version V100-MAX — Ironclad Edition
// Requires ADMIN/OWNER telemetry read role
// Returns real-time GPU VRAM and temperature metrics.
// ----------------------------------------------------------------
adminRouter.get(
  "/api/v1/health/gpu",
  injectSessionRole,
  requirePermission("read:telemetry"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await gpuManager.getMetrics();
      res.status(200).json({ success: true, data: metrics });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// ================================================================
// DELETE /api/v1/admin/workspace/:workspace_id/purge
// @version Phase1-GDPR-01 — GDPR Art.17 Workspace Erasure
// ================================================================
// Permanently deletes ALL data belonging to a workspace/tenant:
//   • PostgreSQL: execution_logs, audit_ledger, vault_keys (tenant rows)
//   • In-memory: API key registry, tenant config
//   • Redis: session keys (via redisClient), semantic cache (cache:*)
//
// Security:
//   • Protected by adminSecretGuard mounted on /api/v1/admin/* (index.ts)
//   • Requires confirm_token=DELETE_WORKSPACE_PERMANENTLY in JSON body
//   • Idempotent — deleting a non-existent workspace returns 200 w/ notice
//   • Full deletion event logged to stdout → external log aggregator
//
// Auth: x-admin-secret header required (enforced above this router by
//       the adminSecretGuard middleware mounted in index.ts)
// ================================================================
adminRouter.delete(
  "/api/v1/admin/workspace/:workspace_id/purge",
  async (req: Request, res: Response): Promise<void> => {
    const { workspace_id } = req.params;
    const { confirm_token, reason } = req.body as {
      confirm_token?: string;
      reason?:        string;
    };

    // ── Safety: confirmation token ─────────────────────────────
    if (confirm_token !== "DELETE_WORKSPACE_PERMANENTLY") {
      res.status(400).json({
        success: false,
        error: {
          code:    "CONFIRMATION_REQUIRED",
          message: "confirm_token must equal 'DELETE_WORKSPACE_PERMANENTLY'.",
        },
      });
      return;
    }

    if (!workspace_id || !workspace_id.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "workspace_id is required." },
      });
      return;
    }

    const workspaceId  = workspace_id.trim().toLowerCase();
    const safeReason   = (typeof reason === "string" && reason.trim())
      ? reason.trim().slice(0, 500)
      : "No reason provided";
    const deletedAt    = new Date().toISOString();
    const redactionId  = `SRV-GDPR-${Date.now()}`;

    console.warn(
      `[Phase1:GDPR] 🗑️  ROUTER-SERVICE PURGE INITIATED
       workspace_id: ${workspaceId}
       reason      : ${safeReason}
       initiated_at: ${deletedAt}
       redaction_id: ${redactionId}`
    );

    const errors: string[] = [];
    const purgedLayers: string[] = [];

    // ── 1. PostgreSQL: delete tenant execution logs ─────────────
    try {
      await pool.query(
        `DELETE FROM execution_logs WHERE tenant_id = $1`,
        [workspaceId]
      );
      purgedLayers.push("execution_logs");
    } catch (err: any) {
      // Table may not exist in all deployments — non-fatal
      if (!err.message?.includes("does not exist")) {
        errors.push(`execution_logs: ${err.message}`);
      }
    }

    // ── 2. PostgreSQL: delete audit ledger rows ─────────────────
    try {
      await pool.query(
        `DELETE FROM audit_ledger WHERE workspace_id = $1 OR tenant_id = $1`,
        [workspaceId]
      );
      purgedLayers.push("audit_ledger");
    } catch (err: any) {
      if (!err.message?.includes("does not exist")) {
        errors.push(`audit_ledger: ${err.message}`);
      }
    }

    // ── 3. PostgreSQL: delete vault keys ────────────────────────
    try {
      await pool.query(
        `DELETE FROM vault_keys WHERE tenant_id = $1`,
        [workspaceId]
      );
      purgedLayers.push("vault_keys");
    } catch (err: any) {
      if (!err.message?.includes("does not exist")) {
        errors.push(`vault_keys: ${err.message}`);
      }
    }

    // ── 4. PostgreSQL: delete API keys ──────────────────────────
    try {
      await pool.query(
        `DELETE FROM api_keys WHERE tenant_id = $1`,
        [workspaceId]
      );
      purgedLayers.push("api_keys_db");
    } catch (err: any) {
      if (!err.message?.includes("does not exist")) {
        errors.push(`api_keys_db: ${err.message}`);
      }
    }

    // ── 5. Redis: purge session and cache keys ───────────────────
    try {
      // Dynamic import to avoid circular dep
      const { getSharedRedisClient } = await import("./redisClient.js");
      const client = getSharedRedisClient();
      if (client) {
        // Scan for all keys matching this workspace
        const pattern = `*${workspaceId}*`;
        let cursor = "0";
        let keysDeleted = 0;
        do {
          const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await client.del(...keys);
            keysDeleted += keys.length;
          }
        } while (cursor !== "0");

        purgedLayers.push(`redis_keys(${keysDeleted})`);
      } else {
        purgedLayers.push("redis_keys(skipped—no_client)");
      }
    } catch (err: any) {
      errors.push(`redis: ${err.message}`);
    }

    // ── 6. In-memory: revoke all API keys for this workspace ─────
    try {
      const { listKeys, revokeKey } = await import("./apiKeyService.js");
      const allKeys = listKeys();
      let revokedCount = 0;
      for (const key of allKeys) {
        if (key.tenant_id === workspaceId) {
          revokeKey(key.key_id);
          revokedCount++;
        }
      }
      purgedLayers.push(`api_key_registry(${revokedCount})`);
    } catch (err: any) {
      errors.push(`api_key_registry: ${err.message}`);
    }

    console.warn(
      `[Phase1:GDPR] ✅ ROUTER-SERVICE PURGE COMPLETE
       workspace_id: ${workspaceId}
       redaction_id: ${redactionId}
       purged_layers: ${purgedLayers.join(", ")}
       errors: ${errors.length > 0 ? errors.join("; ") : "none"}
       deleted_at: ${deletedAt}`
    );

    const response: Record<string, unknown> = {
      success:      true,
      redaction_id: redactionId,
      workspace_id: workspaceId,
      deleted_at:   deletedAt,
      purged_layers: purgedLayers,
      message:
        `Workspace "${workspaceId}" data has been permanently erased from the router-service layer. ` +
        `Redaction ID: ${redactionId}.`,
    };

    if (errors.length > 0) {
      response.warnings = errors;
      response.message  = (response.message as string) +
        ` Some layers had errors (see warnings) — manual verification recommended.`;
    }

    res.status(200).json(response);
  }
);
