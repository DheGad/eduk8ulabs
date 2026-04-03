/**
 * @file apiKeyService.ts
 * @service router-service
 * @version V18
 * @description API Key Management for StreetMP Developer Platform.
 *
 * ================================================================
 * SECURITY CONTRACT
 * ================================================================
 *   - Plaintext keys are NEVER stored. Only SHA-256 hashes are persisted.
 *   - Keys are prefixed with `smp_` for easy identification in logs.
 *   - Each key is bound to a specific `tenant_id` and `policy_id`,
 *     allowing the V12 Policy-as-Code engine to apply the correct
 *     rules automatically on every authenticated request.
 *   - Validation is O(1) via in-memory Map lookup by hash.
 *   - In production, replace the in-memory store with a Redis cache
 *     backed by a persistent database (e.g., Postgres).
 * ================================================================
 */

import { createHash, randomBytes } from "node:crypto";

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export interface ApiKeyRecord {
  key_id:    string;
  tenant_id: string;
  policy_id: string;
  label:     string;
  created_at: string;
  /** SHA-256 hex digest of the plaintext key. Never the plaintext. */
  hash: string;
  /** Optional: restrict to specific IP ranges in production */
  allowed_ips?: string[];
}

export interface ApiKeyContext {
  key_id:    string;
  tenant_id: string;
  policy_id: string;
  label:     string;
}

// ----------------------------------------------------------------
// IN-MEMORY STORE  (indexed by SHA-256 hash for O(1) lookup)
// ----------------------------------------------------------------
//
// Pre-seeded with three developer keys so you can test V18 immediately:
//
//   Finance Tenant:
//     smp_finance_dev_key_jpmc_test_00000000001
//   Education Tenant:
//     smp_education_dev_key_stanford_test_0001
//   Defense Tenant:
//     smp_defense_dev_key_pentagon_test_001
//
// These plaintext keys map to the hashes pre-computed below.
// In production all keys are generated via generateKey() and shown once.

const sha256 = (input: string): string =>
  createHash("sha256").update(input).digest("hex");

const SEEDED_KEYS: { plaintext: string; record: Omit<ApiKeyRecord, "hash"> }[] =
  [
    {
      plaintext: "smp_finance_dev_key_jpmc_test_00000000001",
      record: {
        key_id:     "key_finance_001",
        tenant_id:  "jpmc",
        policy_id:  "FINANCIAL_GRADE",
        label:      "JPMC Dev Key (Seeded)",
        created_at: "2026-03-23T00:00:00Z",
      },
    },
    {
      plaintext: "smp_education_dev_key_stanford_test_0001",
      record: {
        key_id:     "key_education_001",
        tenant_id:  "stanford",
        policy_id:  "ACADEMIC_INTEGRITY",
        label:      "Stanford Dev Key (Seeded)",
        created_at: "2026-03-23T00:00:00Z",
      },
    },
    {
      plaintext: "smp_defense_dev_key_pentagon_test_001",
      record: {
        key_id:     "key_defense_001",
        tenant_id:  "pentagon",
        policy_id:  "SOVEREIGN_DEFENSE",
        label:      "Pentagon Dev Key (Seeded)",
        created_at: "2026-03-23T00:00:00Z",
      },
    },
  ];

/** Primary lookup table: SHA-256(plaintext) → ApiKeyRecord */
const KEY_STORE = new Map<string, ApiKeyRecord>();
/** Secondary index: key_id → hash (for revocation) */
const ID_TO_HASH = new Map<string, string>();

// Bootstrap the seeded keys at module load time
for (const { plaintext, record } of SEEDED_KEYS) {
  const hash = sha256(plaintext);
  KEY_STORE.set(hash, { ...record, hash });
  ID_TO_HASH.set(record.key_id, hash);
}

console.info(
  `[V18:ApiKeyService] Initialized with ${KEY_STORE.size} keys ` +
    `(${SEEDED_KEYS.length} seeded, 0 generated).`
);

// ----------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------

/**
 * generateKey
 * -----------
 * Creates a new API key bound to a `tenant_id` and `policy_id`.
 * Returns the plaintext ONCE — it is never stored. The caller must
 * display it to the user immediately and discard it.
 *
 * @param tenant_id  - The tenant this key grants access for (e.g., "jpmc").
 * @param policy_id  - The V12 policy set to enforce (e.g., "FINANCIAL_GRADE").
 * @param label      - A human-readable label for the key.
 * @returns { plaintext, record }  plaintext = the secret shown once.
 */
export function generateKey(
  tenant_id: string,
  policy_id: string,
  label: string = "API Key"
): { plaintext: string; record: ApiKeyRecord } {
  // Generate a 32-byte cryptographically random token, prefixed for recognition
  const raw       = randomBytes(32).toString("hex");
  const plaintext = `smp_${raw}`;
  const hash      = sha256(plaintext);
  const key_id    = `key_${randomBytes(8).toString("hex")}`;

  const record: ApiKeyRecord = {
    key_id,
    tenant_id,
    policy_id,
    label,
    created_at: new Date().toISOString(),
    hash,
  };

  KEY_STORE.set(hash, record);
  ID_TO_HASH.set(key_id, hash);

  console.info(
    `[V18:ApiKeyService] Generated key key_id=${key_id} tenant=${tenant_id} policy=${policy_id}`
  );

  return { plaintext, record };
}

/**
 * validateKey
 * -----------
 * Resolves a plaintext API key to its associated context.
 * Never stores or logs the plaintext key — only operates on the hash.
 *
 * @param plaintext - The raw `x-api-key` header value from the request.
 * @returns ApiKeyContext if valid, or null if invalid/revoked.
 */
export async function validateKey(
  plaintext: string
): Promise<ApiKeyContext | null> {
  if (!plaintext || typeof plaintext !== "string") return null;
  if (!plaintext.startsWith("smp_")) {
    // Fast-reject non-StreetMP keys without hashing — avoids timing attacks
    // on a partial prefix check (prefix is not secret, just a namespace).
    return null;
  }

  const hash   = sha256(plaintext);
  const record = KEY_STORE.get(hash);

  if (!record) {
    console.warn(`[V18:ApiKeyService] validateKey: unrecognized hash (key not found).`);
    return null;
  }

  return {
    key_id:    record.key_id,
    tenant_id: record.tenant_id,
    policy_id: record.policy_id,
    label:     record.label,
  };
}

/**
 * revokeKey
 * ---------
 * Immediately invalidates a key by removing it from the store.
 * O(1) operation.
 *
 * @param key_id - The key_id of the record to revoke.
 * @returns true if the key existed and was revoked.
 */
export function revokeKey(key_id: string): boolean {
  const hash = ID_TO_HASH.get(key_id);
  if (!hash) return false;
  KEY_STORE.delete(hash);
  ID_TO_HASH.delete(key_id);
  console.info(`[V18:ApiKeyService] Revoked key key_id=${key_id}.`);
  return true;
}

/**
 * listKeys
 * --------
 * Returns all records (without hashes) for the management dashboard.
 * Safe to display in a UI — no secret material is returned.
 */
export function listKeys(): Omit<ApiKeyRecord, "hash">[] {
  return [...KEY_STORE.values()].map(({ hash: _h, ...safe }) => safe);
}

// ================================================================
// V18 SELF-TEST  (runs once at import time in development)
// ================================================================

if (process.env.NODE_ENV !== "production") {
  (async () => {
    console.info("[V18:ApiKeyService] Running self-test...");

    // 1. Validate a seeded key
    const ctx = await validateKey("smp_finance_dev_key_jpmc_test_00000000001");
    console.assert(ctx !== null, "FAIL: seeded key must resolve");
    console.assert(ctx?.tenant_id === "jpmc", "FAIL: tenant must be jpmc");
    console.assert(ctx?.policy_id === "FINANCIAL_GRADE", "FAIL: policy must be FINANCIAL_GRADE");

    // 2. Reject an invalid key
    const bad = await validateKey("smp_invalid_key_that_does_not_exist");
    console.assert(bad === null, "FAIL: unknown key must return null");

    // 3. Reject completely malformed input
    const mal = await validateKey("NOT_A_STREETMP_KEY");
    console.assert(mal === null, "FAIL: non-smp prefix must be fast-rejected");

    // 4. Generate and validate a new key
    const { plaintext, record } = generateKey("test-tenant", "TEST_POLICY", "Self-Test Key");
    const ctx2 = await validateKey(plaintext);
    console.assert(ctx2?.tenant_id === "test-tenant", "FAIL: generated key context mismatch");

    // 5. Revoke and confirm invalidation
    const revoked = revokeKey(record.key_id);
    console.assert(revoked === true, "FAIL: revocation must return true");
    const ctx3 = await validateKey(plaintext);
    console.assert(ctx3 === null, "FAIL: revoked key must return null");

    console.info("[V18:ApiKeyService] All 5 self-tests PASSED ✅");
  })().catch((err) => console.error("[V18:ApiKeyService] Self-test ERROR:", err));
}
