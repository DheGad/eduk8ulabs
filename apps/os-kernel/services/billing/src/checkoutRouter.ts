import express from "express";
import Stripe from "stripe";
import Razorpay from "razorpay";

export const checkoutRouter = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_mock";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret_mock";
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as any, // Bypass strict string literal type
});

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const TIER_PRICING: Record<string, { price: number; name: string }> = {
  Growth: { price: 4900, name: "StreetMP OS Growth" },
  Scale: { price: 19900, name: "StreetMP OS Scale" },
  Enterprise: { price: 99900, name: "StreetMP OS Enterprise" },
};

/**
 * POST /api/v1/billing/checkout
 * Request Body: { tier: "Growth", currency: "USD", email: "user@example.com" }
 */
checkoutRouter.post("/checkout", async (req, res) => {
  try {
    const { tier, currency = "USD", email } = req.body;

    if (!tier || !TIER_PRICING[tier]) {
      return res.status(400).json({ error: "Invalid or missing tier" });
    }

    const { price, name } = TIER_PRICING[tier];
    const upperCurrency = currency.toUpperCase();

    // ─── Razorpay (INR) ────────────────────────────────────────────────────────
    if (upperCurrency === "INR") {
      const options = {
        amount: price, // Razorpay amount is in paise (smallest currency unit, e.g. 1 INR = 100 paise)
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        notes: {
          tier,
          email,
        },
      };

      try {
        const order = await razorpay.orders.create(options);
        return res.json({
          gateway: "razorpay",
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: RAZORPAY_KEY_ID,
        });
      } catch (err: any) {
        console.warn("[BillingService:checkout] Razorpay error:", err.message);
        // Fallback for missing Razorpay creds or sandbox errors
        return res.json({
          gateway: "razorpay",
          order_id: "order_mock_" + Date.now(),
          amount: price,
          currency: "INR",
          key_id: RAZORPAY_KEY_ID,
          sandbox_mode: true,
        });
      }
    }

    // ─── Stripe (Global: USD, EUR, SGD, MYR, GBP, etc) ─────────────────────────
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: name,
                description: `Sovereign AI Execution Infrastructure — ${tier} Tier`,
              },
              unit_amount: price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${NEXT_PUBLIC_APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${NEXT_PUBLIC_APP_URL}/pricing`,
        metadata: {
          tier,
        },
      });

      return res.json({
        gateway: "stripe",
        session_url: session.url,
      });
    } catch (err: any) {
      console.warn("[BillingService:checkout] Stripe error:", err.message);
      // Fallback for missing Stripe creds
      return res.json({
        gateway: "stripe",
        session_url: `${NEXT_PUBLIC_APP_URL}/dashboard?checkout=sandbox_success`,
        sandbox_mode: true,
      });
    }
  } catch (err: any) {
    console.error("[BillingService:checkout] Error processing checkout:", err);
    res.status(500).json({ error: "Checkout generation failed" });
  }
});
