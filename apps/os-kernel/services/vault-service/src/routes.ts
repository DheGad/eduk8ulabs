/**
 * @file routes.ts
 * @service vault-service
 * @description Express route handlers for BYOK key ingestion and internal decryption.
 *
 * ================================================================
 * ROUTE MAP
 * ================================================================
 *
 * PUBLIC  (authenticated via JWT in the Router Service upstream):
 *   POST /api/v1/vault/keys
 *     → Receives a plaintext API key, encrypts it with AES-256-GCM,
 *       upserts the three vault components into byok_vault.
 *
 * INTERNAL (service-to-service only, protected by INTERNAL_ROUTER_SECRET):
 *   GET /internal/vault/keys/:user_id/:provider
 *     → Fetches encrypted vault record, decrypts in-memory,
 *       returns plaintext key to the Router Service.
 *
 * ================================================================
 * SECURITY BOUNDARIES
 * ================================================================
 *   • The public endpoint NEVER echoes or logs any plaintext key.
 *   • The internal endpoint is gated by a shared secret header
 *     (x-internal-service-token) — only the Router Service knows this.
 *   • Decrypted keys are held in memory only for the duration of the
 *     response construction and are never persisted.
 * ================================================================
 */

import { Router, Request, Response, NextFunction } from "express";
import { encryptApiKey, decryptApiKey } from "@streetmp-os/security";
import { pool } from "./db.js";

export const vaultRouter = Router();

// ----------------------------------------------------------------
// CONSTANTS & SUPPORTED PROVIDERS
// Extend this list as new providers are onboarded in Phase 2+.
// ----------------------------------------------------------------
const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "mistral", "cohere"] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(value: string): value is Provider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

// ----------------------------------------------------------------
// INTERNAL SERVICE AUTH MIDDLEWARE
// Applied only to /internal/* routes.
// Rejects all requests that do not carry the correct shared secret.
// ----------------------------------------------------------------
function requireInternalServiceToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalSecret = process.env.INTERNAL_ROUTER_SECRET;

  if (!internalSecret) {
    // Misconfigured service — fail closed, do not expose internal routes
    console.error(
      "[VaultService:auth] FATAL: INTERNAL_ROUTER_SECRET is not set. " +
        "Internal routes are permanently disabled until this is configured."
    );
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_MISCONFIGURED",
        message: "Internal routing secret not configured.",
      },
    });
    return;
  }

  const providedToken = req.headers["x-internal-service-token"];

  if (!providedToken || providedToken !== internalSecret) {
    // Log every unauthorized attempt — this should never happen in prod
    console.warn(
      `[VaultService:auth] 403 — Unauthorized internal access attempt from ${req.ip} ` +
        `to ${req.method} ${req.originalUrl}`
    );
    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Access denied. Internal endpoint requires a valid service token.",
      },
    });
    return;
  }

  next();
}

// ================================================================
// TASK 2: PUBLIC INGESTION ENDPOINT
// POST /api/v1/vault/keys
// ================================================================
/**
 * Accepts a plaintext provider API key, encrypts it using the IronCore
 * AES-256-GCM engine, and upserts the three vault components into
 * the `byok_vault` table. The plaintext key never touches the database.
 *
 * Payload:   { user_id: string, provider: string, api_key: string }
 * Response:  200 { message: "Key encrypted and vaulted successfully." }
 */
vaultRouter.post("/api/v1/vault/keys", async (req: Request, res: Response): Promise<void> => {
  const { user_id, provider, api_key } = req.body as {
    user_id?: string;
    provider?: string;
    api_key?: string;
  };

  // ---- Input Validation ----
  if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: user_id." },
    });
    return;
  }

  if (!provider || typeof provider !== "string") {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: provider." },
    });
    return;
  }

  const normalizedProvider = provider.toLowerCase().trim();
  if (!isSupportedProvider(normalizedProvider)) {
    res.status(400).json({
      success: false,
      error: {
        code: "UNSUPPORTED_PROVIDER",
        message: `Provider "${provider}" is not supported. Valid providers: ${SUPPORTED_PROVIDERS.join(", ")}.`,
      },
    });
    return;
  }

  if (!api_key || typeof api_key !== "string" || api_key.trim() === "") {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: api_key." },
    });
    return;
  }

  // ---- Encryption ----
  let encryptedData: ReturnType<typeof encryptApiKey>;
  try {
    encryptedData = encryptApiKey(api_key);
  } catch (encryptionError) {
    console.error("[VaultService:ingest] Encryption failed:", (encryptionError as Error).message);
    res.status(500).json({
      success: false,
      error: { code: "ENCRYPTION_FAILED", message: "Failed to encrypt the API key." },
    });
    return;
  }

  // ---- Database Upsert ----
  // ON CONFLICT DO UPDATE ensures idempotency: calling this endpoint twice
  // with a new key for the same provider rotates the key rather than failing.
  const UPSERT_QUERY = `
    INSERT INTO byok_vault (user_id, provider, encrypted_key, iv, auth_tag)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
      encrypted_key = EXCLUDED.encrypted_key,
      iv            = EXCLUDED.iv,
      auth_tag      = EXCLUDED.auth_tag,
      updated_at    = NOW()
  `;

  try {
    await pool.query(UPSERT_QUERY, [
      user_id.trim(),
      normalizedProvider,
      encryptedData.encryptedKey,
      encryptedData.iv,
      encryptedData.authTag,
    ]);
  } catch (dbError) {
    const pgError = dbError as { code?: string; message?: string };

    // FK violation — user_id does not exist in users table
    if (pgError.code === "23503") {
      res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "The specified user_id does not exist." },
      });
      return;
    }

    console.error("[VaultService:ingest] Database upsert failed:", pgError.message);
    res.status(500).json({
      success: false,
      error: { code: "DB_ERROR", message: "Failed to save the encrypted key." },
    });
    return;
  }

  // Never log or return any key material. Confirm success only.
  res.status(200).json({
    success: true,
    message: "Key encrypted and vaulted successfully.",
  });
});

// ================================================================
// TASK 3: INTERNAL DECRYPTION ENDPOINT
// GET /internal/vault/keys/:user_id/:provider
// Protected by requireInternalServiceToken middleware
// ================================================================
/**
 * Fetches the AES-256-GCM vault record for a given user+provider,
 * decrypts the key in-memory, and returns the plaintext to the
 * Router Service for immediate use in an upstream AI API call.
 *
 * This endpoint is strictly internal. It must never be reachable
 * from the public internet — enforce this at the network/nginx layer
 * in addition to the token check here.
 *
 * Response:  200 { decrypted_key: "sk-proj-..." }
 *            404 if no key found for this user+provider
 *            403 if service token is missing/invalid
 */
vaultRouter.get(
  "/internal/vault/keys/:user_id/:provider",
  requireInternalServiceToken,
  async (req: Request, res: Response): Promise<void> => {
    const { user_id, provider } = req.params;

    // ---- Path Parameter Validation ----
    if (!user_id || !provider) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_PARAMS", message: "user_id and provider path parameters are required." },
      });
      return;
    }

    const normalizedProvider = provider.toLowerCase().trim();
    if (!isSupportedProvider(normalizedProvider)) {
      res.status(400).json({
        success: false,
        error: {
          code: "UNSUPPORTED_PROVIDER",
          message: `Provider "${provider}" is not supported.`,
        },
      });
      return;
    }

    // ---- Database Fetch ----
    const SELECT_QUERY = `
      SELECT encrypted_key, iv, auth_tag
      FROM byok_vault
      WHERE user_id = $1 AND provider = $2
      LIMIT 1
    `;

    let vaultRow: { encrypted_key: string; iv: string; auth_tag: string } | null = null;
    try {
      const result = await pool.query<{
        encrypted_key: string;
        iv: string;
        auth_tag: string;
      }>(SELECT_QUERY, [user_id, normalizedProvider]);

      vaultRow = result.rows[0] ?? null;
    } catch (dbError) {
      console.error("[VaultService:decrypt] Database fetch failed:", (dbError as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve vault record." },
      });
      return;
    }

    if (!vaultRow) {
      res.status(404).json({
        success: false,
        error: {
          code: "KEY_NOT_FOUND",
          message: `No BYOK key found for provider "${provider}". User must add their key via the Vault ingestion endpoint first.`,
        },
      });
      return;
    }

    // ---- In-Memory Decryption ----
    // The plaintext key is valid only for the scope of this try block.
    // It is never logged, cached, or stored anywhere after this response.
    let decryptedKey: string;
    try {
      decryptedKey = decryptApiKey(
        vaultRow.encrypted_key,
        vaultRow.iv,
        vaultRow.auth_tag
      );
    } catch (decryptError) {
      // This is a CRITICAL SECURITY EVENT: the auth tag failed.
      // The encrypted record in the DB has been tampered with or corrupted.
      console.error(
        `[VaultService:decrypt] CRITICAL SECURITY EVENT: Auth tag validation failed for ` +
          `user_id=${user_id}, provider=${normalizedProvider}. ` +
          `Possible tampering detected. Error: ${(decryptError as Error).message}`
      );
      res.status(500).json({
        success: false,
        error: {
          code: "VAULT_INTEGRITY_FAILURE",
          message:
            "The vault record failed cryptographic integrity validation. " +
            "This incident has been logged. Contact support immediately.",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      decrypted_key: decryptedKey,
    });

    // decryptedKey falls out of scope here — GC will reclaim it.
  }
);
