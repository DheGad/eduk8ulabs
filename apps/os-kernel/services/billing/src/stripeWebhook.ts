/**
 * @file stripeWebhook.ts
 * @service billing
 * @version V99
 * @description Stripe Webhook Nervous System — cryptographically verified event processor.
 *
 * Events handled:
 *   checkout.session.completed   → Activate account, provision V18 API key, send welcome email
 *   invoice.payment_failed       → Mark tenant PAST_DUE, block proxy traffic
 *   customer.subscription.deleted → Graceful offboarding, revoke key, freeze audit vault
 */

import Stripe from "stripe";
import { generateKey, revokeKey } from "../../router-service/src/apiKeyService.js";
import { dispatchWelcomeEmail, dispatchPaymentFailedAlert, dispatchOffboardingEmail } from "./emailEngine.js";

// ----------------------------------------------------------------
// STRIPE CLIENT
// ----------------------------------------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// ----------------------------------------------------------------
// IN-MEMORY TENANT REGISTRY
// (In production: replace with PostgreSQL via db.ts)
// ----------------------------------------------------------------

export interface TenantRecord {
  tenantId: string;
  email: string;
  companyName: string;
  industry: string;
  plan: "starter" | "growth" | "enterprise";
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  streetmpApiKey: string;
  keyId: string;
  status: "active" | "past_due" | "cancelled" | "provisioning";
  provisionedAt: string;
}

const TENANT_REGISTRY = new Map<string, TenantRecord>(); // keyed by stripeCustomerId

export function getTenantByCustomerId(customerId: string): TenantRecord | undefined {
  return TENANT_REGISTRY.get(customerId);
}

export function getTenantByEmail(email: string): TenantRecord | undefined {
  return [...TENANT_REGISTRY.values()].find((t) => t.email === email);
}

// ----------------------------------------------------------------
// POLICY MAPPING
// ----------------------------------------------------------------
const PLAN_TO_POLICY: Record<string, string> = {
  starter: "GENERIC_BASELINE",
  growth: "FINANCIAL_GRADE",
  enterprise: "SOVEREIGN_DEFENSE",
};

// ----------------------------------------------------------------
// WEBHOOK HANDLER
// ----------------------------------------------------------------

/**
 * processStripeWebhook
 * ---------------------
 * Call this with the raw request body buffer and Stripe-Signature header.
 * Returns a structured result for the Express handler to respond with.
 */
export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{ status: number; message: string }> {
  let event: Stripe.Event;

  // ── Signature Verification ──────────────────────────────────────
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`[V99:StripeWebhook] ❌ Signature verification failed: ${err.message}`);
    return { status: 400, message: `Webhook signature verification failed: ${err.message}` };
  }

  console.info(`[V99:StripeWebhook] ✅ Verified event: ${event.type} id=${event.id}`);

  // ── Event Router ────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.debug(`[V99:StripeWebhook] Unhandled event type: ${event.type} — ignoring.`);
    }
  } catch (err: any) {
    console.error(`[V99:StripeWebhook] Handler error for ${event.type}: ${err.message}`);
    return { status: 500, message: `Handler error: ${err.message}` };
  }

  return { status: 200, message: "Webhook processed OK." };
}

// ── Handler: checkout.session.completed ─────────────────────────

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const email = session.customer_details?.email || (session.metadata?.email ?? "");
  const companyName = session.metadata?.company_name ?? email.split("@")[1] ?? "Unknown Corp";
  const industry = session.metadata?.industry ?? "other";
  const plan = (session.metadata?.plan as TenantRecord["plan"]) || "starter";
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";

  if (!email || !stripeCustomerId) {
    console.warn(`[V99:StripeWebhook] checkout.session.completed missing email or customer_id — skipping.`);
    return;
  }

  // Provision V18 tenant API key
  const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const policyId = PLAN_TO_POLICY[plan] || "GENERIC_BASELINE";
  const label = `${companyName} — ${plan.toUpperCase()} Plan Key`;

  const { plaintext: streetmpApiKey, record } = generateKey(tenantId, policyId, label);

  const tenant: TenantRecord = {
    tenantId,
    email,
    companyName,
    industry,
    plan,
    stripeCustomerId,
    stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? "",
    streetmpApiKey,
    keyId: record.key_id,
    status: "active",
    provisionedAt: new Date().toISOString(),
  };

  TENANT_REGISTRY.set(stripeCustomerId, tenant);

  console.info(
    `[V99:StripeWebhook] 🎉 Provisioned tenant: tenantId=${tenantId} plan=${plan} email=${email}`
  );

  // Dispatch the welcome email with the live API key
  await dispatchWelcomeEmail({
    toEmail: email,
    companyName,
    plan,
    streetmpApiKey,
    tenantId,
  });
}

// ── Handler: invoice.payment_failed ─────────────────────────────

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? "";
  const tenant = TENANT_REGISTRY.get(customerId);

  if (!tenant) {
    console.warn(`[V99:StripeWebhook] payment_failed: unknown customer ${customerId}`);
    return;
  }

  // Mark tenant as PAST_DUE — this status is checked by the proxy quota guard
  tenant.status = "past_due";
  TENANT_REGISTRY.set(customerId, tenant);

  console.warn(
    `[V99:StripeWebhook] ⚠️  Payment failed: tenantId=${tenant.tenantId} email=${tenant.email} — status→PAST_DUE`
  );

  await dispatchPaymentFailedAlert({
    toEmail: tenant.email,
    companyName: tenant.companyName,
    amount: (invoice.amount_due / 100).toFixed(2),
    currency: invoice.currency.toUpperCase(),
  });
}

// ── Handler: customer.subscription.deleted ───────────────────────

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? "";
  const tenant = TENANT_REGISTRY.get(customerId);

  if (!tenant) {
    console.warn(`[V99:StripeWebhook] subscription.deleted: unknown customer ${customerId}`);
    return;
  }

  // Revoke V18 API key — immediate traffic block
  const revoked = revokeKey(tenant.keyId);
  tenant.status = "cancelled";
  TENANT_REGISTRY.set(customerId, tenant);

  console.info(
    `[V99:StripeWebhook] 🔒 Subscription cancelled: tenantId=${tenant.tenantId} keyRevoked=${revoked}`
  );

  await dispatchOffboardingEmail({
    toEmail: tenant.email,
    companyName: tenant.companyName,
  });
}
