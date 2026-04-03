/**
 * @file nemoBridge.ts
 * @service router-service
 * @description V81 — TypeScript bridge to the NeMo Guardrails Python sidecar.
 *
 * Design contract
 * ───────────────
 *  - Fail-open: any fetch error, timeout, or unexpected response MUST return
 *    { safe: true } so the sidecar being down NEVER bricks the pipeline.
 *  - Strict 2 000 ms timeout via AbortController (no library dependency).
 *  - All failure states are logged at WARN so ops teams can detect sidecar
 *    drift without the router service surfacing errors to callers.
 *  - The existing V71 Prompt Firewall remains the primary synchronous guard;
 *    NeMo is a secondary, async-capable deep check.
 */

/** Result returned by evaluateWithNeMo() to the caller in routes.ts. */
export interface NemoResult {
  /** Whether the prompt passed the NeMo content-safety check. */
  safe: boolean;
  /** Human-readable reason string — present on both BLOCK and fail-open paths. */
  reason: string;
  /** True if NeMo actually ran and evaluated the prompt; false on fail-open. */
  nemo_evaluated: boolean;
}

const NEMO_SIDECAR_URL =
  process.env.NEMO_SIDECAR_URL ?? "http://localhost:8000/v1/guard";

const NEMO_TIMEOUT_MS = 2_000;

/**
 * Evaluate a prompt against the NeMo Guardrails sidecar.
 *
 * Fail-open guarantee: if the sidecar is unreachable, times out, or returns
 * an unexpected payload, this function ALWAYS returns { safe: true } so the
 * router pipeline continues uninterrupted.
 *
 * @param prompt The (already DLP-scrubbed, V71-cleared) prompt text.
 * @returns NemoResult — evaluation outcome or fail-open sentinel.
 */
export async function evaluateWithNeMo(prompt: string): Promise<NemoResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEMO_TIMEOUT_MS);

  try {
    const response = await fetch(NEMO_SIDECAR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(
        `[V81:NemoBridge] Sidecar returned HTTP ${response.status} — fail-open`
      );
      return {
        safe: true,
        reason: `NeMo sidecar HTTP ${response.status} — fail-open`,
        nemo_evaluated: false,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Validate the response shape defensively; treat malformed replies as fail-open.
    if (typeof data.safe !== "boolean" || typeof data.reason !== "string") {
      console.warn(
        "[V81:NemoBridge] Unexpected sidecar response shape — fail-open",
        data
      );
      return {
        safe: true,
        reason: "NeMo sidecar malformed response — fail-open",
        nemo_evaluated: false,
      };
    }

    return {
      safe: data.safe,
      reason: data.reason,
      nemo_evaluated: typeof data.nemo_evaluated === "boolean" ? data.nemo_evaluated : true,
    };
  } catch (err: unknown) {
    clearTimeout(timer);

    const isTimeout =
      err instanceof Error && err.name === "AbortError";

    const reason = isTimeout
      ? `NeMo sidecar timeout (>${NEMO_TIMEOUT_MS}ms) — fail-open`
      : `NeMo sidecar unreachable — fail-open`;

    console.warn(`[V81:NemoBridge] ${reason}`);

    return { safe: true, reason, nemo_evaluated: false };
  }
}
