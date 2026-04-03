/**
 * @file piiScanner.ts
 * @module StreetMP Extension — Inline PII Detection Engine
 * @command COMMAND_094 — THE ZERO-TRUST BROWSER EXTENSION
 * @version V94.0.0
 *
 * ================================================================
 * ZERO-DEPENDENCY PII SCANNER
 * ================================================================
 *
 * This module runs entirely inside the browser sandbox with NO
 * network calls. It is the local "first line of defence" that
 * mirrors a subset of the V67/V88 DLP scrubber logic from the
 * router-service, but re-implemented using purely client-side
 * regex patterns.
 *
 * Why not import @streetmp/sdk directly?
 *   • The SDK contains Node.js dependencies (streams, crypto)
 *   • MV3 content scripts run in an isolated Web Worker context
 *   • Network round-trips add latency to the submit interception
 *
 * Pattern coverage:
 *   • Credit / Debit Card numbers (Luhn-validated)
 *   • Singapore NRIC / FIN numbers
 *   • Australian TFN
 *   • US Social Security Numbers
 *   • Passport numbers (multi-country)
 *   • API keys (OpenAI, Anthropic, AWS, GCP)
 *   • Email addresses (configurable sensitivity)
 *   • Phone numbers (international E.164)
 *   • IBAN / BIC codes
 *   • IP addresses (RFC 1918 internal ranges)
 *
 * ================================================================
 */

export type PiiCategory =
  | "CREDIT_CARD"
  | "SSN"
  | "NRIC"
  | "TFN"
  | "PASSPORT"
  | "API_KEY"
  | "EMAIL"
  | "PHONE"
  | "IBAN"
  | "INTERNAL_IP"
  | "DATE_OF_BIRTH"
  | "MEDICATION"
  | "BANK_ACCOUNT";

export interface PiiMatch {
  category:    PiiCategory;
  label:       string;
  matchedText: string;
  start:       number;
  end:         number;
  severity:    "HIGH" | "MEDIUM" | "LOW";
}

export interface ScanResult {
  hasPii:      boolean;
  matches:     PiiMatch[];
  /** Redacted version of the text (matches replaced with [REDACTED:category]) */
  redacted:    string;
  /** Latency of the scan in milliseconds */
  latencyMs:   number;
  riskScore:   number;
}

// ─── Pattern Registry ─────────────────────────────────────────────────────────
interface PiiPattern {
  category: PiiCategory;
  label:    string;
  pattern:  RegExp;
  severity: "HIGH" | "MEDIUM" | "LOW";
  /** Luhn check required for this pattern */
  luhn?:    boolean;
}

const PII_PATTERNS: PiiPattern[] = [
  // ─── Credit / Debit Cards ─────────────────────────────────────────────────
  {
    category: "CREDIT_CARD",
    label:    "Credit/Debit Card",
    pattern:  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    severity: "HIGH",
    luhn:     true,
  },
  // Spaced card numbers (e.g. "4111 1111 1111 1111")
  {
    category: "CREDIT_CARD",
    label:    "Credit/Debit Card (spaced)",
    pattern:  /\b(?:\d{4}[- ]){3}\d{4}\b/g,
    severity: "HIGH",
    luhn:     true,
  },

  // ─── SSN (US Social Security) ─────────────────────────────────────────────
  {
    category: "SSN",
    label:    "US Social Security Number",
    pattern:  /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g,
    severity: "HIGH",
  },

  // ─── Singapore NRIC / FIN ─────────────────────────────────────────────────
  {
    category: "NRIC",
    label:    "Singapore NRIC/FIN",
    pattern:  /\b[STFGM]\d{7}[A-Z]\b/gi,
    severity: "HIGH",
  },

  // ─── Australian TFN ───────────────────────────────────────────────────────
  {
    category: "TFN",
    label:    "Australian Tax File Number",
    pattern:  /\b\d{3}[- ]\d{3}[- ]\d{3}\b/g,
    severity: "HIGH",
  },

  // ─── Passport Numbers ────────────────────────────────────────────────────
  {
    category: "PASSPORT",
    label:    "Passport Number",
    pattern:  /\b(?:passport|pp)[:\s#]*([A-Z]{1,2}\d{6,9})\b/gi,
    severity: "HIGH",
  },

  // ─── API Keys ─────────────────────────────────────────────────────────────
  {
    category: "API_KEY",
    label:    "OpenAI API Key",
    pattern:  /\bsk-[a-zA-Z0-9]{20,100}\b/g,
    severity: "HIGH",
  },
  {
    category: "API_KEY",
    label:    "Anthropic API Key",
    pattern:  /\bsk-ant-[a-zA-Z0-9\-_]{20,100}\b/g,
    severity: "HIGH",
  },
  {
    category: "API_KEY",
    label:    "AWS Access Key ID",
    pattern:  /\b(?:AKIA|ASIA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    severity: "HIGH",
  },
  {
    category: "API_KEY",
    label:    "AWS Secret Access Key",
    pattern:  /\b[a-zA-Z0-9\/+]{40}\b/g,
    severity: "MEDIUM",
  },
  {
    category: "API_KEY",
    label:    "Generic Bearer Token",
    pattern:  /\bBearer\s+[a-zA-Z0-9_\-\.]{20,500}\b/gi,
    severity: "HIGH",
  },
  {
    category: "API_KEY",
    label:    "GCP API Key",
    pattern:  /\bAIza[0-9A-Za-z_\-]{35}\b/g,
    severity: "HIGH",
  },

  // ─── Email Addresses ──────────────────────────────────────────────────────
  {
    category: "EMAIL",
    label:    "Corporate Email",
    pattern:  /\b[a-zA-Z0-9._%+\-]+@(?!gmail\.|yahoo\.|hotmail\.|outlook\.)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    severity: "MEDIUM",
  },

  // ─── Phone Numbers (E.164 / common formats) ───────────────────────────────
  {
    category: "PHONE",
    label:    "Phone Number",
    pattern:  /(?<!\d)(?:\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{4,9}(?!\d)/g,
    severity: "MEDIUM",
  },

  // ─── IBAN ─────────────────────────────────────────────────────────────────
  {
    category: "IBAN",
    label:    "IBAN",
    pattern:  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    severity: "HIGH",
  },

  // ─── Internal IP Addresses (RFC 1918) ────────────────────────────────────
  {
    category: "INTERNAL_IP",
    label:    "Internal IP Address",
    pattern:  /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,
    severity: "MEDIUM",
  },

  // ─── Bank Account Numbers ────────────────────────────────────────────────
  {
    category: "BANK_ACCOUNT",
    label:    "Bank Account Number",
    pattern:  /\b(?:account|acct|acc)[:\s#]*(\d{8,17})\b/gi,
    severity: "HIGH",
  },
];

// ─── Luhn Algorithm ───────────────────────────────────────────────────────────
function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (isEven) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────
const SEVERITY_SCORES: Record<"HIGH" | "MEDIUM" | "LOW", number> = {
  HIGH:   100,
  MEDIUM:  50,
  LOW:     10,
};

// ─── Scanner ──────────────────────────────────────────────────────────────────
/**
 * Scans text for PII patterns using the built-in regex engine.
 * Zero network calls — runs entirely in the content script context.
 *
 * @param text - The prompt text to scan (max 50,000 chars)
 * @returns ScanResult with all matches, redacted text, and risk score
 */
export function scanForPii(text: string): ScanResult {
  const t0 = performance.now();
  const target = text.length > 50_000 ? text.slice(0, 50_000) : text;

  const allMatches: PiiMatch[] = [];
  let riskScore = 0;

  for (const def of PII_PATTERNS) {
    // Reset regex state (global flag requires lastIndex reset)
    def.pattern.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = def.pattern.exec(target)) !== null) {
      const raw = m[0];

      // Luhn validation for card numbers
      if (def.luhn && !luhnCheck(raw)) continue;

      allMatches.push({
        category:    def.category,
        label:       def.label,
        matchedText: raw.length > 40 ? raw.slice(0, 40) + "…" : raw,
        start:       m.index,
        end:         m.index + raw.length,
        severity:    def.severity,
      });
      riskScore += SEVERITY_SCORES[def.severity];
    }
  }

  // Sort by position for redaction order
  allMatches.sort((a, b) => a.start - b.start);

  // Build redacted string (replace from end to preserve indices)
  let redacted = target;
  const toReplace = [...allMatches].reverse();
  for (const match of toReplace) {
    redacted =
      redacted.slice(0, match.start) +
      `[REDACTED:${match.category}]` +
      redacted.slice(match.end);
  }

  return {
    hasPii:    allMatches.length > 0,
    matches:   allMatches,
    redacted,
    latencyMs: parseFloat((performance.now() - t0).toFixed(2)),
    riskScore: Math.min(riskScore, 1000),
  };
}
