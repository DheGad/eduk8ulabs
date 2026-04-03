/**
 * trust_engine.rs — V9 Autonomous Trust Engine
 *
 * Calculates a deterministic Trust Score (0.0–100.0) for every incoming
 * prompt BEFORE any sanitization or LLM dispatch happens.
 *
 * Formula:
 *   TrustScore = 100.0 - entropy_penalty - heuristic_penalty - policy_penalty
 *
 * Penalty Components
 * ──────────────────
 *   entropy_penalty:   Shannon entropy over character distribution.
 *                      High-entropy payloads (obfuscated hex/base64 blobs)
 *                      are a classic injection smuggling vector.
 *
 *   heuristic_penalty: Fast O(n) structural checks:
 *     - Unusually long payload                 → +10
 *     - High ratio of non-alphanum characters  → +10
 *     - Suspicious token density               → +15
 *
 *   policy_penalty:    Tenant-specific multiplier applied when the active
 *                      policy_id signals a strict regulated industry.
 *
 * Guillotine Rule:
 *   score < 50.0 → immediate abort → `rejected_autonomous_block`
 */

// ─── Public Types ─────────────────────────────────────────────────────────────

/// Flags set by the heuristic sub-system — each maps to a specific penalty.
#[derive(Debug, Clone)]
pub struct TrustFlags {
    pub high_entropy:          bool,   // Shannon H > threshold
    pub excessive_length:      bool,   // raw_text.len() > 6144 bytes
    pub high_symbol_ratio:     bool,   // >35% non-alphanumeric characters
    pub suspicious_token_density: bool, // TKN_-like or base64 token ratio > 20%
    pub strict_policy_active:  bool,   // Finance / Defense / ITAR policy applied
}

impl Default for TrustFlags {
    fn default() -> Self {
        TrustFlags {
            high_entropy:          false,
            excessive_length:      false,
            high_symbol_ratio:     false,
            suspicious_token_density: false,
            strict_policy_active:  false,
        }
    }
}

/// The full Trust Score report returned to handle_sanitize.
#[derive(Debug, Clone)]
pub struct TrustScore {
    /// Final score in [0.0, 100.0]. Request is blocked if < 50.0.
    pub score:   f64,
    /// Shannon entropy of the payload (computed before penalties).
    pub entropy: f64,
    /// Detailed bitflags for audit trails.
    pub flags:   TrustFlags,
}

// ─── Scoring Constants ────────────────────────────────────────────────────────

/// Entropy threshold above which the high_entropy flag is set.
/// Shannon entropy of natural English prose ≈ 3.5–4.5 bits/char.
/// Obfuscated base64 / hex hovers near 5.5–6.0.
const ENTROPY_THRESHOLD: f64 = 5.2;

/// Maximum penalty that entropy alone can contribute.
const MAX_ENTROPY_PENALTY: f64 = 35.0;

/// Penalties for individual heuristic flags.
const PENALTY_EXCESSIVE_LENGTH:          f64 = 10.0;
const PENALTY_HIGH_SYMBOL_RATIO:         f64 = 10.0;
const PENALTY_SUSPICIOUS_TOKEN_DENSITY:  f64 = 15.0;

/// Extra penalty multiplier for regulated/strict industry policies.
const PENALTY_STRICT_POLICY:             f64 = 5.0;

/// Payload size threshold (bytes) for excessive_length flag.
const EXCESSIVE_LENGTH_THRESHOLD: usize = 6_144;

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/// Calculates the Shannon entropy (H) of the character distribution in `text`.
///
/// H = -Σ p(c) * log2(p(c)) for each unique character c.
///
/// Entirely deterministic and O(n) — suitable for sub-millisecond enclave use.
pub fn calculate_shannon_entropy(text: &str) -> f64 {
    if text.is_empty() {
        return 0.0;
    }

    // Character frequency table — 256 ASCII slots, zero-alloc.
    let mut freq = [0u64; 256];
    let total = text.len() as f64;

    for byte in text.bytes() {
        freq[byte as usize] += 1;
    }

    freq.iter()
        .filter(|&&count| count > 0)
        .map(|&count| {
            let p = count as f64 / total;
            -p * p.log2()
        })
        .sum()
}

/// Evaluates the Trust Score for an incoming prompt.
///
/// # Parameters
/// - `raw_text`:  The unmodified user prompt (never stored or logged).
/// - `policy_id`: The active tenant PolicySet ID from GL-02 router.
///
/// # Returns
/// A [`TrustScore`] with the final score and breakdown flags.
/// The caller must block the request if `score < 50.0`.
pub fn evaluate_trust(raw_text: &str, policy_id: &Option<String>) -> TrustScore {
    let entropy = calculate_shannon_entropy(raw_text);
    let mut flags = TrustFlags::default();

    // ── Entropy Penalty ───────────────────────────────────────────────────────
    // Scale linearly from 0 (at threshold) to MAX_ENTROPY_PENALTY (at 8.0 bits)
    let entropy_penalty = if entropy > ENTROPY_THRESHOLD {
        let over = (entropy - ENTROPY_THRESHOLD) / (8.0 - ENTROPY_THRESHOLD);
        (over * MAX_ENTROPY_PENALTY).min(MAX_ENTROPY_PENALTY)
    } else {
        0.0
    };

    if entropy > ENTROPY_THRESHOLD {
        flags.high_entropy = true;
    }

    // ── Heuristic Penalties ───────────────────────────────────────────────────
    let len = raw_text.len();
    let mut heuristic_penalty = 0.0;

    // Flag 1: Excessive length
    if len > EXCESSIVE_LENGTH_THRESHOLD {
        flags.excessive_length = true;
        heuristic_penalty += PENALTY_EXCESSIVE_LENGTH;
    }

    // Flag 2: High symbol ratio (non-alphanumeric characters)
    // Obfuscated payloads like base64 bombs and hex strings have very low
    // alphanumeric ratios when decoded further or used as raw text.
    let alnum_count = raw_text.chars().filter(|c| c.is_alphanumeric() || c.is_whitespace()).count();
    let symbol_ratio = 1.0 - (alnum_count as f64 / len.max(1) as f64);
    if symbol_ratio > 0.35 {
        flags.high_symbol_ratio = true;
        heuristic_penalty += PENALTY_HIGH_SYMBOL_RATIO;
    }

    // Flag 3: Suspicious token density — detect base64 padding (==) patterns,
    // hex sequences, or existing TKN_ tokens that could confuse the vault.
    let token_indicators = raw_text.matches("==")
        .count()
        .saturating_add(raw_text.matches("0x").count())
        .saturating_add(raw_text.matches("TKN_").count());
    let token_density = token_indicators as f64 * 10.0 / len.max(1) as f64;
    if token_density > 0.20 {
        flags.suspicious_token_density = true;
        heuristic_penalty += PENALTY_SUSPICIOUS_TOKEN_DENSITY;
    }

    // ── Policy Penalty ────────────────────────────────────────────────────────
    // Strict regulated industries get an amplified penalty so questionable
    // payloads that would pass in a generic context are still blocked.
    let policy_penalty = if let Some(id) = policy_id {
        if id.contains("FINANCE") || id.contains("DEFENSE") || id.contains("ITAR") {
            flags.strict_policy_active = true;
            PENALTY_STRICT_POLICY
        } else {
            0.0
        }
    } else {
        0.0
    };

    // ── Final Score ───────────────────────────────────────────────────────────
    let raw_score = 100.0 - entropy_penalty - heuristic_penalty - policy_penalty;
    let score = raw_score.clamp(0.0, 100.0);

    TrustScore { score, entropy, flags }
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn natural_english_scores_high() {
        let text = "Please summarise the Q3 earnings report for the EMEA region.";
        let result = evaluate_trust(text, &None);
        assert!(result.score > 80.0, "Natural prose should score >80, got {:.1}", result.score);
    }

    #[test]
    fn high_entropy_base64_blob_blocked() {
        // 512 bytes of URL-safe base64 — high entropy, malicious smuggling vector
        let blob = "ZXhhbXBsZUJhc2U2NENvbnRlbnQ=".repeat(20);
        let result = evaluate_trust(&blob, &None);
        assert!(result.score < 50.0, "Base64 blob should be blocked, got {:.1}", result.score);
        assert!(result.flags.high_entropy, "high_entropy flag expected");
    }

    #[test]
    fn finance_policy_adds_extra_penalty() {
        let borderline = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=".repeat(5); // moderate obfuscation
        let generic = evaluate_trust(&borderline, &None);
        let finance = evaluate_trust(&borderline, &Some("FINANCE_STRICT_V1".to_string()));
        assert!(
            finance.score <= generic.score,
            "Finance policy should never produce higher score than generic"
        );
    }

    #[test]
    fn entropy_of_uniform_string_is_zero() {
        let uniform = "aaaaaaaaaa";
        let h = calculate_shannon_entropy(uniform);
        assert_eq!(h, 0.0, "Uniform string should have zero entropy");
    }

    #[test]
    fn entropy_of_binary_is_one() {
        let binary = "ababababab";
        let h = calculate_shannon_entropy(binary);
        // Two equally likely symbols → H = 1.0
        assert!((h - 1.0).abs() < 1e-9, "Binary string entropy should be 1.0, got {h}");
    }
}
