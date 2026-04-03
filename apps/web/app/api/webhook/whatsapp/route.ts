import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

// ── DB Pool ───────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 3000,
});

// ── Types: Meta Webhook Payload ───────────────────────────────────────────────
interface MetaStatusChange {
  id: string;                    // wa_message_id from Meta
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;             // Unix epoch string
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      statuses?: MetaStatusChange[];
    };
    field: string;
  }>;
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

// ── Signature Verification ────────────────────────────────────────────────────
function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("[WhatsApp] META_APP_SECRET is not set");
    return false;
  }
  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ── GET: Meta Webhook Verification Challenge ──────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[WhatsApp] Webhook verified by Meta.");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WhatsApp] Webhook verification failed. Token mismatch.");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST: Delivery Receipt Handler ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // 1. Verify payload authenticity
  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn("[WhatsApp] Invalid X-Hub-Signature-256 — payload rejected.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true }); // Ignore non-WA events
  }

  // 2. Process status updates
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const statuses = change.value?.statuses ?? [];

      for (const statusUpdate of statuses) {
        await upsertDeliveryStatus(statusUpdate);
      }
    }
  }

  // Always return 200 to Meta immediately (even on partial errors)
  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── DB Upsert: Update wa_messages delivery_status ─────────────────────────────
async function upsertDeliveryStatus(status: MetaStatusChange) {
  const { id: metaMessageId, status: deliveryStatus, timestamp, errors } = status;
  const ts = new Date(parseInt(timestamp, 10) * 1000).toISOString();

  const errorCode = errors?.[0]?.code?.toString() ?? null;

  const sql = `
    UPDATE wa_messages
    SET
      delivery_status = $1,
      meta_message_id = $2,
      error_code      = $3,
      sent_at         = CASE WHEN $1 = 'sent'      THEN $4::timestamptz ELSE sent_at      END,
      delivered_at    = CASE WHEN $1 = 'delivered' THEN $4::timestamptz ELSE delivered_at END,
      read_at         = CASE WHEN $1 = 'read'      THEN $4::timestamptz ELSE read_at      END
    WHERE meta_message_id = $2
       OR (meta_message_id IS NULL AND id::text = $2)
  `;

  try {
    await pool.query(sql, [deliveryStatus, metaMessageId, errorCode, ts]);
  } catch (err) {
    console.error("[WhatsApp] DB update failed for message:", metaMessageId, err);
  }
}
