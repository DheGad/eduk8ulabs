/**
 * @file src/localPiiGuard.ts
 * @package @streetmp/sdk
 * @description Local pre-flight PII scanner.
 *
 * Runs BEFORE any network request — catches obvious PII patterns in the
 * caller's message array and throws StreetMPPiiError.
 *
 * ── Why local? ──────────────────────────────────────────────────────────────
 *  Defence-in-depth. The StreetMP proxy V67 engine will redact PII server-side
 *  regardless, but local scanning gives partners a zero-latency signal that
 *  their application code is passing raw PII. This helps developers fix their
 *  data pipeline rather than relying on the proxy as the sole defence.
 *
 * ── Dependency policy ───────────────────────────────────────────────────────
 *  Zero external dependencies. All patterns are vanilla JS RegExp.
 *
 * ── Design ──────────────────────────────────────────────────────────────────
 *  - Scan only user/assistant messages, not system messages (those may
 *    legitimately contain PII field names as instructions).
 *  - Fail-fast: return on first detected pattern to minimise latency.
 *  - Each pattern returns its human-readable type for the error message.
 */

import type { ChatMessage } from "./types.js";

interface PiiPattern {
  type:  string;
  regex: RegExp;
}

// Ordered by severity — most critical first for fast-fail
const PATTERNS: PiiPattern[] = [
  {
    type:  "CREDIT_CARD",
    regex: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/,
  },
  {
    type:  "SSN",
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    type:  "NRIC_FIN",
    regex: /\b[STFG]\d{7}[A-Z]\b/,
  },
  {
    type:  "MYKAD",
    regex: /\b\d{6}-\d{2}-\d{4}\b/,
  },
  {
    type:  "IBAN",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16})\b/,
  },
  {
    type:  "EMAIL",
    regex: /\b[\w.%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}\b/,
  },
  {
    type:  "MRN",
    regex: /\bMRN[\s:]+\d{6,10}\b/i,
  },
];

/**
 * Scans message content for obvious PII patterns.
 *
 * @param messages  - Chat messages to scan.
 * @returns Array of detected PII type strings; empty if clean.
 */
export function detectLocalPii(messages: ChatMessage[]): string[] {
  const detected: string[] = [];

  for (const msg of messages) {
    // System messages may legitimately reference PII field names — skip
    if (msg.role === "system") continue;

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(msg.content) && !detected.includes(pattern.type)) {
        detected.push(pattern.type);
      }
    }
  }

  return detected;
}
