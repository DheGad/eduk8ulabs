/**
 * @file app/api/billing/checkout/route.ts
 * @route POST /api/billing/checkout
 * @description Creates a Stripe Checkout Session for plan upgrades.
 *   On success, Stripe redirects to /billing/success?session_id=...
 *   On cancel, Stripe redirects to /plans.
 *   Uses Stripe test-key pattern: sk_test_...
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { pool } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20" as any,
});

// Map plan names to Stripe price IDs (seeded in migration 004)
const PLAN_PRICE_MAP: Record<string, string> = {
  pro:        process.env.STRIPE_PRICE_PRO        ?? "price_test_pro_monthly_49",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "price_test_enterprise_monthly_299",
};

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  const orgId  = req.headers.get("x-streetmp-org-id");
  if (!userId || !orgId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { plan: string };
  const plan  = body.plan?.toLowerCase();

  // ── Free Tier Fast-Path ───────────────────────────────────────────────────
  // $0 plan: no Stripe session needed — activate immediately
  if (plan === "free") {
    try {
      await pool.query(
        `UPDATE organizations SET status = 'ACTIVE', billing_provider = 'NONE'
         WHERE id = $1::UUID`,
        [orgId]
      );
      await pool.query(
        `UPDATE users SET account_tier = 'free' WHERE id = $1::UUID`,
        [userId]
      );
    } catch (err) {
      console.error("[Checkout/Free] DB update failed:", err);
      // Non-blocking: redirect anyway — org was created on sign-in
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.streetmp.com";
    return NextResponse.json({ success: true, url: `${appUrl}/dashboard` });
  }

  if (!plan || !PLAN_PRICE_MAP[plan]) {
    return NextResponse.json(
      { success: false, error: "Invalid plan. Choose 'pro' or 'enterprise'." },
      { status: 400 }
    );
  }

  // Look up or create Stripe customer
  const { rows: orgRows } = await pool.query<{
    stripe_customer_id: string | null;
    name: string;
  }>(
    `SELECT o.name, q.stripe_customer_id
     FROM   organizations o
     LEFT   JOIN org_usage_quotas q ON q.org_id = o.id
     WHERE  o.id = $1::UUID
     LIMIT  1`,
    [orgId]
  );

  let customerId = orgRows[0]?.stripe_customer_id;

  if (!customerId) {
    // Fetch user email from DB
    const { rows: userRows } = await pool.query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1::UUID LIMIT 1`,
      [userId]
    );
    const customer = await stripe.customers.create({
      email:    userRows[0]?.email,
      name:     orgRows[0]?.name,
      metadata: { org_id: orgId, user_id: userId },
    });
    customerId = customer.id;

    // Persist the customer ID
    await pool.query(
      `INSERT INTO org_usage_quotas (org_id, plan_id, stripe_customer_id)
       SELECT $1::UUID, id, $2
       FROM   subscription_plans WHERE name = 'free'
       ON CONFLICT (org_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id`,
      [orgId, customerId]
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.streetmp.com";

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price:    PLAN_PRICE_MAP[plan],
        quantity: 1,
      },
    ],
    metadata: {
      org_id:  orgId,
      user_id: userId,
      plan,
    },
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
    cancel_url:  `${appUrl}/plans`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ success: true, url: session.url });
}
