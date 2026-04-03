/**
 * @file index.ts  
 * @service billing
 * @version V99
 * @description Billing service entry point — mounts the Stripe webhook listener.
 *
 * CRITICAL: Express must parse the raw body BEFORE any JSON middleware
 * so stripe.webhooks.constructEvent() can verify the HMAC signature.
 */

import express from "express";
import { Pool } from "pg";
import { processStripeWebhook } from "./stripeWebhook.js";
import { checkoutRouter } from "./checkoutRouter.js";
import { paymentRouter } from "./paymentRouter.js";
import { setStripePool } from "./stripeService.js";
import { setRazorpayPool } from "./razorpayService.js";

// ── DB Pool (shared across gateway services) ─────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     ?? "localhost",
  port:     parseInt(process.env.DB_PORT ?? "5432", 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max:      5,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis:  5_000,
});
pool.on("error", (err) => console.error("[BillingService:db]", err.message));

// Inject pool into both gateway services
setStripePool(pool);
setRazorpayPool(pool);

const app = express();
const PORT = process.env.BILLING_SERVICE_PORT ? parseInt(process.env.BILLING_SERVICE_PORT) : 4010;

// ── Health Check ────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "UP", service: "billing", version: "V99" });
});

// ── Stripe Webhook — raw body required for HMAC verification ────
app.post(
  "/api/v1/billing/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string | undefined;

    if (!sig) {
      res.status(400).json({ error: "Missing Stripe-Signature header" });
      return;
    }

    const result = await processStripeWebhook(req.body as Buffer, sig);
    res.status(result.status).json({ message: result.message });
  }
);

// ── All other routes — standard JSON ────────────────────────────
app.use(express.json());

app.use("/api/v1/billing", checkoutRouter);
app.use("/api/v1/billing", paymentRouter);

app.listen(PORT, () => {
  console.info(`[V99:BillingService] ⚡ Billing service running on port ${PORT}`);
});
