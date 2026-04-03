/**
 * @file vaultClient.ts
 * @service router-service
 * @description Internal Vault Service communication utility.
 *
 * This module is the ONLY place in the Router Service that knows
 * how to reach the Vault Service's internal decryption endpoint.
 *
 * Security contract:
 *   • The `x-internal-service-token` header proves to the Vault Service
 *     that this request originated from a trusted peer microservice,
 *     not from the public internet.
 *   • The returned `decryptedKey` string must be consumed immediately
 *     and never stored in any variable that outlives the request scope.
 *   • This function and its callers must never log the returned key.
 */
import axios from "axios";
// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------
const VAULT_SERVICE_BASE_URL = process.env.VAULT_SERVICE_URL ?? "http://localhost:4002";
/**
 * Error thrown when the Vault Service interaction fails in a way
 * the Router Service needs to surface differently to the client.
 */
export class VaultClientError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "VaultClientError";
    }
}
/**
 * Fetches a decrypted provider API key from the Vault Service.
 *
 * Makes an authenticated GET request to the Vault Service's
 * internal endpoint, passing the shared INTERNAL_ROUTER_SECRET
 * header. The decrypted key is returned strictly in-memory.
 *
 * @param userId   — The authenticated user's UUID
 * @param provider — The AI provider identifier (e.g. 'openai', 'anthropic')
 *
 * @returns The plaintext API key — MUST be nullified after use.
 *
 * @throws {VaultClientError} on 404 (no key), 403 (auth failure),
 *         500 (integrity failure), or network error.
 */
export async function fetchDecryptedKey(userId, provider) {
    const internalSecret = process.env.INTERNAL_ROUTER_SECRET;
    if (!internalSecret) {
        throw new VaultClientError("VAULT_AUTH_FAILURE", "[RouterService:vaultClient] FATAL: INTERNAL_ROUTER_SECRET is not configured. " +
            "Cannot authenticate with the Vault Service.");
    }
    const url = `${VAULT_SERVICE_BASE_URL}/internal/vault/keys/${encodeURIComponent(userId)}/${encodeURIComponent(provider)}`;
    try {
        const response = await axios.get(url, {
            headers: {
                "x-internal-service-token": internalSecret,
                "Content-Type": "application/json",
            },
            // Fail fast — the Router is on the hot path of an LLM request
            timeout: 5000,
        });
        const decryptedKey = response.data?.decrypted_key;
        if (!decryptedKey || typeof decryptedKey !== "string") {
            throw new VaultClientError("VAULT_ERROR", "Vault Service returned a malformed response — decrypted_key missing.");
        }
        return decryptedKey;
    }
    catch (error) {
        // Already a typed VaultClientError — re-throw as-is
        if (error instanceof VaultClientError) {
            throw error;
        }
        const axiosErr = error;
        if (!axiosErr.response) {
            // Network-level failure — Vault Service is unreachable
            throw new VaultClientError("VAULT_UNREACHABLE", `Cannot reach Vault Service at ${VAULT_SERVICE_BASE_URL}. ` +
                "Ensure vault-service is running and VAULT_SERVICE_URL is configured correctly.");
        }
        const statusCode = axiosErr.response.status;
        const errorCode = axiosErr.response.data?.error?.code ?? "UNKNOWN";
        const errorMsg = axiosErr.response.data?.error?.message ?? axiosErr.message;
        if (statusCode === 404) {
            throw new VaultClientError("KEY_NOT_FOUND", `No BYOK key found for provider "${provider}". ` +
                "The user must add their API key via the Vault ingestion endpoint first.");
        }
        if (statusCode === 403) {
            // This should never happen in a correctly configured deployment.
            // If it does, the INTERNAL_ROUTER_SECRET is mismatched between services.
            console.error(`[RouterService:vaultClient] CRITICAL: Vault Service rejected our internal token ` +
                `(403). INTERNAL_ROUTER_SECRET mismatch between router-service and vault-service.`);
            throw new VaultClientError("VAULT_AUTH_FAILURE", "Internal service authentication failed. Contact the platform administrator.");
        }
        if (statusCode === 500 && errorCode === "VAULT_INTEGRITY_FAILURE") {
            console.error(`[RouterService:vaultClient] CRITICAL: Vault integrity failure for ` +
                `userId=${userId}, provider=${provider}. Possible DB tampering.`);
            throw new VaultClientError("VAULT_INTEGRITY_FAILURE", "A cryptographic integrity failure was detected in the vault. " +
                "This incident has been logged. Contact support.");
        }
        throw new VaultClientError("VAULT_ERROR", `Vault Service returned unexpected error [${statusCode}]: ${errorMsg}`);
    }
}
