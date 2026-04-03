/**
 * @file utils/logger.ts
 * @service router-service (global)
 * @phase Phase 6 — Titan Hardening
 * @description
 *   PII-safe structured logger. ALL console output in the router-service
 *   must route through this module. Direct console.log/warn/error calls
 *   with raw user data are PROHIBITED after Phase 6.
 *
 *   Masking rules (applied in order before any string hits disk):
 *     • Email addresses       → user***@***.***
 *     • GSTIN (Indian tax)    → [GSTIN REDACTED]
 *     • API keys (smp_live_/smp_test_/sk_live_/sk_test_/rzp_live_/rzp_test_)
 *                             → smp_live_[REDACTED]
 *     • Bearer tokens         → Bearer [REDACTED]
 *     • x-api-key values      → [API-KEY REDACTED]
 *     • JWT segments          → [JWT REDACTED]
 *     • Raw IPv4 in logs      → x.x.x.[last-octet] (partial, for debugging)
 *     • Credit card patterns  → [CC REDACTED]
 *     • Generic secrets       → any 40+ char hex/base64 → [SECRET REDACTED]
 *
 *   Usage:
 *     import { log } from "../utils/logger.js";
 *     log.info("Payment processed", { org_id: "...", plan: "pro" });
 *     log.warn("Quota exceeded", { org_id: "...", used: 50001 });
 *     log.error("DB failure", err);
 *
 *   Structured output format (JSON lines when NODE_ENV=production):
 *     {"ts":"2026-04-03T00:00:00Z","level":"info","msg":"...","ctx":{...}}
 *
 *   Human-readable format in development:
 *     [2026-04-03T00:00:00Z] INFO  Payment processed { org_id: "...", plan: "pro" }
 */

import { EventEmitter } from "events";

export const titanLogStream = new EventEmitter();

// ── PII Masking Patterns ──────────────────────────────────────────────────────

interface MaskRule {
  name:        string;
  pattern:     RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
}

const MASK_RULES: MaskRule[] = [
  // API key prefixes (smp_live_, smp_test_, rzp_live_, rzp_test_, sk_live_, sk_test_)
  {
    name:        "api_key_prefixed",
    pattern:     /\b(smp_live_|smp_test_|rzp_live_|rzp_test_|sk_live_|sk_test_|rk_live_|rk_test_)\w+/gi,
    replacement: (_m: string, prefix: string) => `${prefix}[REDACTED]`,
  },
  // Bearer / Authorization tokens
  {
    name:        "bearer_token",
    pattern:     /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi,
    replacement: "Bearer [REDACTED]",
  },
  // JWT (3 base64url segments separated by dots)
  {
    name:        "jwt",
    pattern:     /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g,
    replacement: "[JWT REDACTED]",
  },
  // GSTIN (Indian 15-char format: 22AAAAA0000A1Z5)
  {
    name:        "gstin",
    pattern:     /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g,
    replacement: "[GSTIN REDACTED]",
  },
  // Email addresses
  {
    name:        "email",
    pattern:     /([a-zA-Z0-9._%+\-]{1,3})[a-zA-Z0-9._%+\-]*@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g,
    replacement: (_m: string, prefix: string, domain: string) =>
      `${prefix}***@${domain.split(".").map((_p, i) => i > 0 ? "***" : _p).join(".")}`,
  },
  // Generic long hex/base64 secrets (40+ chars) — catches DB passwords, signing keys etc.
  {
    name:        "generic_secret",
    pattern:     /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
    replacement: "[SECRET REDACTED]",
  },
  // Credit card number patterns (13-19 digits, possibly grouped with spaces/dashes)
  {
    name:        "credit_card",
    pattern:     /\b(?:\d[ \-]?){13,19}\b/g,
    replacement: "[CC REDACTED]",
  },
  // US Social Security Number (SSN): 123-45-6789 or 123 45 6789
  {
    name:        "ssn",
    pattern:     /\b\d{3}[\- ]\d{2}[\- ]\d{4}\b/g,
    replacement: "[SSN REDACTED]",
  },
  // Phone numbers: +91-9876543210, (555) 123-4567, +1 800 555 1234, 9876543210
  {
    name:        "phone",
    pattern:     /(\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
    replacement: "[PHONE REDACTED]",
  },
  // UK National Insurance Number: AB 12 34 56 C
  {
    name:        "uk_nin",
    pattern:     /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g,
    replacement: "[NIN REDACTED]",
  },
  // Partial IPv4 masking — keep last octet for geo-debugging, mask first 3
  {
    name:        "ipv4_partial",
    pattern:     /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    replacement: (_m: string, _a: string, _b: string, _c: string, d: string) =>
      `x.x.x.${d}`,
  },
  // x-api-key header value in log strings like `x-api-key: abc123`
  {
    name:        "x_api_key_header",
    pattern:     /(x-api-key[:\s]+)[^\s,"}'\]]+/gi,
    replacement: "$1[API-KEY REDACTED]",
  },
  // Postgres connection strings
  {
    name:        "postgres_url",
    pattern:     /postgres(?:ql)?:\/\/[^\s"']+/gi,
    replacement: "postgres://[REDACTED]",
  },
];

// ── Core masking function ─────────────────────────────────────────────────────

export function maskPII(input: unknown): string {
  if (input === null || input === undefined) return String(input);

  let str: string;
  try {
    str = typeof input === "string"
      ? input
      : JSON.stringify(input, (_key, val) => {
          // During stringify, redact known sensitive key names
          if (typeof _key === "string" && SENSITIVE_KEY_NAMES.has(_key.toLowerCase())) {
            return "[REDACTED]";
          }
          return val;
        });
  } catch {
    str = String(input);
  }

  // Apply each mask rule in sequence
  for (const rule of MASK_RULES) {
    try {
      str = str.replace(rule.pattern, rule.replacement as string);
    } catch {
      // Regex failure is non-fatal — skip this rule
    }
  }

  return str;
}

/** JSON keys that should never appear in logs — value always redacted */
const SENSITIVE_KEY_NAMES = new Set([
  "password", "passwd", "secret", "key_secret", "api_key",
  "authorization", "token", "access_token", "refresh_token",
  "razorpay_signature", "signing_secret", "signing_secret_hash",
  "stripe_secret_key", "x-api-key", "x-admin-secret",
  "gstin", "credit_card", "card_number", "cvv",
  "backup_encrypt_key", "vault_master_key",
]);

// ── Log levels ────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const IS_JSON = process.env.NODE_ENV === "production" || process.env.LOG_FORMAT === "json";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatJson(
  level:   LogLevel,
  message: string,
  context: Record<string, unknown> | undefined,
  err:     Error | undefined
): string {
  const entry: Record<string, unknown> = {
    ts:  new Date().toISOString(),
    level,
    msg: maskPII(message),
  };
  if (context) entry.ctx = JSON.parse(maskPII(context));
  if (err) {
    entry.err = {
      name:    err.name,
      message: maskPII(err.message),
      stack:   err.stack ? maskPII(err.stack) : undefined,
    };
  }
  return JSON.stringify(entry);
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "\x1b[35mDEBUG\x1b[0m",
  info:  "\x1b[36mINFO \x1b[0m",
  warn:  "\x1b[33mWARN \x1b[0m",
  error: "\x1b[31mERROR\x1b[0m",
};

function formatHuman(
  level:   LogLevel,
  message: string,
  context: Record<string, unknown> | undefined,
  err:     Error | undefined
): string {
  const ts    = new Date().toISOString();
  const label = LEVEL_LABELS[level];
  const msg   = maskPII(message);
  const ctx   = context ? `  ${maskPII(context)}` : "";
  const errStr = err ? `\n  ${maskPII(err.message)}\n  ${maskPII(err.stack ?? "")}` : "";
  return `[${ts}] ${label}  ${msg}${ctx}${errStr}`;
}

// ── Core write function ───────────────────────────────────────────────────────

function write(
  level:   LogLevel,
  message: string,
  context?: Record<string, unknown>,
  err?:    Error
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;

  const jsonLine = formatJson(level, message, context, err);
  const humanLine = formatHuman(level, message, context, err);
  
  const line = IS_JSON ? jsonLine : humanLine;

  // Broadcast the JSON stringified scrubbed log to the Titan UI
  titanLogStream.emit("log", jsonLine);

  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>)           => write("debug", msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>)           => write("info",  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>)           => write("warn",  msg, ctx),
  error: (msg: string, err?: Error, ctx?: Record<string, unknown>) =>
    write("error", msg, ctx, err),
};

/**
 * Express request logger middleware — PII-safe.
 * Replaces the raw `console.log` middleware in index.ts.
 *
 * Logs: method, path (query params stripped), status, duration.
 * Does NOT log: request body, headers, IP (only country code if geo is available).
 */
export function piiSafeRequestLogger(
  req:  import("express").Request,
  res:  import("express").Response,
  next: import("express").NextFunction
): void {
  const start = Date.now();
  // Strip query string from path to avoid logging PII in query params
  const safePath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level: LogLevel =
      res.statusCode >= 500 ? "error" :
      res.statusCode >= 400 ? "warn"  :
      "info";

    write(level, `${req.method} ${safePath}`, {
      status:    res.statusCode,
      duration:  `${duration}ms`,
      trace_id:  (req as Record<string, unknown>).traceId as string | undefined,
    });
  });

  next();
}
