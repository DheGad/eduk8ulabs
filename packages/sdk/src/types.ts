/**
 * @file src/types.ts
 * @package @streetmp/sdk
 * @description Public type surface for the StreetMP OS SDK.
 *
 * Fully compatible with the OpenAI Node SDK message format so callers
 * can swap their existing openai.chat.completions.create() calls with
 * near-zero code changes.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export interface StreetMPClientOptions {
  /**
   * Your StreetMP API key (x-streetmp-key).
   * Obtain from your dashboard at os.streetmp.com.
   */
  apiKey: string;

  /**
   * Your tenant ID (x-tenant-id). Identifies your organisation in the
   * StreetMP kernel for policy and branding resolution.
   */
  tenantId: string;

  /**
   * Override the StreetMP proxy base URL.
   * Defaults to the StreetMP cloud proxy: https://api.streetmp.com/v1/proxy
   * Set to http://localhost:4000/api/proxy/openai for local dev.
   */
  baseUrl?: string;

  /**
   * Optional: Partner SDK token for white-label use.
   * If present, the kernel emits a PARTNER_SDK_EXECUTION V70 trace event
   * and applies partner branding to public verification pages.
   */
  partnerId?: string;

  /**
   * Timeout for proxy requests in milliseconds.
   * Defaults to 30_000 (30 seconds).
   */
  timeoutMs?: number;

  /**
   * End-user identifier — passed to the kernel as x-streetmp-user-id.
   * Used for per-user audit trail correlation. Never stored alongside
   * prompt content. Optional.
   */
  userId?: string;

  /**
   * Enable local pre-flight PII scanning before sending to the proxy.
   * Defaults to true. Rejected prompts throw a StreetMPPiiError.
   * Set to false to disable (not recommended for production).
   */
  localPiiCheck?: boolean;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role:    MessageRole;
  content: string;
  name?:   string;
}

export interface ChatCompletionRequest {
  /** Messages to send. Mirrors OpenAI Chat Completions format. */
  messages:          ChatMessage[];
  /**
   * Model to use. The StreetMP kernel validates this against the tenant's
   * allowed_models policy and falls back to tenant default if blocked.
   */
  model?:            string;
  /** Sampling temperature. 0–2, default 1. */
  temperature?:      number;
  /** Max tokens for the completion. */
  max_tokens?:       number;
  /** Additional metadata passed in x-streetmp-meta header (JSON). */
  meta?:             Record<string, string | number | boolean>;
}

export interface ChatCompletionChoice {
  index:         number;
  message:       ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionUsage {
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
}

export interface ChatCompletionResponse {
  id:      string;
  object:  "chat.completion";
  created: number;
  model:   string;
  choices: ChatCompletionChoice[];
  usage?:  ChatCompletionUsage;
  /** StreetMP-specific extensions */
  streetmp?: {
    /** V70 correlation trace ID */
    trace_id?:        string;
    /** V36 STP execution certificate ID */
    execution_id?:    string;
    /** V36 fingerprint (12-char ZK signature prefix) */
    fingerprint?:     string;
    /** V25 trust score */
    trust_score?:     number;
    /** V25 trust band */
    trust_band?:      "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "CRITICAL";
    /** Number of PII fields redacted before sending to AI */
    pii_redacted?:    number;
    /** Applied compliance frameworks */
    frameworks?:      string[];
    /** True if NeMo safety check ran */
    nemo_evaluated?:  boolean;
  };
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class StreetMPError extends Error {
  public readonly code:   string;
  public readonly status: number;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name   = "StreetMPError";
    this.code   = code;
    this.status = status;
  }
}

export class StreetMPPiiError extends StreetMPError {
  public readonly detectedPatterns: string[];

  constructor(patterns: string[]) {
    super(
      `Local PII pre-check blocked this request. Detected: ${patterns.join(", ")}. ` +
      "The StreetMP proxy would have redacted these, but local validation prevents " +
      "any sensitive data from leaving your application layer.",
      "LOCAL_PII_BLOCKED",
      400,
    );
    this.name             = "StreetMPPiiError";
    this.detectedPatterns = patterns;
  }
}

export class StreetMPTimeoutError extends StreetMPError {
  constructor(timeoutMs: number) {
    super(`StreetMP proxy request timed out after ${timeoutMs}ms.`, "PROXY_TIMEOUT", 504);
    this.name = "StreetMPTimeoutError";
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface STPVerifyResult {
  verified:         boolean;
  protocol:         string;
  status?:          "SECURE" | "TAMPERED";
  certificate?: {
    execution_id:     string;
    fingerprint:      string;
    issued_at:        string;
    trust_score:      number;
    trust_band:       string;
    model:            string;
    provider:         string;
    region:           string;
    compliance_flags: string[];
    zk_signature:     string;
  };
  attestation?: {
    verified_by:      string;
    algorithm:        string;
    verify_timestamp: string;
  };
}

// ─── Partner Branding ─────────────────────────────────────────────────────────

export interface PartnerBrand {
  partner_id:   string;
  display_name: string;
  logo_url?:    string;
  accent_color?: string;
  verify_tagline?: string;
}
