use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Request ──────────────────────────────────────────────────────────────────

/// A unified request struct covering all actions.
/// - `tokenize`:    `raw_text` is the PII string → returns a single token.
/// - `detokenize`:  `token` is the TKN_ string   → returns the original string.
/// - `sanitize`:    `raw_text` is a FULL PROMPT   → returns safe prompt + shares + receipt.
/// - `desanitize`:  `raw_text` is a FULL LLM RESPONSE → caller must supply their shares.
///
/// SECURITY: `raw_text` is NEVER emitted to logs on either side of the vsock.
#[derive(Debug, Deserialize)]
pub struct VaultRequest {
    #[serde(default)]
    pub raw_text: String,

    #[serde(default)]
    pub token: String,

    pub action: Action,

    /// V7: Control Plane's shares for desanitize — keyed by token.
    #[serde(default)]
    pub external_shares: HashMap<String, String>,

    /// GL-02 / V9: Active tenant PolicySet ID (e.g. "FINANCE_STRICT_V1").
    /// Used by the Trust Engine to apply the correct penalty amplifier.
    #[serde(default)]
    pub policy_id: Option<String>,

    /// V11: Session identifier for memory firewall routing.
    /// Required when action == PurgeSession.
    #[serde(default)]
    pub session_id: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Tokenize,
    Detokenize,
    Sanitize,
    Desanitize,
    GetTelemetry,
    /// V11: Cryptographically zero and remove a specific session's token map.
    /// Triggered by the Control Plane when a user logs out or session expires.
    PurgeSession,
}

impl std::fmt::Display for Action {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Action::Tokenize      => write!(f, "tokenize"),
            Action::Detokenize    => write!(f, "detokenize"),
            Action::Sanitize      => write!(f, "sanitize"),
            Action::Desanitize    => write!(f, "desanitize"),
            Action::GetTelemetry  => write!(f, "get_telemetry"),
            Action::PurgeSession  => write!(f, "purge_session"),
        }
    }
}


// ─── Execution Receipt ────────────────────────────────────────────────────────

/// An unforgeable cryptographic proof that a specific sanitize or desanitize
/// action was executed inside the Nitro Enclave hardware boundary.
#[derive(Debug, Serialize, Clone)]
pub struct ExecutionReceipt {
    /// Unix epoch seconds of execution.
    pub timestamp: String,
    /// SHA-256(raw input), hex — commits WHAT went in.
    pub input_hash: String,
    /// SHA-256(output), hex — commits WHAT came out.
    pub output_hash: String,
    /// "PASSED_GUARDRAILS" | "REJECTED_INJECTION" | "REJECTED_LEAKAGE" | "REJECTED_AUTONOMOUS_BLOCK"
    pub policy_result: String,
    /// Base64-encoded Ed25519 signature of "{ts}|{ih}|{oh}|{pr}".
    pub signature: String,
    /// Hex-encoded Ed25519 public key for this enclave session.
    pub signer_pubkey: String,
    /// V9: Final Trust Score (0.0–100.0) computed by the Autonomous Trust Engine.
    /// Exposes entropy + heuristic math to the CISO dashboard.
    pub trust_score: f64,
}

// ─── Share Pair ───────────────────────────────────────────────────────────────

/// The Control Plane's half of the Shamir split for a single tokenized entity.
/// Share 1 stays in the Enclave vault.
/// Share 2 + Share 3 are returned here and must be stored by the caller on their side.
///
/// To reconstruct: call desanitize with `external_shares[token] = share2`.
/// Share 3 is the offline cold-recovery backup (S2 + S3 without the Enclave).
#[derive(Debug, Serialize, Clone)]
pub struct EntityShares {
    /// Base64-encoded Share 2 — return to caller, store in the Control Plane DB.
    pub share2: String,
    /// Base64-encoded Share 3 — cold-storage offline recovery backup.
    pub share3: String,
}

/// V8: Differentially private telemetry metrics (noisy).
#[derive(Debug, Serialize, Clone)]
pub struct TelemetryMetrics {
    pub sanitize_count: usize,
    pub desanitize_count: usize,
    pub rejection_count: usize,
    pub eps: f64,
}

// ─── Response ─────────────────────────────────────────────────────────────────

/// Unified response for all four actions.
#[derive(Debug, Serialize)]
pub struct VaultResponse {
    #[serde(skip_serializing_if = "String::is_empty")]
    pub token: String,          // tokenize → single TKN_ token

    #[serde(skip_serializing_if = "String::is_empty")]
    pub safe_prompt: String,    // sanitize → full prompt with PII replaced

    #[serde(skip_serializing_if = "String::is_empty")]
    pub raw_text: String,       // detokenize / desanitize → restored plaintext

    pub status: ResponseStatus,

    /// V6: Cryptographic execution receipt.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt: Option<ExecutionReceipt>,

    /// V7: Per-entity Shamir shares for the Control Plane to store.
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub shares: HashMap<String, EntityShares>,

    /// V8: Differentially Private metrics.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub telemetry: Option<TelemetryMetrics>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStatus {
    Success,
    Rejected,
    NotFound,
    /// Input guard tripped: prompt injection detected before forwarding to LLM
    RejectedPromptInjection,
    /// Output guard tripped: LLM response contained a mapping reconstruction attempt
    RejectedModelLeakage,
    /// V9: Autonomous Trust Engine blocked the request (Trust Score < 50.0)
    RejectedAutonomousBlock,
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/// Maximum accepted raw_text length — prevents heap stuffing attacks via vsock.
pub const MAX_RAW_TEXT_BYTES: usize = 8_192;

/// A valid token must start with this prefix.
pub const TOKEN_PREFIX: &str = "TKN_";
