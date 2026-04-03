-- ============================================================
-- STREETMP OS — MIGRATION 007
-- V7 Shamir Secret Sharing: Shard Custody + HYOK KMS Registry
-- ============================================================
-- Migration: 007_v7_shamir_shard_custody.sql
-- Depends on: 001 (users, byok_vault)
--
-- Zero-Knowledge Constraint:
--   The Enclave holds Share 1 in volatile RAM only.
--   This migration stores Share 2 and Share 3 — encrypted at rest
--   using the user's Customer-Managed Key (CMK) ARN when available,
--   falling back to the platform STREETMP_MASTER_KEY (AES-256-GCM).
--   No plaintext appears anywhere in this table.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- TABLE: shamir_shard_custody
-- Stores the externalized Shamir shares (S2 + S3) per PII token.
--
-- Security model:
--   - share_2_encrypted: AES-256-GCM ciphertext of S2 (base64)
--   - share_3_encrypted: AES-256-GCM ciphertext of S3 (base64)
--   - Both are encrypted with either the platform master key
--     or the customer's KMS-derived wrapping key.
--   - S1 lives only in Enclave volatile RAM — never here.
--   - A DELETE on this row permanently destroys S2+S3, making
--     the Enclave's S1 mathematically useless (kill-switch path).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shamir_shard_custody (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The user whose vault session created these shares
    user_id             UUID        NOT NULL,

    -- The TKN_... token produced by the Enclave during sanitize
    token               TEXT        NOT NULL,

    -- AES-256-GCM components for Share 2
    share_2_encrypted   TEXT        NOT NULL,   -- Base64 ciphertext
    share_2_iv          TEXT        NOT NULL,   -- 16-byte IV, hex
    share_2_auth_tag    TEXT        NOT NULL,   -- 16-byte GCM auth tag, hex

    -- AES-256-GCM components for Share 3 (cold-storage backup)
    share_3_encrypted   TEXT        NOT NULL,
    share_3_iv          TEXT        NOT NULL,
    share_3_auth_tag    TEXT        NOT NULL,

    -- Which KMS key encrypted these shares (NULL = platform master key)
    -- If customer rotates or revokes their KMS key, these become
    -- unreadable — effective HYOK enforced at the data layer.
    kms_key_id          UUID        NULL,

    -- ISO-8601 expiry — after this, shares should be treated as expired
    -- and re-attestation required. NULL = no expiry (platform default).
    expires_at          TIMESTAMPTZ NULL,

    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_shard_custody_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,  -- Wipe shares when user is deleted

    CONSTRAINT fk_shard_custody_kms
        FOREIGN KEY (kms_key_id)
        REFERENCES hyok_kms_keys (id)
        ON DELETE SET NULL, -- If KMS key record is deleted, shares become unresolvable

    -- One share-pair per token per user (a token belongs to one session)
    CONSTRAINT uq_shard_custody_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_shard_custody_user_id
    ON shamir_shard_custody (user_id);

CREATE INDEX IF NOT EXISTS idx_shard_custody_token
    ON shamir_shard_custody (user_id, token);

CREATE INDEX IF NOT EXISTS idx_shard_custody_kms
    ON shamir_shard_custody (kms_key_id)
    WHERE kms_key_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shard_custody_expires
    ON shamir_shard_custody (expires_at)
    WHERE expires_at IS NOT NULL;

CREATE OR REPLACE TRIGGER set_shard_custody_updated_at
    BEFORE UPDATE ON shamir_shard_custody
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();


-- ────────────────────────────────────────────────────────────
-- TABLE: hyok_kms_keys
-- Registry of customer-controlled KMS keys (HYOK / BYOK).
--
-- One row per linked key per user. Supports:
--   AWS KMS:            arn:aws:kms:...
--   Azure Key Vault:    https://vault.azure.net/keys/...
--   GCP Cloud KMS:      projects/.../cryptoKeys/...
--
-- The Enclave performs an asymmetric attestation handshake
-- on link to prove the user controls the private key material.
-- The `attestation_proof` stores the signed nonce returned by
-- the KMS endpoint during attestation.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hyok_kms_keys (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,

    -- Cloud provider identifier
    provider            TEXT        NOT NULL
        CONSTRAINT kms_provider_valid CHECK (provider IN ('aws', 'azure', 'gcp', 'custom')),

    -- The full resource identifier (ARN / URL / resource path)
    key_arn             TEXT        NOT NULL,

    -- Human-readable alias for the key management UI
    display_name        TEXT        NOT NULL DEFAULT 'Primary KMS Key',

    -- Whether the Enclave has successfully attested this key
    is_attested         BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Opaque proof blob returned by the KMS during attestation
    -- (e.g., signed Ed25519 nonce from the Enclave handshake).
    -- NULL until attestation succeeds.
    attestation_proof   TEXT        NULL,

    -- Timestamp of last successful attestation
    attested_at         TIMESTAMPTZ NULL,

    -- Re-attestation schedule (UTC). The Enclave should re-verify
    -- key accessibility before this timestamp.
    next_attestation_due TIMESTAMPTZ NULL,

    -- Soft-disable: revoked KMS links are retained for audit but
    -- no new shares will be encrypted with this key.
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Optional: ARN of the IAM role used for KMS operations
    -- (for AWS cross-account KMS access patterns)
    role_arn            TEXT        NULL,

    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_hyok_kms_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    -- Each user may have at most one active key per provider
    CONSTRAINT uq_hyok_active_provider
        UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_hyok_kms_user_id
    ON hyok_kms_keys (user_id);

CREATE INDEX IF NOT EXISTS idx_hyok_kms_attested
    ON hyok_kms_keys (user_id, is_attested)
    WHERE is_attested = TRUE;

CREATE INDEX IF NOT EXISTS idx_hyok_kms_next_attest
    ON hyok_kms_keys (next_attestation_due)
    WHERE is_active = TRUE;

CREATE OR REPLACE TRIGGER set_hyok_kms_updated_at
    BEFORE UPDATE ON hyok_kms_keys
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();


-- ────────────────────────────────────────────────────────────
-- TABLE: revocation_log
-- Immutable audit trail of all kill-switch / revocation events.
--
-- Written atomically with the DELETE from shamir_shard_custody.
-- Cannot be updated or deleted — compliance and forensics anchor.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revocation_log (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,

    -- Type of revocation event
    event_type          TEXT        NOT NULL
        CONSTRAINT revocation_event_type_valid CHECK (event_type IN (
            'kill_switch',      -- User triggered the UI kill switch
            'admin_revoke',     -- Platform admin forced revocation
            'kms_key_rotated',  -- Customer rotated their KMS key
            'session_expired',  -- Shares expired per TTL policy
            'api_request'       -- Programmatic revocation via API
        )),

    -- How many shard rows were deleted in this revocation
    shards_purged       INTEGER     NOT NULL DEFAULT 0,

    -- Enclave wipe confirmation reference
    -- Set to the Enclave's request correlation ID if the wipe call succeeded
    enclave_wipe_ref    TEXT        NULL,

    -- HTTP status returned by Enclave wipe call (403 = success)
    enclave_wipe_status INTEGER     NULL,

    -- Metadata: actor identity (could be user email, admin ID, or 'system')
    initiated_by        TEXT        NOT NULL DEFAULT 'user',

    -- Optional: which KMS key was involved (for KMS rotation events)
    kms_key_id          UUID        NULL,

    -- Signed receipt from the Enclave (Ed25519 execution receipt)
    enclave_receipt     TEXT        NULL,

    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
    -- No updated_at: revocation_log is APPEND-ONLY
);

CREATE INDEX IF NOT EXISTS idx_revocation_log_user_id
    ON revocation_log (user_id);

CREATE INDEX IF NOT EXISTS idx_revocation_log_event_type
    ON revocation_log (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revocation_log_created
    ON revocation_log (created_at DESC);


-- ============================================================
-- MIGRATION 007 COMPLETE
-- New tables: shamir_shard_custody, hyok_kms_keys, revocation_log
-- ============================================================
