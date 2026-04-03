import * as crypto from "crypto";

/**
 * @file vaultManager.ts
 * @service router-service
 * @version V47
 * @description V47 Sovereign Data Vaults.
 *
 * Implements AES-256-GCM to encrypt/decrypt (seal/unseal) JSON telemetry and caches
 * ensuring zero plaintext data leaks on local redis or db instances. Uses a simulated
 * Client_KMS_Key logic block.
 */

export interface SealedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class SovereignVault {
  private readonly ALGORITHM = "aes-256-gcm";
  private readonly IV_LENGTH = 16;

  /**
   * Seals data using a 32-byte client-provided cryptographic key
   * 
   * @param payload Any plaintext JSON serializable object
   * @param clientKey Hex string representing the 256 bit key
   */
  public sealData(payload: any, clientKey: string): SealedPayload {
    try {
      if (!clientKey || clientKey.length !== 64) {
        throw new Error("V47: Invalid HYOK client key format. Must be 64-character hex string.");
      }

      const keyBuffer = Buffer.from(clientKey, "hex");
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, keyBuffer, iv);
      const dataStr = JSON.stringify(payload);
      
      let encrypted = cipher.update(dataStr, "utf8", "hex");
      encrypted += cipher.final("hex");
      
      const authTag = cipher.getAuthTag().toString("hex");
      
      return {
        ciphertext: encrypted,
        iv: iv.toString("hex"),
        authTag: authTag,
      };
    } catch (e: unknown) {
      console.error("[V47:Vault] Seal operation failed.", (e instanceof Error) ? e.message : String(e));
      throw e;
    }
  }

  /**
   * Unseals data using the exact original 32-byte client key.
   */
  public unsealData(sealed: SealedPayload, clientKey: string): any {
    try {
      const keyBuffer = Buffer.from(clientKey, "hex");
      const ivBuffer = Buffer.from(sealed.iv, "hex");
      const authTagBuffer = Buffer.from(sealed.authTag, "hex");
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, keyBuffer, ivBuffer);
      decipher.setAuthTag(authTagBuffer);
      
      let decrypted = decipher.update(sealed.ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");
      
      return JSON.parse(decrypted);
    } catch (e: unknown) {
      console.error("[V47:Vault] Unseal operation failed. Key may be revoked or auth tag invalid.", (e instanceof Error) ? e.message : String(e));
      throw new Error("V47 Vault Unseal Failure");
    }
  }
}

// Singleton export
export const globalVault = new SovereignVault();

// Exporting a static mock key for demo pipeline purposes
export const MOCK_CLIENT_KEY = crypto.randomBytes(32).toString("hex");
