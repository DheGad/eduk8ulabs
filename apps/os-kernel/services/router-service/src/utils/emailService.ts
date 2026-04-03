import nodemailer from 'nodemailer';

// Instantiate the SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailgun.org',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const DEFAULT_FROM = process.env.EMAIL_FROM_ADDRESS || '"StreetMP OS" <noreply@os.streetmp.com>';

/**
 * The standard legal footer mandated for CAN-SPAM and compliance.
 */
const getLegalFooter = () => `
  <br><br>
  <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 24px 0;">
  <div style="color: #666666; font-size: 12px; font-family: sans-serif;">
    StreetMP OS | 100 Sovereign Way, Suite 400, Singapore 018981 | <a href="https://os.streetmp.com/unsubscribe" style="color: #10b981;">Unsubscribe</a> | <a href="mailto:support@streetmp.com" style="color: #10b981;">support@streetmp.com</a>
  </div>
`;

/**
 * Generic mailer interface wrapping the base transporter configuration
 */
export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[emailService] SMTP credentials missing. Suppressing email to ${to}`);
    return;
  }

  // Automatically embed the compliance footer to every outgoing communication
  const complianthtml = `${html}${getLegalFooter()}`;

  try {
    const info = await transporter.sendMail({
      from: DEFAULT_FROM,
      to,
      subject,
      html: complianthtml,
    });
    console.log(`[emailService] Successfully dispatched message: ${info.messageId}`);
  } catch (error) {
    console.error(`[emailService] SMTP Transaction failed:`, error);
    throw new Error('Failed to send transactional email');
  }
}

// ----------------------------------------------------------------------
// EXPORTED TEMPLATES (V4 Email Configuration)
// ----------------------------------------------------------------------

export async function sendWelcomeEmail(toEmail: string) {
  const subject = "Welcome to StreetMP OS";
  const html = `
    <div style="font-family: sans-serif; color: #111;">
      <h2 style="color: #10b981;">Welcome to StreetMP OS.</h2>
      <p>Your secure AI proxy is ready. Log in to your dashboard to mint your first API key.</p>
    </div>
  `;
  await sendMail({ to: toEmail, subject, html });
}

export async function sendPaymentSuccessEmail(toEmail: string, planName: string) {
  const subject = `Upgrade Successful: ${planName}`;
  const html = `
    <div style="font-family: sans-serif; color: #111;">
      <h2 style="color: #10b981;">Upgrade Complete.</h2>
      <p>Your upgrade to the <strong>${planName}</strong> tier was successful. Your increased rate limits are now active across the gateway network.</p>
    </div>
  `;
  await sendMail({ to: toEmail, subject, html });
}
