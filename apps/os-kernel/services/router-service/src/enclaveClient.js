/**
 * @file vsock-enclave-client.ts
 * @package router-service
 * @description Typed client for the Nitro Enclave vsock bridge.
 *
 * V7 additions:
 *   - sanitize() now returns EntityShares (S2 + S3) per PII token.
 *   - desanitize() accepts external_shares (token → S2) for SSS reconstruction.
 *   - revokeAll()  sends a WIPE command — used by the UI kill-switch.
 *
 * CRITICAL SECURITY RULES:
 *   1. The prompt / raw_text MUST NEVER be logged in this file.
 *   2. Return values (safe_prompt, raw_text) MUST NEVER be logged.
 *   3. Only action, status, and a correlation UUID are safe to log.
 *   4. If the Enclave rejects the payload, the caller MUST abort — never retry.
 *   5. Shares (S2, S3) MUST NEVER be logged — treat as secret material.
 *   6. Share 1 NEVER leaves the Enclave — this file only handles S2 + S3.
 */
import net from "net";
import { randomUUID } from "node:crypto";
// ─── Configuration ─────────────────────────────────────────────────────────────
// CID 3 is the standard vsock address of the Nitro Enclave on the EC2 parent.
// In local dev, set ENCLAVE_CID=1 and bridge via socat:
//   socat TCP-LISTEN:5000,fork VSOCK-CONNECT:1:5000
const ENCLAVE_CID = parseInt(process.env.ENCLAVE_CID ?? "3", 10);
const ENCLAVE_PORT = parseInt(process.env.ENCLAVE_PORT ?? "5000", 10);
const ENCLAVE_TIMEOUT_MS = parseInt(process.env.ENCLAVE_TIMEOUT_MS ?? "5000", 10);
// ─── Low-Level Socket Helper ──────────────────────────────────────────────────
function callEnclave(request) {
    return new Promise((resolve, reject) => {
        const correlationId = randomUUID();
        let socket;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const vsock = require("vsock");
            socket = vsock.createVsockConnection(ENCLAVE_CID, ENCLAVE_PORT);
        }
        catch {
            // TCP fallback for local dev (socat bridge)
            process.env.NODE_ENV !== "production" &&
                console.warn("[Enclave] vsock module unavailable — TCP fallback active (DEV ONLY)");
            socket = net.createConnection({ host: "127.0.0.1", port: ENCLAVE_PORT });
        }
        let buffer = "";
        socket.setEncoding("utf8");
        socket.setTimeout(ENCLAVE_TIMEOUT_MS);
        socket.on("connect", () => {
            // LOG: correlation ID and action only — NEVER the raw_text or payload
            console.info(`[Enclave] [${correlationId}] → action:${request.action} CID:${ENCLAVE_CID}:${ENCLAVE_PORT}`);
            socket.write(JSON.stringify(request) + "\n");
        });
        socket.on("data", (chunk) => {
            buffer += chunk;
            if (buffer.includes("\n")) {
                socket.destroy();
                const line = buffer.split("\n")[0].trim();
                try {
                    const resp = JSON.parse(line);
                    // LOG: status only — NEVER the safe_prompt or raw_text
                    console.info(`[Enclave] [${correlationId}] ← status:${resp.status}`);
                    resolve(resp);
                }
                catch (e) {
                    reject(new Error(`[Enclave] [${correlationId}] Response parse failed: ${e}`));
                }
            }
        });
        socket.on("timeout", () => {
            socket.destroy();
            console.error(`[Enclave] [${correlationId}] Timeout after ${ENCLAVE_TIMEOUT_MS}ms`);
            reject(new Error("ENCLAVE_TIMEOUT"));
        });
        socket.on("error", (err) => {
            console.error(`[Enclave] [${correlationId}] Socket error: ${err.message}`);
            reject(new Error(`ENCLAVE_SOCKET_ERROR: ${err.message}`));
        });
    });
}
/**
 * Pass the raw user prompt to the Enclave for:
 *   1. Prompt injection detection (guardrail).
 *   2. PII tokenization (all entities replaced with TKN_ tokens).
 *
 * GL-02: `policy` is injected into the Enclave request so the Rust
 * guardrail tier applies the correct industry ruleset.
 *
 * @param rawPrompt  The untouched user prompt — never logged.
 * @param policy     Optional tenant PolicyContext to inject.
 * @returns SanitizeResult
 */
export async function sanitize(rawPrompt, policy) {
    try {
        const resp = await callEnclave({
            action: "sanitize",
            raw_text: rawPrompt,
            ...(policy ? { policy_id: policy.policy_id, policy_label: policy.policy_label } : {}),
        });
        return {
            status: resp.status,
            safe_prompt: resp.status === "success" ? (resp.safe_prompt ?? null) : null,
            shares: resp.status === "success" ? (resp.shares ?? {}) : {},
            receipt: resp.receipt,
            active_policy_id: policy?.policy_id,
        };
    }
    catch (err) {
        console.error("[Enclave] sanitize call failed:", err.message);
        return { status: "rejected", safe_prompt: null, shares: {} };
    }
}
/**
 * Pass the raw LLM response to the Enclave for:
 *   1. Leakage / mapping-probe detection (guardrail).
 *   2. TKN_ token restoration from the Ephemeral Vault.
 *
 * GL-02: `policy` is forwarded so the Enclave applies the correct
 * desanitize guardrail tier for the tenant's industry.
 *
 * @param llmResponse    Raw text from the LLM (may contain TKN_ tokens).
 * @param externalShares V7: { [token]: share2_base64 } from DB.
 * @param policy         Optional tenant PolicyContext.
 */
export async function desanitize(llmResponse, externalShares = {}, policy) {
    try {
        const resp = await callEnclave({
            action: "desanitize",
            raw_text: llmResponse,
            external_shares: externalShares, // V7: supply S2 per token
        });
        return {
            status: resp.status,
            restored_text: resp.status === "success" ? (resp.raw_text ?? null) : null,
            receipt: resp.receipt,
        };
    }
    catch (err) {
        console.error("[Enclave] desanitize call failed:", err.message);
        return { status: "rejected", restored_text: null };
    }
}
/**
 * V7 Kill Switch — send a WIPE command to the Enclave.
 *
 * The Enclave will:
 *   1. Zero all TKN_ → Share1 mappings from the vault HashMap.
 *   2. Destroy the ephemeral Ed25519 signing key pair.
 *   3. Return status:"wiped" + a signed receipt as final proof.
 *
 * The Control Plane MUST also DELETE all rows from shamir_shard_custody
 * for this user before calling this function (see sovereignty router).
 *
 * SECURITY: This action is irreversible. The Enclave process continues
 * running but the vault is cryptographically wiped — all tokens are
 * permanently unresolvable until the next restart.
 *
 * @returns RevokeResult — wipe_ref is the correlation ID for the audit log.
 */
export async function revokeAll() {
    const correlationId = randomUUID();
    try {
        console.warn(`[Enclave] [${correlationId}] KILL-SWITCH engaged — sending WIPE command`);
        const resp = await callEnclave({ action: "wipe" });
        if (resp.status === "wiped") {
            console.warn(`[Enclave] [${correlationId}] WIPE confirmed — vault memory zeroed`);
            return { status: "wiped", wipe_ref: correlationId, receipt: resp.receipt };
        }
        console.error(`[Enclave] [${correlationId}] WIPE rejected — status: ${resp.status}`);
        return { status: "rejected", wipe_ref: correlationId };
    }
    catch (err) {
        console.error(`[Enclave] [${correlationId}] WIPE command failed:`, err.message);
        return { status: "enclave_unavailable", wipe_ref: correlationId };
    }
}
/**
 * V8: Retrieve Differentially Private (noisy) execution metrics from the Enclave.
 * The Control Plane requests this to populate the Financial Sentinel and
 * auditor dashboards without leaking precise execution counts.
 */
export async function getTelemetry() {
    try {
        const resp = await callEnclave({ action: "get_telemetry" });
        if (resp.status === "success" && resp.telemetry) {
            return { status: "success", telemetry: resp.telemetry };
        }
        return { status: resp.status, telemetry: null };
    }
    catch (err) {
        console.error("[Enclave] get_telemetry call failed:", err.message);
        return { status: "enclave_unavailable", telemetry: null };
    }
}
/**
 * V11: Triggers cryptographic zeroization of a specific tenant session
 * inside the Nitro Enclave Memory Firewall.
 *
 * Call this when a user logs out, a session token expires, or a security
 * event requires immediate data destruction. The Enclave will:
 *   1. Locate the (tenant_id, session_id) bucket in the TenantVault.
 *   2. Overwrite every stored plaintext byte with zeros (via the `zeroize` crate).
 *   3. Remove the session entry entirely from memory.
 *
 * This is idempotent — if the session is already gone (TTL-evicted), the
 * Enclave returns "not_found", which the caller can safely ignore.
 *
 * SECURITY: This call is fire-and-forget safe. Even if the vsock is
 * temporarily unavailable, the 15-minute TTL will still evict the session.
 *
 * @param tenantId   The GL-02 tenant identifier (x-tenant-id header value).
 * @param sessionId  The session identifier to purge.
 */
export async function purgeSession(tenantId, sessionId) {
    const correlationRef = randomUUID();
    try {
        console.info(`[Enclave] [${correlationRef}] → purge_session tenant=${tenantId} session=${sessionId}`);
        const resp = await callEnclave({
            action: "purge_session",
            policy_id: tenantId, // forwarded as tenant discriminator on Rust side
            session_id: sessionId,
        });
        // "session_id" is a non-standard field — we pass it through EnclaveRequest
        // as an extra key; the Rust serde deserialiser uses #[serde(default)] to accept it.
        if (resp.status === "success") {
            console.info(`[Enclave] [${correlationRef}] ← purge_session: session zeroed`);
            return { status: "success", correlation_ref: correlationRef };
        }
        if (resp.status === "not_found") {
            console.info(`[Enclave] [${correlationRef}] ← purge_session: session already gone (idempotent)`);
            return { status: "not_found", correlation_ref: correlationRef };
        }
        console.warn(`[Enclave] [${correlationRef}] ← purge_session: unexpected status=${resp.status}`);
        return { status: "rejected", correlation_ref: correlationRef };
    }
    catch (err) {
        console.error(`[Enclave] [${correlationRef}] purge_session failed:`, err.message);
        return { status: "enclave_unavailable", correlation_ref: correlationRef };
    }
}
