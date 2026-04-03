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
import { Router } from "express";
import { generateKey, revokeKey, listKeys, } from "./apiKeyService.js";
import { generateTelemetry } from "./telemetryService.js";
export const adminRouter = Router();
// Valid policy IDs that can be attached to a key (mirrors V12 pacEngine)
const VALID_POLICY_IDS = [
    "FINANCIAL_GRADE",
    "ACADEMIC_INTEGRITY",
    "SOVEREIGN_DEFENSE",
    "GENERIC_BASELINE",
    "TEST_POLICY",
];
// ----------------------------------------------------------------
// GET /api/v1/admin/keys
// Returns all keys for the requesting tenant filtered by x-tenant-id.
// If no tenant header, returns all keys (dev mode only).
// ----------------------------------------------------------------
adminRouter.get("/api/v1/admin/keys", (_req, res) => {
    const tenantId = _req.headers["x-tenant-id"];
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
});
// ----------------------------------------------------------------
// POST /api/v1/admin/keys
// Body: { tenant_id: string, policy_id: string, label?: string }
// Returns: the new key record + plaintext (shown ONCE)
// ----------------------------------------------------------------
adminRouter.post("/api/v1/admin/keys", (req, res) => {
    const { tenant_id, policy_id, label } = req.body;
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
    if (!VALID_POLICY_IDS.includes(policy_id)) {
        res.status(400).json({
            success: false,
            error: {
                code: "INVALID_POLICY",
                message: `policy_id "${policy_id}" is not valid. Allowed: ${VALID_POLICY_IDS.join(", ")}.`,
            },
        });
        return;
    }
    const { plaintext, record } = generateKey(tenant_id.trim(), policy_id, label?.trim() ?? `API Key — ${new Date().toISOString().split("T")[0]}`);
    console.info(`[V19:adminRoutes] Key generated: key_id=${record.key_id} ` +
        `tenant=${tenant_id} policy=${policy_id}`);
    res.status(201).json({
        success: true,
        data: {
            ...record,
            // The plaintext is returned ONCE here. It is never stored.
            plaintext,
        },
        warning: "Store this key securely. It will not be shown again.",
    });
});
// ----------------------------------------------------------------
// DELETE /api/v1/admin/keys/:key_id
// Immediately revokes the key from the in-memory store.
// ----------------------------------------------------------------
adminRouter.delete("/api/v1/admin/keys/:key_id", (req, res) => {
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
});
// ----------------------------------------------------------------
// GET /api/v1/admin/analytics/:tenant_id
// @version V20
// Returns aggregated trust analytics for a specific tenant.
// Supports ?period=7|14|30 for different time windows.
// ----------------------------------------------------------------
adminRouter.get("/api/v1/admin/analytics/:tenant_id", (req, res) => {
    const { tenant_id } = req.params;
    const period = parseInt(req.query["period"] ?? "7", 10);
    const periodDays = [7, 14, 30].includes(period) ? period : 7;
    if (!tenant_id || !tenant_id.trim()) {
        res.status(400).json({
            success: false,
            error: { code: "MISSING_PARAM", message: "tenant_id is required." },
        });
        return;
    }
    const payload = generateTelemetry(tenant_id.trim(), periodDays);
    console.info(`[V20:adminRoutes] Analytics generated: tenant=${tenant_id} ` +
        `period=${periodDays}d requests=${payload.total_requests} ` +
        `threats=${payload.threats_blocked}`);
    res.status(200).json({ success: true, data: payload });
});
import { getAllFrameworksForTenant, toggleFramework, generateAuditReport } from "./complianceService.js";
// ----------------------------------------------------------------
// GET /api/v1/admin/compliance/:tenant_id
// @version V21
// Returns all compliance frameworks and their active status for a tenant.
// ----------------------------------------------------------------
adminRouter.get("/api/v1/admin/compliance/:tenant_id", (req, res) => {
    const { tenant_id } = req.params;
    if (!tenant_id || !tenant_id.trim()) {
        res.status(400).json({ success: false, error: { code: "MISSING_PARAM", message: "tenant_id is required." } });
        return;
    }
    const frameworks = getAllFrameworksForTenant(tenant_id.trim());
    res.status(200).json({ success: true, data: frameworks });
});
// ----------------------------------------------------------------
// POST /api/v1/admin/compliance/:tenant_id/toggle
// @version V21
// Subscribes or unsubscribes a tenant from a compliance framework.
// ----------------------------------------------------------------
adminRouter.post("/api/v1/admin/compliance/:tenant_id/toggle", (req, res) => {
    const { tenant_id } = req.params;
    const { framework_id, active } = req.body;
    if (!tenant_id || !framework_id || typeof active !== "boolean") {
        res.status(400).json({ success: false, error: { code: "INVALID_BODY", message: "tenant_id, framework_id, and active boolean are required." } });
        return;
    }
    try {
        toggleFramework(tenant_id.trim(), framework_id, active);
        res.status(200).json({ success: true, message: `Framework ${framework_id} set to ${active}` });
    }
    catch (e) {
        res.status(400).json({ success: false, error: { code: "TOGGLE_ERROR", message: e.message } });
    }
});
// ----------------------------------------------------------------
// GET /api/v1/admin/compliance/:tenant_id/report
// @version V21
// Generates a mock "Audit Report" JSON string.
// ----------------------------------------------------------------
adminRouter.get("/api/v1/admin/compliance/:tenant_id/report", (req, res) => {
    const { tenant_id } = req.params;
    if (!tenant_id || !tenant_id.trim()) {
        res.status(400).json({ success: false, error: { code: "MISSING_PARAM", message: "tenant_id is required." } });
        return;
    }
    const report = generateAuditReport(tenant_id.trim());
    res.setHeader('Content-disposition', `attachment; filename=audit-report-${tenant_id}-${Date.now()}.json`);
    res.setHeader('Content-type', 'application/json');
    res.status(200).send(report);
});
