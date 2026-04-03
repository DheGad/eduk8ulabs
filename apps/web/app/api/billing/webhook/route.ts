/**
 * @file app/api/billing/webhook/route.ts
 * @route POST /api/billing/webhook
 * @description Stripe Webhook Listener.
 *   Handles subscription lifecycle events and updates org plan_tier + quotas.
 *
 *   Events handled:
 *     checkout.session.completed       → upgrade org plan, reset quota
 *     customer.subscription.deleted    → downgrade to free
 *     customer.subscription.updated    → handle plan changes mid-cycle
 *
 *   Security:
 *     - Raw body verified using Stripe-Signature header (HMAC-SHA256)
 *     - STRIPE_WEBHOOK_SECRET must match the endpoint secret in Stripe Dashboard
 *
 *   Mount:
 *     This route needs the raw body — it is excluded from the global
 *     Next.js body parser via export const config = { api: { bodyParser: false } }
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { pool } from "@/lib/db";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20" as any,
});

// Map Stripe price IDs back to plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO        ?? "price_test_pro_monthly_49"]:        "pro",
  [process.env.STRIPE_PRICE_ENTERPRISE ?? "price_test_enterprise_monthly_299"]: "enterprise",
};

const PLAN_TO_TIER: Record<string, string> = {
  free:       "FREE",
  pro:        "PRO",
  enterprise: "ENTERPRISE",
};

async function upgradePlan(orgId: string, planName: string, subscriptionId: string): Promise<void> {
  const tier = PLAN_TO_TIER[planName] ?? "FREE";

  // 1. Update org tier
  await pool.query(
    `UPDATE organizations SET plan_tier = $1::plan_tier, updated_at = NOW() WHERE id = $2::UUID`,
    [tier, orgId]
  );

  // 2. Upgrade quota row to new plan, reset counter + clear limit flag
  await pool.query(
    `UPDATE org_usage_quotas
     SET
       plan_id                  = (SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1),
       stripe_subscription_id   = $2,
       current_month_executions = 0,
       limit_reached_at         = NULL,
       month_start              = DATE_TRUNC('month', NOW()),
       updated_at               = NOW()
     WHERE org_id = $3::UUID`,
    [planName, subscriptionId, orgId]
  );

  console.info(`[StripeWebhook] ✅ Upgraded org ${orgId} → ${tier} (sub: ${subscriptionId})`);
}

async function downgradePlan(orgId: string): Promise<void> {
  await pool.query(
    `UPDATE organizations SET plan_tier = 'FREE', updated_at = NOW() WHERE id = $1::UUID`,
    [orgId]
  );
  await pool.query(
    `UPDATE org_usage_quotas
     SET
       plan_id    = (SELECT id FROM subscription_plans WHERE name = 'free' LIMIT 1),
       stripe_subscription_id = NULL,
       updated_at = NOW()
     WHERE org_id = $1::UUID`,
    [orgId]
  );
  console.info(`[StripeWebhook] ⬇️  Downgraded org ${orgId} → FREE`);
}

export async function POST(req: NextRequest) {
  const sig     = req.headers.get("stripe-signature");
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[StripeWebhook] Signature verification failed:", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Successful checkout → provision plan ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId   = session.metadata?.org_id;
        const plan    = session.metadata?.plan;
        const subId   = session.subscription as string;

        if (orgId && plan) {
          await upgradePlan(orgId, plan, subId);
        }
        break;
      }

      // ── Subscription updated mid-cycle ────────────────────────────────────
      case "customer.subscription.updated": {
        const sub    = event.data.object as Stripe.Subscription;
        const orgRow = await pool.query<{ org_id: string }>(
          `SELECT org_id FROM org_usage_quotas WHERE stripe_subscription_id = $1 LIMIT 1`,
          [sub.id]
        );
        if (orgRow.rows.length) {
          // Derive plan from first item's price
          const priceId = sub.items.data[0]?.price?.id;
          const plan    = priceId ? (PRICE_TO_PLAN[priceId] ?? "free") : "free";
          await upgradePlan(orgRow.rows[0].org_id, plan, sub.id);
        }
        break;
      }

      // ── Subscription cancelled/expired → free tier ────────────────────────
      case "customer.subscription.deleted": {
        const sub    = event.data.object as Stripe.Subscription;
        const orgRow = await pool.query<{ org_id: string }>(
          `SELECT org_id FROM org_usage_quotas WHERE stripe_subscription_id = $1 LIMIT 1`,
          [sub.id]
        );
        if (orgRow.rows.length) {
          await downgradePlan(orgRow.rows[0].org_id);
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge without processing
        break;
    }
  } catch (err) {
    console.error("[StripeWebhook] Handler error:", (err as Error).message);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
