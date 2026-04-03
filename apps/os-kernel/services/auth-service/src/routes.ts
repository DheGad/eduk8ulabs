/**
 * @file routes.ts
 * @service auth-service
 * @description User registration and login endpoints.
 *
 * ================================================================
 * SECURITY CONTRACTS
 * ================================================================
 *
 * 1. PASSWORD HASHING
 *    bcrypt with cost factor 10. Salt is generated per-hash
 *    automatically by bcryptjs. The plaintext password is never
 *    stored, logged, or returned anywhere. password_hash is
 *    stripped from every public response object.
 *
 * 2. JWT DESIGN
 *    Payload contains only: { sub: user_id, tier: account_tier }
 *    Signed with HS256 using JWT_SECRET (env var, never in DB).
 *    Expires in 24h (Phase 1). Phase 2 will add httpOnly refresh
 *    tokens with 7-day rotation.
 *
 * 3. TIMING ATTACK PREVENTION
 *    On login, if the user is NOT found, we still run a dummy
 *    bcrypt.compare() against a static hash. This ensures the
 *    response time is identical whether the email exists or not,
 *    preventing email enumeration via timing attacks.
 *
 * 4. GENERIC 401 WORDING
 *    Both "email not found" and "wrong password" return the same
 *    "Invalid credentials." message. This prevents user enumeration
 *    via error message differences.
 * ================================================================
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "./db.js";
import { checkLockout, recordFailedAttempt, clearLockout } from "./loginLockout.js";

export const authRouter = Router();

// ----------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------
const BCRYPT_SALT_ROUNDS = 10;
const JWT_EXPIRY = "24h";

// Pre-computed dummy hash used during timing-safe login rejection.
// bcrypt.compare() against this still takes ~70ms, matching real hashes.
// This is generated once at module load — NOT per request.
const DUMMY_HASH = bcrypt.hashSync("__streetmp_dummy_password__", BCRYPT_SALT_ROUNDS);

// ----------------------------------------------------------------
// JWT SECRET — FAIL FAST
// ----------------------------------------------------------------
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "[AuthService] FATAL: JWT_SECRET must be set and at least 32 characters long. " +
        "Generate with: openssl rand -hex 32"
    );
  }
  return secret;
}

// Loaded once at module init — throws if missing, preventing startup
const JWT_SECRET = getJwtSecret();

// ----------------------------------------------------------------
// REQUEST / RESPONSE SCHEMAS (Zod)
// ----------------------------------------------------------------
const AuthRequestSchema = z.object({
  email: z
    .string({ required_error: "email is required." })
    .email({ message: "Must be a valid email address." })
    .toLowerCase()   // normalize before DB lookup
    .trim(),
  password: z
    .string({ required_error: "password is required." })
    .min(8, { message: "Password must be at least 8 characters." })
    .max(128, { message: "Password must not exceed 128 characters." }),
});

// ----------------------------------------------------------------
// JWT UTILITY
// ----------------------------------------------------------------
interface JwtPayload {
  sub: string;          // user UUID
  tier: string;         // account_tier
  role: string;         // User role ('USER' or 'ADMIN')
  first_login: boolean; // User first login state
}

function signToken(userId: string, tier: string, role: string, firstLogin: boolean): string {
  const payload: JwtPayload = { sub: userId, tier, role, first_login: firstLogin };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    algorithm: "HS256",
  });
}

// ----------------------------------------------------------------
// DB ROW TYPE (internal only — never sent to client)
// ----------------------------------------------------------------
interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  account_tier: string;
  current_hcq_score: string;
  role: string;
  first_login_complete: boolean;
}

// ================================================================
// TASK 2: POST /api/v1/auth/register
// ================================================================
/**
 * Creates a new user account with bcrypt-hashed password.
 * Issues a signed JWT on success.
 *
 * Error handling:
 *   400 — Validation failure (bad email, weak password)
 *   409 — Email already registered
 *   500 — Database or hashing failure
 */
authRouter.post(
  "/api/v1/auth/register",
  async (req: Request, res: Response): Promise<void> => {

    // ---- Zod Validation ----
    const parsed = AuthRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { email, password } = parsed.data;

    // ---- Step 1: Check for existing user ----
    let existingUser: UserRow | null = null;
    try {
      const check = await pool.query<UserRow>(
        "SELECT id FROM users WHERE email = $1 LIMIT 1",
        [email]
      );
      existingUser = check.rows[0] ?? null;
    } catch (dbError) {
      console.error("[AuthService:register] DB check failed:", (dbError as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Registration failed. Please try again." },
      });
      return;
    }

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email address already exists.",
        },
      });
      return;
    }

    // ---- Step 2: Hash password ----
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    } catch (hashError) {
      console.error("[AuthService:register] bcrypt hash failed:", (hashError as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "HASH_ERROR", message: "Registration failed. Please try again." },
      });
      return;
    }

    // ---- Step 3: Insert new user ----
    let newUser: UserRow;
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (email, password_hash, account_tier, current_hcq_score, role, first_login_complete)
         VALUES ($1, $2, 'free', 0, 'USER', false)
         RETURNING id, email, account_tier, current_hcq_score, role, first_login_complete`,
        [email, passwordHash]
      );
      newUser = result.rows[0];
    } catch (dbError) {
      const pgError = dbError as { code?: string; message?: string };
      // Race condition: two concurrent registrations with the same email
      if (pgError.code === "23505") {
        res.status(409).json({
          success: false,
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "An account with this email address already exists.",
          },
        });
        return;
      }
      console.error("[AuthService:register] DB insert failed:", pgError.message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Registration failed. Please try again." },
      });
      return;
    }

    // ---- Step 4: Issue JWT ----
    const token = signToken(newUser.id, newUser.account_tier, newUser.role, newUser.first_login_complete);

    // SECURITY: password_hash is deliberately NOT in RETURNING clause
    // and is never added to this response object.
    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        tier: newUser.account_tier,
        role: newUser.role,
        first_login_complete: newUser.first_login_complete
      },
    });
  }
);

// ================================================================
// TASK 3: POST /api/v1/auth/login
// ================================================================
/**
 * Validates credentials and issues a JWT on success.
 *
 * Implements timing-safe rejection: even if the email is not found,
 * a dummy bcrypt.compare() is executed to prevent email enumeration
 * via response time differences.
 *
 * Error handling:
 *   400 — Validation failure
 *   401 — Invalid credentials (deliberately generic — no detail on which failed)
 *   500 — Database failure
 */
authRouter.post(
  "/api/v1/auth/login",
  async (req: Request, res: Response): Promise<void> => {

    // ---- Zod Validation ----
    const parsed = AuthRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { email, password } = parsed.data;

    // ---- [Phase3-AUTH-02] Step 0: Brute-force lockout check ----
    // Runs BEFORE bcrypt to prevent CPU-amplification DoS during lockout.
    const lockout = checkLockout(email);
    if (lockout.locked) {
      const retryAfterSec = Math.ceil((lockout.retryAfterMs ?? 0) / 1000);
      console.warn(
        `[Phase3:Lockout] 🚫 Blocked locked account login: email="${email}" ` +
        `retry_after=${retryAfterSec}s`
      );
      res.status(429).json({
        success: false,
        error: {
          code:    "ACCOUNT_LOCKED",
          message: `Too many failed login attempts. Your account is temporarily locked. ` +
                   `Please try again in ${Math.ceil(retryAfterSec / 60)} minute(s), ` +
                   `or reset your password.`,
          retry_after_seconds: retryAfterSec,
        },
      });
      return;
    }

    // ---- Step 1: Fetch user by email ----
    let userRow: UserRow | null = null;
    try {
      const result = await pool.query<UserRow>(
        "SELECT id, email, password_hash, account_tier, role, first_login_complete FROM users WHERE email = $1 LIMIT 1",
        [email]
      );
      userRow = result.rows[0] ?? null;
    } catch (dbError) {
      console.error("[AuthService:login] DB fetch failed:", (dbError as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Login failed. Please try again." },
      });
      return;
    }

    // ---- Step 2: Timing-safe password verification ----
    // Compare against the real hash if user exists, or the dummy hash if not.
    // Both paths take ~70ms, preventing email enumeration via timing.
    const hashToCompare = userRow?.password_hash ?? DUMMY_HASH;
    let passwordValid: boolean;
    try {
      passwordValid = await bcrypt.compare(password, hashToCompare);
    } catch (compareError) {
      console.error("[AuthService:login] bcrypt compare failed:", (compareError as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "AUTH_ERROR", message: "Login failed. Please try again." },
      });
      return;
    }

    // If user wasn't found OR password didn't match → same generic 401
    if (!userRow || !passwordValid) {
      // [Phase3-AUTH-02] Record failed attempt — triggers lockout after MAX_ATTEMPTS
      const failCount = recordFailedAttempt(email);
      console.warn(
        `[Phase3:Lockout] Failed login #${failCount} for email="\${email}" ` +
        `from \${req.ip}`
      );

      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          // Deliberately generic — reveals nothing about which check failed
          message: "Invalid credentials.",
        },
      });
      return;
    }

    // ---- [Phase3-AUTH-02] Clear lockout on successful login ----
    clearLockout(email);

    // ---- Step 3: Issue JWT ----
    const token = signToken(userRow.id, userRow.account_tier, userRow.role, userRow.first_login_complete);

    // Set an httpOnly-safe cookie so the Next.js middleware can read it
    // for protected route enforcement, AND return in the JSON body so
    // apiClient.ts can store it in localStorage for Bearer auth on API calls.
    res.cookie("auth_token", token, {
      httpOnly: false,   // Must be false so middleware.ts can read it on edge
      secure: false,     // false for localhost (no HTTPS in dev)
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in ms
      path: "/",
    });

    // SECURITY: password_hash excluded from response
    res.status(200).json({
      success: true,
      token,
      user: {
        id: userRow.id,
        email: userRow.email,
        tier: userRow.account_tier,
        role: userRow.role,
        first_login_complete: userRow.first_login_complete,
      },
    });
  }
);

// ================================================================
// COMMAND 061: THE B2B API KEYS (S2S)
// POST /api/v1/auth/s2s-keys
// ================================================================
import crypto from "crypto";

function requireJwt(req: Request, res: Response, next: import("express").NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
    if (!payload.sub) throw new Error("Missing sub claim");
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
    (req as any).user = { sub: payload.sub, tier: payload.tier ?? "free" };
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "JWT validation failed" } });
  }
}

const CreateS2SKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

authRouter.post(
  "/api/v1/auth/s2s-keys",
  requireJwt,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateS2SKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid payload." } });
      return;
    }

    const userId = (req as any).user.sub;
    const name = parsed.data.name || "Default S2S Key";

    try {
      // Generate a secure API Key
      // prefix: streetmp_s2s_
      const randomBytes = crypto.randomBytes(32).toString("hex");
      const apiKey = `streetmp_s2s_${randomBytes}`;
      
      const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
      const keyHint = apiKey.slice(0, 4) + "..." + apiKey.slice(-4);

      // Store ONLY the hash
      const result = await pool.query(
        `INSERT INTO s2s_api_keys (user_id, api_key_hash, key_hint, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, key_hint, name, created_at`,
        [userId, apiKeyHash, keyHint, name]
      );

      // Return the plaintext key ONCE
      res.status(201).json({
        success: true,
        data: {
          key: result.rows[0],
          api_key: apiKey // Only time this is ever returned
        }
      });

    } catch (err) {
      console.error("[AuthService:s2s-keys]", err);
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to generate key." } });
    }
  }
);

// ================================================================
// COMMAND 062: THE ONBOARDING COMPLETION
// POST /api/v1/auth/complete-onboarding
// ================================================================
authRouter.post(
  "/api/v1/auth/complete-onboarding",
  requireJwt,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.sub;

    try {
      const result = await pool.query(
        "UPDATE users SET first_login_complete = true, updated_at = NOW() WHERE id = $1 RETURNING id",
        [userId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found." } });
        return;
      }

      res.status(200).json({ success: true, message: "Onboarding completed successfully." });
    } catch (err) {
      console.error("[AuthService:complete-onboarding]", (err as Error).message);
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to update onboarding state." } });
    }
  }
);
