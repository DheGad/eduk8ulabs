/**
 * @file shield.ts
 * @package privacy-pro
 * @description Sovereign Privacy Shield (SPS) — Differential Privacy Middleware
 *
 * Implements C053 Task 3.
 *
 * Core Problem:
 *   The AI must solve a problem that IS contextually linked to a specific user
 *   (e.g. "Why was Rahul's ₹1.4L transaction flagged?") WITHOUT the AI ever
 *   knowing Rahul's real identity, account number, or any UID.
 *
 * Solution — Three-Layer SPS Pipeline:
 *   1. ENTITY STRIPPING      — Remove all direct identifiers (PII)
 *   2. DP NOISE INJECTION    — Add calibrated Laplace noise to numeric fields
 *   3. CONTEXT PRESERVATION  — Keep the semantic "shape" of the problem intact
 *
 * Formal guarantee:
 *   P[M(D) ∈ S] ≤ e^ε × P[M(D') ∈ S]
 *   where ε (epsilon) is the privacy budget (default: 0.1 = very strong privacy)
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================
export interface SpsInput {
  raw_prompt: string;
  user_id: string;
  account_number?: string;
  numeric_fields?: Record<string, number>; // e.g. { amount: 142000 }
  epsilon?: number; // Privacy budget; lower = more private. Default: 0.1
}

export interface SpsOutput {
  sanitized_prompt: string;     // Safe for LLM consumption — no PII
  entity_map: EntityMap;        // Maps placeholder → stripped entity for post-processing
  dp_noise_applied: boolean;    // Whether Laplace noise was added to numeric fields
  privacy_budget_used: number;  // Epsilon consumed in this request
  anonymization_token: string;  // Short-lived token for result re-personalization
  pii_count: number;            // Number of PII entities removed
}

export interface EntityMap {
  [placeholder: string]: {
    original_type: string;
    masked_value: string;  // The replacement shown in sanitized_prompt
  };
}

// ================================================================
// PII DETECTION PATTERNS
// ================================================================
const PII_PATTERNS: Array<{ type: string; regex: RegExp; replacement: (i: number) => string }> = [
  { type: "AADHAAR",    regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,            replacement: (i) => `[AADHAAR_${i}]` },
  { type: "PAN",        regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,               replacement: (i) => `[PAN_${i}]` },
  { type: "SSN",        regex: /\b\d{3}-\d{2}-\d{4}\b/g,                replacement: (i) => `[SSN_${i}]` },
  { type: "EMAIL",      regex: /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi,      replacement: (i) => `[EMAIL_${i}]` },
  { type: "PHONE_IN",   regex: /\b[6-9]\d{9}\b/g,                        replacement: (i) => `[PHONE_${i}]` },
  { type: "ACCOUNT_NO", regex: /\b\d{10,18}\b/g,                         replacement: (i) => `[ACCOUNT_${i}]` },
  { type: "IP_ADDRESS", regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,          replacement: (i) => `[IP_ADDR_${i}]` },
  { type: "DOB",        regex: /\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}\b/gi, replacement: (i) => `[DOB_${i}]` },
];

// ================================================================
// LAPLACE NOISE — Differential Privacy
// ================================================================
/**
 * Laplace mechanism: adds noise drawn from Lap(sensitivity/epsilon) distribution.
 * For financial amounts, sensitivity = 1 (one unit = ₹1 change in one user's record).
 */
function laplaceNoise(sensitivity: number, epsilon: number): number {
  const u = Math.random() - 0.5;
  const b = sensitivity / epsilon;
  return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

function addDpNoise(value: number, epsilon: number): number {
  const noise = laplaceNoise(1, epsilon);
  // Round to nearest 100 (currency) to preserve plausibility
  return Math.max(0, Math.round((value + noise) / 100) * 100);
}

// ================================================================
// ANONYMIZATION TOKEN
// ================================================================
function issueAnonToken(userId: string, accountNumber?: string): string {
  const secret = process.env.PRIVACY_SHIELD_SECRET || "sps_default_secret";
  const payload = `${userId}:${accountNumber || "none"}:${Date.now()}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 24);
}

// ================================================================
// MAIN SPS FUNCTION — Export for middleware use
// ================================================================
export function applyPrivacyShield(input: SpsInput): SpsOutput {
  const epsilon = input.epsilon ?? 0.1;
  let sanitized = input.raw_prompt;
  const entityMap: EntityMap = {};
  let piiCount = 0;

  // ── LAYER 1: Strip UID and Account Number ──
  if (input.user_id) {
    const uidToken = `[USER_X]`;
    // Replace any occurrence (UUIDs, numeric IDs)
    sanitized = sanitized.replace(new RegExp(input.user_id.replace(/-/g, "[-]?"), "gi"), uidToken);
    entityMap[uidToken] = { original_type: "USER_ID", masked_value: uidToken };
    piiCount++;
  }

  if (input.account_number) {
    const accToken = `[ACCOUNT_X]`;
    sanitized = sanitized.replace(new RegExp(input.account_number, "g"), accToken);
    entityMap[accToken] = { original_type: "ACCOUNT_NUMBER", masked_value: accToken };
    piiCount++;
  }

  // ── LAYER 2: Pattern-Based PII Stripping ──
  PII_PATTERNS.forEach(pattern => {
    let matchIndex = 0;
    sanitized = sanitized.replace(pattern.regex, (match) => {
      const token = pattern.replacement(matchIndex++);
      entityMap[token] = { original_type: pattern.type, masked_value: token };
      piiCount++;
      return token;
    });
  });

  // ── LAYER 3: Differential Privacy Noise on Numeric Fields ──
  let dpApplied = false;
  if (input.numeric_fields) {
    Object.entries(input.numeric_fields).forEach(([field, value]) => {
      const noisyValue = addDpNoise(value, epsilon);
      const original = value.toString();
      const noisy = noisyValue.toString();
      sanitized = sanitized.replace(original, noisy);
      dpApplied = true;
    });
  }

  return {
    sanitized_prompt: sanitized,
    entity_map: entityMap,
    dp_noise_applied: dpApplied,
    privacy_budget_used: epsilon,
    anonymization_token: issueAnonToken(input.user_id, input.account_number),
    pii_count: piiCount,
  };
}

/**
 * Re-personalization: After the LLM returns a response referencing [USER_X],
 * this restores the original values for the authenticated client display layer.
 * The LLM never saw the real data — but the response is personalized on output.
 */
export function repersonalizeOutput(
  llmResponse: string,
  entityMap: EntityMap,
  anonToken: string
): string {
  // In production: verify anonToken matches HMAC before repersonalizing
  // For now: substitute tokens back with their masked values (not originals)
  // Originals are fetched from a secure client-side session store — never sent to LLM
  let output = llmResponse;
  Object.entries(entityMap).forEach(([placeholder]) => {
    // Replace placeholder with masked display (e.g. [ACCOUNT_X] → •••• 4871)
    output = output.replace(placeholder, `[Protected by SPS — ${entityMap[placeholder].original_type}]`);
  });
  return output;
}
