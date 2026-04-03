import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ─── Phase 6: Dual Webhook Receivers (Razorpay) ──────────────────────────────
// V18 Tenant Activation Logic and Welcome Email trigger for localized payments.

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "whsec_test_mock";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    // Verify signature using crypto
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("[RazorpayWebhook] Signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const { email, tier } = payment.notes || {};
      
      console.info(`[V18:TenantActivation] Razorpay payment captured for ${email} (Tier: ${tier})`);
      
      // TODO: Actual DB tenant activation and Resend welcome email logic
      // e.g. await db.query("UPDATE tenants SET tier = $1, status = 'ACTIVE' WHERE email = $2", [tier, email]);
      // e.g. await sendWelcomeEmail(email, tier);

      return NextResponse.json({ received: true, status: "activated" }, { status: 200 });
    } else if (event.event === "payment.failed" || event.event === "subscription.charged.failed") {
      const payloadEntity = event.payload.payment?.entity || event.payload.subscription?.entity;
      const email = payloadEntity?.email || payloadEntity?.notes?.email;
      
      console.warn(`[V18:Billing] Razorpay payment failed for ${email}`);
      
      // TODO: Set the tenant status to PAST_DUE in the database and trigger a warning email
      // e.g. await db.query("UPDATE tenants SET status = 'PAST_DUE' WHERE email = $1", [email]);
      // e.g. await sendWarningEmail(email, "razorpay");

      return NextResponse.json({ received: true, status: "payment_failed" }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (err: any) {
    console.error("[RazorpayWebhook] Error processing event:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
