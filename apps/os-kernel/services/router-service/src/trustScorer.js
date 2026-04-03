/**
 * @file trustScorer.ts
 * @version V25
 * @description V25 Global Trust Score Engine
 *
 * Aggregates all security, compliance, and cryptographic telemetry
 * into a single, immutable "StreetMP Trust Score" (0–100).
 *
 * Algorithm:
 *   Base: 100
 *   − V15 Consensus Penalty  : −10 if quorum was weak (votes barely met threshold)
 *   − V17 Cognitive Penalty  : −(0 to 30) scaled inversely by confidence score
 *   − V12 Policy Penalty     : −5  if no explicit rule matched (fallback / GENERIC)
 *
 * The result is clamped to [0, 100] to prevent under/overflow.
 */
// Rule IDs that represent a fallback / generic match (not a strict policy hit)
const GENERIC_RULE_IDS = new Set([
    "DEFAULT_ALLOW",
    "DEFAULT_DENY",
    "GENERIC",
    "CATCH_ALL",
    "",
]);
// ----------------------------------------------------------------
// CORE ALGORITHM
// ----------------------------------------------------------------
/**
 * Calculates the V25 Global Trust Score for a completed execution.
 *
 * @param context - Telemetry from V12, V15, and V17 subsystems.
 * @returns A { score, breakdown } object. The score is an integer [0, 100].
 */
export function calculateGlobalTrustScore(context) {
    const BASE = 100;
    let v15_penalty = 0;
    let v17_penalty = 0;
    let v12_penalty = 0;
    const audit_notes = [];
    // ---- V15: Byzantine Consensus Penalty ----
    // Deduct 10 pts if the vote count barely met quorum (≤ quorum_required)
    // or if there were any dissenting nodes (indicating possible node divergence).
    if (context.consensus) {
        const { votes, quorum_required, dissenting_count } = context.consensus;
        if (votes <= quorum_required) {
            v15_penalty += 10;
            audit_notes.push(`V15: Weak quorum — ${votes}/${quorum_required} votes met (minimum threshold). −10pts`);
        }
        if (dissenting_count > 0 && v15_penalty === 0) {
            // Dissenting nodes even when quorum was strong — partial flag
            v15_penalty += 5;
            audit_notes.push(`V15: ${dissenting_count} dissenting node(s) detected despite strong quorum. −5pts`);
        }
    }
    else {
        // No consensus data = consensus layer was bypassed entirely
        v15_penalty += 10;
        audit_notes.push("V15: No consensus telemetry available — layer may have been bypassed. −10pts");
    }
    // ---- V17: Cognitive Governor Penalty ----
    // Scale penalty 0–30 inversely to confidence.
    // confidence 100% → penalty 0
    // confidence  70% → penalty 9   (borderline)
    // confidence  50% → penalty 15
    // confidence   0% → penalty 30
    if (context.cognitive) {
        const { confidence, isSafe } = context.cognitive;
        // Clamp confidence to [0, 100]
        const c = Math.max(0, Math.min(100, confidence));
        const raw = Math.round(((100 - c) / 100) * 30);
        v17_penalty = raw;
        if (v17_penalty > 0) {
            audit_notes.push(`V17: Cognitive confidence ${c}% → −${v17_penalty}pts (safety=${isSafe ? "PASS" : "FAIL"})`);
        }
    }
    else {
        // Missing cognitive data — treat as low confidence
        v17_penalty = 15;
        audit_notes.push("V17: No cognitive telemetry available. −15pts");
    }
    // ---- V12: Policy-as-Code Fallback Penalty ----
    // Deduct 5 pts if no specific rule was matched (catch-all / generic fallback).
    if (context.policy) {
        const ruleId = (context.policy.matched_rule_id ?? "").trim().toUpperCase();
        if (GENERIC_RULE_IDS.has(ruleId)) {
            v12_penalty = 5;
            audit_notes.push(`V12: No targeted rule matched (rule_id="${context.policy.matched_rule_id ?? "null"}") — fallback policy applied. −5pts`);
        }
    }
    else {
        // No policy context means policy gate was skipped
        v12_penalty = 5;
        audit_notes.push("V12: No policy telemetry available — policy gate may have been skipped. −5pts");
    }
    // ---- Final Score ----
    const raw = BASE - v15_penalty - v17_penalty - v12_penalty;
    const final_score = Math.max(0, Math.min(100, raw));
    if (audit_notes.length === 0) {
        audit_notes.push("All layers passed cleanly. Full trust maintained.");
    }
    return {
        score: final_score,
        breakdown: {
            base: BASE,
            v15_penalty,
            v17_penalty,
            v12_penalty,
            final_score,
            audit_notes,
        },
    };
}
/**
 * Helper: Returns the human-readable severity band for a trust score.
 */
export function getTrustBand(score) {
    if (score >= 90)
        return "HIGH";
    if (score >= 70)
        return "MEDIUM";
    return "CRITICAL";
}
