/**
 * @file alertEngine.ts
 * @service monitor
 * @command COMMAND_095 — SELF-HEALING OS MONITOR
 * @version V95.0.0
 *
 * ================================================================
 * MULTI-CHANNEL ALERT DISPATCH ENGINE
 * ================================================================
 *
 * Channel Matrix:
 *   ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 *   │ Severity │  Email   │   SMS    │  Console │  Slack   │
 *   ├──────────┼──────────┼──────────┼──────────┼──────────┤
 *   │ LOW      │    —     │    —     │    ✓     │    —     │
 *   │ MEDIUM   │    —     │    —     │    ✓     │    —     │
 *   │ HIGH     │    ✓     │    —     │    ✓     │    ✓     │
 *   │ CRITICAL │    ✓     │    ✓     │    ✓     │    ✓     │
 *   └──────────┴──────────┴──────────┴──────────┴──────────┘
 *
 * Rate Limiting:
 *   • Minimum 5 minutes between same-service alerts (prevent storm)
 *   • Recovery alerts always dispatched (no rate limit)
 *
 * ================================================================
 */

import nodemailer, { type Transporter }   from "nodemailer";
import type Twilio                         from "twilio";
import type { Incident, IncidentSeverity }  from "./healthMonitor";

// ─── Configuration (from .env) ────────────────────────────────────────────────

const SMTP_HOST       = process.env.SMTP_HOST       ?? "";
const SMTP_PORT       = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER       = process.env.SMTP_USER       ?? "";
const SMTP_PASS       = process.env.SMTP_PASS       ?? "";
const SMTP_FROM       = process.env.SMTP_FROM       ?? "streetmp-os-monitor@streetmp.com";
const ALERT_EMAIL_TO  = process.env.MONITOR_ALERT_EMAIL ?? "";

const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID  ?? "";
const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN   ?? "";
const TWILIO_FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER  ?? "";
const ALERT_SMS_TO        = process.env.MONITOR_ALERT_PHONE ?? "";

const SLACK_WEBHOOK_URL = process.env.MONITOR_SLACK_WEBHOOK ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertPayload {
  severity:     IncidentSeverity;
  serviceId:    string;
  serviceName:  string;
  errorMessage: string;
  actionTaken:  string;
  status:       string;
  incident:     Incident;
  isRecovery:   boolean;
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
const MIN_ALERT_GAP_MS  = 5 * 60 * 1000;   // 5 minutes between same-service alerts
const lastAlertTs       = new Map<string, number>(); // serviceId → timestamp

function isRateLimited(serviceId: string, isRecovery: boolean): boolean {
  if (isRecovery) return false;   // Recovery alerts always go through
  const lastSent = lastAlertTs.get(serviceId) ?? 0;
  return (Date.now() - lastSent) < MIN_ALERT_GAP_MS;
}

function markAlertSent(serviceId: string): void {
  lastAlertTs.set(serviceId, Date.now());
}

// ─── Lazy-initialized Singletons ─────────────────────────────────────────────

let _mailer: Transporter | null = null;
let _twilio: ReturnType<typeof import("twilio")> | null = null;

function getMailer(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ALERT_EMAIL_TO) return null;
  if (!_mailer) {
    _mailer = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _mailer;
}

async function getTwilio(): Promise<typeof _twilio | null> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !ALERT_SMS_TO) {
    return null;
  }
  if (!_twilio) {
    const { default: twilio } = await import("twilio") as { default: typeof Twilio };
    _twilio = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return _twilio;
}

// ─── Email Format ─────────────────────────────────────────────────────────────

function buildEmailHtml(p: AlertPayload): string {
  const color    = p.isRecovery ? "#00E599" : p.severity === "CRITICAL" ? "#FF4444" : "#FFA500";
  const emoji    = p.isRecovery ? "✅" : p.severity === "CRITICAL" ? "🚨" : "⚠️";
  const title    = p.isRecovery
    ? `${p.serviceName} has RECOVERED`
    : `${p.severity} ALERT: ${p.serviceName} is ${p.status}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="background:rgba(0,229,153,0.06);border:1px solid rgba(0,229,153,0.2);border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">${emoji}</span>
        <div>
          <div style="color:${color};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">
            StreetMP OS — ${p.isRecovery ? "Recovery" : p.severity} Alert
          </div>
          <div style="color:#FFFFFF;font-size:18px;font-weight:700;">${title}</div>
        </div>
      </div>
    </div>

    <!-- Details -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:20px 24px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;width:160px;">Service</td>
          <td style="padding:7px 0;color:#FFFFFF;font-size:12px;font-weight:600;">${p.serviceName}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Service ID</td>
          <td style="padding:7px 0;color:#FFFFFF;font-size:12px;font-family:monospace;">${p.serviceId}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Current Status</td>
          <td style="padding:7px 0;font-size:12px;font-weight:700;color:${color};">${p.status}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Error</td>
          <td style="padding:7px 0;color:#FF8888;font-size:12px;font-family:monospace;">${p.errorMessage}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Action Taken</td>
          <td style="padding:7px 0;color:#00E599;font-size:12px;">${p.actionTaken}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Incident ID</td>
          <td style="padding:7px 0;color:#FFFFFF;font-size:11px;font-family:monospace;">${p.incident.id}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Started At</td>
          <td style="padding:7px 0;color:#FFFFFF;font-size:12px;">${p.incident.startedAt}</td>
        </tr>
        ${p.isRecovery && p.incident.resolvedAt ? `
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Resolved At</td>
          <td style="padding:7px 0;color:#00E599;font-size:12px;">${p.incident.resolvedAt}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:7px 0;color:rgba(255,255,255,0.4);font-size:12px;">Consecutive Fails</td>
          <td style="padding:7px 0;color:#FFFFFF;font-size:12px;">${p.incident.triggerCount}</td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <a href="https://os.streetmp.com/dashboard/admin/system-health"
       style="display:block;text-align:center;padding:12px 24px;background:linear-gradient(135deg,#00E599,#00b077);
              color:#000;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;margin-bottom:24px;">
      View System Health Dashboard →
    </a>

    <!-- Footer -->
    <p style="color:rgba(255,255,255,0.2);font-size:10px;text-align:center;margin:0;">
      V95 Self-Healing OS Monitor · StreetMP, Inc. · Sent at ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;
}

// ─── SMS Format ───────────────────────────────────────────────────────────────

function buildSmsText(p: AlertPayload): string {
  if (p.isRecovery) {
    return `✅ STREETMP OS: ${p.serviceName} RECOVERED. Incident ${p.incident.id.slice(0, 8)} resolved at ${p.incident.resolvedAt ?? "now"}. Dashboard: os.streetmp.com/dashboard/admin/system-health`;
  }
  return `🚨 STREETMP OS CRITICAL: ${p.serviceName} is ${p.status}! Error: ${p.errorMessage.slice(0, 80)}. Action: ${p.actionTaken.slice(0, 60)}. Incident: ${p.incident.id.slice(0, 8)}`;
}

// ─── Slack Format ─────────────────────────────────────────────────────────────

function buildSlackPayload(p: AlertPayload): object {
  const color    = p.isRecovery ? "#00E599" : p.severity === "CRITICAL" ? "#FF4444" : "#FFA500";
  const title    = p.isRecovery
    ? `✅ RECOVERED: ${p.serviceName}`
    : `${p.severity === "CRITICAL" ? "🚨" : "⚠️"} ${p.severity}: ${p.serviceName} is ${p.status}`;

  return {
    text: title,
    attachments: [{
      color,
      fields: [
        { title: "Service",         value: p.serviceName,           short: true },
        { title: "Status",          value: p.status,                short: true },
        { title: "Error",           value: p.errorMessage,          short: false },
        { title: "Action Taken",    value: p.actionTaken,           short: false },
        { title: "Incident ID",     value: p.incident.id.slice(0, 8), short: true },
        { title: "Severity",        value: p.severity,              short: true },
      ],
      actions: [{
        type:  "button",
        text:  "Open Dashboard",
        url:   "https://os.streetmp.com/dashboard/admin/system-health",
        style: "primary",
      }],
      footer: "StreetMP V95 Monitor",
      ts:     Math.floor(Date.now() / 1000),
    }],
  };
}

// ─── Dispatch Orchestrator ────────────────────────────────────────────────────

/**
 * Main alert dispatcher. Called by healthMonitor.ts on service state changes.
 *
 * Channel routing:
 *   HIGH     → Email + Slack
 *   CRITICAL → Email + Slack + SMS
 *   Recovery → Email + Slack (always, no rate limit)
 */
export async function dispatchAlert(payload: AlertPayload): Promise<void> {
  const { severity, serviceId, isRecovery } = payload;

  // Rate limit (except recovery)
  if (isRateLimited(serviceId, isRecovery)) {
    console.info(
      `[V95:AlertEngine] Rate limit active for ${serviceId} — alert suppressed.`
    );
    return;
  }

  markAlertSent(serviceId);

  const shouldEmail = isRecovery || severity === "HIGH" || severity === "CRITICAL";
  const shouldSms   = severity === "CRITICAL" && !isRecovery;
  const shouldSlack = isRecovery || severity === "HIGH" || severity === "CRITICAL";

  const dispatches: Promise<void>[] = [];

  // ── Email ────────────────────────────────────────────────────────────────────
  if (shouldEmail) {
    const mailer = getMailer();
    if (mailer) {
      dispatches.push(
        mailer.sendMail({
          from:    SMTP_FROM,
          to:      ALERT_EMAIL_TO,
          subject: `[StreetMP OS] ${isRecovery ? "RECOVERY" : severity}: ${payload.serviceName}`,
          html:    buildEmailHtml(payload),
        }).then(() => {
          console.info(`[V95:AlertEngine] ✉️  Email dispatched to ${ALERT_EMAIL_TO}`);
        }).catch((err: Error) => {
          console.warn(`[V95:AlertEngine] Email failed: ${err.message}`);
        })
      );
    } else {
      console.info("[V95:AlertEngine] Email not configured (SMTP_* env vars missing)");
    }
  }

  // ── SMS ──────────────────────────────────────────────────────────────────────
  if (shouldSms) {
    dispatches.push(
      getTwilio().then(async (twilio) => {
        if (!twilio) {
          console.info("[V95:AlertEngine] SMS not configured (TWILIO_* env vars missing)");
          return;
        }
        await (twilio as unknown as { messages: { create: (o: object) => Promise<unknown> } }).messages.create({
          body: buildSmsText(payload),
          from: TWILIO_FROM_NUMBER,
          to:   ALERT_SMS_TO,
        });
        console.info(`[V95:AlertEngine] 📱 SMS dispatched to ${ALERT_SMS_TO}`);
      }).catch((err: Error) => {
        console.warn(`[V95:AlertEngine] SMS failed: ${err.message}`);
      })
    );
  }

  // ── Slack ────────────────────────────────────────────────────────────────────
  if (shouldSlack && SLACK_WEBHOOK_URL) {
    dispatches.push(
      fetch(SLACK_WEBHOOK_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildSlackPayload(payload)),
        signal:  AbortSignal.timeout(8_000),
      }).then(() => {
        console.info("[V95:AlertEngine] 💬 Slack notification dispatched.");
      }).catch((err: Error) => {
        console.warn(`[V95:AlertEngine] Slack failed: ${err.message}`);
      })
    );
  }

  // Fire all channels concurrently — never block the monitor loop
  await Promise.allSettled(dispatches);

  // Console log always
  const prefix = isRecovery ? "✅ RECOVERY" : `${severity} ALERT`;
  console.info(
    `[V95:AlertEngine][${new Date().toISOString()}] ${prefix} | ` +
    `service=${serviceId} | channels=[${[
      shouldEmail ? "email"  : null,
      shouldSms   ? "sms"   : null,
      shouldSlack ? "slack" : null,
    ].filter(Boolean).join(", ") || "console-only"}]`
  );
}
