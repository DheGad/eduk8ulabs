/**
 * @file redactor.ts
 * @service sanitizer-service
 * @deprecated V5-02 (2026-03-23)
 *
 * ⚠️  DEPRECATED — DO NOT USE IN NEW CODE ⚠️
 *
 * This module previously performed PII detection and redaction
 * entirely inside the Node.js V8 heap (Control Plane).
 *
 * As of V5-02, ALL PII detection, tokenization, and desanitization
 * is performed exclusively inside the Rust Nitro Enclave via the
 * `vsock` bridge (see `apps/os-kernel/services/router-service/src/enclaveClient.ts`).
 *
 * This file is preserved for:
 *   - Audit trail purposes
 *   - Reference during the V5.x → V6 migration
 *   - Emergency plaintext fallback (disabled by NITRO_ENCLAVE_REQUIRED=true)
 *
 * SECURITY RULE: If NITRO_ENCLAVE_REQUIRED=true (the default in production),
 * calling any function in this file will throw an EnclaveBypassError
 * to prevent accidental re-activation of the legacy pipeline.
 *
 * The Rust Enclave MUST be running before the router-service is started.
 */

class EnclaveBypassError extends Error {
  constructor() {
    super(
      "[SECURITY] Legacy Node.js sanitizer invoked while Nitro Enclave is required. " +
      "Set NITRO_ENCLAVE_REQUIRED=false to allow plaintext fallback (NON-PRODUCTION ONLY)."
    );
    this.name = "EnclaveBypassError";
  }
}

function assertEnclaveNotRequired(): void {
  if (process.env.NITRO_ENCLAVE_REQUIRED !== "false") {
    throw new EnclaveBypassError();
  }
}

import { createHash } from "node:crypto";
import nlp from "compromise";

export type RedactionStrategy = "mask" | "hash" | "remove";

export interface RedactionResult {
  sanitized: string;
  deIdMap: Record<string, string>;
  redactionCount: number;
}

const PATTERNS = {
  EMAIL:       /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  PHONE:       /(?:\+?\d{1,3}[\s\-.])?(?:\(?\d{3}\)?[\s\-.])\d{3}[\s\-.]?\d{4}/g,
  CREDIT_CARD: /\b(?:\d[ \-]?){13,16}\b/g,
  SSN:         /\b\d{3}-\d{2}-\d{4}\b/g,
  IP_ADDRESS:  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
} as const;

function sha256Token(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function maskToken(category: string, index: number): string {
  return `[${category}_REDACTED_${String(index + 1).padStart(2, "0")}]`;
}

/**
 * @deprecated Use the Enclave vsock bridge (enclaveClient.sanitize) instead.
 */
export function redactPayload(
  text: string,
  strategy: RedactionStrategy,
  customPatterns: string[] = []
): RedactionResult {
  assertEnclaveNotRequired(); // GUARD: throws in production

  const deIdMap: Record<string, string> = {};
  let redactionCount = 0;
  let result = text;

  function applyPattern(pattern: RegExp, category: string, inputText: string): string {
    const matches = Array.from(new Set(inputText.match(pattern) ?? []));
    let output = inputText;
    matches.forEach((match, idx) => {
      const token = buildToken(match, category, idx, strategy, deIdMap);
      if (token !== null) {
        output = output.split(match).join(token);
        if (strategy !== "remove") deIdMap[token] = match;
        redactionCount++;
      } else {
        output = output.split(match).join("");
        redactionCount++;
      }
    });
    return output;
  }

  result = applyPattern(new RegExp(PATTERNS.EMAIL.source, "gi"),       "EMAIL",       result);
  result = applyPattern(new RegExp(PATTERNS.PHONE.source, "g"),        "PHONE",       result);
  result = applyPattern(new RegExp(PATTERNS.SSN.source, "g"),          "SSN",         result);
  result = applyPattern(new RegExp(PATTERNS.CREDIT_CARD.source, "g"),  "CREDIT_CARD", result);
  result = applyPattern(new RegExp(PATTERNS.IP_ADDRESS.source, "g"),   "IP_ADDRESS",  result);

  try {
    const doc = nlp(result);
    const people: Array<{ text: string }> = doc.people().json() as Array<{ text: string }>;
    Array.from(new Set(people.map((p) => p.text).filter(Boolean))).forEach((name, idx) => {
      if (!name.trim()) return;
      const token = buildToken(name, "PERSON", idx, strategy, deIdMap);
      if (token !== null) { result = result.split(name).join(token); if (strategy !== "remove") deIdMap[token] = name; redactionCount++; }
      else { result = result.split(name).join(""); redactionCount++; }
    });
  } catch (e) { console.warn("[Redactor:DEPRECATED] NLP failed:", (e as Error).message); }

  customPatterns.forEach((patStr, i) => {
    try { result = applyPattern(new RegExp(patStr, "g"), `CUSTOM_${i + 1}`, result); }
    catch { console.warn(`[Redactor:DEPRECATED] Invalid pattern "${patStr}" skipped`); }
  });

  return { sanitized: result, deIdMap, redactionCount };
}

/**
 * @deprecated Use the Enclave vsock bridge (enclaveClient.desanitize) instead.
 */
export function reidentifyResponse(
  text: string,
  deIdMap: Record<string, string>
): string {
  assertEnclaveNotRequired(); // GUARD: throws in production
  let result = text;
  for (const [token, original] of Object.entries(deIdMap).reverse()) {
    result = result.split(token).join(original);
  }
  return result;
}

function buildToken(value: string, category: string, index: number, strategy: RedactionStrategy, _deIdMap: Record<string, string>): string | null {
  if (strategy === "remove") return null;
  if (strategy === "hash") return `[HASH:${sha256Token(value)}]`;
  return maskToken(category, index);
}
