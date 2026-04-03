/**
 * @file messages.ts
 * @module StreetMP Extension — Shared Message Types
 * @command COMMAND_094
 *
 * Typed message contracts for chrome.runtime.sendMessage between
 * the content script, background service worker, and popup.
 */

// ─── Message Types ────────────────────────────────────────────────────────────
export type MessageType =
  | "SHADOW_IT_BLOCKED"
  | "SHADOW_IT_WARN"
  | "SHADOW_IT_REDACTED"
  | "STATUS_REQUEST"
  | "STATUS_RESPONSE"
  | "SETTINGS_UPDATE"
  | "TRACE_FLUSH";

// ─── Content → Background: Violation report ───────────────────────────────────
export interface BlockMessage {
  type:        "SHADOW_IT_BLOCKED" | "SHADOW_IT_WARN" | "SHADOW_IT_REDACTED";
  payload: {
    url:         string;
    site:        "ChatGPT" | "Claude" | "Gemini" | "Unknown";
    piiCategories: string[];
    riskScore:   number;
    traceId:     string;
    timestamp:   string;
    promptHash:  string;  // SHA-256 of the prompt (never the plaintext)
  };
}

// ─── Popup → Background: Status request ───────────────────────────────────────
export interface StatusRequestMessage {
  type: "STATUS_REQUEST";
}

// ─── Background → Popup: Status response ──────────────────────────────────────
export interface StatusResponseMessage {
  type: "STATUS_RESPONSE";
  payload: {
    connected:          boolean;
    kernelUrl:          string;
    complianceFrameworks: string[];
    blockedToday:       number;
    warnedToday:        number;
    lastSyncAt:         string | null;
    extensionVersion:   string;
  };
}

export type ExtensionMessage =
  | BlockMessage
  | StatusRequestMessage
  | StatusResponseMessage;

// ─── Storage schema ───────────────────────────────────────────────────────────
export interface ExtensionStorage {
  /** StreetMP OS kernel URL (configured by IT admin) */
  kernelUrl:          string;
  /** Auth token for the extension to talk to the kernel */
  extensionApiKey:    string;
  /** Active APAC/SOC2 compliance frameworks */
  complianceFrameworks: string[];
  /** Whether PII blocking is enabled */
  blockingEnabled:    boolean;
  /** Daily violation counters */
  stats: {
    date:         string;   // YYYY-MM-DD
    blockedCount: number;
    warnedCount:  number;
  };
  /** V70 trace buffer to flush to the kernel */
  traceBuffer: TraceEvent[];
}

export interface TraceEvent {
  event_type:     "SHADOW_IT_BLOCKED" | "SHADOW_IT_WARN" | "SHADOW_IT_REDACTED";
  trace_id:       string;
  timestamp:      string;
  site:           string;
  pii_categories: string[];
  risk_score:     number;
  prompt_hash:    string;
  url:            string;
}

export const DEFAULT_STORAGE: ExtensionStorage = {
  kernelUrl:            "https://os.streetmp.com",
  extensionApiKey:      "",
  complianceFrameworks: ["PDPA", "SOC2"],
  blockingEnabled:      true,
  stats: {
    date:         new Date().toISOString().split("T")[0],
    blockedCount: 0,
    warnedCount:  0,
  },
  traceBuffer: [],
};
