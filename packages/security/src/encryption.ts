/**
 * @file encryption.ts
 * @package @streetmp-os/security
 * @description IronCore Cryptography Engine — AES-256-GCM BYOK Key Vault
 *
 * ================================================================
 * SECURITY ARCHITECTURE NOTE (For Enterprise Audit Trail)
 * ================================================================
 * This module is the ONLY location in the entire Streetmp OS
 * platform where raw API key encryption and decryption occurs.
 *
 * Algorithm: AES-256-GCM (Advanced Encryption Standard,
 *            256-bit key, Galois/Counter Mode)
 *
 * WHY AES-256-GCM over AES-256-CBC:
 *   GCM is an AEAD (Authenticated Encryption with Associated Data)
 *   mode. In addition to confidentiality (the data is unreadable
 *   without the key), GCM also provides INTEGRITY AUTHENTICATION
 *   via the `authTag` (a 16-byte Message Authentication Code).
 *
 *   If any single bit of the ciphertext or IV stored in the
 *   `byok_vault` table is tampered with — by an attacker, a rogue
 *   admin, or a storage corruption event — the `authTag` validation
 *   will FAIL and decryption will throw a hard error BEFORE any
 *   plaintext is ever returned. This makes database-level tampering
 *   cryptographically detectable. No CBC mode provides this guarantee.
 *
 * KEY DERIVATION:
 *   The encryption key is sourced exclusively from STREETMP_MASTER_KEY
 *   (a 32-byte / 256-bit hex string stored as an environment variable,
 *   never in the database or any repository). The key is loaded once
 *   at module initialization and validated for correct length.
 *
 * IV POLICY:
 *   A fresh cryptographically random 16-byte (128-bit) IV is generated
 *   for EVERY single encryption call. Re-using an IV with the same key
 *   would be a catastrophic security failure (it breaks GCM's security
 *   properties). This module enforces the one-IV-per-encryption rule.
 *
 * SUPPLY-CHAIN SECURITY:
 *   This module uses ONLY Node.js built-in `crypto` module. Zero
 *   external NPM dependencies for cryptographic operations, eliminating
 *   all supply-chain attack vectors on the key vault.
 * ================================================================
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ----------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------
const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTE_LENGTH = 16;    // 128-bit IV — standard for AES-GCM
const KEY_BYTE_LENGTH = 32;   // 256-bit key — required for AES-256
const AUTH_TAG_BYTE_LENGTH = 16; // 128-bit auth tag — GCM maximum, most secure

// ----------------------------------------------------------------
// MASTER KEY LOADING & VALIDATION
// Fail fast at module load time. If the master key is missing or
// malformed, the Vault Service should refuse to start entirely.
// ----------------------------------------------------------------
function loadMasterKey(): Buffer {
  const hexKey = process.env.STREETMP_MASTER_KEY;

  if (!hexKey) {
    throw new Error(
      "[IronCore] FATAL: STREETMP_MASTER_KEY environment variable is not set. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  // A 32-byte key represented as hex must be exactly 64 characters
  if (hexKey.length !== KEY_BYTE_LENGTH * 2) {
    throw new Error(
      `[IronCore] FATAL: STREETMP_MASTER_KEY must be exactly ${KEY_BYTE_LENGTH * 2} hex characters ` +
        `(${KEY_BYTE_LENGTH} bytes / 256 bits). Received ${hexKey.length} characters.`
    );
  }

  const keyBuffer = Buffer.from(hexKey, "hex");

  // Final sanity check: confirm the decoded buffer is the right byte length
  if (keyBuffer.byteLength !== KEY_BYTE_LENGTH) {
    throw new Error(
      `[IronCore] FATAL: STREETMP_MASTER_KEY decoded to ${keyBuffer.byteLength} bytes. ` +
        `Expected exactly ${KEY_BYTE_LENGTH} bytes. The key may contain non-hex characters.`
    );
  }

  return keyBuffer;
}

// Load and lock the master key into module scope at startup.
// This is intentionally module-level (not inside each function call)
// for performance, but the key never escapes this module boundary.
const MASTER_KEY: Buffer = loadMasterKey();


// ----------------------------------------------------------------
// TYPESCRIPT INTERFACES
// ----------------------------------------------------------------

/**
 * The three components returned by `encryptApiKey` and required
 * by `decryptApiKey`. All three fields must be stored together
 * in the `byok_vault` table — losing any one of them makes
 * decryption impossible.
 */
export interface EncryptedData {
  /**
   * The AES-256-GCM ciphertext of the plaintext API key,
   * encoded as a lowercase hex string.
   */
  encryptedKey: string;

  /**
   * The Initialization Vector used during encryption,
   * encoded as a lowercase hex string.
   * Each encryption generates a new random IV.
   * MUST be stored alongside the ciphertext.
   */
  iv: string;

  /**
   * The GCM Authentication Tag produced during encryption,
   * encoded as a lowercase hex string.
   * Required to verify ciphertext integrity before decryption.
   * If this tag does not match on decryption, the data was tampered with.
   */
  authTag: string;
}

/**
 * Input type for `decryptApiKey` — mirrors the three column values
 * read directly from the `byok_vault` table row.
 */
export interface VaultRecord {
  encryptedKey: string;
  iv: string;
  authTag: string;
}


// ----------------------------------------------------------------
// FUNCTION 1: encryptApiKey
// ----------------------------------------------------------------

/**
 * Encrypts a plaintext provider API key using AES-256-GCM.
 *
 * @param plainTextKey - The raw, plaintext API key string (e.g., "sk-abc123...").
 *                       This string MUST be handled exclusively in memory and
 *                       MUST NEVER be logged, stored, or transmitted.
 *
 * @returns {EncryptedData} An object containing `encryptedKey`, `iv`, and
 *          `authTag` — all as hex strings — ready for storage in `byok_vault`.
 *
 * @throws {Error} If the master key is invalid or if the crypto module fails.
 *
 * @example
 * const encrypted = encryptApiKey("sk-proj-abc123...");
 * // Store encrypted.encryptedKey, encrypted.iv, encrypted.authTag in DB
 */
export function encryptApiKey(plainTextKey: string): EncryptedData {
  if (!plainTextKey || typeof plainTextKey !== "string") {
    throw new Error("[IronCore] encryptApiKey: plainTextKey must be a non-empty string.");
  }

  // Generate a fresh, cryptographically secure random IV for this encryption.
  // CRITICAL: A unique IV must be used for every single encryption operation
  // with the same key. IV reuse with GCM is a catastrophic security failure.
  const iv = randomBytes(IV_BYTE_LENGTH);

  // Create the AES-256-GCM cipher with our master key and fresh IV
  const cipher = createCipheriv(ALGORITHM, MASTER_KEY, iv);

  // Encrypt the plaintext. The cipher produces the ciphertext in two chunks:
  // the `update()` call processes the main data, `final()` flushes any remainder.
  const encryptedBuffer = Buffer.concat([
    cipher.update(plainTextKey, "utf8"),
    cipher.final(),
  ]);

  // Extract the GCM Authentication Tag AFTER calling cipher.final().
  // This tag is computed over the entire ciphertext and serves as a
  // cryptographic proof of integrity. It must be stored with the ciphertext.
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encryptedBuffer.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}


// ----------------------------------------------------------------
// FUNCTION 2: decryptApiKey
// ----------------------------------------------------------------

/**
 * Decrypts a provider API key from its AES-256-GCM vault components.
 *
 * ⚠️  SECURITY CONTRACT:
 *   This function sets the GCM `authTag` BEFORE calling `decipher.final()`.
 *   This forces Node.js to authenticate the ciphertext against the tag
 *   BEFORE returning ANY plaintext. If authentication fails (tampered
 *   ciphertext, corrupted IV, wrong auth tag), `decipher.final()` will
 *   throw an `ERR_CRYPTO_INVALID_AUTH_TAG` error. The caller MUST handle
 *   this error as a critical security event (log + alert, do NOT retry
 *   silently). The plaintext key must be used immediately and never cached.
 *
 * @param encryptedKey - Hex string of the AES-256-GCM ciphertext from `byok_vault.encrypted_key`.
 * @param iv           - Hex string of the IV from `byok_vault.iv`.
 * @param authTag      - Hex string of the GCM auth tag from `byok_vault.auth_tag`.
 *
 * @returns {string} The plaintext API key, valid strictly in-memory for the
 *          duration of the current request. MUST NOT be stored or logged.
 *
 * @throws {Error} If the authTag validation fails — this indicates database
 *          tampering or record corruption. Treat as a CRITICAL SECURITY EVENT.
 * @throws {Error} If any input is missing, malformed, or the wrong length.
 *
 * @example
 * // Fetch row from byok_vault, then:
 * const plainTextKey = decryptApiKey(row.encrypted_key, row.iv, row.auth_tag);
 * // Use plainTextKey to call external API, then let it fall out of scope.
 */
export function decryptApiKey(
  encryptedKey: string,
  iv: string,
  authTag: string
): string {
  if (!encryptedKey || typeof encryptedKey !== "string") {
    throw new Error("[IronCore] decryptApiKey: encryptedKey must be a non-empty hex string.");
  }
  if (!iv || typeof iv !== "string") {
    throw new Error("[IronCore] decryptApiKey: iv must be a non-empty hex string.");
  }
  if (!authTag || typeof authTag !== "string") {
    throw new Error("[IronCore] decryptApiKey: authTag must be a non-empty hex string.");
  }

  const ivBuffer = Buffer.from(iv, "hex");
  if (ivBuffer.byteLength !== IV_BYTE_LENGTH) {
    throw new Error(
      `[IronCore] decryptApiKey: IV must decode to ${IV_BYTE_LENGTH} bytes. ` +
        `Got ${ivBuffer.byteLength} bytes. The vault record may be corrupted.`
    );
  }

  const authTagBuffer = Buffer.from(authTag, "hex");
  if (authTagBuffer.byteLength !== AUTH_TAG_BYTE_LENGTH) {
    throw new Error(
      `[IronCore] decryptApiKey: authTag must decode to ${AUTH_TAG_BYTE_LENGTH} bytes. ` +
        `Got ${authTagBuffer.byteLength} bytes.`
    );
  }

  // Create the AES-256-GCM decipher using the same master key and the stored IV
  const decipher = createDecipheriv(ALGORITHM, MASTER_KEY, ivBuffer);

  // ⚠️  CRITICAL: Set the auth tag BEFORE calling update/final.
  // This instructs the decipher to authenticate the ciphertext against
  // this tag during final(). Do NOT skip this step — without it, GCM
  // authentication is bypassed entirely, defeating its core security guarantee.
  decipher.setAuthTag(authTagBuffer);

  try {
    const decryptedBuffer = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, "hex")),
      decipher.final(), // ← Auth tag is verified here. Throws if tampered.
    ]);

    return decryptedBuffer.toString("utf8");
  } catch (error) {
    // Wrap the low-level crypto error in a domain-specific, audit-friendly message.
    // The original error (ERR_CRYPTO_INVALID_AUTH_TAG) is attached for logging.
    throw new Error(
      "[IronCore] CRITICAL SECURITY EVENT: decryptApiKey authentication failed. " +
        "The vault record has been tampered with, corrupted, or the master key has changed. " +
        "Incident must be investigated immediately. " +
        `Original error: ${(error as Error).message}`
    );
  }
}
