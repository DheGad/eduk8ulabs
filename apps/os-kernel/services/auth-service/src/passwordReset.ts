/**
 * @file passwordReset.ts
 * @service auth-service
 * @version Phase3-AUTH-01
 * @description Password Reset — Cryptographic Token Flow
 *
 * ================================================================
 * FLOW
 * ================================================================
 *
 *  1. POST /api/v1/auth/forgot-password
 *     • Accepts: { email }
 *     • Generates a 32-byte CSPRNG token
 *     • SHA-256 hashes it before DB storage (so plaintext never rests)
 *     • Stores: (user_id, token_hash, expires_at=now+1h) in `password_reset_tokens`
 *     • Emails the PLAINTEXT token in a link via Resend (Nodemailer fallback)
 *     • ALWAYS returns 200 — never reveals whether email exists
 *
 *  2. POST /api/v1/auth/reset-password
 *     • Accepts: { token, new_password }
 *     • SHA-256 hashes the supplied token
 *     • Looks up the hash in DB — validates expiry
 *     • bcrypt-hashes new_password, updates users.password_hash
 *     • Deletes the token row (single-use guarantee)
 *     • Clears any active lockout for the account
 *     • Returns 200 on success
 *
 * ================================================================
 * SECURITY PROPERTIES
 * ================================================================
 *
 *  • Tokens are SHA-256 hashed in the DB — a DB compromise does not
 *    leak usable reset tokens (unlike MD5 or plain storage).
 *  • 1-hour TTL is enforced at the DB query level via `expires_at`.
 *  • Only ONE token per user exists at a time (old row deleted on
 *    each new request) — prevents token accumulation.
 *  • Forgot-password endpoint returns 200 regardless of whether the
 *    email is registered — prevents email enumeration.
 *  • New password goes through the same Zod schema as registration
 *    (8–128 chars) before bcrypt hashing.
 *  • Token is deleted immediately on use — verifiable single-use.
 *
 * ================================================================
 * EMAIL PROVIDER PRIORITY
 * ================================================================
 *
 *  1. Resend (RESEND_API_KEY env var)    ← preferred: best DX
 *  2. Nodemailer SMTP (SMTP_HOST env var) ← fallback for self-hosted
 *  3. Console log only                    ← dev/offline fallback
 *
 * ================================================================
 */

import { Router, Request, Response } from "express";
import { randomBytes, createHash }   from "node:crypto";
import bcrypt                         from "bcryptjs";
import { z }                          from "zod";
import { pool }                       from "./db.js";
import { clearLockout }               from "./loginLockout.js";

export const passwordResetRouter = Router();

// ── Constants ─────────────────────────────────────────────────────
const BCRYPT_SALT_ROUNDS  = 10;
const TOKEN_EXPIRY_HOURS  = 1;
const APP_URL             = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Schema ────────────────────────────────────────────────────────
const ForgotSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const ResetSchema = z.object({
  token:        z.string().min(32, "Invalid token."),
  new_password: z
    .string()
    .min(8,  "Password must be at least 8 characters.")
    .max(128, "Password must not exceed 128 characters."),
});

// ── Token helpers ─────────────────────────────────────────────────

/** Generates a URL-safe random reset token (64 hex chars = 32 bytes). */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 hashes a plaintext token for DB storage. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Email dispatcher ──────────────────────────────────────────────

/**
 * Attempts to send the password-reset email.
 * Priority: Resend API → Nodemailer SMTP → console fallback.
 * All failures are caught and logged — the API response is never
 * blocked by email delivery issues.
 */
async function sendResetEmail(
  to:        string,
  resetLink: string
): Promise<void> {
  const subject  = "Reset your StreetMP OS password";
  const htmlBody = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#0f172a;font-size:20px;font-weight:800;margin-bottom:8px">
        StreetMP OS — Password Reset
      </h2>
      <p style="color:#374151;font-size:14px;line-height:1.6">
        You (or someone claiming to be you) requested a password reset.
        Click the button below to set a new password. This link expires in
        <strong>1 hour</strong>.
      </p>
      <a href="${resetLink}"
         style="display:inline-block;margin:24px 0;padding:12px 24px;
                background:#7c3aed;color:#fff;font-weight:700;text-decoration:none;
                border-radius:8px;font-size:14px">
        Reset My Password →
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        If you did not request a password reset, you can safely ignore this email.
        Your password has NOT been changed.
      </p>
      <p style="color:#9ca3af;font-size:11px;margin-top:8px">
        Link: <a href="${resetLink}" style="color:#7c3aed">${resetLink}</a>
      </p>
    </div>`;

  // ── 1. Try Resend ──────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:    process.env.RESEND_FROM_EMAIL ?? "noreply@streetmp.com",
          to:      [to],
          subject,
          html:    htmlBody,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        console.info(`[Phase3:PasswordReset] ✅ Reset email sent via Resend to ${to}`);
        return;
      }
      const errText = await res.text().catch(() => "");
      console.warn(`[Phase3:PasswordReset] Resend returned ${res.status}: ${errText}`);
    } catch (err) {
      console.warn(`[Phase3:PasswordReset] Resend failed: ${(err as Error).message}`);
    }
  }

  // ── 2. Try Nodemailer SMTP ─────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      // Dynamic import — nodemailer is an optional dep
      const nodemailer = (await import("nodemailer")) as typeof import("nodemailer");
      const transporter = nodemailer.createTransport({
        host:   smtpHost,
        port:   parseInt(process.env.SMTP_PORT ?? "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from:    process.env.SMTP_FROM ?? "noreply@streetmp.com",
        to,
        subject,
        html:    htmlBody,
      });

      console.info(`[Phase3:PasswordReset] ✅ Reset email sent via SMTP to ${to}`);
      return;
    } catch (err) {
      console.warn(`[Phase3:PasswordReset] SMTP failed: ${(err as Error).message}`);
    }
  }

  // ── 3. Console fallback (dev / no email config) ────────────────
  console.info(
    `[Phase3:PasswordReset] ⚠️  No email provider configured.\n` +
    `  Reset link for ${to}:\n  ${resetLink}\n` +
    `  (Set RESEND_API_KEY or SMTP_HOST to send real emails)`
  );
}

// ── DB: Ensure password_reset_tokens table exists ─────────────────

/**
 * Creates the password_reset_tokens table if it doesn't exist.
 * Called once at module load time — idempotent.
 */
async function ensureResetTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   TEXT        NOT NULL UNIQUE,
        expires_at   TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);
    `);
    console.info("[Phase3:PasswordReset] password_reset_tokens table ready.");
  } catch (err) {
    // Non-fatal at startup — table creation failures surface on first request
    console.warn(
      `[Phase3:PasswordReset] Could not ensure table: ${(err as Error).message}`
    );
  }
}

// Fire-and-forget — don't block module load waiting for DB
ensureResetTable().catch(() => void 0);

// ================================================================
// POST /api/v1/auth/forgot-password
// ================================================================
/**
 * Initiates a password reset for the given email.
 *
 * ALWAYS returns 200 — reveals nothing about whether the email exists.
 * The reset token is only stored and emailed if the account exists.
 *
 * Security:
 *   • Token: 32 bytes CSPRNG → stored as SHA-256 hash
 *   • Expires: 1 hour from now
 *   • Only one active token per user (old tokens deleted on new request)
 */
passwordResetRouter.post(
  "/api/v1/auth/forgot-password",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ForgotSchema.safeParse(req.body);
    if (!parsed.success) {
      // Even on validation failure, respond generically
      res.status(200).json({
        success: true,
        message: "If that email is registered, a reset link has been sent.",
      });
      return;
    }

    const { email } = parsed.data;

    // ── Look up user (but don't reveal result) ─────────────────
    try {
      const userResult = await pool.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1 LIMIT 1",
        [email]
      );
      const user = userResult.rows[0];

      if (user) {
        const plainToken = generateToken();
        const tokenHash  = hashToken(plainToken);
        const expiresAt  = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        // Delete any existing tokens for this user (one-at-a-time guarantee)
        await pool.query(
          "DELETE FROM password_reset_tokens WHERE user_id = $1",
          [user.id]
        );

        // Store the hash (never the plaintext)
        await pool.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, tokenHash, expiresAt.toISOString()]
        );

        const resetLink = `${APP_URL}/reset-password?token=${plainToken}`;

        console.info(
          `[Phase3:PasswordReset] Reset token generated for user ${user.id} ` +
          `(expires ${expiresAt.toISOString()})`
        );

        // Non-blocking — email delivery never blocks the HTTP response
        sendResetEmail(email, resetLink).catch((err) =>
          console.error("[Phase3:PasswordReset] sendResetEmail threw:", err)
        );
      }
    } catch (err) {
      // Log DB errors but respond generically — never reveal failure mode
      console.error(
        `[Phase3:PasswordReset] forgot-password DB error: ${(err as Error).message}`
      );
    }

    // Always 200 — attacker cannot determine if email exists
    res.status(200).json({
      success: true,
      message: "If that email is registered, a reset link has been sent.",
    });
  }
);

// ================================================================
// POST /api/v1/auth/reset-password
// ================================================================
/**
 * Consumes a reset token and sets a new password.
 *
 * Error handling:
 *   400 — Missing / invalid fields
 *   400 — Token not found, expired, or already used
 *   500 — DB or hashing failure
 */
passwordResetRouter.post(
  "/api/v1/auth/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ResetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code:    "INVALID_PAYLOAD",
          message: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { token, new_password } = parsed.data;
    const tokenHash = hashToken(token);

    // ── Look up the token ──────────────────────────────────────
    let tokenRow: { id: string; user_id: string; expires_at: Date } | undefined;
    try {
      const result = await pool.query<{ id: string; user_id: string; expires_at: Date }>(
        `SELECT id, user_id, expires_at
         FROM password_reset_tokens
         WHERE token_hash = $1
           AND expires_at > now()
         LIMIT 1`,
        [tokenHash]
      );
      tokenRow = result.rows[0];
    } catch (err) {
      console.error(`[Phase3:PasswordReset] reset-password DB lookup: ${(err as Error).message}`);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Password reset failed. Please try again." },
      });
      return;
    }

    if (!tokenRow) {
      res.status(400).json({
        success: false,
        error: {
          code:    "INVALID_OR_EXPIRED_TOKEN",
          message: "This reset link is invalid or has expired. Please request a new one.",
        },
      });
      return;
    }

    // ── Hash new password ──────────────────────────────────────
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(new_password, BCRYPT_SALT_ROUNDS);
    } catch (err) {
      console.error(`[Phase3:PasswordReset] bcrypt hash failed: ${(err as Error).message}`);
      res.status(500).json({
        success: false,
        error: { code: "HASH_ERROR", message: "Password reset failed. Please try again." },
      });
      return;
    }

    // ── Update password + delete token atomically ─────────────
    try {
      await pool.query("BEGIN");

      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [passwordHash, tokenRow.user_id]
      );

      // Single-use: delete immediately after use
      await pool.query(
        "DELETE FROM password_reset_tokens WHERE id = $1",
        [tokenRow.id]
      );

      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK").catch(() => void 0);
      console.error(`[Phase3:PasswordReset] reset-password DB update: ${(err as Error).message}`);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Password reset failed. Please try again." },
      });
      return;
    }

    // ── Clear any lockout for this account ──────────────────────
    // Need the email to clear the lockout — look it up
    try {
      const emailResult = await pool.query<{ email: string }>(
        "SELECT email FROM users WHERE id = $1 LIMIT 1",
        [tokenRow.user_id]
      );
      const email = emailResult.rows[0]?.email;
      if (email) clearLockout(email);
    } catch {
      // Non-fatal — lockout will expire naturally
    }

    console.info(
      `[Phase3:PasswordReset] ✅ Password reset successful for user ${tokenRow.user_id}`
    );

    res.status(200).json({
      success: true,
      message: "Your password has been reset. You can now sign in with your new password.",
    });
  }
);
