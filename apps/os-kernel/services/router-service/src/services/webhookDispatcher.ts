/**
 * @file services/webhookDispatcher.ts
 * @service router-service
 * @phase Phase 5 — Scale & API Marketplace
 * @description
 *   Webhook Dispatcher — fired by the Sentinel when a CRITICAL threat is detected.
 *
 *   Flow:
 *     1. Sentinel-01/Auditor flags a SUSPICIOUS_ENTITY → calls `dispatchWebhooks()`
 *     2. Dispatcher fetches all ACTIVE, non-disabled webhook endpoints for the org
 *     3. For each endpoint, signs the payload with HMAC-SHA256 (matching Stripe's model)
 *     4. POSTs the signed JSON payload with a 5-second timeout
 *     5. Updates `last_triggered_at`, `last_status_code`, `failure_count` in DB
 *     6. Auto-disables endpoints after MAX_FAILURES consecutive failures
 *
 *   Signing:
 *     Header: `x-streetmp-signature: sha256=<hex_hmac>`
 *     Body:   JSON with `event`, `org_id`, `timestamp`, `data` fields
 *     Secret: stored as `signing_secret_hash` in `org_webhook_endpoints`
 *             The raw secret is only returned once at registration time.
 *
 *   Delivery is fire-and-forget — webhook failures never block the Sentinel.
 */

import { createHmac } from "node:crypto";
import { pool } from "../db.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const DISPATCH_TIMEOUT_MS = 5_000;
const MAX_FAILURES        = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  event:    string;              // e.g. "threat.critical"
  org_id:   string;
  timestamp: string;             // ISO-8601
  data:     Record<string, unknown>;
}

interface WebhookEndpoint {
  id:                  string;
  org_id:              string;
  url:                 string;
  signing_secret_hash: string;   // raw HMAC secret (not a hash — field name is legacy)
  failure_count:       number;
}

// ── SQL ───────────────────────────────────────────────────────────────────────

const FETCH_ENDPOINTS_SQL = `
  SELECT id, org_id, url, signing_secret_hash, failure_count
  FROM   org_webhook_endpoints
  WHERE  org_id      = $1::UUID
    AND  is_active   = TRUE
    AND  disabled_at IS NULL
  ORDER  BY created_at ASC
  LIMIT  20;
`;

const UPDATE_ENDPOINT_SUCCESS_SQL = `
  UPDATE org_webhook_endpoints
  SET
    last_triggered_at = NOW(),
    last_status_code  = $2,
    failure_count     = 0,
    updated_at        = NOW()
  WHERE id = $1;
`;

const UPDATE_ENDPOINT_FAILURE_SQL = `
  UPDATE org_webhook_endpoints
  SET
    last_triggered_at = NOW(),
    last_status_code  = $2,
    failure_count     = failure_count + 1,
    -- Auto-disable after MAX_FAILURES consecutive failures
    disabled_at       = CASE
                          WHEN failure_count + 1 >= $3 THEN NOW()
                          ELSE disabled_at
                        END,
    updated_at        = NOW()
  WHERE id = $1
  RETURNING failure_count, disabled_at;
`;

// ── Signing ───────────────────────────────────────────────────────────────────

function signPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

// ── Delivery ──────────────────────────────────────────────────────────────────

async function deliverWebhook(
  endpoint: WebhookEndpoint,
  payload:  WebhookPayload,
  body:     string
): Promise<void> {
  const signature = signPayload(endpoint.signing_secret_hash, body);

  let statusCode = 0;
  let success    = false;

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method:  "POST",
      headers: {
        "Content-Type":           "application/json",
        "x-streetmp-signature":   signature,
        "x-streetmp-event":       payload.event,
        "x-streetmp-delivery-id": endpoint.id,
        "User-Agent":             "StreetMP-Sentinel/5.0",
      },
      body:    body,
      signal:  controller.signal,
    });

    clearTimeout(timer);
    statusCode = response.status;
    success    = response.status >= 200 && response.status < 300;
  } catch (err) {
    // Timeout or network error
    statusCode = 0;
    success    = false;
    console.warn(
      `[WebhookDispatcher] Delivery failed for endpoint ${endpoint.id}: `,
      (err as Error).message
    );
  }

  if (success) {
    await pool.query(UPDATE_ENDPOINT_SUCCESS_SQL, [endpoint.id, statusCode]);
    console.info(
      `[WebhookDispatcher] ✅ Delivered "${payload.event}" to ${endpoint.url} → ${statusCode}`
    );
  } else {
    const { rows } = await pool.query<{ failure_count: number; disabled_at: string | null }>(
      UPDATE_ENDPOINT_FAILURE_SQL,
      [endpoint.id, statusCode, MAX_FAILURES]
    );

    const updated = rows[0];
    if (updated?.disabled_at) {
      console.error(
        `[WebhookDispatcher] ❌ Endpoint ${endpoint.id} AUTO-DISABLED after ${MAX_FAILURES} failures.`
      );
    } else {
      console.warn(
        `[WebhookDispatcher] ⚠️  Delivery failed for ${endpoint.url} → ${statusCode} ` +
        `(failures: ${updated?.failure_count ?? "?"}/${MAX_FAILURES})`
      );
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch CRITICAL threat webhooks for an organization.
 * Fire-and-forget — never throws, never blocks the Sentinel run.
 *
 * @param orgId    UUID of the organization
 * @param event    Event name (e.g. "threat.critical", "sentinel.block")
 * @param data     Event payload data
 */
export async function dispatchWebhooks(
  orgId:   string,
  event:   string,
  data:    Record<string, unknown>
): Promise<void> {
  let endpoints: WebhookEndpoint[];

  try {
    const { rows } = await pool.query<WebhookEndpoint>(FETCH_ENDPOINTS_SQL, [orgId]);
    endpoints = rows;
  } catch (err) {
    console.error("[WebhookDispatcher] Failed to fetch endpoints:", (err as Error).message);
    return;
  }

  if (endpoints.length === 0) return;

  const payload: WebhookPayload = {
    event,
    org_id:    orgId,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  console.info(
    `[WebhookDispatcher] Dispatching "${event}" to ${endpoints.length} endpoint(s) for org ${orgId}`
  );

  // Fire all deliveries in parallel — failures are isolated per-endpoint
  await Promise.allSettled(
    endpoints.map((ep) => deliverWebhook(ep, payload, body))
  );
}

/**
 * Register a new webhook endpoint for an org.
 * Returns the raw signing secret ONCE — it is never retrievable again.
 * The raw secret is stored directly in `signing_secret_hash` (field name is legacy).
 */
export async function registerWebhookEndpoint(
  orgId:       string,
  url:         string,
  description: string,
  signingSecret: string  // caller generates with randomBytes(32).toString('hex')
): Promise<{ id: string; signing_secret: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO org_webhook_endpoints
       (org_id, url, signing_secret_hash, description)
     VALUES ($1::UUID, $2, $3, $4)
     RETURNING id`,
    [orgId, url, signingSecret, description]
  );

  return { id: rows[0].id, signing_secret: signingSecret };
}
