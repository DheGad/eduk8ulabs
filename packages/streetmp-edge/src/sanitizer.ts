/**
 * @file sanitizer.ts
 * @package streetmp-edge
 * @deprecated V5-02 (2026-03-23)
 *
 * ⚠️  DEPRECATED — DO NOT USE IN NEW CODE ⚠️
 *
 * The EdgeSanitizer ran PII detection inside the browser's V8 engine.
 * This approach has been superseded by the Rust Nitro Enclave Sanitizer
 * introduced in V4-03. The Enclave provides hardware-isolated pattern
 * matching that the browser/Node.js layer cannot tamper with.
 *
 * This file is preserved only for audit trail and back-compat reference.
 * No new callers should reference EdgeSanitizer.mask() or .unmask().
 */

export interface SanitizedPayload {
  text: string;
  mapping: Record<string, string>;
}

export interface PiiPattern {
  type: string;
  regex: RegExp;
}

/**
 * @deprecated Replaced by the Rust Enclave sanitizer (V4-03).
 * Use the enclave vsock bridge via enclaveClient.sanitize() instead.
 */
export class EdgeSanitizer {
  static mask(_input: string): SanitizedPayload {
    throw new Error(
      "[DEPRECATED] EdgeSanitizer.mask() is disabled. " +
      "All PII sanitization must go through the Nitro Enclave bridge."
    );
  }

  static unmask(_input: string, _mapping: Record<string, string>): string {
    throw new Error(
      "[DEPRECATED] EdgeSanitizer.unmask() is disabled. " +
      "All PII desanitization must go through the Nitro Enclave bridge."
    );
  }
}
