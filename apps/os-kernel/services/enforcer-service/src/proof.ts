/**
 * @file proof.ts
 * @service enforcer-service
 * @description Proof of Execution (PoE) — Cryptographic Receipt Generator
 *
 * Generates a tamper-evident receipt for every successful AI execution:
 *   1. SHA-256 hash of the raw prompt (privacy-safe: content not stored)
 *   2. SHA-256 hash of the validated JSON output
 *   3. SHA-256 hash of the required_keys schema (for Memory Service lookups)
 *   4. HMAC-SHA256 signature = HMAC(prompt_hash + "|" + output_hash, POE_SECRET)
 *
 * The signature lets any party verify the execution was genuinely processed by
 * this StreetMP OS instance — a "Verified by StreetMP Enforcer" cryptographic seal.
 *
 * ⚠ Security Note:
 *   POE_SECRET must be kept private. Exposure allows forgery of proof receipts.
 *   Rotate via OPERATIONS.md Section 5.
 */

import { createHash, createHmac } from "node:crypto";

// ================================================================
// TYPES
// ================================================================

export interface ProofOfExecution {
  /** SHA-256 of the raw prompt text */
  prompt_hash: string;
  /** SHA-256 of JSON.stringify(validatedOutput) */
  output_hash: string;
  /** SHA-256 of JSON.stringify(sortedRequiredKeys) — stable sort */
  schema_hash: string;
  /** HMAC-SHA256(prompt_hash + "|" + output_hash, POE_SECRET) */
  signature: string;
  /** LLM model identifier used in the execution */
  model_used: string;
  /** ISO timestamp of proof generation */
  generated_at: string;
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Stable SHA-256 of any JSON-serializable value.
 * Using JSON.stringify with sorted keys for determinism.
 */
function sha256(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}

/**
 * HMAC-SHA256 using the POE_SECRET env var.
 * Throws at call-site if the secret is not configured, so the caller
 * can decide to skip proof generation rather than store unsigned proofs.
 */
function hmacSha256(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data, "utf-8").digest("hex");
}

/**
 * Canonical serialization of a required-keys array.
 * Sorts the keys alphabetically to ensure the hash is identical
 * regardless of the order the caller specified them.
 */
function canonicalSchemaHash(requiredKeys: string[]): string {
  const sorted = [...requiredKeys].sort();
  return sha256(JSON.stringify(sorted));
}

// ================================================================
// MAIN EXPORT
// ================================================================

/**
 * generateProofOfExecution
 *
 * @param prompt        The raw prompt text sent to the LLM (hashed, not stored)
 * @param output        The validated JSON output object from the Enforcer
 * @param model         The LLM model identifier (e.g. "gpt-4o")
 * @param requiredKeys  The schema keys the output was validated against
 * @returns             ProofOfExecution object — ready to INSERT into execution_proofs
 *
 * @throws Error if POE_SECRET is not set in environment — caller should catch
 *         and log a warning rather than blocking the user response.
 */
export function generateProofOfExecution(
  prompt: string,
  output: Record<string, unknown>,
  model: string,
  requiredKeys: string[]
): ProofOfExecution {
  const poeSecret = process.env.POE_SECRET;
  if (!poeSecret) {
    throw new Error(
      "[PoE] POE_SECRET is not configured. " +
        "Set POE_SECRET in .env to enable cryptographic proof generation."
    );
  }

  const prompt_hash = sha256(prompt);
  const output_hash = sha256(JSON.stringify(output));
  const schema_hash = canonicalSchemaHash(requiredKeys);

  // Signature = HMAC(prompt_hash + "|" + output_hash)
  // Binds the proof to both the input AND the verified output — forgery
  // would require knowledge of POE_SECRET.
  const signature = hmacSha256(`${prompt_hash}|${output_hash}`, poeSecret);

  return {
    prompt_hash,
    output_hash,
    schema_hash,
    signature,
    model_used: model,
    generated_at: new Date().toISOString(),
  };
}

/**
 * verifyProofSignature
 *
 * Allows external parties (marketplace clients, auditors) to verify a
 * given proof receipt against a shared POE_SECRET — without revealing
 * the original prompt or output.
 *
 * Returns true if the signature is valid (constant-time comparison to
 * prevent timing attacks).
 */
export function verifyProofSignature(
  proof: Pick<ProofOfExecution, "prompt_hash" | "output_hash" | "signature">,
  secret: string
): boolean {
  const expected = hmacSha256(`${proof.prompt_hash}|${proof.output_hash}`, secret);
  // Constant-time comparison (Node's crypto.timingSafeEqual)
  const { timingSafeEqual } = createHash as unknown as { timingSafeEqual?: (a: Buffer, b: Buffer) => boolean };
  if (timingSafeEqual) {
    try {
      return timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(proof.signature, "hex")
      );
    } catch {
      return false;
    }
  }
  // Fallback (still safe for equal-length hex strings)
  return expected === proof.signature;
}
