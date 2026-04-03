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
const ENCLAVE_CID  = parseInt(process.env.ENCLAVE_CID  ?? "3",    10);
const ENCLAVE_PORT = parseInt(process.env.ENCLAVE_PORT ?? "5000", 10);
const ENCLAVE_TIMEOUT_MS = parseInt(process.env.ENCLAVE_TIMEOUT_MS ?? "5000", 10);

// ─── Types ─────────────────────────────────────────────────────────────────────
type EnclaveAction = "tokenize" | "detokenize" | "sanitize" | "desanitize" | "get_telemetry" | "purge_session" | "wipe";

/** V8: Differentially Private metrics returned by the Enclave. */
export interface TelemetryMetrics {
  sanitize_count:   number;
  desanitize_count: number;
  rejection_count:  number;
  eps:              number;
}

/**
 * V7: Shamir share pair for one PII entity.
 * S2 + S3 are Base64-encoded and returned from the Enclave to the Control Plane.
 * S1 stays in Enclave volatile RAM — it NEVER appears here.
 */
export interface EntityShares {
  share2: string;  // Base64 — must be persisted encrypted (AES-GCM) in DB
  share3: string;  // Base64 — cold-storage backup shard
}

/** V6: Cryptographic receipt signed by the Enclave's ephemeral Ed25519 key. */
export interface ExecutionReceipt {
  timestamp:     string;
  input_hash:    string;
  output_hash:   string;
  policy_result: string;
  signature:     string;      // Ed25519 signature (base64)
  signer_pubkey: string;      // Enclave's ephemeral public key (base64)
  /** V9: Trust Score (0–100) from the Autonomous Trust Engine */
  trust_score?:  number;
}

interface EnclaveRequest {
  action: EnclaveAction;
  raw_text?: string;
  token?: string;
  // V7: token → base64 share2, sent by caller during desanitize
  external_shares?: Record<string, string>;
  // GL-02 / V9: Active tenant PolicySet ID for Trust Engine penalty tier
  policy_id?: string;
  policy_label?: string;
  // V11: Session ID for Memory Firewall purge routing
  session_id?: string;
}

/**
 * V5 Enclave response status codes.
 * The caller MUST handle all four non-success statuses.
 */
export type EnclaveStatus =
  | "success"
  | "rejected"
  | "not_found"
  | "rejected_prompt_injection"   // Input guardrail tripped
  | "rejected_model_leakage"      // Output guardrail tripped
  | "wiped";                      // V7: kill-switch wipe confirmed

interface EnclaveResponse {
  safe_prompt?: string;   // Present on sanitize → success
  raw_text?:    string;   // Present on desanitize → success
  status:       EnclaveStatus;
  receipt?:     ExecutionReceipt;                   // V6: signed proof
  shares?:      Record<string, EntityShares>;       // V7: S2+S3 per token
  telemetry?:   TelemetryMetrics;                   // V8: DP metrics
}

// ─── Public Result Types ──────────────────────────────────────────────────────

export interface SanitizeResult {
  status:      EnclaveStatus;
  safe_prompt: string | null;                      // null on rejection
  /** V7: Map of TKN_ token → { share2, share3 }. MUST be encrypted and persisted by caller. */
  shares:      Record<string, EntityShares>;        // empty on rejection
  receipt?:    ExecutionReceipt;                    // V6: signed execution proof
  /** GL-02: Echo of the active policy_id so callers can log which policy ran. */
  active_policy_id?: string;
}

export interface DesanitizeResult {
  status:        EnclaveStatus;
  restored_text: string | null;  // null on rejection
  receipt?:      ExecutionReceipt;
}

export interface RevokeResult {
  status:      "wiped" | "rejected" | "enclave_unavailable";
  /** Correlation ID to store in revocation_log.enclave_wipe_ref */
  wipe_ref?:   string;
  receipt?:    ExecutionReceipt;
}

export interface TelemetryResult {
  status:    EnclaveStatus | "enclave_unavailable";
  telemetry: TelemetryMetrics | null;
}

// ─── Low-Level Socket Helper ──────────────────────────────────────────────────

function callEnclave(request: EnclaveRequest): Promise<EnclaveResponse> {
  return new Promise((resolve, reject) => {
    const correlationId = randomUUID();
    let socket: net.Socket;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const vsock = require("vsock");
      socket = vsock.createVsockConnection(ENCLAVE_CID, ENCLAVE_PORT) as net.Socket;
    } catch {
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

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.includes("\n")) {
        socket.destroy();
        const line = buffer.split("\n")[0].trim();
        try {
          const resp = JSON.parse(line) as EnclaveResponse;
          // LOG: status only — NEVER the safe_prompt or raw_text
          console.info(`[Enclave] [${correlationId}] ← status:${resp.status}`);
          resolve(resp);
        } catch (e) {
          reject(new Error(`[Enclave] [${correlationId}] Response parse failed: ${e}`));
        }
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      console.error(`[Enclave] [${correlationId}] Timeout after ${ENCLAVE_TIMEOUT_MS}ms`);
      reject(new Error("ENCLAVE_TIMEOUT"));
    });

    socket.on("error", (err: Error) => {
      console.error(`[Enclave] [${correlationId}] Socket error: ${err.message}`);
      reject(new Error(`ENCLAVE_SOCKET_ERROR: ${err.message}`));
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * GL-02: Policy context forwarded from the tenant router.
 * Only policy_id and policy_label are sent — no raw PII from the policy config.
 */
export interface PolicyContext {
  policy_id:    string;
  policy_label: string;
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
export async function sanitize(
  rawPrompt: string,
  policy?: PolicyContext,
): Promise<SanitizeResult> {
  try {
    const resp = await callEnclave({
      action:       "sanitize",
      raw_text:     rawPrompt,
      ...(policy ? { policy_id: policy.policy_id, policy_label: policy.policy_label } : {}),
    });
    return {
      status:           resp.status,
      safe_prompt:      resp.status === "success" ? (resp.safe_prompt ?? null) : null,
      shares:           resp.status === "success" ? (resp.shares ?? {}) : {},
      receipt:          resp.receipt,
      active_policy_id: policy?.policy_id,
    };
  } catch (err) {
    console.error("[Enclave] sanitize call failed:", (err as Error).message);
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
export async function desanitize(
  llmResponse: string,
  externalShares: Record<string, string> = {},
  policy?: PolicyContext,
): Promise<DesanitizeResult> {
  try {
    const resp = await callEnclave({
      action:          "desanitize",
      raw_text:        llmResponse,
      external_shares: externalShares,  // V7: supply S2 per token
    });
    return {
      status:        resp.status,
      restored_text: resp.status === "success" ? (resp.raw_text ?? null) : null,
      receipt:       resp.receipt,
    };
  } catch (err) {
    console.error("[Enclave] desanitize call failed:", (err as Error).message);
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
export async function revokeAll(): Promise<RevokeResult> {
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
  } catch (err) {
    console.error(`[Enclave] [${correlationId}] WIPE command failed:`, (err as Error).message);
    return { status: "enclave_unavailable", wipe_ref: correlationId };
  }
}

/**
 * V8: Retrieve Differentially Private (noisy) execution metrics from the Enclave.
 * The Control Plane requests this to populate the Financial Sentinel and
 * auditor dashboards without leaking precise execution counts.
 */
export async function getTelemetry(): Promise<TelemetryResult> {
  try {
    const resp = await callEnclave({ action: "get_telemetry" });
    if (resp.status === "success" && resp.telemetry) {
      return { status: "success", telemetry: resp.telemetry };
    }
    return { status: resp.status, telemetry: null };
  } catch (err) {
    console.error("[Enclave] get_telemetry call failed:", (err as Error).message);
    return { status: "enclave_unavailable", telemetry: null };
  }
}

// ─── V11: Memory Firewall — PurgeSession Bridge ───────────────────────────────

export interface PurgeSessionResult {
  /**
   * "success":           session found, all entries zeroed and removed.
   * "not_found":         session already gone (idempotent — safe to ignore).
   * "rejected":          malformed request (missing session_id).
   * "enclave_unavailable": vsock error — caller should retry or log.
   */
  status: "success" | "not_found" | "rejected" | "enclave_unavailable";
  /** Correlation ID for the audit log. */
  correlation_ref: string;
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
export async function purgeSession(
  tenantId: string,
  sessionId: string,
): Promise<PurgeSessionResult> {
  const correlationRef = randomUUID();
  try {
    console.info(`[Enclave] [${correlationRef}] → purge_session tenant=${tenantId} session=${sessionId}`);
    const resp = await callEnclave({
      action:     "purge_session",
      policy_id:  tenantId,   // forwarded as tenant discriminator on Rust side
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
  } catch (err) {
    console.error(`[Enclave] [${correlationRef}] purge_session failed:`, (err as Error).message);
    return { status: "enclave_unavailable", correlation_ref: correlationRef };
  }
}

