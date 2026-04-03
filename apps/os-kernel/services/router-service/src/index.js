/**
 * @file index.ts
 * @service router-service
 * @description Router Service entrypoint — The Execution Engine API Gateway.
 *
 * This service sits between the Next.js frontend (Layer 1) and
 * all upstream AI providers. It:
 *   • Receives incoming prompt execution requests
 *   • Authenticates with the Vault Service to retrieve BYOK keys
 *   • Dispatches to the appropriate LLM provider SDK
 *   • Returns structured AI output to the frontend
 *
 * Port: 4000 (internal gateway — not directly public-facing in production)
 * In production, an nginx/ALB layer routes `/api/v1/*` to this service.
 */
import "@streetmp-os/config/env"; // Load root .env — must be first
import express from "express";
import { executionRouter } from "./routes.js";
import { sovereigntyRouter } from "./sovereignty.js";
import { adminRouter } from "./adminRoutes.js";
import { proxyRouter } from "./proxyRoutes.js";
import { verifyRouter } from "./verifyService.js";
const app = express();
// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------
// JSON body parsing — 64kb limit to accommodate large prompts
// while still bounding request amplification risk
app.use(express.json({ limit: "64kb" }));
// Basic security headers
app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    next();
});
// ----------------------------------------------------------------
// REQUEST LOGGING (lightweight, no external dep)
// ----------------------------------------------------------------
app.use((req, _res, next) => {
    const start = Date.now();
    _res.on("finish", () => {
        console.log(`[RouterService] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
});
// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req, res) => {
    res.status(200).json({
        service: "router-service",
        status: "ok",
        timestamp: new Date().toISOString(),
    });
});
app.use(executionRouter);
// ----------------------------------------------------------------
// SOVEREIGNTY ROUTES (V7 — Shard Custody & HYOK)
// ----------------------------------------------------------------
app.use(sovereigntyRouter);
// ----------------------------------------------------------------
// ADMIN ROUTES (V19 — API Key Management)
// ----------------------------------------------------------------
app.use("/api/v1/admin", adminRouter);
// ----------------------------------------------------------------
// PROXY ROUTES (V26 — Drop-In OpenAI-Compatible Proxy)
// Mount at /api/proxy/openai → exposes /v1/chat/completions
// SDK baseURL: http://localhost:4000/api/proxy/openai
// ----------------------------------------------------------------
app.use("/api/proxy/openai", proxyRouter);
app.use("/api/v1/verify", verifyRouter);
// ----------------------------------------------------------------
// 404 HANDLER
// ----------------------------------------------------------------
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: "The requested endpoint does not exist on this service.",
        },
    });
});
// ----------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ----------------------------------------------------------------
app.use((err, req, res, _next) => {
    if (err?.status === 413 || err?.type === "entity.too.large" || err?.message?.toLowerCase().includes("too large")) {
        console.warn(`[RouterServiceEdge] 413 Payload Too Large from ${req.ip}`);
        return res.status(413).json({
            error: {
                message: "Payload too large. Maximum size is 64kb.",
                type: "client_error",
                code: "payload_too_large"
            }
        });
    }
    console.error("[RouterService] Unhandled error:", err.message, err.stack);
    res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected internal error occurred.",
        },
    });
});
// ----------------------------------------------------------------
// SERVER STARTUP
// ----------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? "4000", 10);
app.listen(PORT, () => {
    console.log(`[RouterService] ✅  Listening on port ${PORT}`);
    console.log(`[RouterService]     Execution:   POST http://localhost:${PORT}/api/v1/execute`);
    console.log(`[RouterService]     Proxy(V26):  POST http://localhost:${PORT}/api/proxy/openai/v1/chat/completions`);
    console.log(`[RouterService]     Models(V26): GET  http://localhost:${PORT}/api/proxy/openai/v1/models`);
    console.log(`[RouterService]     Revoke:      POST http://localhost:${PORT}/api/v1/sovereignty/revoke`);
    console.log(`[RouterService]     KMS Link:    POST http://localhost:${PORT}/api/v1/sovereignty/kms/link`);
    console.log(`[RouterService]     Health:      GET  http://localhost:${PORT}/health`);
    console.log(`[RouterService]     Vault upstream: ${process.env.VAULT_SERVICE_URL ?? "http://localhost:4002"}`);
});
export default app;
