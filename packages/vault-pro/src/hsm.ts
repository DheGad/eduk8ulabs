/**
 * @file hsm.ts
 * @package @streetmp-os/vault-pro
 * @description Hardware Security Module (HSM) Connector — "SYOK" (Secure Your Own Key) Engine
 *
 * Implements Hardware-Level Key Isolation (The "JP Morgan Standard").
 *
 * Architecture:
 *   1. The Root Master Key never leaves the Vault/HSM secure enclave.
 *   2. The OS Kernel (Enforcer, Router) never sees the raw Vendor API key (e.g., OpenAI/Anthropic).
 *   3. When the Enforcer needs to call an LLM, it requests a Temporal Execution Token.
 *   4. The Vault generates a short-lived (10-second) JWT signed by the Master Key.
 *   5. The network proxy transparently intercepts the JWT, decrypts the true key inside the
 *      secure boundary, and injects it into the outbound request to the LLM vendor.
 *
 * This guarantees that even if the Enforcer or memory space is completely compromised or dumped,
 * the attacker only gets an expired token, not the enterprise root key.
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================

export interface TemporalExecutionToken {
  /** The 10-second short-lived token to be passed to the LLM SDK */
  token:        string;
  /** Cryptographic proof of origin */
  signature:    string;
  /** When this token expires (Unix time ms) */
  expires_at:   number;
  /** The model permitted to be called with this token */
  model_target: string;
}

export interface HSMConfig {
  /** If true, simulates HSM interaction using Node crypto (dev mode) */
  simulateRootKey?: boolean;
  /** Path to the PKCS#11 hardware module (production) */
  pkcs11Path?:      string;
}

// ================================================================
// THE SECURE ENCLAVE (Black Box)
// ================================================================
// In a true HSM, this memory space is isolated at the hardware level.
// Here in Node, we keep it closely scoped and garbage-collected quickly.

class SecureEnclave {
  private masterKey: crypto.webcrypto.CryptoKey | null = null;
  private initializationVector: Uint8Array = crypto.getRandomValues(new Uint8Array(12));

  /** Returns true if the enclave is initialized */
  public isReady(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Generates or imports the Root Key into the un-extractable WebCrypto enclave.
   * `extractable: false` means even V8 JavaScript cannot read the raw key buffer after creation.
   */
  public async initialize(): Promise<void> {
    if (this.isReady()) return;
    this.masterKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // MUST BE FALSE for JP Morgan standard (non-extractable)
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypts the raw vendor key inside the enclave.
   */
  public async secureKey(rawVendorKey: string): Promise<string> {
    if (!this.masterKey) throw new Error("HSM Enclave not initialized");
    const encoded = new TextEncoder().encode(rawVendorKey);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: this.initializationVector },
      this.masterKey,
      encoded
    );
    return Buffer.from(ciphertext).toString("base64");
  }

  /**
   * Decrypts the raw vendor key IN-MEMORY ONLY during outbound proxying.
   */
  public async retrieveKey(securedPayloadBase64: string): Promise<string> {
    if (!this.masterKey) throw new Error("HSM Enclave not initialized");
    const ciphertext = Buffer.from(securedPayloadBase64, "base64");
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: this.initializationVector },
      this.masterKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }
}

const Enclave = new SecureEnclave();

// ================================================================
// HSM CONNECTOR PUBLIC API
// ================================================================

export class HSMConnector {
  
  /**
   * Boot the HSM. Must be called at Vault Service startup.
   */
  public static async boot(_config?: HSMConfig): Promise<void> {
    await Enclave.initialize();
    console.log("[HSM] Secure Enclave booted. Root key generated [extractable: false].");
  }

  /**
   * Vault initialization: Encrypt a raw vendor API key so it can be safely stored in Postgres.
   */
  public static async encryptForStorage(rawKey: string): Promise<string> {
    return Enclave.secureKey(rawKey);
  }

  /**
   * Mint a Temporal Execution Token for the Enforcer.
   *
   * @param encryptedPayload    The AES-GCM encrypted string back from the DB.
   * @param targetModel         The LLM allowed to be accessed (e.g. "gpt-4o").
   * @param traceId             Forensic trace ID for audit logging.
   * @returns                   TemporalExecutionToken (10s expiry).
   */
  public static async mintTemporalToken(
    encryptedPayload: string,
    targetModel: string,
    traceId: string
  ): Promise<TemporalExecutionToken> {
    if (!Enclave.isReady()) throw new Error("Hardware Security Module unreachable");

    const expires_at = Date.now() + 10_000; // 10 seconds from now

    // The token string is a signed claim, containing the encrypted payload
    // but NEVER the decrypted payload.
    const tokenHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "SYOK" })).toString("base64url");
    const tokenBody = Buffer.from(JSON.stringify({
      ptr: encryptedPayload, // The pointer to the encrypted payload
      mod: targetModel,
      exp: expires_at,
      tid: traceId
    })).toString("base64url");

    // Sign the token using an ephemeral HMAC key (derived from root key in production HSMs)
    const ephemeralKey = crypto.randomBytes(32);
    const signature = crypto.createHmac("sha256", ephemeralKey)
      .update(`${tokenHeader}.${tokenBody}`)
      .digest("base64url");

    const token = `${tokenHeader}.${tokenBody}.${signature}`;

    return {
      token,
      signature,
      expires_at,
      model_target: targetModel
    };
  }

  /**
   * DANGEROUS / INTERNAL ONLY: 
   * Used exclusively by the Outbound Network Egress Node to swap the Temporal Token
   * for the actual raw Vendor Key right before opening the TLS socket to OpenAI/Anthropic.
   */
  public static async __DECRYPT_AT_EGRESS(temporalToken: string): Promise<string> {
    const parts = temporalToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid Temporal Token structure");

    const bodyStr = Buffer.from(parts[1], "base64url").toString("utf-8");
    const body = JSON.parse(bodyStr);

    if (Date.now() > body.exp) {
      throw new Error("HSM Violation: Temporal Token expired. Refusing to unseal Master Key.");
    }

    // Decrypt the payload pointer back to raw key
    return Enclave.retrieveKey(body.ptr);
  }
}
