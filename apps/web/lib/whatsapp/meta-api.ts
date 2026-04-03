/**
 * @file apps/web/lib/whatsapp/meta-api.ts
 * @description Meta Graph API — WhatsApp template message dispatcher.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaTextParameter {
  type: "text";
  text: string;
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters?: MetaTextParameter[];
}

export interface MetaSendTemplatePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: MetaTemplateComponent[];
  };
}

export interface MetaSendSuccessResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MetaSendErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

export type MetaSendResult =
  | { ok: true; messageId: string; waId: string }
  | { ok: false; error: string; code?: number };

// ── Core Send Function ────────────────────────────────────────────────────────

/**
 * Sends a WhatsApp template message via the Meta Graph API.
 *
 * @param to            - Recipient phone number in E.164 format (e.g. "+919876543210")
 * @param templateName  - Approved Meta template name (e.g. "onboarding_v1")
 * @param languageCode  - BCP-47 language code (default: "en_US")
 * @param components    - Optional template body/header variable substitutions
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  components?: MetaTemplateComponent[]
): Promise<MetaSendResult> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken   = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      ok: false,
      error: "META_PHONE_NUMBER_ID or META_ACCESS_TOKEN is not configured",
    };
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const body: MetaSendTemplatePayload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components && components.length > 0 ? { components } : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      // Next.js: do not cache outbound API calls
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok) {
      const errBody = json as MetaSendErrorResponse;
      console.error(`[MetaAPI] Send failed for ${to}:`, errBody.error);
      return {
        ok: false,
        error: errBody.error?.message ?? "Unknown Meta API error",
        code: errBody.error?.code,
      };
    }

    const success = json as MetaSendSuccessResponse;
    return {
      ok: true,
      messageId: success.messages[0].id,
      waId: success.contacts[0].wa_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error(`[MetaAPI] Fetch threw for ${to}:`, message);
    return { ok: false, error: message };
  }
}
