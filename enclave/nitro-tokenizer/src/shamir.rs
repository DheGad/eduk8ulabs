/// Shamir's Secret Sharing — 2-of-3 threshold split for PII values.
///
/// # Why this solves the "full vault dump" attack:
///
/// Without SSS:
///   Enclave RAM dump → full `Token → Plaintext` map → game over.
///
/// With SSS (this module):
///   Enclave RAM holds only Share 1.
///   Control Plane (Node.js / DB) holds Share 2 + Share 3.
///   An attacker needs BOTH sides to reconstruct the original secret.
///   A compromised enclave memory dump alone is USELESS.
///
/// # Scheme
///   - Algorithm: GF(2^8) Lagrange interpolation (standard Shamir)
///   - Threshold : k = 2 (any 2 shares → reconstruct)
///   - Total     : n = 3 (3 shares generated per secret)
///   - Share 1 → Enclave Vault (volatile RAM, dies on restart)
///   - Share 2 → Returned to Control Plane over vsock in the response
///   - Share 3 → Returned to Control Plane over vsock in the response
///     (Control Plane should store S2+S3 in cold storage / separate DB)
///
/// # Reconstruction
///   Enclave uses Share 1 (from its own vault) + Share 2 (from caller).
///   Share 3 is backup; the caller can also use Share 2 + Share 3
///   independently if the enclave is unavailable (cold-recovery path).
///
/// # Wire format
///   Each share is a raw byte sequence serialised over the wire as Base64.
///   The `sharks` crate encodes each share as `[x, y0, y1, ... yN]` where
///   `x` is the share index and `yI` are the GF(2^8) polynomial evaluations.

use base64ct::{Base64, Encoding};
use sharks::{Share, Sharks};

// ─── Public API ───────────────────────────────────────────────────────────────

/// The three shares of a split secret.
/// All fields are Base64-encoded raw share bytes for JSON transport.
#[derive(Debug, Clone)]
pub struct SplitSecret {
    /// Stored in the Enclave vault. Never returned to the caller.
    pub share1: Vec<u8>,
    /// Returned to the Control Plane. Store in cold/separate storage.
    pub share2_b64: String,
    /// Returned to the Control Plane. Store as backup / offline recovery.
    pub share3_b64: String,
}

/// Split a UTF-8 string into 3 Shamir shares using a 2-of-3 threshold.
///
/// Backed by GF(2^8) arithmetic from the `sharks` crate.
/// Both caller and callee only need to combine 2 shares to reconstruct.
pub fn split_secret(plaintext: &str) -> SplitSecret {
    // Threshold k=2 means any 2 shares can reconstruct the secret.
    let sharks = Sharks(2);
    let mut dealer = sharks.dealer(plaintext.as_bytes());

    // Generate exactly 3 shares.
    // `dealer` is an infinite iterator — we take precisely 3.
    let shares: Vec<Share> = dealer.by_ref().take(3).collect();

    let to_bytes = |s: &Share| -> Vec<u8> { Vec::from(s) };

    let share1_bytes = to_bytes(&shares[0]);
    let share2_bytes = to_bytes(&shares[1]);
    let share3_bytes = to_bytes(&shares[2]);

    SplitSecret {
        share1: share1_bytes,
        share2_b64: Base64::encode_string(&share2_bytes),
        share3_b64: Base64::encode_string(&share3_bytes),
    }
}

/// Reconstruct the plaintext from two shares.
///
/// # Arguments
/// * `share1_bytes` — the raw bytes of Share 1 (retrieved from the Enclave vault)
/// * `share2_b64`   — the Base64-encoded Share 2 provided by the Control Plane
///
/// # Returns
/// The reconstructed plaintext, or an error if the shares are invalid.
pub fn reconstruct_secret(share1_bytes: &[u8], share2_b64: &str) -> anyhow::Result<String> {
    let share2_bytes = Base64::decode_vec(share2_b64)
        .map_err(|e| anyhow::anyhow!("Share 2 base64 decode failed: {e}"))?;

    let s1 = Share::try_from(share1_bytes.as_ref())
        .map_err(|_| anyhow::anyhow!("Share 1 is corrupt or malformed"))?;
    let s2 = Share::try_from(share2_bytes.as_slice())
        .map_err(|_| anyhow::anyhow!("Share 2 is corrupt or malformed"))?;

    let sharks = Sharks(2);
    let secret = sharks
        .recover([s1, s2].iter())
        .map_err(|_| anyhow::anyhow!("Secret reconstruction failed (incompatible shares?)"))?;

    String::from_utf8(secret)
        .map_err(|e| anyhow::anyhow!("Reconstructed secret is not valid UTF-8: {e}"))
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_and_reconstruct_roundtrip() {
        let original = "John Doe";
        let split = split_secret(original);

        // Share 1 raw + Share 2 base64 → must reconstruct perfectly
        let restored = reconstruct_secret(&split.share1, &split.share2_b64)
            .expect("reconstruction must succeed with share1 + share2");
        assert_eq!(restored, original, "reconstructed secret must match original");
    }

    #[test]
    fn share3_also_reconstructs_with_share2() {
        // Verify the backup recovery path: S2 + S3 (without the enclave)
        let original = "jane.smith@corp.com";
        let split = split_secret(original);

        // Decode share3
        let share3_bytes = Base64::decode_vec(&split.share3_b64).unwrap();
        let s2_bytes = Base64::decode_vec(&split.share2_b64).unwrap();

        let s2 = Share::try_from(s2_bytes.as_slice()).unwrap();
        let s3 = Share::try_from(share3_bytes.as_slice()).unwrap();

        let sharks = Sharks(2);
        let secret = sharks.recover([s2, s3].iter()).expect("S2+S3 must recover");
        let restored = String::from_utf8(secret).unwrap();
        assert_eq!(restored, original, "S2+S3 cold-recovery must match original");
    }

    #[test]
    fn single_share_cannot_reconstruct() {
        let original = "SSN:123-45-6789";
        let split = split_secret(original);

        // Attempting to recover with only 1 share must fail (k=2 required)
        let s1 = Share::try_from(split.share1.as_slice()).unwrap();
        let sharks = Sharks(2);
        // A single-share recover is either an error or returns garbage — never the original
        match sharks.recover([s1].iter()) {
            Err(_) => {} // expected — insufficient shares
            Ok(bytes) => {
                // If the library doesn't error, the result must NOT be the original
                let out = String::from_utf8_lossy(&bytes);
                assert_ne!(out, original, "single share must NOT reveal the secret");
            }
        }
    }

    #[test]
    fn unicode_secret_survives_roundtrip() {
        let original = "Dheeraj Sōlomon";
        let split = split_secret(original);
        let restored = reconstruct_secret(&split.share1, &split.share2_b64).unwrap();
        assert_eq!(restored, original, "unicode must survive Shamir roundtrip");
    }
}
