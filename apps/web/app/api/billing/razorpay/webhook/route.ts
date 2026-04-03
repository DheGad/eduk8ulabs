/**
 * @file app/api/billing/razorpay/webhook/route.ts
 * @route POST /api/billing/razorpay/webhook
 * @description Razorpay Webhook Listener.
 *   Handles: payment.captured, subscription.activated, subscription.cancelled
 *
 *   Security:
 *     - x-razorpay-signature header verified via HMAC-SHA256
 *     - RAZORPAY_WEBHOOK_SECRET set in Razorpay Dashboard → Webhooks
 *
 *   Register in Razorpay Dashboard:
 *     URL: https://os.streetmp.com/api/billing/razorpay/webhook
 *     Events: payment.captured, subscription.activated, subscription.cancelled
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret   = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ── Event: payment.captured ───────────────────────────────────────────────────

async function handlePaymentCaptured(entity: Record<string, unknown>) {
  const orderId  = entity.order_id  as string | undefined;
  const payId    = entity.id        as string | undefined;
  if (!orderId || !payId) return;

  const { rows } = await pool.query<{ org_id: string; plan_name: string }>(
    `UPDATE razorpay_orders
       SET status              = 'PAID',
           razorpay_payment_id = $2,
           updated_at          = NOW()
     WHERE razorpay_order_id = $1 AND status != 'PAID'
     RETURNING org_id, plan_name`,
    [orderId, payId]
  );

  if (!rows.length) return; // Already processed

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
    console.info(`[RzpWebhook] payment.captured → org ${org_id} → ${tier}`);
  }
}

// ── Event: subscription.activated ────────────────────────────────────────────

async function handleSubscriptionActivated(entity: Record<string, unknown>) {
  const rzpSubId   = entity.id            as string | undefined;
  const startEpoch = entity.current_start as number | undefined;
  const endEpoch   = entity.current_end   as number | undefined;

  if (!rzpSubId) return;

  await pool.query(
    `UPDATE razorpay_subscriptions
       SET status        = 'ACTIVE',
           current_start = TO_TIMESTAMP($2),
           current_end   = TO_TIMESTAMP($3),
           updated_at    = NOW()
     WHERE razorpay_subscription_id = $1`,
    [rzpSubId, startEpoch, endEpoch]
  );
  console.info(`[RzpWebhook] subscription.activated → ${rzpSubId}`);
}

// ── Event: subscription.cancelled ────────────────────────────────────────────

async function handleSubscriptionCancelled(entity: Record<string, unknown>) {
  const rzpSubId = entity.id as string | undefined;
  if (!rzpSubId) return;

  const { rows } = await pool.query<{ org_id: string }>(
    `UPDATE razorpay_subscriptions
       SET status = 'CANCELLED', updated_at = NOW()
     WHERE razorpay_subscription_id = $1
     RETURNING org_id`,
    [rzpSubId]
  );

  if (rows.length) {
    await pool.query(
      `UPDATE organizations
         SET plan_tier = 'FREE', updated_at = NOW()
       WHERE id = $1::UUID`,
      [rows[0].org_id]
    );
    console.info(`[RzpWebhook] subscription.cancelled → org ${rows[0].org_id} → FREE`);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[RzpWebhook] Signature verification FAILED");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { event: string; payload: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  type EventPayload = { entity?: Record<string, unknown> };
  const getEntity = (key: string): Record<string, unknown> =>
    ((event.payload[key] as EventPayload | undefined)?.entity ?? {});

  try {
    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(getEntity("payment"));
        break;
      case "subscription.activated":
        await handleSubscriptionActivated(getEntity("subscription"));
        break;
      case "subscription.cancelled":
        await handleSubscriptionCancelled(getEntity("subscription"));
        break;
      default:
        // Unhandled — acknowledge without error
        break;
    }
  } catch (err) {
    console.error(`[RzpWebhook] Handler error for "${event.event}":`, (err as Error).message);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
