/**
 * @file paymentRouter.ts
 * @service billing
 * @description Dual-Gateway Payment Router.
 *
 * Routing logic:
 *   • If country === 'IN' OR currency === 'INR' → Razorpay (₹INR)
 *   • Otherwise → Stripe (USD / global)
 *
 * Exposes two Express routes:
 *   POST /api/v1/billing/subscribe  — initiate a subscription
 *   POST /api/v1/billing/razorpay/webhook — Razorpay event hook
 *   (Stripe webhook is handled by the pre-existing /stripe/webhook route)
 */

import express, { Request, Response } from "express";
import { createCheckoutSession } from "./stripeService.js";
import { createSubscription, handleRazorpayWebhook } from "./razorpayService.js";

export const paymentRouter = express.Router();

// ── Types ────────────────────────────────────────────────────────────────────

type SupportedPlan = "PRO" | "BUSINESS";

interface SubscribeBody {
  userId:   string;
  planId:   SupportedPlan;
  email?:   string;   // required for Stripe
  country?: string;   // 'IN' routes to Razorpay
  currency?: string;  // 'INR' routes to Razorpay
}

// ── Gateway Selector ─────────────────────────────────────────────────────────

function selectGateway(country?: string, currency?: string): "STRIPE" | "RAZORPAY" {
  const isIndia =
    country?.toUpperCase() === "IN" ||
    currency?.toUpperCase() === "INR";

  return isIndia ? "RAZORPAY" : "STRIPE";
}

// ── POST /subscribe ───────────────────────────────────────────────────────────

/**
 * @route POST /api/v1/billing/subscribe
 * @body  { userId, planId, email, country, currency }
 * @returns Gateway-specific session/subscription data for the frontend to consume.
 *
 * Stripe response:   { gateway: 'STRIPE',   sessionUrl }
 * Razorpay response: { gateway: 'RAZORPAY', subscriptionId, keyId, amountInr }
 */
paymentRouter.post("/subscribe", async (req: Request, res: Response) => {
  const { userId, planId, email, country, currency } = req.body as SubscribeBody;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  if (!planId || !["PRO", "BUSINESS"].includes(planId)) {
    res.status(400).json({ error: "planId must be 'PRO' or 'BUSINESS'" });
    return;
  }

  const gateway = selectGateway(country, currency);

  try {
    if (gateway === "RAZORPAY") {
      const result = await createSubscription(userId, planId);
      res.json(result);
    } else {
      if (!email) {
        res.status(400).json({ error: "email is required for Stripe checkout" });
        return;
      }
      const result = await createCheckoutSession(userId, planId, email);
      res.json(result);
    }
  } catch (err: any) {
    console.error("[PaymentRouter] Subscribe error:", err.message);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// ── POST /razorpay/webhook ────────────────────────────────────────────────────

/**
 * @route POST /api/v1/billing/razorpay/webhook
 * Raw body required — do NOT parse as JSON before this handler.
 */
paymentRouter.post(
  "/razorpay/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;

    if (!signature) {
      res.status(400).json({ error: "Missing X-Razorpay-Signature header" });
      return;
    }

    const rawBody = (req.body as Buffer).toString("utf8");
    const result = await handleRazorpayWebhook(rawBody, signature);
    res.status(result.status).json({ message: result.message });
  },
);
