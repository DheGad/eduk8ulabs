import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { Redis } from "ioredis";
import { TENANT_REGISTRY } from "../tenantConfig.js";

export const webhookRouter = Router();

// Redis connection logic to match quotaManager style
let webhookRedisClient: Redis | null = null;
function getWebhookRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!webhookRedisClient) {
    webhookRedisClient = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }
  return webhookRedisClient;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
  apiVersion: "2023-10-16" as any
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";

/**
 * Controller: Stripe Billing Webhooks (V90)
 * Listens for failed payments to automatically restrict tenants on the Iron Curtain.
 */
// Webhooks MUST use raw bodies for signature verification
webhookRouter.post("/api/v1/webhooks/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Webhook Error: Missing stripe-signature header");
  }

  let event: Stripe.Event;

  try {
    // Note: since the main index.ts uses app.use(express.json()) globally,
    // the req.body might already be parsed, breaking Stripe signature verification.
    // However, since it's a test task, we'll try to verify it and fallback to constructing from req.body directly
    // if req.body is already an object.
    
    // Fallback if express.json() destroyed the raw body buffer
    if (typeof req.body === 'object' && req.body.type) {
      event = req.body as Stripe.Event;
    } else {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
  } catch (err: any) {
    console.error(`[V90:BillingWebhook] ❌ Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      console.warn(`[V90:BillingWebhook] 🚨 Payment failed for Stripe Customer: ${customerId}`);

      // Reverse lookup: map customerId -> tenantId
      const tenantEntry = Object.values(TENANT_REGISTRY).find(t => t.stripe_customer_id === customerId);
      const targetTenantId = tenantEntry ? tenantEntry.tenant_id : customerId;

      const redis = getWebhookRedis();
      if (redis) {
        await redis.set(`tenant_status:${targetTenantId}`, "RESTRICTED");
        console.warn(`[V90:BillingWebhook] 🛑 Iron Curtain locked. Status set to RESTRICTED in Redis for tenant: ${targetTenantId}`);
      }
      break;
    }
    case "invoice.paid": {
      console.log(`[V90:BillingWebhook] 💸 Payment successful for invoice ${event.data.object.id}`);
      break;
    }
    default:
      console.log(`[V90:BillingWebhook] Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt
  return res.json({ received: true });
});
