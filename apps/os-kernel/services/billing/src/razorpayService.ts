/**
 * @file razorpayService.ts
 * @service billing
 * @description Razorpay integration for Indian (INR) subscriptions.
 *   • createSubscription  — creates a Razorpay Subscription record
 *   • handleRazorpayWebhook — processes subscription.charged
 *                              and subscription.halted
 *
 * Razorpay Plan IDs (₹/mo — set via env):
 *   RAZORPAY_PLAN_ID_PRO      = plan_xxxx (₹3,999/mo)
 *   RAZORPAY_PLAN_ID_BUSINESS = plan_xxxx (₹24,999/mo)
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import { Pool } from "pg";
import { MONTHLY_LIMITS } from "./stripeService.js";

// ── Constants ────────────────────────────────────────────────────────────────

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "rzp_test_placeholder";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "rzp_secret_placeholder";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "rzp_webhook_placeholder";

export const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * Razorpay Plan IDs — create these in the Razorpay dashboard and set via env.
 * Fall back to sandbox placeholders for local dev.
 */
const RAZORPAY_PLAN_IDS = {
  PRO:      process.env.RAZORPAY_PLAN_ID_PRO      ?? "plan_pro_placeholder",
  BUSINESS: process.env.RAZORPAY_PLAN_ID_BUSINESS ?? "plan_business_placeholder",
} as const;

/** INR amounts in paise for display / creation reference */
const RAZORPAY_INR_AMOUNTS: Record<string, number> = {
  PRO:      399900,  // ₹3,999.00 (in paise)
  BUSINESS: 2499900, // ₹24,999.00 (in paise)
};

// ── DB pool (injected at runtime) ────────────────────────────────────────────

let _pool: Pool | null = null;

export function setRazorpayPool(pool: Pool): void {
  _pool = pool;
}

function getPool(): Pool {
  if (!_pool) throw new Error("[RazorpayService] DB pool not initialized");
  return _pool;
}

// ── createSubscription ───────────────────────────────────────────────────────

export interface RazorpaySubscriptionResult {
  gateway: "RAZORPAY";
  subscriptionId: string;
  planId: string;
  amountInr: number;
  keyId: string;
  isSandbox?: boolean;
}

export async function createSubscription(
  userId: string,
  planId: "PRO" | "BUSINESS",
): Promise<RazorpaySubscriptionResult> {
  const razorpayPlanId = RAZORPAY_PLAN_IDS[planId];
  const amountInr = RAZORPAY_INR_AMOUNTS[planId];

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id:         razorpayPlanId,
      total_count:     12,   // 12-month cycle (renews automatically)
      quantity:        1,
      notes: {
        userId,
        planId,
      },
    });

    return {
      gateway:        "RAZORPAY",
      subscriptionId: subscription.id,
      planId:         razorpayPlanId,
      amountInr,
      keyId:          RAZORPAY_KEY_ID,
    };
  } catch (err: any) {
    console.warn("[RazorpayService] Razorpay error, falling back to sandbox:", err.message);
    return {
      gateway:        "RAZORPAY",
      subscriptionId: `sub_sandbox_${Date.now()}`,
      planId:         razorpayPlanId,
      amountInr,
      keyId:          RAZORPAY_KEY_ID,
      isSandbox:      true,
    };
  }
}

// ── Razorpay Webhook Handler ──────────────────────────────────────────────────

/**
 * Verifies Razorpay webhook signature using HMAC-SHA256.
 * Razorpay sends X-Razorpay-Signature header (hex digest).
 */
function verifyRazorpaySignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string,
): Promise<{ status: number; message: string }> {
  // ── Signature verification ─────────────────────────────────────────────────
  if (!verifyRazorpaySignature(rawBody, signature)) {
    console.error("[RazorpayService] Webhook signature mismatch");
    return { status: 400, message: "Invalid signature" };
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, message: "Invalid JSON body" };
  }

  const event      = payload.event as string;
  const entity     = payload.payload?.subscription?.entity ?? {};
  const notes      = entity.notes ?? {};
  const userId     = notes.userId as string | undefined;
  const planId     = notes.planId as string | undefined;   // 'PRO' | 'BUSINESS'
  const razorpayCustomerId = entity.customer_id as string | undefined;

  const db = getPool();

  switch (event) {
    // ── Payment captured — activate subscription ────────────────────────────
    case "subscription.charged": {
      if (!userId || !planId) {
        console.warn("[RazorpayService] subscription.charged: missing notes");
        break;
      }

      const tier = planId.toLowerCase();

      await db.query(
        `UPDATE users
           SET account_tier          = $1,
               razorpay_customer_id   = $2,
               active_gateway         = 'RAZORPAY',
               api_calls_this_month   = 0,
               monthly_limit          = $3,
               updated_at             = NOW()
         WHERE id = $4`,
        [tier, razorpayCustomerId ?? null, MONTHLY_LIMITS[planId], userId],
      );

      console.info(
        `[RazorpayService] ✅ subscription.charged → user=${userId} tier=${tier}`,
      );
      break;
    }

    // ── Payment failed / subscription halted — downgrade to free ───────────
    case "subscription.halted": {
      if (!userId) {
        console.warn("[RazorpayService] subscription.halted: missing userId in notes");
        break;
      }

      await db.query(
        `UPDATE users
           SET account_tier      = 'free',
               monthly_limit     = $1,
               active_gateway    = NULL,
               updated_at        = NOW()
         WHERE id = $2`,
        [MONTHLY_LIMITS.FREE, userId],
      );

      console.warn(
        `[RazorpayService] ⚠️ subscription.halted → user=${userId} → downgraded to free`,
      );
      break;
    }

    default:
      console.debug(`[RazorpayService] Unhandled event: ${event}`);
  }

  return { status: 200, message: "OK" };
}
