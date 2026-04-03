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

import "./instrument.js"; // [Phase 2] Sentry — must be first import
import "@streetmp-os/config/env"; // Load root .env — must be after Sentry init

const REQUIRED_ENV = [
  "STRIPE_SECRET_KEY",
  "DATABASE_URL",
  "VAULT_SERVICE_URL",
  "STREETMP_ADMIN_SECRET"
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`CRITICAL STARTUP HALT: Missing required environment variable \${key}`);
  }
}

import { Sentry } from "./instrument.js";
import express, { Request, Response, NextFunction } from "express";
import { executionRouter, apiAuthMiddleware } from "./routes.js";
import { sovereigntyRouter } from "./sovereignty.js";
import { adminRouter } from "./adminRoutes.js";
import { proxyRouter } from "./proxyRoutes.js";
import { verifyRouter } from "./verifyService.js";
import { runRetentionSweep } from "./services/retentionSweeper.js";
import { traceProviderMiddleware } from "./middleware/traceProvider.js";
import { adminSecretGuard } from "./middleware/adminSecretGuard.js";
import { getSharedRedisClient, closeSharedRedisClient } from "./redisClient.js";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { startAgentWorker, stopAgentWorker, closeQueueConnection } from "./workers/agentWorker.js";
import { startCronDaemon, stopCronDaemon } from "./services/cronScheduler.js";
import { scannerRouter }         from "./controllers/scannerController.js";
import { verificationRouter }    from "./controllers/verificationController.js";
import { legalRouter }           from "./controllers/legalController.js";
import { webhookRouter }         from "./controllers/webhookController.js";
// [Phase 3] Sentinel Layer — Agentic Core
import { startSentinelRunner, stopSentinelRunner } from "./sentinel/sentinelRunner.js";
// [Phase 3.2] Sentinel-02 — Firewall Guard
import { firewallGuard } from "./middleware/firewallGuard.js";
// [Phase 6] Titan Hardening — Ctrl Route Guard + PII-Safe Logger
import { ctrlRouteGuard, adminTombstone, CTRL_PREFIX } from "./middleware/ctrlRouteGuard.js";
import { piiSafeRequestLogger, titanLogStream } from "./utils/logger.js";
import { getOrganizations, getThreatEvents, getRevenueStats, suspendOrg, blockIp, upgradeOrg, setMaintenanceMode, pushPolicy, getChurnWarning } from "./controllers/titanController.js";
import { runTitanBackup, runV1Audit } from "./controllers/overrideController.js";
import { WebSocketServer } from "ws";
// [Phase 7] Titan 3.0 Sidecar Bridge
import { bridgeGuard } from "./middleware/bridgeGuard.js";
import { generateImpersonationToken } from "./controllers/impersonationController.js";
import { getInfraPulse } from "./controllers/healthController.js";

const app = express();

// ----------------------------------------------------------------
// [Phase1-INFRA-01] REDIS INITIALIZATION
// Connect eagerly so rate-limiter benefits from Redis on first request.
// All failures are non-fatal — service continues without Redis.
// ----------------------------------------------------------------
getSharedRedisClient();

// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------

// JSON body parsing — 64kb limit to accommodate large prompts
// while still bounding request amplification risk
app.use(express.json({ limit: "64kb" }));

// ---- [V70] Correlation Trace Engine ----
// Must be first middleware: seeds req.traceId + x-streetmp-trace-id header
// before any route handler, DLP, or auth middleware runs.
app.use(traceProviderMiddleware);

// ---- [Phase 3.2] Firewall Guard ----
// Must come AFTER traceProviderMiddleware (has traceId) but BEFORE all routes,
// rate limiters, and auth. Blocks IP-blacklisted requests with 403 immediately.
app.use(firewallGuard);

// ---- CORS Lockdown ----
app.use(cors({
  origin: ["http://localhost:3000", "http://187.127.131.212:3000", "https://os.streetmp.com"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// ---- Rate Limiting Configuration ----
// [Phase1-INFRA-01] Redis-backed rate limiting.
// When Redis is available, counters are shared across all instances.
// Falls back to in-memory if Redis is offline (single-host safe).

/**
 * Builds a rate-limit store that uses Redis when available,
 * falling back to the default in-memory store.
 */
function buildRateLimitStore() {
  const client = getSharedRedisClient();
  if (!client) return undefined; // undefined = default in-memory store

  // Dynamically require rate-limit-redis only if we have a client.
  // rate-limit-redis is an optional dep — guard the require.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RedisStore } = require("rate-limit-redis") as {
      RedisStore: new (opts: { sendCommand: (...args: string[]) => Promise<number> }) => object
    };
    return new RedisStore({
      sendCommand: (...args: string[]) => (client as any).sendCommand(args),
    });
  } catch {
    console.warn(
      "[Phase1:RateLimit] rate-limit-redis not installed — using in-memory store. " +
      "Run: npm install rate-limit-redis"
    );
    return undefined;
  }
}

const _rateLimitStore = buildRateLimitStore();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // catching all IPs
  standardHeaders: true,
  legacyHeaders: false,
  ...((_rateLimitStore) ? { store: _rateLimitStore as any } : {}),
  message: { error: "Global rate limit exceeded (200 req/15min). Please slow down." }
});

// [Stage 4] Global catch-all DDoS net applied before ANY routes
app.use(globalLimiter);

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  ...((_rateLimitStore) ? { store: _rateLimitStore as any } : {}),
  message: { error: "Too many authentication requests, please try again later." }
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each API Key to 60 requests per window
  keyGenerator: (req: Request) => {
    return (req.headers["x-api-key"] as string) || req.ip || "unknown";
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...((_rateLimitStore) ? { store: _rateLimitStore as any } : {}),
  message: { error: "API Key rate limit exceeded (60 req/min). Please slow down." }
});

const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Admin endpoints: tighter limit
  standardHeaders: true,
  legacyHeaders: false,
  ...((_rateLimitStore) ? { store: _rateLimitStore as any } : {}),
  message: { error: "Admin API rate limit exceeded. Please slow down." }
});

// Basic security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ----------------------------------------------------------------
// REQUEST LOGGING — [Phase 6] PII-safe structured logger
// Replaces raw console.log. No emails/keys/GSTINs ever hit disk.
// ----------------------------------------------------------------
app.use(piiSafeRequestLogger);

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "router-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// V95 SYSTEM HEALTH MONITOR API
// ----------------------------------------------------------------
// GET /api/v1/admin/system-health
// Auth: x-admin-secret header (STREETMP_ADMIN_SECRET)
// Returns live snapshot from the self-healing monitor service.
// ----------------------------------------------------------------
app.get("/api/v1/admin/system-health", (req: Request, res: Response) => {
  const adminSecret   = req.headers["x-admin-secret"];
  const expectedSecret = process.env.STREETMP_ADMIN_SECRET;

  if (!expectedSecret || adminSecret !== expectedSecret) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    // Lazy-require to avoid circular dep at startup — monitor may not be co-located
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSystemHealthSnapshot } = require("./services/monitor/healthMonitor") as
      { getSystemHealthSnapshot: () => Record<string, unknown> };
    const snapshot = getSystemHealthSnapshot();
    res.status(200).json({ success: true, data: snapshot });
  } catch {
    // Monitor service not running — return degraded status
    res.status(200).json({
      success: true,
      data: {
        overallStatus:    "DEGRADED",
        uptimePercent:    null,
        monitorStartedAt: null,
        generatedAt:      new Date().toISOString(),
        services:         {},
        openIncidents:    [],
        recentIncidents:  [],
        totalSecondsDown: 0,
        _note:            "Monitor service not loaded. Start apps/os-kernel/services/monitor.",
      },
    });
  }
});

app.use(executionRouter);

// ----------------------------------------------------------------
// SOVEREIGNTY ROUTES (V7 — Shard Custody & HYOK)
// ----------------------------------------------------------------
app.use(sovereigntyRouter);

// ----------------------------------------------------------------
// ADMIN TOMBSTONE — [Phase 6] Returns 404 on old /api/v1/admin
// paths to prevent path enumeration. No redirect.
// ----------------------------------------------------------------
app.all("/api/v1/admin/*", adminTombstone);
app.all("/api/admin/*",    adminTombstone);

// ----------------------------------------------------------------
// CTRL-TITAN ROUTES (renamed from /api/v1/admin)
// [Phase 6] IP allowlist guard + admin secret + rate limiter.
// Mount url: /api/v1/ctrl-titan-9x2k/*
// ----------------------------------------------------------------
const ctrlRouter = express.Router();
ctrlRouter.use(adminRouter); // backwards compatibility for old admin routes under new path

// Titan Dashboard APIs
ctrlRouter.get("/titan/organizations", getOrganizations);
ctrlRouter.patch("/titan/organizations/:orgId/suspend", suspendOrg);
ctrlRouter.patch("/titan/organizations/:orgId/upgrade", upgradeOrg);

ctrlRouter.get("/titan/threats", getThreatEvents);
ctrlRouter.post("/titan/threats/block", blockIp);

ctrlRouter.get("/titan/revenue", getRevenueStats);

// Global Overrides
ctrlRouter.post("/titan/override/backup", runTitanBackup);
ctrlRouter.post("/titan/override/audit", runV1Audit);

app.use(CTRL_PREFIX, adminRateLimiter, ctrlRouteGuard, adminSecretGuard, ctrlRouter);


// ----------------------------------------------------------------
// [Phase 7] TITAN HQ SIDECAR BRIDGE
// Mount url: /api/v1/bridge-hq/*
// Strict IP + Titan Key check. Cannot be accessed publicly.
// ----------------------------------------------------------------
const hqBridgeRouter = express.Router();
hqBridgeRouter.post("/impersonate", generateImpersonationToken);

// Expose Titan read APIs to HQ as well, reusing logic
hqBridgeRouter.get("/organizations", getOrganizations);
hqBridgeRouter.patch("/organizations/:orgId/suspend", suspendOrg);
hqBridgeRouter.patch("/organizations/:orgId/upgrade", upgradeOrg);
hqBridgeRouter.get("/threats", getThreatEvents);
hqBridgeRouter.post("/threats/block", blockIp);
hqBridgeRouter.get("/revenue", getRevenueStats);
hqBridgeRouter.post("/override/backup", runTitanBackup);
hqBridgeRouter.post("/override/audit", runV1Audit);
hqBridgeRouter.get("/infra", getInfraPulse);
hqBridgeRouter.post("/maintenance", setMaintenanceMode);
hqBridgeRouter.post("/policy", pushPolicy);
hqBridgeRouter.get("/churn", getChurnWarning);

app.use("/api/v1/bridge-hq", bridgeGuard, hqBridgeRouter);

// ----------------------------------------------------------------
// [Phase 7.5] MAINTENANCE MODE GUARD
// Checks Redis for 'system:maintenance_mode'. If '1', drops traffic.
// Executed AFTER bridge-hq so Titan HQ can still access the core.
// ----------------------------------------------------------------
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const redis = getSharedRedisClient();
    if (redis) {
      const mode = await redis.get("system:maintenance_mode");
      if (mode === "1") {
        res.status(503).json({
          success: false,
          error: "Service is currently undergoing scheduled maintenance. Please try again later."
        });
        return;
      }
    }
  } catch (err) {
    // Fail OPEN if redis crashes so we don't accidentally drop traffic due to infra bug
  }
  next();
});

// ----------------------------------------------------------------
// PROXY ROUTES (V26 — Drop-In OpenAI-Compatible Proxy)
// Mount at /api/proxy/openai → exposes /v1/chat/completions
// SDK baseURL: http://localhost:4000/api/proxy/openai
// ----------------------------------------------------------------
app.use("/api/proxy/openai", proxyLimiter, proxyRouter);
app.use("/api/v1/execute", proxyLimiter);
app.use(executionRouter);
app.use("/api/v1/verify", verifyRouter);

// ----------------------------------------------------------------
// PUBLIC ROUTES (V86/V87 — No Auth Required)
// ----------------------------------------------------------------
app.use(scannerRouter);
app.use(verificationRouter);
app.use(legalRouter);
app.use(webhookRouter);

// ----------------------------------------------------------------
// [Phase 3.2] INTERNAL — Firewall Cache Invalidation
// Called by Next.js /api/sentinel/override/unblock to bust the Redis
// hot-cache immediately after an engineer unblocks an IP.
// Only callable with x-admin-secret — not exposed externally.
// ----------------------------------------------------------------
app.post("/internal/firewall/invalidate", adminSecretGuard, async (req: Request, res: Response) => {
  const { ip } = req.body as { ip?: string };
  if (!ip) {
    res.status(400).json({ success: false, error: "ip is required" });
    return;
  }
  try {
    const { invalidateFirewallCache } = await import("./middleware/firewallGuard.js");
    await invalidateFirewallCache(ip);
    res.status(200).json({ success: true, invalidated: ip });
  } catch (err) {
    console.error("[InternalFirewall] Cache invalidation failed:", (err as Error).message);
    res.status(500).json({ success: false, error: "Invalidation failed" });
  }
});

// ----------------------------------------------------------------
// 404 HANDLER

// ----------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint does not exist on this service.",
    },
  });
});

// ----------------------------------------------------------------
// GLOBAL ERROR HANDLER — [Phase 2] Sentry-instrumented
// ----------------------------------------------------------------
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
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

  // [Phase 2] Capture unhandled server errors in Sentry before responding
  try {
    Sentry.captureException(err, {
      tags: { service: "router-service", route: req.path, method: req.method },
      extra: { traceId: ((req as any) as Record<string, unknown>).traceId ?? null },
    });
  } catch { /* non-fatal: Sentry failure must never break routing */ }

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
// STARTUP V2 (WebSockets for Titan Live Trace)
// ----------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? "4000", 10);

// Need to grab the actual http.Server to attach WebSockets
const server = app.listen(PORT, () => {
  console.log(`🚀 Router-Service [NODE_ENV=${process.env.NODE_ENV}] listening on port ${PORT}`);
  console.log(`[RouterService]     Execution:      POST http://localhost:${PORT}/api/v1/execute`);
  console.log(`[RouterService]     Async Exec(V76):POST http://localhost:${PORT}/api/v1/execute/async`);
  console.log(`[RouterService]     Job Status(V76):GET  http://localhost:${PORT}/api/v1/execute/status/:job_id`);
  console.log(`[RouterService]     Proxy(V26):     POST http://localhost:${PORT}/api/proxy/openai/v1/chat/completions`);
  console.log(`[RouterService]     Models(V26):    GET  http://localhost:${PORT}/api/proxy/openai/v1/models`);
  console.log(`[RouterService]     Revoke:         POST http://localhost:${PORT}/api/v1/sovereignty/revoke`);
  console.log(`[RouterService]     KMS Link:       POST http://localhost:${PORT}/api/v1/sovereignty/kms/link`);
  console.log(`[RouterService]     Health:         GET  http://localhost:${PORT}/health`);
  console.log(`[RouterService]     Vault upstream: ${process.env.VAULT_SERVICE_URL ?? "http://localhost:4002"}`);
  console.log(`[RouterService]     Scanner(V86):   POST http://localhost:${PORT}/api/v1/public/scan`);

  // ----------------------------------------------------------------
  // [V76] ASYNC AGENT WORKER DAEMON
  // Starts the BLPOP background worker. Completely isolated from the
  // HTTP server — crashes inside the worker CANNOT affect routing.
  // ----------------------------------------------------------------
  startAgentWorker().catch((err: unknown) => {
    console.error(
      "[V76:Worker] Failed to start agent worker (routing unaffected):",
      (err as Error)?.message
    );
  });

  // ----------------------------------------------------------------
  // [V80] AUTONOMOUS HEARTBEAT (DISTRIBUTED SCHEDULER)
  // ----------------------------------------------------------------
  startCronDaemon();

  // ----------------------------------------------------------------
  // [Phase 3] SENTINEL LAYER — AGENTIC SECURITY CORE
  // Starts the Sentinel agent scheduler (Sentinel-01/Auditor + future agents).
  // Completely fault-isolated — agent failures never affect HTTP routing.
  // ----------------------------------------------------------------
  startSentinelRunner();
  console.log(`[RouterService]     Sentinel(P3):   Auditor active (15 min) · Enforcer active (5 min)`);
  console.log(`[RouterService]     Firewall(P3.2): IP Blacklist guard LIVE on all routes`);

  // ----------------------------------------------------------------
  // [V66] DATA LIFECYCLE ENGINE — RETENTION SWEEPER SCHEDULER
  // ----------------------------------------------------------------
  //
  // Schedule: runs every 24 hours. An initial "warm-up" sweep fires
  // 60 seconds after startup to catch any backlog from a cold restart.
  //
  // Target: ~03:00 UTC daily. Because setInterval drifts slightly over
  // days, production deployments should additionally set a system-level
  // cron (/etc/cron.d/streetmp-retention-sweep) as a belt-and-suspenders
  // mechanism. This in-process scheduler handles the common case.
  //
  // FAIL-SAFE: the sweeper is individually wrapped in try/catch.
  // A sweep failure is logged as a critical error but NEVER propagates
  // to the HTTP server — routing continues unaffected.
  // ----------------------------------------------------------------

  const SWEEP_INTERVAL_MS   = 24 * 60 * 60 * 1000; // 24 hours
  const INITIAL_DELAY_MS    = 60 * 1000;             // 60 seconds after startup

  const safeSweep = async () => {
    try {
      const summary = await runRetentionSweep();
      console.info(
        `[V66:RetentionSweeper] Sweep complete: ` +
        `${summary.tenantsProcessed} tenants | ` +
        `${(summary.totalPurged + summary.totalDbDeleted).toLocaleString()} total purged | ` +
        `${summary.durationMs}ms`
      );
    } catch (err: unknown) {
      // CRITICAL: sweep failure must NEVER crash the routing process
      console.error(
        `[V66:RetentionSweeper] ❌ SWEEP FAILED (routing unaffected): ` +
        `${(err as Error)?.message ?? String(err)}`
      );
    }
  };

  // Initial sweep: fires 60s after the server is ready
  setTimeout(() => {
    console.info("[V66:RetentionSweeper] ⏱  Initial warm-up sweep starting...");
    void safeSweep();
  }, INITIAL_DELAY_MS);

  // Recurring sweep: every 24 hours
  const sweepInterval = setInterval(() => {
    console.info("[V66:RetentionSweeper] 🕐 24-hour scheduled sweep starting...");
    void safeSweep();
  }, SWEEP_INTERVAL_MS);

  // Ensure the interval doesn't prevent graceful shutdown
  sweepInterval.unref();

  console.log(
    `[RouterService]     Retention(V66): 24h sweep scheduled ` +
    `(first run in ${INITIAL_DELAY_MS / 1000}s)`
  );
});

// ----------------------------------------------------------------
// GRACEFUL SHUTDOWN — ensures Redis connections are closed cleanly
// ----------------------------------------------------------------
process.on("SIGTERM", async () => {
  console.log("[RouterService] SIGTERM received — graceful shutdown...");
  stopCronDaemon();
  stopAgentWorker();
  stopSentinelRunner(); // [Phase 3]
  await closeQueueConnection().catch(() => {/* non-fatal */});
  await closeSharedRedisClient().catch(() => {/* non-fatal */});
  process.exit(0);
});

export default app;
export { maskPII } from "./utils/logger.js";
