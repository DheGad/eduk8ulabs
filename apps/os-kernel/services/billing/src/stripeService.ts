/**
 * @file stripeService.ts
 * @service billing
 * @description Stripe integration for global (USD) subscriptions.
 *   • createCheckoutSession — generates a hosted Stripe Checkout URL
 *   • handleStripeWebhook  — processes checkout.session.completed
 *                             and customer.subscription.deleted
 */

import Stripe from "stripe";
import { Pool } from "pg";

// ── Constants ────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as any,
});

/** Stripe Price IDs — set real IDs via env; fall back to price_data for sandbox */
const STRIPE_PRICE_IDS = {
  PRO:      process.env.STRIPE_PRICE_ID_PRO      ?? null,
  BUSINESS: process.env.STRIPE_PRICE_ID_BUSINESS ?? null,
} as const;

/** Fallback unit amounts (cents) when price IDs are not configured */
const STRIPE_UNIT_AMOUNTS: Record<string, number> = {
  PRO:      4900,   // $49.00
  BUSINESS: 29900,  // $299.00
};

const PLAN_NAMES: Record<string, string> = {
  PRO:      "StreetMP OS Professional",
  BUSINESS: "StreetMP OS Business",
};

// ── Tier → monthly API call limits ──────────────────────────────────────────

export const MONTHLY_LIMITS: Record<string, number> = {
  FREE:     100,
  PRO:      10_000,
  BUSINESS: 100_000,
  SOVEREIGN: Number.MAX_SAFE_INTEGER, // Unlimited
};

// ── DB pool (injected at runtime) ────────────────────────────────────────────

let _pool: Pool | null = null;

export function setStripePool(pool: Pool): void {
  _pool = pool;
}

function getPool(): Pool {
  if (!_pool) throw new Error("[StripeService] DB pool not initialized");
  return _pool;
}

// ── createCheckoutSession ────────────────────────────────────────────────────

export interface CheckoutSessionResult {
  gateway: "STRIPE";
  sessionUrl: string;
  isSandbox?: boolean;
}

export async function createCheckoutSession(
  userId: string,
  planId: "PRO" | "BUSINESS",
  email: string,
): Promise<CheckoutSessionResult> {
  const priceId = STRIPE_PRICE_IDS[planId];
  const name = PLAN_NAMES[planId];
  const unitAmount = STRIPE_UNIT_AMOUNTS[planId];

  try {
    // Build line_items — prefer a configured Price ID, else use price_data
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name,
                description: "StreetMP OS Sovereign AI Execution — Monthly Subscription",
              },
              unit_amount: unitAmount,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: lineItems,
      mode: "subscription",
      metadata: { userId, planId },
      success_url: `${APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/pricing`,
    });

    return { gateway: "STRIPE", sessionUrl: session.url! };
  } catch (err: any) {
    console.warn("[StripeService] Stripe error, falling back to sandbox:", err.message);
    return {
      gateway: "STRIPE",
      sessionUrl: `${APP_URL}/dashboard?checkout=sandbox_success`,
      isSandbox: true,
    };
  }
}

// ── Stripe Webhook Handler ────────────────────────────────────────────────────

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<{ status: number; message: string }> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[StripeService] Webhook signature verification failed:", err.message);
    return { status: 400, message: `Webhook Error: ${err.message}` };
  }

  const db = getPool();

  switch (event.type) {
    // ── Subscription activated / payment successful ─────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, planId } = session.metadata ?? {};
      const stripeCustomerId = session.customer as string | null;

      if (!userId || !planId) {
        console.warn("[StripeService] checkout.session.completed: missing metadata");
        break;
      }

      const tier = planId.toLowerCase(); // 'pro' | 'business'

      await db.query(
        `UPDATE users
           SET account_tier        = $1,
               stripe_customer_id   = $2,
               active_gateway       = 'STRIPE',
               api_calls_this_month = 0,
               monthly_limit        = $3,
               updated_at           = NOW()
         WHERE id = $4`,
        [tier, stripeCustomerId, MONTHLY_LIMITS[planId], userId],
      );

      console.info(
        `[StripeService] ✅ checkout.session.completed → user=${userId} tier=${tier}`,
      );
      break;
    }

    // ── Subscription cancelled / payment failed ─────────────────────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const stripeCustomerId = sub.customer as string;

      await db.query(
        `UPDATE users
           SET account_tier      = 'free',
               monthly_limit     = $1,
               active_gateway    = NULL,
               updated_at        = NOW()
         WHERE stripe_customer_id = $2`,
        [MONTHLY_LIMITS.FREE, stripeCustomerId],
      );

      console.info(
        `[StripeService] ⚠️ customer.subscription.deleted → customer=${stripeCustomerId} → downgraded to free`,
      );
      break;
    }

    default:
      console.debug(`[StripeService] Unhandled event type: ${event.type}`);
  }

  return { status: 200, message: "OK" };
}
