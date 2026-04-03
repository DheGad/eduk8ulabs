/**
 * @file index.ts
 * @service trust-service
 * @description Trust Service entrypoint — HCQ, Flight Recorder & Smart Escrow.
 *
 * Routes:
 *   INTERNAL (token-gated):
 *     POST /internal/trust/trace              — Log trace + update HCQ profile
 *     POST /internal/trust/verify-and-release — Validate escrow schema + capture Stripe PI
 *
 *   PUBLIC (marketplace-readable):
 *     GET  /api/v1/trust/hcq/:userId          — HCQ scorecard
 *
 *   AUTHENTICATED (JWT required):
 *     POST /api/v1/escrow/create              — Create Stripe escrow contract
 *
 *   STRIPE WEBHOOK (raw body, no auth):
 *     POST /webhooks/stripe                   — Payment events + dispute handling
 *
 * Port: 4005
 */

import "@streetmp-os/config/env"; // Load root .env — must be first
import express, { Request, Response, NextFunction } from "express";
import { trustRouter } from "./routes.js";
import { escrowRouter, STRIPE_WEBHOOK_PATH } from "./escrowRoutes.js";
import { payoutRouter } from "./payoutRoutes.js";

// DB import triggers startup connectivity probe
import "./db.js";

const app = express();

// ----------------------------------------------------------------
// STRIPE WEBHOOK — mount BEFORE express.json()
// The Stripe SDK requires the raw request Buffer to verify
// the HMAC-SHA256 Stripe-Signature header. If express.json()
// runs first, the body is already parsed and verification fails.
// express.raw() is scoped only to this path.
// ----------------------------------------------------------------
app.use(STRIPE_WEBHOOK_PATH, express.raw({ type: "application/json" }));

// ----------------------------------------------------------------
// GLOBAL JSON MIDDLEWARE (all other routes)
// ----------------------------------------------------------------
app.use(express.json({ limit: "64kb" })); // Prompts + JSONB payloads can be substantial

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // Internal responses should not be cached downstream
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Lightweight request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on("finish", () => {
    console.log(
      `[TrustService] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// ----------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "trust-service",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------
// TRUST ROUTES (HCQ, Flight Recorder)
// ----------------------------------------------------------------
app.use(trustRouter);

// ----------------------------------------------------------------
// ESCROW ROUTES (Stripe PaymentIntents, verify-and-release, webhook)
// ----------------------------------------------------------------
app.use(escrowRouter);

// ----------------------------------------------------------------
// PAYOUT ROUTES (Stripe Connect Onboarding, Balance)
// ----------------------------------------------------------------
app.use(payoutRouter);

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
  console.error("[TrustService] Unhandled error:", err.message, err.stack);
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
const PORT = parseInt(process.env.PORT ?? "4005", 10);

app.listen(PORT, () => {
  console.log(`[TrustService] ✅  Listening on port ${PORT}`);
  console.log(`[TrustService]    HCQ/Trace:  POST /internal/trust/trace`);
  console.log(`[TrustService]    Escrow:     POST /api/v1/escrow/create`);
  console.log(`[TrustService]    Release:    POST /internal/trust/verify-and-release`);
  console.log(`[TrustService]    Webhook:    POST /webhooks/stripe`);
  console.log(`[TrustService]    Scorecard:  GET  /api/v1/trust/hcq/:userId`);
  console.log(`[TrustService]    Onboarding: POST /api/v1/payouts/onboard`);
  console.log(`[TrustService]    Balance:    GET  /api/v1/payouts/balance`);
  console.log(`[TrustService]    Health:     GET  /health`);
});

export default app;
