/// V6 Cryptographic Receipt Engine
///
/// All signing is performed inside the trusted Rust Enclave.
/// The private key never leaves this module and is never serialized.
///
/// Receipt format (signed payload string):
///   `"{timestamp}|{input_hash}|{output_hash}|{policy_result}"`
///
/// Verification steps (for auditors):
///   1. Fetch the enclave's public key from GET /v1/enclave/pubkey
///   2. Reconstruct the signed payload string field-by-field
///   3. Verify `receipt.signature` (base64-decode → u8[64]) against the payload
///      using standard Ed25519 verification

use base64ct::{Base64, Encoding};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};

use crate::protocol::ExecutionReceipt;

// ─── Signing Key ──────────────────────────────────────────────────────────────

/// Enclave signing key — one instance per process.
/// Generated from Nitro hardware RNG on startup, lives in volatile RAM.
pub struct EnclaveSigningKey {
    signing_key:   SigningKey,
    verifying_key: VerifyingKey,
    pubkey_hex:    String,  // Pre-computed hex for the /pubkey endpoint and receipts
}

impl EnclaveSigningKey {
    /// Generate a fresh Ed25519 keypair from the hardware RNG.
    /// Must be called exactly once at enclave startup.
    ///
    /// SECURITY: The `signing_key` private bytes never leave this struct.
    ///           They are not logged, exported, or stored.
    pub fn generate() -> Self {
        // ed25519-dalek 2.x requires an OsRng-compatible source.
        // On Nitro, OsRng reads from /dev/urandom backed by the hypervisor's HRNG.
        let mut rng = rand_core::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();
        let pubkey_hex = hex::encode(verifying_key.as_bytes());

        Self {
            signing_key,
            verifying_key,
            pubkey_hex,
        }
    }

    /// The hex-encoded public key — safe to publish openly.
    pub fn pubkey_hex(&self) -> &str {
        &self.pubkey_hex
    }

    /// Sign a message and return the base64-encoded signature.
    fn sign_message(&self, message: &[u8]) -> String {
        let signature: Signature = self.signing_key.sign(message);
        Base64::encode_string(signature.to_bytes().as_ref())
    }
}

// ─── Receipt Builder ──────────────────────────────────────────────────────────

/// Policy result labels — logged in the receipt, never into raw metrics.
pub const POLICY_PASSED: &str = "PASSED_GUARDRAILS";
pub const POLICY_REJECTED_INJECTION: &str = "REJECTED_INJECTION";
pub const POLICY_REJECTED_LEAKAGE: &str = "REJECTED_LEAKAGE";
/// V9: Autonomous Trust Engine block label.
pub const POLICY_REJECTED_AUTONOMOUS: &str = "REJECTED_AUTONOMOUS_BLOCK";

/// SHA-256 a byte slice and return lowercase hex.
fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Build and sign an ExecutionReceipt for a completed sanitize or desanitize action.
///
/// Security contract:
///   - `input`  = the RAW text received (before guardrail / tokenization)
///   - `output` = the SAFE text produced (after tokenization / restoration)
///   - Neither `input` nor `output` appear in the receipt — only their hashes.
///   - The timestamp is the Unix epoch seconds at the time of signing.
pub fn build_receipt(
    input: &str,
    output: &str,
    policy_result: &str,
    signing_key: &EnclaveSigningKey,
) -> ExecutionReceipt {
    // Use Unix timestamp (seconds). On Nitro, std::time works via the host vDSO.
    let timestamp = {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|_| "0".to_string())
    };

    let input_hash  = sha256_hex(input.as_bytes());
    let output_hash = sha256_hex(output.as_bytes());

    // Canonical payload — deterministic ordering for verifiers
    let signed_payload = format!(
        "{}|{}|{}|{}",
        timestamp, input_hash, output_hash, policy_result
    );

    let signature   = signing_key.sign_message(signed_payload.as_bytes());
    let signer_pubkey = signing_key.pubkey_hex().to_string();

    ExecutionReceipt {
        timestamp,
        input_hash,
        output_hash,
        policy_result: policy_result.to_string(),
        signature,
        signer_pubkey,
        trust_score: 0.0,  // Caller overrides for V9 autonomous block receipts
    }
}

// ─── Self-Test ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Verifier;

    #[test]
    fn receipt_signature_verifies() {
        let key = EnclaveSigningKey::generate();
        let receipt = build_receipt("hello world", "TKN_ABCDEF0123456789", POLICY_PASSED, &key);

        // Reconstruct the signed payload
        let payload = format!(
            "{}|{}|{}|{}",
            receipt.timestamp, receipt.input_hash, receipt.output_hash, receipt.policy_result
        );

        // Decode signature
        let sig_bytes = Base64::decode_vec(&receipt.signature).expect("base64 decode");
        let signature = Signature::from_slice(&sig_bytes).expect("signature decode");

        // Verify with the public key
        let verifying = key.verifying_key;
        assert!(verifying.verify(payload.as_bytes(), &signature).is_ok(), "signature must verify");
    }

    #[test]
    fn different_inputs_produce_different_hashes() {
        let key = EnclaveSigningKey::generate();
        let r1 = build_receipt("John Doe", "TKN_A", POLICY_PASSED, &key);
        let r2 = build_receipt("Jane Doe", "TKN_B", POLICY_PASSED, &key);
        assert_ne!(r1.input_hash, r2.input_hash, "distinct inputs must have distinct hashes");
    }

    #[test]
    fn tampered_payload_fails_verification() {
        let key = EnclaveSigningKey::generate();
        let receipt = build_receipt("input", "output", POLICY_PASSED, &key);

        // Tamper: change policy_result
        let tampered_payload = format!(
            "{}|{}|{}|TAMPERED",
            receipt.timestamp, receipt.input_hash, receipt.output_hash
        );

        let sig_bytes = Base64::decode_vec(&receipt.signature).expect("base64 decode");
        let signature = Signature::from_slice(&sig_bytes).expect("signature decode");

        let verifying = key.verifying_key;
        assert!(
            verifying.verify(tampered_payload.as_bytes(), &signature).is_err(),
            "tampered payload must NOT verify"
        );
    }
}
