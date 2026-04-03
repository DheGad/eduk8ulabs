import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/meta-api";

// ── DB Pool ───────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 3000,
});

// ── Request / Response Types ──────────────────────────────────────────────────
interface CampaignDispatchRequest {
  org_id: string;
  campaign_name: string;
  template_name: string;
  language_code?: string;
  phone_numbers: string[];
}

interface DispatchResult {
  phone: string;
  ok: boolean;
  message_id?: string;
  error?: string;
}

// ── POST /api/whatsapp/campaign ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: CampaignDispatchRequest;

  // 1. Parse + validate request
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { org_id, campaign_name, template_name, language_code = "en_US", phone_numbers } = body;

  if (!org_id || !campaign_name || !template_name || !Array.isArray(phone_numbers) || phone_numbers.length === 0) {
    return NextResponse.json(
      { error: "Missing required fields: org_id, campaign_name, template_name, phone_numbers[]" },
      { status: 422 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Create campaign record
    const campaignRes = await client.query<{ id: string }>(
      `INSERT INTO wa_campaigns (org_id, campaign_name, status, scheduled_at)
       VALUES ($1, $2, 'running', NOW())
       RETURNING id`,
      [org_id, campaign_name]
    );

    const campaign_id = campaignRes.rows[0].id;

    // 3. Dispatch messages — errors are isolated per recipient, never crash the loop
    const results: DispatchResult[] = [];

    for (const phone of phone_numbers) {
      const trimmed = phone.trim();
      if (!trimmed) continue;

      const result = await sendWhatsAppTemplate(trimmed, template_name, language_code);

      if (result.ok) {
        // Insert successful message record
        await client.query(
          `INSERT INTO wa_messages
             (campaign_id, recipient_phone, template_used, delivery_status, meta_message_id, sent_at)
           VALUES ($1, $2, $3, 'sent', $4, NOW())`,
          [campaign_id, trimmed, template_name, result.messageId]
        );

        results.push({ phone: trimmed, ok: true, message_id: result.messageId });
      } else {
        // Insert failed message record — do NOT abort the transaction
        await client.query(
          `INSERT INTO wa_messages
             (campaign_id, recipient_phone, template_used, delivery_status, error_code)
           VALUES ($1, $2, $3, 'failed', $4)`,
          [campaign_id, trimmed, template_name, result.code?.toString() ?? "UNKNOWN"]
        );

        results.push({ phone: trimmed, ok: false, error: result.error });
      }
    }

    // 4. Update campaign status
    const total   = results.length;
    const sent    = results.filter((r) => r.ok).length;
    const failed  = total - sent;
    const finalStatus = failed === total ? "failed" : "completed";

    await client.query(
      `UPDATE wa_campaigns SET status = $1 WHERE id = $2`,
      [finalStatus, campaign_id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      campaign_id,
      summary: { total, sent, failed },
      results,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[WhatsApp Campaign] Transaction failed:", err);
    return NextResponse.json({ error: "Internal server error during dispatch" }, { status: 500 });
  } finally {
    client.release();
  }
}
