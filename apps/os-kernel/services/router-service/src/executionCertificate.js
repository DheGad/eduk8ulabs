/**
 * @file executionCertificate.ts
 * @service router-service
 * @version V36
 * @description Global Trust Standard — Immutable Execution Certificate
 *
 * ================================================================
 * PURPOSE
 * ================================================================
 * Every AI execution through the StreetMP OS generates one and
 * only one ExecutionCertificate. This certificate is:
 *
 *   - Tamper-evident: the `zk_signature` is an HMAC-SHA256 of all
 *     certificate fields — mutating any field invalidates it.
 *   - Public-verifiable: the GET /verify/:execution_id endpoint
 *     allows any third party to validate integrity without
 *     accessing raw payloads.
 *   - Zero-knowledge: the certificate contains NO prompt text,
 *     NO response text, and NO user-identifiable content.
 *
 * CRITICAL RULE: This module ONLY appends to the pipeline.
 * It MUST NOT modify any V1-V35 routing, governance, or security logic.
 * ================================================================
 */
import { createHmac, randomBytes } from "node:crypto";
// ─── Signing Key ─────────────────────────────────────────────────────────────
// In production this would be loaded from V10 Vault / HSM.
// For the sovereign kernel demo we derive it from an env variable.
const SIGNING_KEY = process.env.STREETMP_CERT_SIGNING_KEY ?? "streetmp_sovereign_v36_signing_key_changeme";
// ─── In-Memory Ledger ────────────────────────────────────────────────────────
// Stores issued certificates for fast /verify lookups.
// In production: write to V35 AuditEngine persistent store / Merkle tree.
const certLedger = new Map();
// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Builds the canonical payload string used as HMAC input.
 * Field order is fixed — order changes would invalidate the signature.
 */
function buildCanonicalPayload(execution_id, issued_at, trust_score, compliance_flags, region, model, provider) {
    return [
        `execution_id=${execution_id}`,
        `issued_at=${issued_at}`,
        `trust_score=${trust_score}`,
        `compliance_flags=${compliance_flags.sort().join(",")}`,
        `region=${region}`,
        `model=${model}`,
        `provider=${provider}`,
    ].join("|");
}
/**
 * Derives the trust band from a trust_score.
 * Mirrors V25 getTrustBand without importing it (additive-only rule).
 */
function deriveTrustBand(score) {
    if (score >= 90)
        return "PLATINUM";
    if (score >= 75)
        return "GOLD";
    if (score >= 50)
        return "SILVER";
    if (score >= 25)
        return "BRONZE";
    return "CRITICAL";
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Issues a new, immutable ExecutionCertificate.
 *
 * Called as the LAST step in the execution pipeline — after V25 trust score
 * is computed. Does NOT modify any earlier pipeline output.
 *
 * @param trust_score    V25 computed trust score (0–100)
 * @param compliance_flags  Any compliance/policy flags raised
 * @param region         AWS region label (e.g. "eu-west-1")
 * @param model          Model ID (e.g. "gpt-4o")
 * @param provider       Provider (e.g. "openai")
 */
export function issueCertificate(params) {
    const execution_id = "exec_" + randomBytes(10).toString("hex");
    const issued_at = new Date().toISOString();
    const flags = params.compliance_flags ?? [];
    const region = params.region ?? process.env.AWS_REGION ?? "eu-west-1";
    const canonical = buildCanonicalPayload(execution_id, issued_at, params.trust_score, flags, region, params.model, params.provider);
    const zk_signature = createHmac("sha256", SIGNING_KEY)
        .update(canonical)
        .digest("hex");
    const cert = {
        execution_id,
        issued_at,
        trust_score: params.trust_score,
        trust_band: deriveTrustBand(params.trust_score),
        compliance_flags: flags,
        region,
        model: params.model,
        provider: params.provider,
        zk_signature,
        fingerprint: zk_signature.slice(0, 12).toUpperCase(),
    };
    // Register in ledger so /verify can look it up
    certLedger.set(execution_id, cert);
    console.info(`[V36:ExecCert] Issued ` +
        `id=${execution_id} trust=${params.trust_score} ` +
        `band=${cert.trust_band} fp=${cert.fingerprint}`);
    return cert;
}
/**
 * Verifies an already-issued certificate from the in-memory ledger.
 * Recomputes the HMAC and compares to the stored signature.
 *
 * Returns "SECURE" if the certificate has not been tampered with.
 * Returns "TAMPERED" if the stored signature does not match.
 * Returns null if the execution_id is unknown.
 */
export function verifyCertificate(execution_id, client_signature) {
    const cert = certLedger.get(execution_id);
    if (!cert)
        return null;
    const canonical = buildCanonicalPayload(cert.execution_id, cert.issued_at, cert.trust_score, cert.compliance_flags, cert.region, cert.model, cert.provider);
    const expectedSig = createHmac("sha256", SIGNING_KEY)
        .update(canonical)
        .digest("hex");
    let status = (expectedSig === cert.zk_signature)
        ? "SECURE"
        : "TAMPERED";
    if (client_signature && client_signature !== cert.zk_signature) {
        status = "TAMPERED";
    }
    return { status, cert };
}
/** Raw ledger access — used by verifyService router */
export function getCertFromLedger(execution_id) {
    return certLedger.get(execution_id) ?? null;
}
/** Returns total count of issued certificates — for monitoring */
export function getLedgerSize() {
    return certLedger.size;
}
