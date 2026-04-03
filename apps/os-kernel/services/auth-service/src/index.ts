/**
 * @file index.ts
 * @service auth-service
 * @description Auth Service entrypoint — Identity & Access Provider.
 *
 * This service is the gatekeeper of the entire OS kernel.
 * It validates credentials and issues JWTs that all other
 * services trust when checking user identity.
 *
 * Port: 4001
 *
 * In production, this service should sit behind a rate-limiter
 * (e.g., nginx limit_req or a Redis-backed middleware) to prevent
 * brute-force attacks on the /login endpoint.
 */

import "@streetmp-os/config/env"; // Load root .env — must be first
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { authRouter } from "./routes.js";

// DB import triggers startup connectivity probe
import "./db.js";

const app = express();

// ----------------------------------------------------------------
// CORS — allows the Next.js frontend on :3000 to call auth endpoints
// ----------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.NEXT_PUBLIC_APP_URL ?? "",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server / curl)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-tenant-id", "x-streetmp-role"],
  })
);

// Handle pre-flight OPTIONS requests
app.options("*", cors());

// ----------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ----------------------------------------------------------------
app.use(express.json({ limit: "16kb" }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // Auth responses must never be cached — tokens are time-sensitive
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

// Request logger — intentionally omits email/password from logged body
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on("finish", () => {
    console.log(
      `[AuthService] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "auth-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------------------
app.use(authRouter);

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
  // Deliberately minimal error logging — never log request bodies in auth service
  console.error("[AuthService] Unhandled error:", err.message);
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
const PORT = parseInt(process.env.PORT ?? "4001", 10);

app.listen(PORT, () => {
  console.log(`[AuthService] ✅  Listening on port ${PORT}`);
  console.log(`[AuthService]    Register: POST http://localhost:${PORT}/api/v1/auth/register`);
  console.log(`[AuthService]    Login:    POST http://localhost:${PORT}/api/v1/auth/login`);
  console.log(`[AuthService]    Health:   GET  http://localhost:${PORT}/health`);
});

export default app;
