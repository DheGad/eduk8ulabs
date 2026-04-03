/**
 * @file promptFirewall.ts
 * @service os-kernel/services/security
 * @version V71
 * @description Prompt Firewall — Adversarial Injection Detection Engine
 *
 * Implements a heuristic scoring engine that runs ALL injection signatures
 * against an incoming prompt and returns a structured FirewallVerdict.
 *
 * ================================================================
 * SCORING MODEL
 * ================================================================
 *
 *   Each matched signature contributes its score to a cumulative total.
 *   The final aggregate score maps to one of three verdicts:
 *
 *   │ Score        │ Verdict │ Action                                   │
 *   ├──────────────┼─────────┼──────────────────────────────────────────┤
 *   │  0 – 29      │ ALLOW   │ Prompt proceeds normally                 │
 *   │ 30 – 99      │ WARN    │ Logged, tenant alerted, prompt continues │
 *   │ 100+         │ BLOCK   │ 403 returned, LLM never called           │
 *
 * ================================================================
 * PERFORMANCE CONTRACT (< 5ms)
 * ================================================================
 *
 *   • All RegExp objects are pre-compiled at module load (not per call)
 *   • Short-circuit: stops scanning after first CRITICAL match to avoid
 *     spending CPU on additional patterns that can't change a BLOCK verdict
 *   • Max prompt length checked: 50,000 chars (matches V67 clamp)
 *
 * ================================================================
 * TENANT CONTEXT (future)
 * ================================================================
 *
 *   tenantId is accepted for future use: tenant-specific allowlists or
 *   custom signature sets (e.g., defence tenants may allow role-play
 *   for red-team simulation purposes under a signed policy override).
 *   Currently all tenants share the global signature set.
 */

import {
  ALL_SIGNATURES,
  BLOCK_THRESHOLD,
  WARN_THRESHOLD,
  type InjectionSignature,
  type InjectionCategory,
} from "./injectionPatterns.js";

// ================================================================
// TYPES
// ================================================================

export type FirewallVerdict = "ALLOW" | "WARN" | "BLOCK";

export interface FirewallMatch {
  /** Stable signature identifier (e.g. "SYS_OVERRIDE_001") */
  signatureId: string;
  category:    InjectionCategory;
  score:       number;
  context:     string;
  /** The exact substring that triggered the match */
  matchedText: string;
}

export interface FirewallResult {
  verdict:        FirewallVerdict;
  /** Aggregate risk score across all matched patterns */
  totalScore:     number;
  /** All signatures that fired, sorted by score descending */
  matches:        FirewallMatch[];
  /** Latency of the evaluation in milliseconds */
  latencyMs:      number;
  /** Tenant context — for audit trails and custom policies */
  tenantId:       string;
  /** If BLOCK: a human-readable reason for the UI response body */
  blockReason?:   string;
}

// ================================================================
// CORE ENGINE
// ================================================================

/**
 * Maximum prompt length passed to the firewall engine.
 * Matches the V67 DLP clamp — prompts longer than this have already
 * been truncated before entering the security pipeline.
 */
const MAX_EVAL_LENGTH = 50_000;

/**
 * Run the full adversarial injection analysis against a single prompt.
 *
 * @param prompt   - The (potentially DLP-scrubbed) prompt string
 * @param tenantId - Tenant identifier, forwarded into the audit result
 * @returns FirewallResult with verdict, all matches, and latency
 */
export function evaluatePromptSafety(
  prompt:   string,
  tenantId: string
): FirewallResult {
  const startMs = performance.now();

  // Safety clamp — should already be done by V67, but belt-and-suspenders
  const evalTarget = prompt.length > MAX_EVAL_LENGTH
    ? prompt.slice(0, MAX_EVAL_LENGTH)
    : prompt;

  const matches: FirewallMatch[] = [];
  let totalScore = 0;
  let shortCircuited = false;

  for (const sig of ALL_SIGNATURES) {
    // Short-circuit: once we're at or above BLOCK_THRESHOLD, no need
    // to run remaining patterns — we'll block regardless.
    if (totalScore >= BLOCK_THRESHOLD) {
      shortCircuited = true;
      break;
    }

    const result = tryMatch(sig, evalTarget);
    if (result) {
      matches.push(result);
      totalScore += sig.score;
    }
  }

  const latencyMs = parseFloat((performance.now() - startMs).toFixed(3));

  // Determine verdict
  let verdict: FirewallVerdict;
  if (totalScore >= BLOCK_THRESHOLD) {
    verdict = "BLOCK";
  } else if (totalScore >= WARN_THRESHOLD) {
    verdict = "WARN";
  } else {
    verdict = "ALLOW";
  }

  // Sort matches by descending score severity for clean audit logs
  matches.sort((a, b) => b.score - a.score);

  const topMatch = matches[0];
  const blockReason = verdict === "BLOCK" && topMatch
    ? `Prompt Injection Detected [${topMatch.signatureId}]: ${topMatch.context}`
    : undefined;

  // System log — always emitted regardless of verdict
  if (verdict !== "ALLOW") {
    const sigIds = matches.map((m) => m.signatureId).join(", ");
    console.warn(
      `[V71:PromptFirewall] ${verdict} | tenant=${tenantId} ` +
      `score=${totalScore} signatures=[${sigIds}] latency=${latencyMs}ms ` +
      `${shortCircuited ? "(short-circuited)" : ""}`
    );
  }

  return {
    verdict,
    totalScore,
    matches,
    latencyMs,
    tenantId,
    blockReason,
  };
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Attempts to match a single signature against the prompt.
 * Returns a FirewallMatch if the pattern fires, otherwise null.
 *
 * Uses `pattern.exec()` with a reset lastIndex to avoid state pollution
 * on non-global RegExps (which is the case for all V71 patterns).
 */
function tryMatch(sig: InjectionSignature, prompt: string): FirewallMatch | null {
  try {
    // Reset lastIndex for safety — though patterns are non-global
    sig.pattern.lastIndex = 0;
    const match = sig.pattern.exec(prompt);
    if (!match) return null;

    // Extract matched text, clamped so the log line doesn't balloon
    const raw = match[0] ?? "";
    const matchedText = raw.length > 120 ? raw.slice(0, 120) + "…" : raw;

    return {
      signatureId: sig.id,
      category:    sig.category,
      score:       sig.score,
      context:     sig.context,
      matchedText,
    };
  } catch {
    // Regex execution should never throw but guard defensively
    return null;
  }
}
