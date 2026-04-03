/**
 * @file alertEngine.ts
 * @service router-service
 * @version V63
 * @description Proactive Alert Engine — Outbound Quota Threshold Notifier
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 *
 *  When a tenant crosses a critical token-consumption milestone
 *  (80%, 90%, or 100% of monthly quota), this module fires an
 *  outbound HTTP POST to a configured webhook URL (Slack, Discord,
 *  PagerDuty, or any HTTP endpoint).
 *
 *  All dispatch calls are FIRE-AND-FORGET — the function returns
 *  immediately and must NEVER be awaited on the hot path.
 *
 * ================================================================
 * SECURITY
 * ================================================================
 *
 *  • The webhook URL is read from QUOTA_ALERT_WEBHOOK_URL env var.
 *  • Never logged in plaintext — only the hostname is surfaced.
 *  • Failures are caught and demoted to warnings — alert failures
 *    must NEVER interrupt AI prompt execution.
 *
 * ================================================================
 */

import axios from "axios";

// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------

const WEBHOOK_URL = process.env.QUOTA_ALERT_WEBHOOK_URL ?? "";

/**
 * Maximum time to wait for the webhook response before timing out.
 * Kept intentionally short — we do not want a slow webhook to
 * hold any thread resources.
 */
const WEBHOOK_TIMEOUT_MS = 8000;

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export interface QuotaAlertPayload {
  tenantId:      string;
  currentTokens: number;
  limitTokens:   number;
  threshold:     80 | 90 | 100;
  billingPeriod: string; // YYYY-MM
  firedAt:       string; // ISO-8601
  burnPercent:   number; // exact float, e.g. 83.4
  /** V70: Correlation trace ID of the request that triggered this alert */
  traceId?:      string;
}

// ----------------------------------------------------------------
// DISPATCH FUNCTION
// ----------------------------------------------------------------

/**
 * Fires an HTTP POST webhook notification for a quota threshold crossing.
 *
 * CONTRACT: This function MUST be called with floating-Promise semantics:
 *   Promise.resolve().then(() => dispatchQuotaAlert(...));
 *
 * It MUST NEVER be awaited directly on the request hot path.
 *
 * @param tenantId      - Tenant identifier (e.g. "jpmc-global")
 * @param currentTokens - New cumulative token total after this execution
 * @param limitTokens   - Tenant's monthly token cap
 * @param threshold     - The specific threshold crossed: 80 | 90 | 100
 */
export async function dispatchQuotaAlert(
  tenantId:      string,
  currentTokens: number,
  limitTokens:   number,
  threshold:     80 | 90 | 100,
  traceId?:      string
): Promise<void> {
  const billingPeriod = getBillingPeriod();
  const burnPercent   = parseFloat(((currentTokens / limitTokens) * 100).toFixed(2));
  const firedAt       = new Date().toISOString();

  // ---- High-priority system warning (always emitted, even if webhook disabled) ----
  console.warn(
    `[V63 ALERT] Tenant ${tenantId} crossed ${threshold}% of monthly quota ` +
    `(${currentTokens.toLocaleString()} / ${limitTokens.toLocaleString()} tokens, ` +
    `${burnPercent}% burn) — period=${billingPeriod}`
  );

  if (!WEBHOOK_URL) {
    console.warn(
      "[V63:AlertEngine] QUOTA_ALERT_WEBHOOK_URL is not set — " +
      "alert logged to console only. Set QUOTA_ALERT_WEBHOOK_URL to enable webhook dispatch."
    );
    return;
  }

  const payload: QuotaAlertPayload = {
    tenantId,
    currentTokens,
    limitTokens,
    threshold,
    billingPeriod,
    firedAt,
    burnPercent,
    traceId,
  };

  // ---- Build human-readable Slack/Discord/generic message body ----
  const alertMessage = buildAlertMessage(payload);

  // ---- Attempt webhook dispatch ----
  try {
    const webhookHost = (() => {
      try { return new URL(WEBHOOK_URL).hostname; }
      catch { return "configured-webhook"; }
    })();

    console.info(
      `[V63:AlertEngine] Dispatching ${threshold}% quota alert for tenant=${tenantId} ` +
      `→ ${webhookHost}`
    );

    await axios.post(
      WEBHOOK_URL,
      alertMessage,
      {
        timeout: WEBHOOK_TIMEOUT_MS,
        headers: { "Content-Type": "application/json" },
      }
    );

    console.info(
      `[V63:AlertEngine] ✅ Alert dispatched successfully: ` +
      `tenant=${tenantId} threshold=${threshold}% period=${billingPeriod}`
    );

  } catch (err: unknown) {
    // CRITICAL: webhook failure must NEVER surface to the caller.
    // Demote to a warning — telemetry only.
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[V63:AlertEngine] ⚠️  Webhook dispatch failed (non-fatal): ` +
      `tenant=${tenantId} threshold=${threshold}% error="${errMsg}"`
    );
  }
}

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

/**
 * Returns the current billing period string in YYYY-MM format.
 * This is used both for the alert key namespace and message payload.
 */
export function getBillingPeriod(): string {
  const now = new Date();
  const year  = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Calculates seconds remaining until end of current UTC month.
 * Used by quotaManager to set the Redis alert lock TTL so it
 * expires precisely at the start of the next billing cycle.
 */
export function secondsUntilEndOfMonth(): number {
  const now = new Date();
  // First day of next month at 00:00:00 UTC
  const nextMonth = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, 0, 0, 0, 0
  ));
  return Math.max(1, Math.floor((nextMonth.getTime() - now.getTime()) / 1000));
}

/**
 * Builds the outbound webhook payload body.
 * Compatible with Slack Incoming Webhooks, Discord Webhooks,
 * and generic HTTP POST endpoints.
 */
function buildAlertMessage(p: QuotaAlertPayload): object {
  const severity = p.threshold === 100
    ? "🚨 CRITICAL"
    : p.threshold === 90
    ? "⚠️  WARNING"
    : "📊 NOTICE";

  const headline =
    `${severity} — Tenant \`${p.tenantId}\` has consumed **${p.threshold}%** of monthly AI quota`;

  const detail =
    `**Tokens Used:** ${p.currentTokens.toLocaleString()} / ${p.limitTokens.toLocaleString()}\n` +
    `**Burn Rate:** ${p.burnPercent}%\n` +
    `**Billing Period:** ${p.billingPeriod}\n` +
    `**Fired At:** ${p.firedAt}`;

  // Slack/Discord-compatible "blocks" body + fallback plain text
  return {
    // Slack Incoming Webhook format
    text: `${headline}\n${detail}`,
    // Discord / generic format
    content: `${headline}\n${detail}`,
    // Structured payload for programmatic consumers
    streetmp_quota_alert: {
      tenant_id:      p.tenantId,
      threshold_pct:  p.threshold,
      current_tokens: p.currentTokens,
      limit_tokens:   p.limitTokens,
      burn_pct:       p.burnPercent,
      billing_period: p.billingPeriod,
      fired_at:       p.firedAt,
    },
  };
}
