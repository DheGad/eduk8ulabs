/**
 * @file app/api/billing/razorpay/order/route.ts
 * @route POST /api/billing/razorpay/order
 * @description Creates a Razorpay Order and returns checkout params to the frontend.
 *   Called when user clicks "Pay with Razorpay" on the Pricing/Checkout page.
 *   Defaults to INR for Indian orgs. Stores GSTIN if provided.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import Razorpay from "razorpay";
import { createHmac } from "crypto";

// ── Razorpay client (Next.js side, reads same env vars) ───────────────────────
const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     ?? "rzp_test_placeholder_key",
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? "rzp_test_placeholder_secret",
});

// ── INR plan catalog (paise, GST-inclusive) ───────────────────────────────────
const RZP_PLANS: Record<string, { amountPaise: number; gstPaise: number; basePaise: number; display: string }> = {
  pro: {
    basePaise:   338983,
    gstPaise:     61017,
    amountPaise: 400000,  // ₹4,000
    display:     "Pro",
  },
  enterprise: {
    basePaise:  2110169,
    gstPaise:    379831,
    amountPaise: 2490000, // ₹24,900
    display:     "Enterprise",
  },
};

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-streetmp-user-id");
  const orgId  = req.headers.get("x-streetmp-org-id");
  if (!userId || !orgId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { plan: string; gstin?: string };
  const planKey = body.plan?.toLowerCase();
  const plan = RZP_PLANS[planKey];

  if (!plan) {
    return NextResponse.json(
      { success: false, error: `Invalid plan. Choose: ${Object.keys(RZP_PLANS).join(", ")}` },
      { status: 400 }
    );
  }

  // Validate GSTIN format if provided
  if (body.gstin) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(body.gstin)) {
      return NextResponse.json({ success: false, error: "Invalid GSTIN format" }, { status: 400 });
    }
    // Persist GSTIN to org
    await pool.query(
      `UPDATE organizations SET gstin = $1, updated_at = NOW() WHERE id = $2::UUID`,
      [body.gstin, orgId]
    );
  }

  const receipt = `smp_${orgId.slice(0, 8)}_${Date.now()}`;

  try {
    const rzpOrder = await rzp.orders.create({
      amount:   plan.amountPaise,
      currency: "INR",
      receipt,
      notes: { org_id: orgId, plan: planKey, platform: "StreetMP OS" },
    });

    // Persist order to DB
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO razorpay_orders
         (org_id, razorpay_order_id, amount, currency, plan_name, gstin, gst_amount, receipt, notes)
       VALUES ($1::UUID, $2, $3, 'INR', $4, $5, $6, $7, $8::JSONB)
       RETURNING id`,
      [
        orgId, rzpOrder.id, plan.amountPaise, plan.display,
        body.gstin ?? null, plan.gstPaise, receipt,
        JSON.stringify({ plan: planKey }),
      ]
    );

    return NextResponse.json({
      success:           true,
      gateway:           "razorpay",
      razorpay_order_id: rzpOrder.id,
      db_order_id:       rows[0].id,
      amount:            plan.amountPaise,
      currency:          "INR",
      key_id:            process.env.RAZORPAY_KEY_ID ?? "rzp_test_placeholder_key",
      plan_display:      plan.display,
      gst_breakdown: {
        base_amount:  plan.basePaise,
        gst_amount:   plan.gstPaise,
        total_amount: plan.amountPaise,
        gst_rate:     "18%",
        currency:     "INR",
      },
    });
  } catch (err) {
    console.error("[Razorpay/order]", err);
    return NextResponse.json({ success: false, error: "Failed to create Razorpay order" }, { status: 500 });
  }
}
