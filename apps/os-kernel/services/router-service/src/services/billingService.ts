import Stripe from "stripe";
import { TENANT_REGISTRY } from "../tenantConfig.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
  apiVersion: "2023-10-16" as any,
});

/**
 * V90: Stripe Metered Billing Integration
 * 
 * Reports token usage to Stripe asynchronously.
 * Fire-and-forget pattern ensures the critical AI routing path
 * is never blocked by a billing API call.
 */
export const reportUsage = async (tenantId: string, tokens: number) => {
  if (tokens <= 0) return;
  
  const targetId = tenantId.trim().toLowerCase();
  const tenant = TENANT_REGISTRY[targetId];

  if (!tenant || !tenant.stripe_subscription_item_id) {
    // For sandbox/generic tenants without Stripe IDs, silently skip
    return;
  }

  // Fire-and-forget logging
  Promise.resolve().then(async () => {
    try {
      await (stripe.subscriptionItems as any).createUsageRecord(
        tenant.stripe_subscription_item_id as string,
        {
          quantity: tokens,
          timestamp: Math.floor(Date.now() / 1000),
          action: "increment"
        }
      );
      console.log(`[V90:BillingService] ✅ Logged ${tokens} tokens for ${targetId} to Stripe.`);
    } catch (e) {
      console.error(`[V90:BillingService] ❌ Failed to report usage for ${targetId}`, e);
    }
  });
};
