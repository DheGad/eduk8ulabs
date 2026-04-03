/**
 * @file index.ts
 * @package @streetmp-os/security
 * @description Public API barrel export for the IronCore Security package.
 */

// AES-256-GCM BYOK Key Vault
export { encryptApiKey, decryptApiKey } from "./encryption.js";
export type { EncryptedData, VaultRecord } from "./encryption.js";

// JWT Authentication Middleware
export { requireAuth } from "./middleware.js";
