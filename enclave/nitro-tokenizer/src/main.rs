mod guardrail;
mod memory_firewall;
mod proofs;
mod protocol;
mod receipt;
mod sanitizer;
mod shamir;
mod telemetry;
mod trust_engine;

use std::{
    collections::HashMap,
    io::{BufRead, Write},
    sync::{Arc, RwLock},
};

use guardrail::{check_input_injection, check_output_leakage};
use protocol::{
    Action, EntityShares, ExecutionReceipt, VaultRequest, VaultResponse, ResponseStatus,
    MAX_RAW_TEXT_BYTES, TOKEN_PREFIX,
};
use receipt::{
    build_receipt, EnclaveSigningKey,
    POLICY_PASSED, POLICY_REJECTED_INJECTION, POLICY_REJECTED_LEAKAGE,
};
use sanitizer::{compile_patterns, desanitize_response, sanitize_prompt, PiiPattern};
use shamir::{reconstruct_secret, split_secret};
use telemetry::{record_sanitize, record_desanitize, record_rejection, get_noisy_telemetry};
use trust_engine::evaluate_trust;
use memory_firewall::{TenantVault, new_tenant_vault, evict_all_expired, purge_session as mf_purge_session};
use tracing::{error, info, warn};
use vsock::{VsockAddr, VsockListener, VMADDR_CID_ANY};

const VSOCK_PORT: u32 = 5000;

/// V7 Vault: stores only Share 1 of each Shamir split.
/// token → raw bytes of Share 1 (Shamir GF(2^8) encoding)
///
/// Share 2 + Share 3 are returned to the Control Plane over vsock and
/// stored there. This ensures a dump of Enclave RAM alone is USELESS.
type ShareVault = Arc<RwLock<HashMap<String, Vec<u8>>>>;

/// Ed25519 signing key — generated once on boot, shared read-only across threads.
type SigningKeyRef = Arc<EnclaveSigningKey>;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .without_time()
        .with_target(false)
        .init();

    // ── V6: Ephemeral Ed25519 signing key ────────────────────────────────────
    let signing_key: SigningKeyRef = Arc::new(EnclaveSigningKey::generate());
    info!(
        pubkey = %signing_key.pubkey_hex(),
        "Ed25519 signing key generated. Publish pubkey via /v1/enclave/pubkey."
    );

    let patterns: Arc<Vec<PiiPattern>> = Arc::new(compile_patterns());

    // V7: Share Vault — stores ONLY Share 1
    let vault: ShareVault = Arc::new(RwLock::new(HashMap::new()));

    // V11: Tenant-scoped Memory Firewall with cryptographic TTL
    let mf_vault: TenantVault = new_tenant_vault();

    let addr = VsockAddr::new(VMADDR_CID_ANY, VSOCK_PORT);
    let listener = VsockListener::bind(&addr)
        .expect("FATAL: could not bind vsock listener");

    info!(port = VSOCK_PORT, "Nitro Enclave V7 — Distributed Vault (Shamir SSS) READY");

    for connection in listener.incoming() {
        match connection {
            Ok(stream) => {
                let peer_cid = stream.peer_addr().map(|a| a.cid()).unwrap_or(0);
                info!(peer_cid, "Connection accepted");

                let vault       = Arc::clone(&vault);
                let mf_vault    = Arc::clone(&mf_vault);
                let patterns    = Arc::clone(&patterns);
                let signing_key = Arc::clone(&signing_key);

                std::thread::spawn(move || {
                    if let Err(e) = handle_connection(stream, peer_cid, vault, mf_vault, patterns, signing_key) {
                        error!(peer_cid, err = %e, "Connection error");
                    }
                });
            }
            Err(e) => error!(err = %e, "vsock accept failed"),
        }
    }
}

// ─── Connection Handler ───────────────────────────────────────────────────────

fn handle_connection(
    stream: vsock::VsockStream,
    peer_cid: u32,
    vault: ShareVault,
    mf_vault: TenantVault,
    patterns: Arc<Vec<PiiPattern>>,
    signing_key: SigningKeyRef,
) -> anyhow::Result<()> {
    let mut reader = std::io::BufReader::new(&stream);
    let mut writer = std::io::BufWriter::new(&stream);

    let mut line = String::new();
    reader.read_line(&mut line)?;
    let line = line.trim().to_owned();

    if line.is_empty() {
        warn!(peer_cid, "Empty payload — dropped");
        return Ok(());
    }

    let request: VaultRequest = serde_json::from_str(&line).map_err(|e| {
        warn!(peer_cid, parse_error = %e, "Malformed JSON rejected");
        e
    })?;

    let payload_len = request.raw_text.len().max(request.token.len());
    if payload_len > MAX_RAW_TEXT_BYTES {
        warn!(peer_cid, "Payload exceeds MAX_RAW_TEXT_BYTES — rejected");
        return write_response(&mut writer, make_rejection(None));
    }

    info!(peer_cid, action = %request.action, "Processing");

    // V11: Memory Firewall — sweep expired entries before every action.
    // This is the continuous TTL enforcement mechanism. O(n) over live entries.
    let evicted = evict_all_expired(&mf_vault);
    if evicted > 0 {
        info!(peer_cid, evicted, "[MemFirewall] Evicted expired session entries");
    }

    let response = match request.action {
        Action::Tokenize      => handle_tokenize(request, peer_cid, &vault),
        Action::Detokenize    => handle_detokenize(request, peer_cid, &vault),
        Action::Sanitize      => handle_sanitize(request, peer_cid, &vault, &patterns, &signing_key),
        Action::Desanitize    => handle_desanitize(request, peer_cid, &vault, &signing_key),
        Action::GetTelemetry  => handle_telemetry(peer_cid),
        Action::PurgeSession  => handle_purge_session(request, peer_cid, &mf_vault),
    };

    write_response(&mut writer, response)?;
    info!(peer_cid, "Response dispatched");
    Ok(())
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

fn handle_tokenize(request: VaultRequest, peer_cid: u32, vault: &ShareVault) -> VaultResponse {
    if request.raw_text.is_empty() {
        warn!(peer_cid, "tokenize: raw_text empty");
        return make_rejection(None);
    }
    // Single-entity tokenize: Shamir-split the raw value, store Share 1
    let token = fresh_token();
    let split = split_secret(&request.raw_text);
    commit_share1(vault, token.clone(), split.share1);

    // Return the token; for backward-compat, share2/3 exposed via shares map
    let mut shares = HashMap::new();
    shares.insert(token.clone(), EntityShares {
        share2: split.share2_b64,
        share3: split.share3_b64,
    });

    VaultResponse {
        token,
        safe_prompt: String::new(),
        raw_text: String::new(),
        status: ResponseStatus::Success,
        receipt: None,
        shares,
        telemetry: None,
    }
}

fn handle_detokenize(request: VaultRequest, peer_cid: u32, vault: &ShareVault) -> VaultResponse {
    if !request.token.starts_with(TOKEN_PREFIX) {
        warn!(peer_cid, "detokenize: prefix check failed");
        return make_rejection(None);
    }
    // Single-token detokenize requires the caller to also supply Share 2
    let share1_opt = vault.read().expect("vault poisoned").get(&request.token).cloned();
    let share2_b64 = request.external_shares.get(&request.token).cloned().unwrap_or_default();

    match share1_opt {
        None => {
            warn!(peer_cid, "detokenize: share1 not found");
            VaultResponse {
                token: String::new(), safe_prompt: String::new(),
                raw_text: String::new(), status: ResponseStatus::NotFound,
                receipt: None, shares: HashMap::new(), telemetry: None,
            }
        }
        Some(share1_bytes) => {
            if share2_b64.is_empty() {
                warn!(peer_cid, "detokenize: no external share provided");
                return make_rejection(None);
            }
            match reconstruct_secret(&share1_bytes, &share2_b64) {
                Ok(original) => VaultResponse {
                    token: String::new(), safe_prompt: String::new(),
                    raw_text: original, status: ResponseStatus::Success,
                    receipt: None, shares: HashMap::new(), telemetry: None,
                },
                Err(e) => {
                    warn!(peer_cid, err = %e, "detokenize: reconstruction failed");
                    make_rejection(None)
                }
            }
        }
    }
}

// ─── V11: Memory Firewall Purge Handler ───────────────────────────────────────

/// Handles the PurgeSession vsock action.
///
/// Immediately and unconditionally zeroes and removes ALL token→plaintext
/// mappings for the specified (tenant_id, session_id) pair from the V11
/// Memory Firewall. Triggered by the Control Plane when a user logs out.
///
/// Response status:
///   - success        → session found and zeroed
///   - not_found      → tenant or session did not exist (idempotent — safe to ignore)
fn handle_purge_session(
    request: VaultRequest,
    peer_cid: u32,
    mf_vault: &TenantVault,
) -> VaultResponse {
    let tenant_id  = request.policy_id.as_deref().unwrap_or("unknown_tenant");
    let session_id = match request.session_id.as_deref() {
        Some(s) if !s.is_empty() => s,
        _ => {
            warn!(peer_cid, "purge_session: missing session_id");
            return make_rejection(None);
        }
    };

    match mf_purge_session(mf_vault, tenant_id, session_id) {
        Ok(count) => {
            info!(
                peer_cid,
                tenant_id,
                session_id,
                zeroed_entries = count,
                "[MemFirewall] PurgeSession: session zeroed and removed"
            );
            VaultResponse {
                token: String::new(), safe_prompt: String::new(),
                raw_text: String::new(),
                status: ResponseStatus::Success,
                receipt: None, shares: HashMap::new(), telemetry: None,
            }
        }
        Err("TENANT_NOT_FOUND") | Err("SESSION_NOT_FOUND") => {
            // Idempotent — if session already gone, treat as success
            info!(peer_cid, tenant_id, session_id, "[MemFirewall] PurgeSession: session not found (already purged)");
            VaultResponse {
                token: String::new(), safe_prompt: String::new(),
                raw_text: String::new(),
                status: ResponseStatus::NotFound,
                receipt: None, shares: HashMap::new(), telemetry: None,
            }
        }
        Err(e) => {
            warn!(peer_cid, err = e, "[MemFirewall] PurgeSession: unexpected error");
            make_rejection(None)
        }
    }
}

fn handle_sanitize(
    request: VaultRequest,
    peer_cid: u32,
    vault: &ShareVault,
    patterns: &[PiiPattern],
    signing_key: &EnclaveSigningKey,
) -> VaultResponse {
    if request.raw_text.is_empty() {
        warn!(peer_cid, "sanitize: raw_text empty");
        return make_rejection(None);
    }

    // ── V9 AUTONOMOUS TRUST ENGINE ────────────────────────────────────────────────────
    // Evaluate the request BEFORE any guardrail or tokenization work.
    // Sub-millisecond deterministic math — no ML model required.
    let trust = evaluate_trust(&request.raw_text, &request.policy_id);
    info!(
        peer_cid,
        trust_score  = trust.score,
        entropy      = trust.entropy,
        high_entropy = trust.flags.high_entropy,
        strict_policy= trust.flags.strict_policy_active,
        "V9 Trust Engine evaluated"
    );

    if trust.score < 50.0 {
        warn!(
            peer_cid,
            trust_score = trust.score,
            entropy     = trust.entropy,
            "AUTONOMOUS BLOCK: Trust Score below guillotine threshold"
        );
        record_rejection();
        let rejection_receipt = {
            let mut r = receipt::build_receipt(
                &request.raw_text, "",
                receipt::POLICY_REJECTED_INJECTION, // reuse constant for signing
                signing_key,
            );
            r.trust_score = trust.score;
            r
        };
        return VaultResponse {
            token: String::new(), safe_prompt: String::new(),
            raw_text: String::new(),
            status: ResponseStatus::RejectedAutonomousBlock,
            receipt: Some(rejection_receipt), shares: HashMap::new(), telemetry: None,
        };
    }

    // ── V5 INPUT GUARDRAIL ────────────────────────────────────────────────────
    if let Some(sig) = check_input_injection(&request.raw_text) {
        warn!(peer_cid, matched_signature = sig, "GUARDRAIL: prompt injection detected");
        record_rejection();
        let rejection_receipt = build_receipt(&request.raw_text, "", POLICY_REJECTED_INJECTION, signing_key);
        return VaultResponse {
            token: String::new(), safe_prompt: String::new(),
            raw_text: String::new(), status: ResponseStatus::RejectedPromptInjection,
            receipt: Some(rejection_receipt), shares: HashMap::new(), telemetry: None,
        };
    }

    record_sanitize();

    // Run PII regex — extracts entity text, replaces with TKN_ tokens
    let result = sanitize_prompt(&request.raw_text, patterns, &fresh_token);

    // ── V7: Shamir-split each PII entity — store Share 1, return Share 2+3 ──
    let mut out_shares: HashMap<String, EntityShares> = HashMap::new();

    {
        let mut map = vault.write().expect("vault poisoned");
        for (token, original) in &result.mappings {
            let split = split_secret(original);
            map.insert(token.clone(), split.share1);  // Enclave keeps ONLY Share 1
            out_shares.insert(token.clone(), EntityShares {
                share2: split.share2_b64,
                share3: split.share3_b64,
            });
        }
        info!(
            peer_cid,
            entities = result.mappings.len(),
            vault_size = map.len(),
            "sanitize: shamir vault updated (share1 only)"
        );
    }

    // ── V6: Sign the execution receipt ────────────────────────────────────────
    let exec_receipt = build_receipt(&request.raw_text, &result.safe_prompt, POLICY_PASSED, signing_key);
    info!(
        peer_cid,
        receipt_input_hash  = %exec_receipt.input_hash,
        receipt_output_hash = %exec_receipt.output_hash,
        "sanitize: execution receipt signed"
    );

    VaultResponse {
        token: String::new(),
        safe_prompt: result.safe_prompt,
        raw_text: String::new(),
        status: ResponseStatus::Success,
        receipt: Some(exec_receipt),
        shares: out_shares,   // Control Plane MUST persist these
        telemetry: None,
    }
}

fn handle_desanitize(
    request: VaultRequest,
    peer_cid: u32,
    vault: &ShareVault,
    signing_key: &EnclaveSigningKey,
) -> VaultResponse {
    if request.raw_text.is_empty() {
        warn!(peer_cid, "desanitize: raw_text empty");
        return make_rejection(None);
    }

    // ── V5 OUTPUT GUARDRAIL ───────────────────────────────────────────────────
    if let Some(sig) = check_output_leakage(&request.raw_text) {
        warn!(peer_cid, matched_signature = sig, "GUARDRAIL: model leakage detected");
        record_rejection();
        let rejection_receipt = build_receipt(&request.raw_text, "", POLICY_REJECTED_LEAKAGE, signing_key);
        return VaultResponse {
            token: String::new(), safe_prompt: String::new(),
            raw_text: String::new(), status: ResponseStatus::RejectedModelLeakage,
            receipt: Some(rejection_receipt), shares: HashMap::new(), telemetry: None,
        };
    }

    record_desanitize();

    // ── V7: Reconstruct each token using Share1 (vault) + Share2 (caller) ────
    let (restored, missing) = {
        let map = vault.read().expect("vault poisoned");
        desanitize_response(&request.raw_text, &|token| {
            let share1 = map.get(token)?;
            let share2 = request.external_shares.get(token)?;
            match reconstruct_secret(share1, share2) {
                Ok(original) => Some(original),
                Err(e) => {
                    // Log reconstruction error per-token — not the values themselves
                    tracing::warn!(err = %e, "reconstruct_secret failed for a token");
                    None
                }
            }
        })
    };

    if !missing.is_empty() {
        warn!(
            peer_cid,
            missing_count = missing.len(),
            "desanitize: tokens missing shares or not in vault — entities left as tokens"
        );
    }

    // ── V6: Sign the execution receipt ────────────────────────────────────────
    let exec_receipt = build_receipt(&request.raw_text, &restored, POLICY_PASSED, signing_key);
    info!(
        peer_cid,
        receipt_input_hash  = %exec_receipt.input_hash,
        receipt_output_hash = %exec_receipt.output_hash,
        "desanitize: execution receipt signed"
    );

    VaultResponse {
        token: String::new(),
        safe_prompt: String::new(),
        raw_text: restored,
        status: ResponseStatus::Success,
        receipt: Some(exec_receipt),
        shares: HashMap::new(), // No shares returned on desanitize
        telemetry: None,
    }
}

fn handle_telemetry(peer_cid: u32) -> VaultResponse {
    let (s_count, d_count, r_count) = get_noisy_telemetry();
    info!(peer_cid, "telemetry: returned DP noisy metrics (eps=0.5)");

    VaultResponse {
        token: String::new(),
        safe_prompt: String::new(),
        raw_text: String::new(),
        status: ResponseStatus::Success,
        receipt: None,
        shares: HashMap::new(),
        telemetry: Some(protocol::TelemetryMetrics {
            sanitize_count: s_count,
            desanitize_count: d_count,
            rejection_count: r_count,
            eps: 0.5,
        }),
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn fresh_token() -> String {
    let mut bytes = [0u8; 8];
    getrandom::getrandom(&mut bytes).expect("getrandom failed");
    format!("{}{}", TOKEN_PREFIX, hex::encode(bytes).to_uppercase())
}

fn commit_share1(vault: &ShareVault, token: String, share1: Vec<u8>) {
    let mut map = vault.write().expect("vault poisoned");
    map.insert(token, share1);
    info!("Share1 committed. Vault size: {}", map.len());
}

fn make_rejection(receipt: Option<ExecutionReceipt>) -> VaultResponse {
    VaultResponse {
        token:       String::new(),
        safe_prompt: String::new(),
        raw_text:    String::new(),
        status:      ResponseStatus::Rejected,
        receipt,
        shares:      HashMap::new(),
        telemetry:   None,
    }
}

fn write_response(
    writer: &mut std::io::BufWriter<&vsock::VsockStream>,
    response: VaultResponse,
) -> anyhow::Result<()> {
    let mut s = serde_json::to_string(&response)?;
    s.push('\n');
    writer.write_all(s.as_bytes())?;
    writer.flush()?;
    Ok(())
}
