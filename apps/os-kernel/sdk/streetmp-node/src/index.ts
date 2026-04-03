/**
 * @file index.ts
 * @package streetmp-node
 * @version V39
 * @description Official StreetMP Node.js SDK
 *
 * Zero-friction integration — import, init, run:
 *
 *   import { StreetMP } from 'streetmp';
 *
 *   const client = new StreetMP('stmp_your_key');
 *
 *   const result = await client.secureRun({
 *     prompt: "Summarise this document.",
 *     model:  "streetmp-auto",  // optional — defaults to auto-routing
 *   });
 *
 *   console.log(result.output);          // AI response
 *   console.log(result.certificate);     // V36 ZK certificate
 *   console.log(result.trustScore);      // V25 Trust Score (0-100)
 */

import { createHmac } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecureRunOptions {
  /** The prompt to execute */
  prompt: string;
  /** Model to use — defaults to "streetmp-auto" for intelligent routing */
  model?: string;
  /** Data classification — defaults to "INTERNAL" */
  classification?: "TOP_SECRET" | "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";
  /** Timeout in ms — defaults to 30,000 */
  timeoutMs?: number;
  /** Custom metadata (not logged — passed through as headers) */
  metadata?: Record<string, string>;
}

export interface ZKCertificate {
  execution_id:     string;
  fingerprint:      string;
  trust_band:       "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "CRITICAL";
  verify_url:       string;
  /** Whether the certificate was cryptographically verified client-side */
  client_verified:  boolean;
}

export interface SecureRunResult {
  /** The AI response text */
  output:          string;
  /** Raw response data */
  data:            Record<string, unknown>;
  /** V25 Trust Score (0–100) */
  trustScore:      number;
  /** Human-readable trust band */
  trustBand:       string;
  /** V36 ZK Execution Certificate */
  certificate:     ZKCertificate | null;
  /** Route used (provider/model) */
  routing:         string;
  /** End-to-end latency in ms */
  latencyMs:       number;
}

export interface StreetMPConfig {
  /** Base URL — defaults to https://api.streetmp.com */
  baseUrl?:        string;
  /** Default model — defaults to "streetmp-auto" */
  defaultModel?:   string;
  /** Signing key for local ZK cert verification — optional but recommended */
  certSigningKey?: string;
}

// ─── SDK Class ────────────────────────────────────────────────────────────────

export class StreetMP {
  private readonly apiKey:        string;
  private readonly baseUrl:       string;
  private readonly defaultModel:  string;
  private readonly certSigningKey?: string;

  constructor(apiKey: string, config: StreetMPConfig = {}) {
    if (!apiKey || !apiKey.startsWith("smp_")) {
      throw new Error(
        "[StreetMP SDK] Invalid API key format. Keys must begin with 'smp_'. " +
        "Get your key at https://app.streetmp.com/dashboard/admin/keys"
      );
    }
    this.apiKey       = apiKey;
    this.baseUrl       = (config.baseUrl       ?? "http://localhost:4000").replace(/\/$/, "");
    this.defaultModel  = config.defaultModel   ?? "streetmp-auto";
    this.certSigningKey = config.certSigningKey;
  }

  /**
   * Execute a prompt through the full StreetMP OS pipeline:
   * V12 → V22 → V25 → V36 → response
   *
   * Automatically parses and validates the V36 ZK certificate.
   */
  async secureRun(options: SecureRunOptions): Promise<SecureRunResult> {
    const startMs  = Date.now();
    const model    = options.model ?? this.defaultModel;
    const timeout  = options.timeoutMs ?? 30_000;

    const headers: Record<string, string> = {
      "Content-Type":           "application/json",
      "Authorization":          `Bearer ${this.apiKey}`,
      "x-api-key":              this.apiKey,
      "x-data-classification":  options.classification ?? "INTERNAL",
      ...options.metadata,
    };

    const body = JSON.stringify({
      model,
      messages: [{ role: "user", content: options.prompt }],
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/proxy/openai/v1/chat/completions`,
        { method: "POST", headers, body, signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as any;
      throw new StreetMPError(
        errBody?.error?.message ?? `HTTP ${response.status}`,
        response.status,
        errBody?.error?.code ?? "API_ERROR"
      );
    }

    const json      = await response.json() as any;
    const latencyMs = Date.now() - startMs;

    // Extract V25 trust headers
    const trustScore = parseInt(response.headers.get("x-streetmp-trust-score") ?? "0", 10);
    const trustBand  = response.headers.get("x-streetmp-trust-band") ?? "UNKNOWN";
    const routing    = response.headers.get("x-streetmp-routing")    ?? "unknown";

    // Parse and verify V36 ZK Certificate
    const execId    = response.headers.get("x-streetmp-execution-id") ?? json?.streetmp?.execution_certificate?.execution_id;
    const signature = response.headers.get("x-streetmp-signature")    ?? "";
    const certObj   = json?.streetmp?.execution_certificate ?? null;

    const certificate: ZKCertificate | null = certObj ? {
      execution_id:    certObj.execution_id ?? execId,
      fingerprint:     certObj.fingerprint  ?? signature.slice(0, 12).toUpperCase(),
      trust_band:      certObj.trust_band   ?? "SILVER",
      verify_url:      certObj.verify_url   ?? `/verify/${execId}`,
      client_verified: this.verifyCertSignature(certObj, signature),
    } : null;

    // Extract output text from OpenAI-schema response
    const output = json?.choices?.[0]?.message?.content ?? "";

    return {
      output,
      data:      json?.streetmp ?? json,
      trustScore,
      trustBand,
      certificate,
      routing,
      latencyMs,
    };
  }

  /**
   * Verify the V36 certificate signature client-side.
   * Requires `certSigningKey` to be set in config — otherwise returns false.
   */
  private verifyCertSignature(cert: any, storedSignature: string): boolean {
    if (!this.certSigningKey || !cert || !storedSignature) return false;
    try {
      const canonical = [
        `execution_id=${cert.execution_id}`,
        `issued_at=${cert.issued_at ?? ""}`,
        `trust_score=${cert.trust_score ?? 0}`,
        `compliance_flags=${[...(cert.compliance_flags ?? [])].sort().join(",")}`,
        `region=${cert.region ?? "eu-west-1"}`,
        `model=${cert.model ?? ""}`,
        `provider=${cert.provider ?? ""}`,
      ].join("|");

      const expected = createHmac("sha256", this.certSigningKey).update(canonical).digest("hex");
      return expected === storedSignature;
    } catch {
      return false;
    }
  }

  /**
   * Health-check the proxy endpoint.
   * Returns true if the StreetMP OS is reachable and responding.
   */
  async ping(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const startMs = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      return { ok: res.ok, latencyMs: Date.now() - startMs, message: res.ok ? "StreetMP Proxy Active" : "Proxy returned non-200" };
    } catch (e: any) {
      return { ok: false, latencyMs: Date.now() - startMs, message: e.message ?? "Connection failed" };
    }
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class StreetMPError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(`[StreetMP SDK] ${message}`);
    this.name = "StreetMPError";
  }
}
