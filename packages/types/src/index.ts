/**
 * @file index.ts
 * @package @streetmp-os/types
 * @description Shared platform-wide types for Streetmp OS.
 * Imported by all microservices and the Next.js app layer.
 */

// ----------------------------------------------------------------
// Account & User Types
// ----------------------------------------------------------------

export type AccountTier = "free" | "pro" | "enterprise";

export interface User {
  id: string; // UUID
  email: string;
  accountTier: AccountTier;
  currentHcqScore: number; // 0–100
  stripeCustomerId: string | null;
  razorpayCustomerId: string | null;
  activeGateway: "STRIPE" | "RAZORPAY" | null;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------------
// BYOK Vault Types
// ----------------------------------------------------------------

export type ApiProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere";

export interface VaultEntry {
  id: string;
  userId: string;
  provider: ApiProvider;
  createdAt: Date;
  updatedAt: Date;
  // Note: encrypted_key, iv, auth_tag are NEVER exposed in this type.
  // They are internal to the Vault Service only.
}

// ----------------------------------------------------------------
// Usage & Telemetry Types
// ----------------------------------------------------------------

export type ValidationStatus =
  | "success"
  | "hallucinated_retry"
  | "failed";

export interface UsageLog {
  id: string;          // UUID
  userId: string;      // UUID
  promptId: string;    // UUID — unique execution trace ID
  modelUsed: string;
  tokensPrompt: number;
  tokensCompletion: number;
  totalCost: string;   // Kept as string to preserve NUMERIC(12,8) precision
  validationStatus: ValidationStatus;
  createdAt: Date;
}

// ----------------------------------------------------------------
// API Response Envelopes
// ----------------------------------------------------------------

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ----------------------------------------------------------------
// JWT & Auth Types
// ----------------------------------------------------------------

/**
 * The verified payload decoded from a Streetmp OS JWT.
 *
 * Issued by auth-service, verified by requireAuth middleware.
 * Follows RFC 7519 standard claims:
 *   `sub` — Subject (the user's UUID, standard JWT claim)
 *   `tier` — Account tier (custom claim for gating logic)
 *   `iat` — Issued At   (injected by jsonwebtoken automatically)
 *   `exp` — Expires At  (injected by jsonwebtoken automatically)
 */
export interface JwtPayload {
  /** The authenticated user's UUID — use as user_id in all service calls */
  sub: string;
  /** Account tier — used by Enforcer Service for rate limit gating */
  tier: AccountTier;
  /** Standard JWT: issued-at timestamp (seconds since epoch) */
  iat?: number;
  /** Standard JWT: expiry timestamp (seconds since epoch) */
  exp?: number;
}

// ----------------------------------------------------------------
// Express Request Augmentation
// ----------------------------------------------------------------
// This module augmentation extends the global Express `Request`
// interface so that `req.user` is available with full type safety
// in every microservice that imports this package.
//
// Usage in any protected Express handler (after requireAuth):
//   const userId = req.user!.sub;   // string — no cast needed
//   const tier   = req.user!.tier;  // AccountTier — fully typed
// ----------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      /**
       * The verified JWT payload, injected by `requireAuth` middleware.
       * Present only on routes protected by `requireAuth`.
       * Undefined on public routes (register, login, health).
       */
      user?: JwtPayload;
    }
  }
}
