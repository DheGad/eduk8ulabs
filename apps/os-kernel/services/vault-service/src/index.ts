/**
 * @file index.ts
 * @service vault-service
 * @description Vault Service entrypoint — Express server initialization.
 *
 * Startup sequence:
 *   1. Load environment variables
 *   2. Import db.ts (triggers PostgreSQL pool connection probe)
 *   3. Mount vault routes
 *   4. Register 404 and global error handlers
 *   5. Listen on PORT (default: 4002)
 *
 * This service handles ONLY cryptographic vault operations.
 * It has no public auth layer — JWT validation is upstream (Router Service).
 * The /internal/* routes are protected by INTERNAL_ROUTER_SECRET header check.
 */

import "@streetmp-os/config/env"; // Load root .env — must be first
import express, { Request, Response, NextFunction } from "express";
import { vaultRouter } from "./routes.js";

// db.ts import triggers the connection pool startup probe.
// If the DB is unreachable, the process exits here before accepting traffic.
import "./db.js";

const app = express();

// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------

// Parse JSON bodies — limit size to prevent request amplification attacks
app.use(express.json({ limit: "16kb" }));

// Basic security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store"); // Never cache vault responses
  next();
});

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "vault-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// VAULT ROUTES
// ----------------------------------------------------------------
app.use(vaultRouter);

// ----------------------------------------------------------------
// 404 HANDLER — catch any unmatched route
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
// Catches any unhandled errors thrown by async route handlers.
// Express 5 propagates async errors automatically; for Express 4,
// routes use explicit try/catch and pass errors to next().
// ----------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[VaultService] Unhandled error:", err.message, err.stack);
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
const PORT = parseInt(process.env.PORT ?? "4002", 10);

app.listen(PORT, () => {
  console.log(`[VaultService] ✅ Listening on port ${PORT}`);
  console.log(`[VaultService]    Public:   POST http://localhost:${PORT}/api/v1/vault/keys`);
  console.log(`[VaultService]    Internal: GET  http://localhost:${PORT}/internal/vault/keys/:user_id/:provider`);
  console.log(`[VaultService]    Health:   GET  http://localhost:${PORT}/health`);
});

export default app;
