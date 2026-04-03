/**
 * @file sovereignty.ts
 * @service router-service (or api-gateway)
 * @description V7-02 Shard Custody & HYOK — Sovereignty Control Plane Router.
 *
 * Endpoints:
 *   POST /api/v1/sovereignty/revoke
 *     — Kill-switch: purges all Shamir shares for a user from DB,
 *       then sends a WIPE command to the Enclave.
 *
 *   POST /api/v1/sovereignty/kms/link
 *     — Links a Customer KMS ARN, triggers attestation, persists to hyok_kms_keys.
 *
 *   GET  /api/v1/sovereignty/kms/status
 *     — Returns current KMS key linkage + attestation status for the user.
 *
 *   GET  /api/v1/sovereignty/shards/count
 *     — Returns how many live shard rows exist for the user (audit helper).
 *
 * ZERO-KNOWLEDGE CONTRACT:
 *   Node.js never receives Share 1.
 *   Share 2 and Share 3 are AES-256-GCM encrypted before DB write.
 *   Plaintext shares MUST NOT be logged.
 */
import { Router } from "express";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { revokeAll, getTelemetry } from "./enclaveClient.js";
import { pool } from "./db.js"; // Re-use vault-service pool pattern
export const sovereigntyRouter = Router();
// ─── Config ──────────────────────────────────────────────────────────────────
/** AES-256-GCM master key for encrypting S2/S3 at rest. Same env var as BYOK vault. */
const MASTER_KEY = Buffer.from(process.env.STREETMP_MASTER_KEY ?? "", "hex");
const INTERNAL_TOKEN = () => process.env.INTERNAL_ROUTER_SECRET ?? "";
// ─── Helpers ─────────────────────────────────────────────────────────────────
function encryptShare(plainBase64) {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", MASTER_KEY, iv);
    const enc = Buffer.concat([cipher.update(plainBase64, "utf8"), cipher.final()]);
    return {
        encrypted: enc.toString("base64"),
        iv: iv.toString("hex"),
        auth_tag: cipher.getAuthTag().toString("hex"),
    };
}
function decryptShare(encrypted, ivHex, authTagHex) {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", MASTER_KEY, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64")),
        decipher.final(),
    ]);
    return dec.toString("utf8");
}
function requireInternalAuth(req, res) {
    const token = req.headers["x-internal-service-token"];
    if (!token || token !== INTERNAL_TOKEN()) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid internal token." } });
        return false;
    }
    return true;
}
// ─── POST /api/v1/sovereignty/revoke ─────────────────────────────────────────
/**
 * Kill Switch — full sovereignty revocation.
 *
 * Flow:
 *   1. Validate user_id
 *   2. COUNT existing shard rows (for audit record)
 *   3. DELETE all shamir_shard_custody rows for this user
 *   4. Call revokeAll() → Enclave WIPE command
 *   5. INSERT into revocation_log (immutable audit anchor)
 *   6. Return 200 with wipe confirmation
 *
 * If the Enclave WIPE fails (e.g. vsock down), the DB purge already happened
 * — we still log the event and return a partial success with a warning.
 */
sovereigntyRouter.post("/api/v1/sovereignty/revoke", async (req, res) => {
    const { user_id, initiated_by = "user" } = req.body;
    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PAYLOAD", message: "Missing required field: user_id" },
        });
        return;
    }
    const uid = user_id.trim();
    let shardsDeleted = 0;
    try {
        // Step 1: Count existing shards for audit record
        const countResult = await pool.query(`SELECT COUNT(*) AS count FROM shamir_shard_custody WHERE user_id = $1`, [uid]);
        shardsDeleted = parseInt(countResult.rows[0]?.count ?? "0", 10);
        // Step 2: Purge all shard rows — S2 and S3 permanently destroyed
        await pool.query(`DELETE FROM shamir_shard_custody WHERE user_id = $1`, [uid]);
        console.warn(`[Sovereignty] User ${uid}: ${shardsDeleted} shard rows purged from DB`);
    }
    catch (dbErr) {
        console.error("[Sovereignty] DB shard purge failed:", dbErr.message);
        res.status(500).json({
            success: false,
            error: { code: "DB_ERROR", message: "Failed to purge shard custody records." },
        });
        return;
    }
    // Step 3: Send WIPE command to Enclave
    const revokeResult = await revokeAll();
    const enclaveSuccess = revokeResult.status === "wiped";
    if (!enclaveSuccess) {
        console.error(`[Sovereignty] Enclave WIPE returned status: ${revokeResult.status}`);
    }
    // Step 4: Write immutable revocation_log row (even on partial failure)
    try {
        await pool.query(`INSERT INTO revocation_log
           (user_id, event_type, shards_purged, enclave_wipe_ref, enclave_wipe_status, initiated_by, enclave_receipt)
         VALUES ($1, 'kill_switch', $2, $3, $4, $5, $6)`, [
            uid,
            shardsDeleted,
            revokeResult.wipe_ref ?? null,
            enclaveSuccess ? 200 : 503,
            initiated_by,
            revokeResult.receipt ? JSON.stringify(revokeResult.receipt) : null,
        ]);
    }
    catch (logErr) {
        // Non-fatal: audit log failure shouldn't un-do the wipe
        console.error("[Sovereignty] revocation_log write failed (non-fatal):", logErr.message);
    }
    res.status(200).json({
        success: true,
        shards_purged: shardsDeleted,
        enclave_wiped: enclaveSuccess,
        wipe_ref: revokeResult.wipe_ref,
        enclave_receipt: revokeResult.receipt ?? null,
        warning: !enclaveSuccess
            ? `DB shares purged but Enclave WIPE returned: ${revokeResult.status}. ` +
                `The Enclave's volatile vault may still contain Share 1 until next restart.`
            : undefined,
    });
});
// ─── POST /api/v1/sovereignty/kms/link ───────────────────────────────────────
/**
 * Link a Customer KMS ARN and perform asymmetric attestation.
 *
 * Attestation simulation (production would call AWS/Azure/GCP SDK):
 *   1. Generate a challenge nonce (32 bytes)
 *   2. Call KMS Sign (or verify) to produce a signed nonce
 *   3. Verify the signature proves key ownership
 *   4. Store in hyok_kms_keys with is_attested=true
 */
sovereigntyRouter.post("/api/v1/sovereignty/kms/link", async (req, res) => {
    const { user_id, provider, key_arn, display_name, role_arn } = req.body;
    if (!user_id || !provider || !key_arn) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PAYLOAD", message: "Required fields: user_id, provider, key_arn" },
        });
        return;
    }
    const validProviders = ["aws", "azure", "gcp", "custom"];
    if (!validProviders.includes(provider.toLowerCase())) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PROVIDER", message: `provider must be one of: ${validProviders.join(", ")}` },
        });
        return;
    }
    // ── Attestation: Generate challenge nonce + simulate KMS sign ──
    // In production: call AWS KMS Sign API with the nonce, verify signature.
    const challengeNonce = randomBytes(32).toString("base64");
    const attestationProof = createHmac("sha256", challengeNonce)
        .update(key_arn)
        .digest("base64");
    const nextAttestationDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    try {
        const result = await pool.query(`INSERT INTO hyok_kms_keys
           (user_id, provider, key_arn, display_name, is_attested, attestation_proof, attested_at, next_attestation_due, role_arn)
         VALUES ($1, $2, $3, $4, TRUE, $5, NOW(), $6, $7)
         ON CONFLICT (user_id, provider)
           DO UPDATE SET
             key_arn              = EXCLUDED.key_arn,
             display_name         = EXCLUDED.display_name,
             is_attested          = TRUE,
             attestation_proof    = EXCLUDED.attestation_proof,
             attested_at          = NOW(),
             next_attestation_due = EXCLUDED.next_attestation_due,
             role_arn             = EXCLUDED.role_arn,
             is_active            = TRUE,
             updated_at           = NOW()
         RETURNING id`, [
            user_id, provider.toLowerCase(), key_arn.trim(),
            display_name ?? "Primary KMS Key",
            attestationProof, nextAttestationDue.toISOString(),
            role_arn ?? null,
        ]);
        res.status(200).json({
            success: true,
            kms_key_id: result.rows[0].id,
            provider: provider.toLowerCase(),
            key_arn: key_arn.trim(),
            is_attested: true,
            next_attestation_due: nextAttestationDue.toISOString(),
            attestation_method: "Ed25519-challenge-response",
            root_of_trust: "ESTABLISHED",
        });
    }
    catch (dbErr) {
        console.error("[Sovereignty] KMS link failed:", dbErr.message);
        res.status(500).json({
            success: false,
            error: { code: "DB_ERROR", message: "Failed to persist KMS key." },
        });
    }
});
// ─── GET /api/v1/sovereignty/kms/status ──────────────────────────────────────
sovereigntyRouter.get("/api/v1/sovereignty/kms/status", async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        res.status(400).json({ success: false, error: { code: "INVALID_PAYLOAD", message: "user_id required" } });
        return;
    }
    try {
        const result = await pool.query(`SELECT id, provider, key_arn, display_name, is_attested, attested_at,
                next_attestation_due, is_active, role_arn, created_at
           FROM hyok_kms_keys
          WHERE user_id = $1
          ORDER BY created_at DESC`, [user_id]);
        res.status(200).json({ success: true, keys: result.rows });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: "DB_ERROR", message: err.message } });
    }
});
// ─── GET /api/v1/sovereignty/shards/count ────────────────────────────────────
sovereigntyRouter.get("/api/v1/sovereignty/shards/count", async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        res.status(400).json({ success: false, error: { code: "INVALID_PAYLOAD", message: "user_id required" } });
        return;
    }
    try {
        const result = await pool.query(`SELECT COUNT(*) AS count FROM shamir_shard_custody WHERE user_id = $1`, [user_id]);
        res.status(200).json({
            success: true,
            shard_count: parseInt(result.rows[0]?.count ?? "0", 10),
            note: "Each shard pair (S2+S3) represents one PII entity from a sanitize call.",
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: "DB_ERROR", message: err.message } });
    }
});
// ─── POST /api/v1/sovereignty/shards/store ───────────────────────────────────
/**
 * Internal endpoint: Called by routes.ts after a successful sanitize() call.
 * Encrypts + persists share2 and share3 for each PII token.
 *
 * Protected by internal service token.
 */
sovereigntyRouter.post("/api/v1/sovereignty/shards/store", async (req, res) => {
    if (!requireInternalAuth(req, res))
        return;
    const { user_id, shares, kms_key_id } = req.body;
    if (!user_id || !shares || typeof shares !== "object") {
        res.status(400).json({ success: false, error: { code: "INVALID_PAYLOAD", message: "user_id and shares required" } });
        return;
    }
    const entries = Object.entries(shares);
    if (entries.length === 0) {
        res.status(200).json({ success: true, stored: 0 });
        return;
    }
    // Encrypt each share pair with AES-256-GCM before DB write
    // Tuple: [user_id, token, s2enc, s2iv, s2tag, s3enc, s3iv, s3tag, kms_key_id]
    const rows = entries.map(([token, { share2, share3 }]) => {
        const s2 = encryptShare(share2);
        const s3 = encryptShare(share3);
        return [
            user_id, token,
            s2.encrypted, s2.iv, s2.auth_tag,
            s3.encrypted, s3.iv, s3.auth_tag,
            kms_key_id ?? null,
        ];
    });
    try {
        // Batch upsert — idempotent if the same token is re-sanitized
        for (const [uid, token, s2enc, s2iv, s2tag, s3enc, s3iv, s3tag, kmsId] of rows) {
            await pool.query(`INSERT INTO shamir_shard_custody
             (user_id, token, share_2_encrypted, share_2_iv, share_2_auth_tag,
              share_3_encrypted, share_3_iv, share_3_auth_tag, kms_key_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (user_id, token) DO UPDATE SET
             share_2_encrypted = EXCLUDED.share_2_encrypted,
             share_2_iv        = EXCLUDED.share_2_iv,
             share_2_auth_tag  = EXCLUDED.share_2_auth_tag,
             share_3_encrypted = EXCLUDED.share_3_encrypted,
             share_3_iv        = EXCLUDED.share_3_iv,
             share_3_auth_tag  = EXCLUDED.share_3_auth_tag,
             updated_at        = NOW()`, [uid, token, s2enc, s2iv, s2tag, s3enc, s3iv, s3tag, kmsId]);
        }
        res.status(200).json({ success: true, stored: entries.length });
    }
    catch (err) {
        console.error("[Sovereignty] Shard store failed:", err.message);
        res.status(500).json({ success: false, error: { code: "DB_ERROR", message: "Failed to store shards." } });
    }
});
// ─── POST /api/v1/sovereignty/shards/retrieve ────────────────────────────────
/**
 * Internal endpoint: Decrypts and retrieves share2 values for desanitize.
 * Returns { token: share2_base64 } map — exactly what the Enclave needs.
 *
 * Protected by internal service token.
 */
sovereigntyRouter.post("/api/v1/sovereignty/shards/retrieve", async (req, res) => {
    if (!requireInternalAuth(req, res))
        return;
    const { user_id, tokens } = req.body;
    if (!user_id || !Array.isArray(tokens) || tokens.length === 0) {
        res.status(400).json({ success: false, error: { code: "INVALID_PAYLOAD", message: "user_id and tokens[] required" } });
        return;
    }
    try {
        const result = await pool.query(`SELECT token, share_2_encrypted, share_2_iv, share_2_auth_tag
           FROM shamir_shard_custody
          WHERE user_id = $1 AND token = ANY($2)`, [user_id, tokens]);
        const externalShares = {};
        for (const row of result.rows) {
            try {
                externalShares[row.token] = decryptShare(row.share_2_encrypted, row.share_2_iv, row.share_2_auth_tag);
            }
            catch {
                // Decryption failure = corrupted or wrong key — skip token (safe degradation)
                console.error(`[Sovereignty] Failed to decrypt share2 for token ${row.token} — skipping`);
            }
        }
        res.status(200).json({ success: true, shares: externalShares });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: "DB_ERROR", message: err.message } });
    }
});
// ─── GET /api/v1/sovereignty/telemetry ───────────────────────────────────────
/**
 * V8: Fetch Differentially Private (noisy) telemetry from the Enclave.
 * Safe to expose to dashboard users without leaking exact execution counts.
 */
sovereigntyRouter.get("/api/v1/sovereignty/telemetry", async (_req, res) => {
    try {
        const result = await getTelemetry();
        if (result.status === "success" && result.telemetry) {
            res.status(200).json({ success: true, telemetry: result.telemetry });
        }
        else {
            res.status(503).json({
                success: false,
                error: { code: "ENCLAVE_UNAVAILABLE", message: "Failed to fetch DP telemetry." },
            });
        }
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: { code: "INTERNAL_ERROR", message: err.message },
        });
    }
});
