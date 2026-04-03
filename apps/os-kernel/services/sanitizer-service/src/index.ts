/**
 * @file index.ts
 * @service sanitizer-service
 * @description Enterprise Privacy Shield — PII scrubbing for HYOK mode.
 *
 * Routes:
 *   INTERNAL (token-gated):
 *     POST /api/v1/sanitize         — Redact PII from prompt, return de-id map
 *
 *   DIAGNOSTIC:
 *     GET  /api/v1/sanitize/health  — Engine warmup check
 *     GET  /health                  — Standard service health
 *
 * Port: 4006
 */

import "@streetmp-os/config/env"; // Load root .env — must be first
import express, { Request, Response, NextFunction } from "express";
import { sanitizerRouter } from "./routes.js";

const app = express();

// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------
app.use(express.json({ limit: "512kb" })); // Enterprise prompts can be large

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Lightweight request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on("finish", () => {
    console.log(
      `[SanitizerService] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "sanitizer-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// SANITIZER ROUTES
// ----------------------------------------------------------------
app.use(sanitizerRouter);

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
  console.error("[SanitizerService] Unhandled error:", err.message, err.stack);
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
const PORT = parseInt(process.env.SANITIZER_SERVICE_PORT ?? "4006", 10);

app.listen(PORT, () => {
  console.log(`[SanitizerService] ✅  Listening on port ${PORT}`);
  console.log(`[SanitizerService]    Sanitize:  POST /api/v1/sanitize`);
  console.log(`[SanitizerService]    Health:    GET  /health`);
  console.log(`[SanitizerService]    Engine:    GET  /api/v1/sanitize/health`);
});

export default app;
