/**
 * @file src/StreetMPClient.ts
 * @package @streetmp/sdk
 * @description StreetMP OS White-Label SDK — Core Client Class.
 *
 * ── Design principles ───────────────────────────────────────────────────────
 *  1. Zero runtime dependencies — uses native fetch (Node ≥18 / browser).
 *  2. Drop-in compatible with the OpenAI Node SDK chat.completions.create()
 *     call signature. Partners can swap baseUrl with a one-line change.
 *  3. Local PII pre-flight scan runs before any network I/O.
 *  4. All StreetMP-specific headers are injected automatically — callers
 *     never touch raw headers.
 *  5. AbortController timeout — no dangling fetch promises.
 *  6. STP certificate verification available as client.stp.verify().
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // BEFORE (raw OpenAI)
 *   const openai = new OpenAI({ apiKey: "sk-..." });
 *   const res = await openai.chat.completions.create({
 *     model: "gpt-4o",
 *     messages: [{ role: "user", content: prompt }],
 *   });
 *
 *   // AFTER (StreetMP SDK — governed AI)
 *   import { StreetMPClient } from "@streetmp/sdk";
 *   const client = new StreetMPClient({
 *     apiKey:   "smp_live_...",
 *     tenantId: "acme-corp",
 *   });
 *   const res = await client.chat.completions.create({
 *     messages: [{ role: "user", content: prompt }],
 *   });
 *   console.log(res.streetmp?.trust_score); // 87.3
 */

import {
  StreetMPClientOptions,
  ChatCompletionRequest,
  ChatCompletionResponse,
  STPVerifyResult,
  StreetMPError,
  StreetMPPiiError,
  StreetMPTimeoutError,
} from "./types.js";
import { detectLocalPii } from "./localPiiGuard.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL  = "https://api.streetmp.com/v1/proxy";
const DEFAULT_TIMEOUT   = 30_000;
const SDK_VERSION       = "1.0.0";

// ─── STP Verifier Sub-Client ──────────────────────────────────────────────────

class StpClient {
  private readonly verifyBase: string;
  private readonly timeout:    number;

  constructor(baseUrl: string, timeout: number) {
    // Strip the /proxy suffix to get the kernel base
    this.verifyBase = baseUrl.replace(/\/api\/proxy\/openai$/, "").replace(/\/v1\/proxy$/, "");
    this.timeout    = timeout;
  }

  /**
   * Verify any STP certificate by execution ID or Merkle leaf hash.
   * Calls GET /api/v1/public/verify/:hash — public, no auth.
   */
  async verify(hash: string): Promise<STPVerifyResult> {
    const url = `${this.verifyBase}/api/v1/public/verify/${encodeURIComponent(hash)}`;
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method:  "GET",
        headers: { "Accept": "application/json", "X-Streetmp-SDK": `@streetmp/sdk@${SDK_VERSION}` },
        signal:  controller.signal,
      });

      if (!res.ok && res.status !== 404) {
        throw new StreetMPError(`Verification failed with status ${res.status}`, "VERIFY_ERROR", res.status);
      }

      const json = await res.json() as { success: boolean; verified?: boolean; protocol?: string; status?: string; certificate?: unknown; attestation?: unknown };

      return {
        verified:    json.verified ?? false,
        protocol:    json.protocol ?? "STP/1.0",
        status:      json.status as "SECURE" | "TAMPERED" | undefined,
        certificate: json.certificate as STPVerifyResult["certificate"],
        attestation: json.attestation as STPVerifyResult["attestation"],
      };
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        throw new StreetMPTimeoutError(this.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Chat Sub-Client ──────────────────────────────────────────────────────────

class ChatCompletionsClient {
  constructor(private readonly parent: StreetMPClient) {}

  /**
   * Create a governed chat completion through the StreetMP proxy.
   *
   * Drop-in replacement for:
   *   openai.chat.completions.create({ messages, model? })
   *
   * Additions:
   *   - Local PII pre-flight check (configurable)
   *   - Automatic x-streetmp-key, x-tenant-id, x-streetmp-partner-id injection
   *   - Returns res.streetmp.* metadata (trust_score, execution_id, etc.)
   *   - Timeout via AbortController
   */
  async create(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const opts = this.parent["_opts"]; // access via private member

    // ── Local PII pre-flight ─────────────────────────────────────────────
    if (opts.localPiiCheck !== false) {
      const pii = detectLocalPii(request.messages);
      if (pii.length > 0) throw new StreetMPPiiError(pii);
    }

    // ── Build request ────────────────────────────────────────────────────
    const headers: Record<string, string> = {
      "Content-Type":          "application/json",
      "Accept":                "application/json",
      "x-streetmp-key":        opts.apiKey,
      "x-tenant-id":           opts.tenantId,
      "x-streetmp-sdk":        `@streetmp/sdk@${SDK_VERSION}`,
    };

    if (opts.partnerId) headers["x-streetmp-partner-id"] = opts.partnerId;
    if (opts.userId)    headers["x-streetmp-user-id"]    = opts.userId;
    if (request.meta)   headers["x-streetmp-meta"]        = JSON.stringify(request.meta);

    const body = {
      model:       request.model ?? "streetmp-auto",
      messages:    request.messages,
      temperature: request.temperature,
      max_tokens:  request.max_tokens,
    };

    // ── Timeout via AbortController ──────────────────────────────────────
    const controller = new AbortController();
    const timeoutMs  = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.parent["_baseUrl"]}/v1/chat/completions`, {
        method:  "POST",
        headers,
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      // Parse error body for upstream errors
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new StreetMPError(
          errJson?.error?.message ?? `Proxy returned HTTP ${res.status}`,
          "PROXY_ERROR",
          res.status,
        );
      }

      const data = await res.json() as ChatCompletionResponse;

      // Attach trace metadata from response headers (if present)
      if (!data.streetmp) (data as unknown as Record<string, unknown>)["streetmp"] = {};
      const traceId     = res.headers.get("x-streetmp-trace-id");
      const execId      = res.headers.get("x-streetmp-execution-id");
      const fingerprint = res.headers.get("x-streetmp-fingerprint");

      if (traceId     && data.streetmp) data.streetmp.trace_id     = traceId;
      if (execId      && data.streetmp) data.streetmp.execution_id = execId;
      if (fingerprint && data.streetmp) data.streetmp.fingerprint  = fingerprint;

      return data;
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") throw new StreetMPTimeoutError(timeoutMs);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Chat Container ───────────────────────────────────────────────────────────

class ChatClient {
  public readonly completions: ChatCompletionsClient;
  constructor(parent: StreetMPClient) {
    this.completions = new ChatCompletionsClient(parent);
  }
}

// ─── Main Client ──────────────────────────────────────────────────────────────

/**
 * StreetMPClient — the primary entry point for the @streetmp/sdk.
 *
 * @example
 * ```typescript
 * import { StreetMPClient } from "@streetmp/sdk";
 *
 * const client = new StreetMPClient({
 *   apiKey:   "smp_live_xxxxxxxxxxxx",
 *   tenantId: "acme-corp",
 *   // Optional white-label / partner ID
 *   partnerId: "fintech-partner-a",
 * });
 *
 * // Governed chat completion (drop-in for openai.chat.completions.create)
 * const res = await client.chat.completions.create({
 *   messages: [{ role: "user", content: "Summarise this quarter's results." }],
 *   model: "gpt-4o",
 * });
 *
 * console.log(res.choices[0].message.content);
 * console.log(res.streetmp?.trust_score); // 87.3 — GOLD
 * console.log(res.streetmp?.execution_id); // exec_a3f8...
 *
 * // Verify an STP certificate
 * const cert = await client.stp.verify("exec_a3f8c2d1e94b7056fe3a");
 * console.log(cert.verified); // true
 * ```
 */
export class StreetMPClient {
  private readonly _opts:    Required<Pick<StreetMPClientOptions, "apiKey" | "tenantId" | "localPiiCheck" | "timeoutMs">>
                           & Omit<StreetMPClientOptions, "apiKey" | "tenantId" | "localPiiCheck" | "timeoutMs">;
  private readonly _baseUrl: string;

  /** Governed chat completion API — mirrors openai.chat */
  public readonly chat: ChatClient;
  /** STP certificate verification API */
  public readonly stp:  StpClient;

  constructor(options: StreetMPClientOptions) {
    if (!options.apiKey)   throw new StreetMPError("apiKey is required.",   "CONFIG_ERROR", 400);
    if (!options.tenantId) throw new StreetMPError("tenantId is required.", "CONFIG_ERROR", 400);

    this._baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

    this._opts = {
      ...options,
      localPiiCheck: options.localPiiCheck ?? true,
      timeoutMs:     options.timeoutMs     ?? DEFAULT_TIMEOUT,
    };

    this.chat = new ChatClient(this);
    this.stp  = new StpClient(this._baseUrl, this._opts.timeoutMs);
  }

  /**
   * Returns the current SDK configuration (without the API key for safety).
   */
  config(): Omit<StreetMPClientOptions, "apiKey"> & { apiKey: "[REDACTED]" } {
    return { ...this._opts, apiKey: "[REDACTED]" };
  }
}
