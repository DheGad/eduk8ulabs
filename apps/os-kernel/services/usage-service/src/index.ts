/**
 * @file index.ts
 * @service usage-service
 * @description Usage Service entrypoint — The Financial Ledger.
 *
 * This service is entirely internal. It:
 *   • Receives POST /internal/usage/log from the Router Service
 *   • Calculates exact LLM API cost via the pricing engine
 *   • Persists immutable records to the usage_logs table
 *   • Serves aggregate usage summaries for billing and HCQ scoring
 *
 * Port: 4004 (internal only — no public route should reach this port)
 */

import "@streetmp-os/config/env"; // Load root .env — must be first
import express, { Request, Response, NextFunction } from "express";
import { usageRouter } from "./routes.js";
import { startTelemetryScheduler, stopTelemetryScheduler } from "./telemetry.js";

// Import triggers DB pool startup connectivity probe
import "./db.js";

const app = express();

// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------
app.use(express.json({ limit: "16kb" }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on("finish", () => {
    console.log(
      `[UsageService] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "usage-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// USAGE ROUTES
// ----------------------------------------------------------------
app.use(usageRouter);

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
// GLOBAL ERROR HANDLER
// ----------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[UsageService] Unhandled error:", err.message, err.stack);
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
const PORT = parseInt(process.env.PORT ?? "4004", 10);

app.listen(PORT, () => {
  console.log(`[UsageService] ✅  Listening on port ${PORT}`);
  console.log(`[UsageService]    Log:     POST /internal/usage/log`);
  console.log(`[UsageService]    Summary: GET  /internal/usage/summary/:user_id`);
  console.log(`[UsageService]    Ingest:  POST /api/v1/telemetry/ingest`);
  console.log(`[UsageService]    Ledger:  GET  /api/v1/telemetry/nodes/:nodeId/ledger`);
  console.log(`[UsageService]    Health:  GET  /health`);

  // Start the periodic telemetry pulse (time-based trigger)
  startTelemetryScheduler();
});

// ----------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ----------------------------------------------------------------
function gracefulShutdown(signal: string): void {
  console.log(`[UsageService] Received ${signal} — stopping telemetry scheduler...`);
  stopTelemetryScheduler();
  process.exit(0);
}
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT",  () => gracefulShutdown("SIGINT"));

export default app;
