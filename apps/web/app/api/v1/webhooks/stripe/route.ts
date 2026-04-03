import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// ─── Phase 6: Dual Webhook Receivers (Stripe) ────────────────────────────────
// V18 Tenant Activation Logic and Welcome Email trigger for global payments.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as any, // Bypass strict string literal type while matching runtime
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.warn("[StripeWebhook] Signature verification failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      const tier = session.metadata?.tier;
      
      console.info(`[V18:TenantActivation] Stripe payment captured for ${email} (Tier: ${tier})`);
      
      // TODO: Actual DB tenant activation and Resend welcome email logic
      // e.g. await db.query("UPDATE tenants SET tier = $1, status = 'ACTIVE' WHERE email = $2", [tier, email]);
      // e.g. await sendWelcomeEmail(email, tier);

      return NextResponse.json({ received: true, status: "activated" }, { status: 200 });
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const email = invoice.customer_email;
      
      console.warn(`[V18:Billing] Stripe payment failed for ${email}`);
      
      // TODO: Set the tenant status to PAST_DUE in the database and trigger a warning email
      // e.g. await db.query("UPDATE tenants SET status = 'PAST_DUE' WHERE email = $1", [email]);
      // e.g. await sendWarningEmail(email, "stripe");

      return NextResponse.json({ received: true, status: "payment_failed" }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (err: any) {
    console.error("[StripeWebhook] Error processing event:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
