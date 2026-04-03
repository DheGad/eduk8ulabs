/**
 * @file emailEngine.ts
 * @service billing
 * @version V99
 * @description Email Dispatch Engine — Resend API integration for transactional emails.
 *
 * Dispatches:
 *   - Welcome email (on checkout.session.completed)
 *   - Payment failed alert (on invoice.payment_failed)
 *   - Offboarding confirmation (on subscription.deleted)
 *
 * Note: If RESEND_API_KEY is not set, emails are logged to stdout (dev mode).
 */

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export interface WelcomeEmailPayload {
  toEmail: string;
  companyName: string;
  plan: "starter" | "growth" | "enterprise";
  streetmpApiKey: string;
  tenantId: string;
}

export interface PaymentFailedPayload {
  toEmail: string;
  companyName: string;
  amount: string;
  currency: string;
}

export interface OffboardingPayload {
  toEmail: string;
  companyName: string;
}

// ----------------------------------------------------------------
// RESEND SENDER
// ----------------------------------------------------------------

const FROM_ADDRESS = process.env.EMAIL_FROM || "StreetMP OS <no-reply@streetmp.com>";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const DASHBOARD_URL = process.env.WEB_BASE_URL || "https://os.streetmp.com";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    // Dev mode: log to stdout
    console.info(`[V99:EmailEngine] 📧 [DEV MODE — no RESEND_API_KEY set]`);
    console.info(`[V99:EmailEngine]    TO: ${to}`);
    console.info(`[V99:EmailEngine]    SUBJECT: ${subject}`);
    console.info(`[V99:EmailEngine]    BODY (truncated): ${html.slice(0, 200)}...`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[V99:EmailEngine] Resend API error: ${err}`);
  }

  const data = await res.json();
  console.info(`[V99:EmailEngine] ✅ Email dispatched id=${data.id} to=${to}`);
}

// ----------------------------------------------------------------
// TEMPLATES
// ----------------------------------------------------------------

/** Welcome to Sovereign AI — sent after successful checkout */
export async function dispatchWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
  const { toEmail, companyName, plan, streetmpApiKey, tenantId } = payload;

  const integrationSnippet = `fetch("https://os.streetmp.com/v1/execute", {
  method: "POST",
  headers: {
    "x-api-key": "${streetmpApiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] })
})`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Welcome to StreetMP OS</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:40px auto;">
    <tr>
      <td style="background:linear-gradient(135deg,#002D1F,#001A12);padding:40px;border-radius:16px 16px 0 0;border:1px solid rgba(0,229,153,0.2);">
        <div style="font-size:11px;font-weight:700;letter-spacing:4px;color:#00E599;text-transform:uppercase;margin-bottom:16px;">
          STREETMP OS // SOVEREIGN AI
        </div>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#FFFFFF;line-height:1.2;">
          You're live on the<br/>
          <span style="color:#00E599;">Sovereign AI Grid.</span>
        </h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:16px;line-height:1.6;">
          ${companyName}'s account has been provisioned. You are now running on ${plan.charAt(0).toUpperCase() + plan.slice(1)} tier — protected by the full StreetMP AI governance stack.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#0F0F0F;padding:32px;border-left:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.4);text-transform:uppercase;">Your StreetMP API Key</p>
        <div style="background:#000;border:1px solid rgba(0,229,153,0.3);border-radius:8px;padding:16px;font-family:monospace;font-size:13px;color:#00E599;word-break:break-all;">
          ${streetmpApiKey}
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:8px;">
          ⚠️ Store this key securely. It will not be shown again.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#0F0F0F;padding:0 32px 32px;border-left:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.4);text-transform:uppercase;">One-Line Integration</p>
        <pre style="background:#000;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;font-size:11px;color:#A3E4C6;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${integrationSnippet}</pre>
      </td>
    </tr>
    <tr>
      <td style="background:#0F0F0F;padding:0 32px 32px;border-left:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);">
        <table width="100%">
          <tr>
            <td style="padding-right:8px;">
              <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;text-transform:uppercase;letter-spacing:2px;">Tenant ID</div>
                <div style="font-family:monospace;font-size:12px;color:#FFFFFF;">${tenantId}</div>
              </div>
            </td>
            <td style="padding-left:8px;">
              <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;text-transform:uppercase;letter-spacing:2px;">Plan</div>
                <div style="font-family:monospace;font-size:12px;color:#00E599;text-transform:uppercase;">${plan}</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#0F0F0F;padding:0 32px 40px;border-left:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);border-radius:0 0 16px 16px;text-align:center;">
        <a href="${DASHBOARD_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#00E599,#00B377);color:#000;font-weight:700;font-size:13px;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:1px;text-transform:uppercase;">
          Open Your Dashboard →
        </a>
        <p style="color:rgba(255,255,255,0.2);font-size:11px;margin-top:24px;">
          StreetMP OS • Sovereign AI Infrastructure • os.streetmp.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(toEmail, "🚀 Welcome to StreetMP OS — You're Live on the Sovereign AI Grid", html);
}

/** Sent on invoice.payment_failed */
export async function dispatchPaymentFailedAlert(payload: PaymentFailedPayload): Promise<void> {
  const { toEmail, companyName, amount, currency } = payload;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:40px auto;background:#0F0F0F;border:1px solid rgba(239,68,68,0.25);border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#2D0000,#1A0000);padding:32px;border-bottom:1px solid rgba(239,68,68,0.2);">
        <div style="font-size:11px;font-weight:700;letter-spacing:4px;color:#EF4444;text-transform:uppercase;margin-bottom:12px;">⚠ PAYMENT ALERT</div>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Payment Failed — Action Required</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;">
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;">
          Hi ${companyName} team,<br/><br/>
          Your payment of <strong style="color:#EF4444;">${currency} ${amount}</strong> was unsuccessful. 
          Your account has been paused and API traffic is being held until payment is resolved.
        </p>
        <a href="${DASHBOARD_URL}/billing" style="display:inline-block;background:#EF4444;color:#FFFFFF;font-weight:700;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:1px;">
          Update Payment Method →
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:11px;margin-top:24px;">If you believe this is an error, contact support@streetmp.com immediately.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(toEmail, "⚠️ Payment Failed — Your StreetMP OS Account is Paused", html);
}

/** Sent on customer.subscription.deleted */
export async function dispatchOffboardingEmail(payload: OffboardingPayload): Promise<void> {
  const { toEmail, companyName } = payload;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:40px auto;background:#0F0F0F;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:32px;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;font-weight:700;letter-spacing:4px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:12px;">ACCOUNT CANCELLED</div>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Goodbye from the Sovereign Grid</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 16px;">
          Hi ${companyName} team,<br/><br/>
          Your StreetMP OS subscription has been cancelled. Your API key has been revoked and your audit vault has been frozen to read-only mode for a 90-day retention period per compliance requirements.<br/><br/>
          If you'd like to reactivate, we'd be glad to have you back.
        </p>
        <a href="${DASHBOARD_URL}/onboard" style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#FFFFFF;font-weight:700;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:1px;">
          Reactivate Account
        </a>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(toEmail, "Your StreetMP OS Account Has Been Cancelled", html);
}
