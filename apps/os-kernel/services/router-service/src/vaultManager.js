import * as crypto from "crypto";
export class SovereignVault {
    ALGORITHM = "aes-256-gcm";
    IV_LENGTH = 16;
    /**
     * Seals data using a 32-byte client-provided cryptographic key
     *
     * @param payload Any plaintext JSON serializable object
     * @param clientKey Hex string representing the 256 bit key
     */
    sealData(payload, clientKey) {
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
        }
        catch (e) {
            console.error("[V47:Vault] Seal operation failed.", (e instanceof Error) ? e.message : String(e));
            throw e;
        }
    }
    /**
     * Unseals data using the exact original 32-byte client key.
     */
    unsealData(sealed, clientKey) {
        try {
            const keyBuffer = Buffer.from(clientKey, "hex");
            const ivBuffer = Buffer.from(sealed.iv, "hex");
            const authTagBuffer = Buffer.from(sealed.authTag, "hex");
            const decipher = crypto.createDecipheriv(this.ALGORITHM, keyBuffer, ivBuffer);
            decipher.setAuthTag(authTagBuffer);
            let decrypted = decipher.update(sealed.ciphertext, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return JSON.parse(decrypted);
        }
        catch (e) {
            console.error("[V47:Vault] Unseal operation failed. Key may be revoked or auth tag invalid.", (e instanceof Error) ? e.message : String(e));
            throw new Error("V47 Vault Unseal Failure");
        }
    }
}
// Singleton export
export const globalVault = new SovereignVault();
// Exporting a static mock key for demo pipeline purposes
export const MOCK_CLIENT_KEY = crypto.randomBytes(32).toString("hex");
