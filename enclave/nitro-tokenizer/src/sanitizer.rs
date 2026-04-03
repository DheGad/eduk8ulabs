use regex::Regex;

/// A compiled PII pattern with its category label.
/// Compiled once at startup via `lazy_static` equivalent.
pub struct PiiPattern {
    pub label: &'static str,
    pub regex: Regex,
}

/// All PII patterns the enclave will detect and tokenize.
/// ORDER MATTERS: more specific patterns must come before general ones.
/// For example: SSN before generic digits, Email before generic words.
pub fn compile_patterns() -> Vec<PiiPattern> {
    vec![
        // ── Social Security Numbers (US) ─────────────────────────────────────
        // Formats: 123-45-6789 | 123 45 6789 | 123456789
        PiiPattern {
            label: "SSN",
            regex: Regex::new(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b").expect("SSN regex"),
        },

        // ── Account / Routing Numbers ─────────────────────────────────────────
        // 10–17 contiguous digits (covers IBAN fragments, routing, account numbers)
        PiiPattern {
            label: "ACCT",
            regex: Regex::new(r"\b\d{10,17}\b").expect("ACCT regex"),
        },

        // ── Email Addresses ───────────────────────────────────────────────────
        PiiPattern {
            label: "EMAIL",
            regex: Regex::new(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
                .expect("EMAIL regex"),
        },

        // ── Phone Numbers (US / international) ────────────────────────────────
        // +1 (555) 123-4567 | 555-123-4567 | 5551234567
        PiiPattern {
            label: "PHONE",
            regex: Regex::new(
                r"\b(?:\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b",
            )
            .expect("PHONE regex"),
        },

        // ── Full Names (two capitalised words) ────────────────────────────────
        // Intentionally last: catches "John Doe" but not already-replaced tokens
        PiiPattern {
            label: "PERSON",
            regex: Regex::new(r"\b[A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20}\b").expect("PERSON regex"),
        },
    ]
}

/// Result of scanning a prompt.
pub struct SanitizeResult {
    /// The prompt with all PII replaced by TKN_ tokens.
    pub safe_prompt: String,
    /// Ordered (token, original_text) pairs to commit to the Vault.
    /// Ordered so the caller can write them all in one lock acquisition.
    pub mappings: Vec<(String, String)>,
}

/// Scan `prompt`, replace each PII match with a fresh token, and collect mappings.
///
/// Replacement is done left-to-right with no overlapping matches.
/// The function is pure — it does NOT touch the vault directly.
pub fn sanitize_prompt(
    prompt: &str,
    patterns: &[PiiPattern],
    gen_token: &dyn Fn() -> String,
) -> SanitizeResult {
    let mut result = prompt.to_owned();
    let mut mappings: Vec<(String, String)> = Vec::new();

    for pattern in patterns {
        // Collect all non-overlapping matches on the *current* (already partially
        // replaced) string so we never double-tokenize a TKN_ value.
        let matches: Vec<(usize, usize, String)> = pattern
            .regex
            .find_iter(&result)
            .filter(|m| !m.as_str().starts_with("TKN_")) // skip already-tokenized spans
            .map(|m| (m.start(), m.end(), m.as_str().to_owned()))
            .collect();

        // Replace right-to-left so byte offsets remain valid after each substitution
        for (start, end, original) in matches.into_iter().rev() {
            let token = gen_token();
            mappings.push((token.clone(), original));
            result.replace_range(start..end, &token);
        }
    }

    SanitizeResult {
        safe_prompt: result,
        mappings,
    }
}

/// Scan `response` for TKN_ tokens and replace each with its vault lookup.
/// Returns the restored text and a list of any tokens that were NOT found in the map.
pub fn desanitize_response(
    response: &str,
    vault_lookup: &dyn Fn(&str) -> Option<String>,
) -> (String, Vec<String>) {
    let token_re = Regex::new(r"TKN_[0-9A-F]{16}").expect("TKN regex");
    let mut restored = response.to_owned();
    let mut missing: Vec<String> = Vec::new();

    let matches: Vec<(usize, usize, String)> = token_re
        .find_iter(response)
        .map(|m| (m.start(), m.end(), m.as_str().to_owned()))
        .collect();

    // Replace right-to-left to maintain byte offset integrity
    for (start, end, token) in matches.into_iter().rev() {
        match vault_lookup(&token) {
            Some(original) => {
                restored.replace_range(start..end, &original);
            }
            None => {
                missing.push(token);
            }
        }
    }

    (restored, missing)
}
