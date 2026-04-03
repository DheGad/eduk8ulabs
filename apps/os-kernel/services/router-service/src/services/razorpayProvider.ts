/**
 * @file services/razorpayProvider.ts
 * @service router-service / web api routes
 * @phase Phase 5.5 — Razorpay India Integration
 * @description
 *   Razorpay dual-gateway provider. Handles:
 *     1. Order creation  — POST /api/billing/razorpay/order
 *     2. Signature verification — called server-side after Checkout.js returns
 *     3. Webhook processing — payment.captured / subscription.activated
 *
 *   Key patterns:
 *     - All amounts in PAISE (1 INR = 100 paise). Never floats.
 *     - GST is 18% on digital services (per Indian GST Act for SaaS)
 *     - Signature HMAC uses rzp_key_secret (HMAC-SHA256 of
 *       `${razorpay_order_id}|${razorpay_payment_id}`)
 *     - Uses `rzp_test_` key pattern; swap for `rzp_live_` in production.
 *
 *   Indian pricing (INR, inclusive of 18% GST):
 *     Pro:        ₹4,000 / month
 *     Enterprise: ₹24,900 / month
 */

import Razorpay from "razorpay";
import { createHmac } from "node:crypto";
import { pool } from "../db.js";

// ── Razorpay client singleton ─────────────────────────────────────────────────

let _rzp: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (_rzp) return _rzp;
  _rzp = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID     ?? "rzp_test_placeholder_key",
    key_secret: process.env.RAZORPAY_KEY_SECRET ?? "rzp_test_placeholder_secret",
  });
  return _rzp;
}

// ── Plan catalog (INR paise, inclusive of 18% GST) ───────────────────────────

interface RzpPlan {
  name:          string;
  amountPaise:   number;   // Total charged (base + GST)
  baseAmountPaise: number; // Pre-GST amount (for invoice breakdown)
  gstAmountPaise:  number; // 18% GST component
  currency:      string;
  description:   string;
}

export const RZP_PLANS: Record<string, RzpPlan> = {
  pro: {
    name:            "Pro",
    baseAmountPaise:  338983,  // ₹3,389.83 base
    gstAmountPaise:    61017,  // ₹610.17 GST (18%)
    amountPaise:      400000,  // ₹4,000.00 total (matches Stripe $49 ~₹4,000)
    currency:        "INR",
    description:     "StreetMP OS Pro Plan — 50,000 executions/month",
  },
  enterprise: {
    name:            "Enterprise",
    baseAmountPaise: 2110169,  // ₹21,101.69 base
    gstAmountPaise:   379831,  // ₹3,798.31 GST (18%)
    amountPaise:     2490000,  // ₹24,900.00 total (≈ Stripe $299)
    currency:        "INR",
    description:     "StreetMP OS Enterprise Plan — Unlimited executions",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RzpOrderResult {
  razorpay_order_id: string;
  amount:            number;
  currency:          string;
  key_id:            string;
  plan:              RzpPlan;
  db_order_id:       string;
}

// ── 1. Create Order ───────────────────────────────────────────────────────────

/**
 * Creates a Razorpay order and persists it to razorpay_orders.
 * Returns the data needed to initialize Razorpay Checkout.js on the frontend.
 */
export async function createRazorpayOrder(
  orgId:    string,
  planKey:  string,
  gstin?:   string
): Promise<RzpOrderResult> {
  const plan = RZP_PLANS[planKey.toLowerCase()];
  if (!plan) {
    throw new Error(`Unknown Razorpay plan: ${planKey}. Valid: ${Object.keys(RZP_PLANS).join(", ")}`);
  }

  const rzp     = getRazorpay();
  const receipt = `smp_${orgId.slice(0, 8)}_${Date.now()}`;

  // Create order on Razorpay
  const rzpOrder = await rzp.orders.create({
    amount:   plan.amountPaise,
    currency: plan.currency,
    receipt,
    notes: {
      org_id:   orgId,
      plan:     planKey,
      platform: "StreetMP OS",
    },
  });

  // Persist to DB
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO razorpay_orders
       (org_id, razorpay_order_id, amount, currency, plan_name, gstin, gst_amount, receipt, notes)
     VALUES
       ($1::UUID, $2, $3, $4, $5, $6, $7, $8, $9::JSONB)
     RETURNING id`,
    [
      orgId,
      rzpOrder.id,
      plan.amountPaise,
      plan.currency,
      plan.name,
      gstin ?? null,
      plan.gstAmountPaise,
      receipt,
      JSON.stringify({ plan: planKey, platform: "StreetMP OS" }),
    ]
  );

  return {
    razorpay_order_id: rzpOrder.id,
    amount:            plan.amountPaise,
    currency:          plan.currency,
    key_id:            process.env.RAZORPAY_KEY_ID ?? "rzp_test_placeholder_key",
    plan,
    db_order_id:       rows[0].id,
  };
}

// ── 2. Verify Signature ────────────────────────────────────────────────────────

/**
 * Verifies the Razorpay payment signature returned by Checkout.js.
 * HMAC-SHA256 of `${razorpay_order_id}|${razorpay_payment_id}` using key_secret.
 * Returns true if valid. Must be called server-side — never client-side.
 *
 * @throws if the signature is invalid (do NOT catch silently — treat as fraud)
 */
export function verifyRazorpaySignature(
  razorpay_order_id:   string,
  razorpay_payment_id: string,
  razorpay_signature:  string
): boolean {
  const secret   = process.env.RAZORPAY_KEY_SECRET ?? "";
  const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = createHmac("sha256", secret).update(body).digest("hex");

  // Constant-time compare — reject timing attacks
  if (expected.length !== razorpay_signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ razorpay_signature.charCodeAt(i);
  }
  return diff === 0;
}

// ── 3. Mark order as PAID in DB ───────────────────────────────────────────────

export async function markOrderPaid(
  razorpay_order_id:   string,
  razorpay_payment_id: string,
  razorpay_signature:  string
): Promise<string | null> {
  const { rows } = await pool.query<{ org_id: string; plan_name: string }>(
    `UPDATE razorpay_orders
     SET
       status              = 'PAID',
       razorpay_payment_id = $2,
       razorpay_signature  = $3,
       updated_at          = NOW()
     WHERE razorpay_order_id = $1
     RETURNING org_id, plan_name`,
    [razorpay_order_id, razorpay_payment_id, razorpay_signature]
  );

  if (!rows.length) return null;

  const { org_id, plan_name } = rows[0];

  // Upgrade org plan tier
  const tierMap: Record<string, string> = { pro: "PRO", enterprise: "ENTERPRISE" };
  const tier = tierMap[plan_name.toLowerCase()];
  if (tier) {
    await pool.query(
      `UPDATE organizations
         SET plan_tier = $1::plan_tier, billing_provider = 'RAZORPAY', updated_at = NOW()
       WHERE id = $2::UUID`,
      [tier, org_id]
    );
    // Reset quota counter
    await pool.query(
      `UPDATE org_usage_quotas
         SET
           plan_id                  = (SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1),
           current_month_executions = 0,
           limit_reached_at         = NULL,
           month_start              = DATE_TRUNC('month', NOW()),
           updated_at               = NOW()
       WHERE org_id = $2::UUID`,
      [plan_name.toLowerCase(), org_id]
    );
  }

  return org_id;
}

// ── 4. Webhook event handlers ─────────────────────────────────────────────────

/**
 * Verifies a Razorpay webhook signature.
 * Header: `x-razorpay-signature`
 * Uses RAZORPAY_WEBHOOK_SECRET (set in Razorpay Dashboard → Webhooks).
 */
export function verifyRazorpayWebhook(
  rawBody:   string,
  signature: string
): boolean {
  const secret   = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Handle `payment.captured` event from Razorpay webhook.
 * Idempotent — safe to call multiple times.
 */
export async function handlePaymentCaptured(payload: Record<string, unknown>): Promise<void> {
  const payment  = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown>;
  const entity   = payment?.entity as Record<string, unknown>;

  const orderId  = entity?.order_id  as string | undefined;
  const payId    = entity?.id        as string | undefined;
  const status   = entity?.status    as string | undefined;

  if (!orderId || !payId || status !== "captured") {
    console.warn("[RzpWebhook] payment.captured: missing fields or status != captured");
    return;
  }

  // Update order status (signature already verified at Checkout.js callback — webhook is audit)
  const { rows } = await pool.query<{ org_id: string; plan_name: string }>(
    `UPDATE razorpay_orders
       SET status = 'PAID', razorpay_payment_id = $2, updated_at = NOW()
     WHERE razorpay_order_id = $1 AND status != 'PAID'
     RETURNING org_id, plan_name`,
    [orderId, payId]
  );

  if (rows.length) {
    const { org_id, plan_name } = rows[0];
    const tierMap: Record<string, string> = { Pro: "PRO", Enterprise: "ENTERPRISE" };
    const tier = tierMap[plan_name];
    if (tier) {
      await pool.query(
        `UPDATE organizations
           SET plan_tier = $1::plan_tier, billing_provider = 'RAZORPAY', updated_at = NOW()
         WHERE id = $2::UUID`,
        [tier, org_id]
      );
    }
    console.info(`[RzpWebhook] payment.captured → org ${org_id} upgraded to ${plan_name}`);
  }
}

/**
 * Handle `subscription.activated` event.
 */
export async function handleSubscriptionActivated(payload: Record<string, unknown>): Promise<void> {
  const sub    = (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown>;
  const entity = sub?.entity as Record<string, unknown>;

  const rzpSubId  = entity?.id       as string | undefined;
  const startAt   = entity?.current_start as number | undefined;
  const endAt     = entity?.current_end   as number | undefined;

  if (!rzpSubId) return;

  await pool.query(
    `UPDATE razorpay_subscriptions
       SET status        = 'ACTIVE',
           current_start = TO_TIMESTAMP($2),
           current_end   = TO_TIMESTAMP($3),
           updated_at    = NOW()
     WHERE razorpay_subscription_id = $1`,
    [rzpSubId, startAt ?? null, endAt ?? null]
  );

  console.info(`[RzpWebhook] subscription.activated → sub ${rzpSubId}`);
}
