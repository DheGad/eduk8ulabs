/**
 * @file index.ts
 * @service enforcer-service
 * @description Enforcer Service entrypoint — The Deterministic Bolt.
 *
 * This service sits between the Next.js frontend and the Router Service.
 * When a caller needs structured, parseable JSON output from an LLM,
 * they route through this service instead of calling the Router directly.
 *
 * Port: 4003
 */

import "@streetmp-os/config/env"; // Load root .env — must be first
import express, { Request, Response, NextFunction } from "express";
import { enforcerRouter } from "./routes.js";

const app = express();

// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------

// Larger body limit than other services — prompts can be substantial
app.use(express.json({ limit: "128kb" }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on("finish", () => {
    console.log(
      `[EnforcerService] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "enforcer-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// ENFORCER ROUTES
// ----------------------------------------------------------------
app.use(enforcerRouter);

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
  console.error("[EnforcerService] Unhandled error:", err.message, err.stack);
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
const PORT = parseInt(process.env.PORT ?? "4003", 10);

app.listen(PORT, () => {
  console.log(`[EnforcerService] ✅  Listening on port ${PORT}`);
  console.log(`[EnforcerService]    Enforce: POST http://localhost:${PORT}/api/v1/enforce`);
  console.log(`[EnforcerService]    Health:  GET  http://localhost:${PORT}/health`);
  console.log(`[EnforcerService]    Router upstream: ${process.env.ROUTER_SERVICE_URL ?? "http://localhost:4000"}`);
});

export default app;
