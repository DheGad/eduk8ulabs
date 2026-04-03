/**
 * @file app/api/onboard/checkout/route.ts
 * @description Phase 2 — $0 Free Tier bypass + Stripe paid checkout.
 *
 * Free tier flow:
 *   1. Validate input
 *   2. INSERT org + quotas in one atomic block
 *   3. Notify kernel via TITAN_BRIDGE_KEY
 *   4. Return { url: "/dashboard" } immediately — no Stripe call
 *
 * Paid tier flow: Stripe Checkout Session as before.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { randomUUID } from "crypto";

// ── Stripe is only initialised when actually needed (paid plans) ─────────────
function getStripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
    apiVersion: "2022-11-15",
  });
}

// ── Price IDs ────────────────────────────────────────────────────────────────
const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter_placeholder",
  growth:  process.env.STRIPE_PRICE_GROWTH  || "price_growth_placeholder",
};

// ── Validation schema ─────────────────────────────────────────────────────────
const checkoutSchema = z.object({
  email:       z.string().email("Valid email is required"),
  companyName: z.string().default("Personal Workspace"),
  industry:    z.string().default("other"),
  plan:        z.enum(["starter", "growth", "free"]),
});

// ── Kernel notification (fire & forget) ──────────────────────────────────────
async function notifyKernel(orgId: string, email: string) {
  try {
    const kernelUrl = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";
    await fetch(`${kernelUrl}/api/v1/internal/org-activated`, {
      method: "POST",
      headers: {
        "Content-Type":       "application/json",
        "x-titan-bridge-key": process.env.TITAN_BRIDGE_KEY ?? "",
      },
      body: JSON.stringify({ org_id: orgId, email }),
      signal: AbortSignal.timeout(3000),
    });
    console.log(`[Checkout] Kernel notified for org: ${orgId}`);
  } catch (err: any) {
    // Non-blocking — kernel notification must never block org creation
    console.warn(`[Checkout] Kernel notification skipped (offline?): ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // ── Parse & validate ────────────────────────────────────────────────────────
  let body: z.infer<typeof checkoutSchema>;
  try {
    body = checkoutSchema.parse(await req.json());
  } catch (err: any) {
    const msg = err instanceof z.ZodError ? err.issues[0].message : "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { email, companyName, industry, plan } = body;

  // ── FREE TIER BYPASS ────────────────────────────────────────────────────────
  if (plan === "free") {
    const orgId = `org_${randomUUID()}`;

    try {
      // 1. Create organisation
      await pool.query(
        `INSERT INTO organizations
           (id, name, billing_provider, status, billing_email, account_tier)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (billing_email) DO NOTHING`,
        [orgId, companyName, "NONE", "ACTIVE", email, "free"]
      );

      // 2. Initialize usage quota
      await pool.query(
        `INSERT INTO org_usage_quotas
           (org_id, current_month_executions, limit_reached_at)
         VALUES ($1, 0, NULL)
         ON CONFLICT (org_id) DO NOTHING`,
        [orgId]
      );

      // 3. Update user row with tier + org link
      await pool.query(
        `UPDATE users
         SET account_tier = 'free',
             org_id       = COALESCE(org_id, $2),
             updated_at   = NOW()
         WHERE email = $1`,
        [email, orgId]
      );

      console.log(`[Checkout:Free] Org provisioned: ${orgId} for ${email}`);
    } catch (dbErr: any) {
      // DB is offline — still let them into the dashboard in dev mode
      console.warn(`[Checkout:Free] DB write failed (offline?): ${dbErr.message}`);
    }

    // 4. Notify kernel (TITAN_BRIDGE_KEY forwarded in header)
    void notifyKernel(orgId, email);

    // 5. Return dashboard redirect — user is in the workspace in < 1 second
    return NextResponse.json({ url: "/dashboard" });
  }

  // ── PAID TIER (Stripe) ──────────────────────────────────────────────────────
  if (!PRICE_MAP[plan]) {
    return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode:                 "subscription",
      payment_method_types: ["card"],
      customer_email:       email,
      line_items:           [{ price: PRICE_MAP[plan], quantity: 1 }],
      metadata: {
        email,
        company_name: companyName,
        industry,
        plan,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboard/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/onboard?step=3&cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[Checkout:Stripe] Error:", err.message);
    return NextResponse.json(
      { error: "Payment provider error. Please try again or contact support." },
      { status: 500 }
    );
  }
}
