/**
 * @file app/api/billing/razorpay/verify/route.ts
 * @route POST /api/billing/razorpay/verify
 * @description Server-side signature verification after Checkout.js returns.
 *   Called by the frontend BEFORE redirecting to success page.
 *   Marks the order PAID and upgrades the org's plan_tier.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createHmac } from "crypto";

function verifySignature(
  orderId:   string,
  paymentId: string,
  signature: string
): boolean {
  const secret   = process.env.RAZORPAY_KEY_SECRET ?? "";
  const message  = `${orderId}|${paymentId}`;
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

const PLAN_TIER_MAP: Record<string, string> = {
  Pro:        "PRO",
  Enterprise: "ENTERPRISE",
};

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  const orgId  = req.headers.get("x-streetmp-org-id");
  if (!userId || !orgId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    razorpay_order_id:   string;
    razorpay_payment_id: string;
    razorpay_signature:  string;
  };

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json(
      { success: false, error: "Missing payment verification fields" },
      { status: 400 }
    );
  }

  // ── Verify signature ───────────────────────────────────────────────────────
  const valid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) {
    console.error(`[Razorpay/verify] INVALID SIGNATURE — order: ${razorpay_order_id} org: ${orgId}`);
    return NextResponse.json(
      { success: false, error: "Payment signature verification failed. Contact support." },
      { status: 400 }
    );
  }

  // ── Mark order PAID ────────────────────────────────────────────────────────
  const { rows } = await pool.query<{ org_id: string; plan_name: string }>(
    `UPDATE razorpay_orders
       SET status              = 'PAID',
           razorpay_payment_id = $2,
           razorpay_signature  = $3,
           updated_at          = NOW()
     WHERE razorpay_order_id = $1
       AND org_id            = $4::UUID
       AND status            != 'PAID'
     RETURNING org_id, plan_name`,
    [razorpay_order_id, razorpay_payment_id, razorpay_signature, orgId]
  );

  if (!rows.length) {
    // Already marked PAID (idempotent) or org mismatch
    return NextResponse.json({ success: true, already_processed: true });
  }

  const { org_id, plan_name } = rows[0];
  const tier = PLAN_TIER_MAP[plan_name];

  if (tier) {
    // Upgrade org tier + billing provider
    await pool.query(
      `UPDATE organizations
         SET plan_tier        = $1::plan_tier,
             billing_provider = 'RAZORPAY',
             updated_at       = NOW()
       WHERE id = $2::UUID`,
      [tier, org_id]
    );

    // Reset quota to new plan
    await pool.query(
      `UPDATE org_usage_quotas
         SET plan_id                  = (SELECT id FROM subscription_plans WHERE name = LOWER($1) LIMIT 1),
             current_month_executions = 0,
             limit_reached_at         = NULL,
             month_start              = DATE_TRUNC('month', NOW()),
             updated_at               = NOW()
       WHERE org_id = $2::UUID`,
      [plan_name, org_id]
    );

    console.info(`[Razorpay/verify] ✅ Verified — org ${org_id} → ${tier} (payment: ${razorpay_payment_id})`);
  }

  return NextResponse.json({
    success: true,
    org_id,
    plan:    plan_name,
    tier,
    payment_id: razorpay_payment_id,
  });
}
