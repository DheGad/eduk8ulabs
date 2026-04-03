/**
 * @file trustSignal.ts
 * @service router-service
 * @version V40
 * @description Trust Signal Calculator
 *
 * Distils the full StreetMP cryptographic context (V25 Trust Score,
 * V36 ZK Certificate, V12 Policy Flags) into a single three-state
 * consumer-facing signal — as universal as the HTTPS padlock.
 *
 * GREEN  — Fully secure. Drop the data.
 * YELLOW — Proceed with awareness. A non-critical action was taken.
 * RED    — Blocked. Do NOT surface the output to the end-user.
 *
 * ADDITIVE ONLY.
 */

export type TrustSignalColor = "GREEN" | "YELLOW" | "RED";

export interface TrustSignal {
  color:       TrustSignalColor;
  label:       string;           // Short human label: "Secure" | "Warning" | "Blocked"
  description: string;           // One-liner shown in the TrustLight popover
  /** Icon emoji shown in the badge */
  icon:        "🟢" | "🟡" | "🔴";
  /** Computed in < 1ms — safe to call on every render */
  computed_at: number;
}

/** Severe flags that will hard-block the signal to RED regardless of score */
const SEVERE_FLAGS = new Set([
  "POLICY_VIOLATION",
  "JAILBREAK_DETECTED",
  "DATA_EXFILTRATION_ATTEMPT",
  "ZK_TAMPERED",
  "CONTAINMENT_ACTIVE",
]);

/** Flags that degrade the signal to YELLOW */
const WARNING_FLAGS = new Set([
  "PII_MASKED",
  "PII_REDACTED",
  "CONTENT_TRUNCATED",
  "MODEL_FALLBACK",
  "LATENCY_HIGH",
  "COST_CEILING_REACHED",
]);

/**
 * Calculates the consumer-facing Trust Light signal.
 *
 * @param trust_score   V25 Global Trust Score (0–100)
 * @param policy_flags  Array of V12 flags raised during execution
 * @param zk_verified   Whether the V36 certificate signature is valid
 */
export function calculateTrustSignal(
  trust_score:  number,
  policy_flags: string[],
  zk_verified:  boolean,
): TrustSignal {
  const flagSet = new Set(policy_flags.map(f => f.toUpperCase()));

  // ── RED: hard-block conditions (any one is sufficient) ───────────
  const hasSevereFlag = [...SEVERE_FLAGS].some(f => flagSet.has(f));
  if (!zk_verified || trust_score < 70 || hasSevereFlag) {
    const reason = !zk_verified
      ? "Certificate tampered"
      : hasSevereFlag
      ? "Critical policy violation"
      : `Trust score critical (${trust_score}/100)`;

    return {
      color:       "RED",
      label:       "Blocked",
      description: reason,
      icon:        "🔴",
      computed_at: Date.now(),
    };
  }

  // ── YELLOW: degraded trust ────────────────────────────────────────
  const hasWarningFlag = [...WARNING_FLAGS].some(f => flagSet.has(f));
  const isWarnScore    = trust_score >= 70 && trust_score < 90;
  if (isWarnScore || hasWarningFlag) {
    const reason = hasWarningFlag
      ? policy_flags.filter(f => WARNING_FLAGS.has(f.toUpperCase())).join(", ")
      : `Trust score advisory (${trust_score}/100)`;

    return {
      color:       "YELLOW",
      label:       "Warning",
      description: reason,
      icon:        "🟡",
      computed_at: Date.now(),
    };
  }

  // ── GREEN: fully secure ───────────────────────────────────────────
  return {
    color:       "GREEN",
    label:       "Secure",
    description: "ZK verified · No policy violations",
    icon:        "🟢",
    computed_at: Date.now(),
  };
}

/** Utility — serialize a TrustSignal for HTTP headers / SDK return values */
export function serializeTrustSignal(signal: TrustSignal): string {
  return `${signal.color};${signal.label};${signal.computed_at}`;
}
