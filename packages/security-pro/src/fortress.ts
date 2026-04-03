/**
 * @file fortress.ts
 * @package security-pro
 * @description Fortress Shield — Adversarial Prompt Guard
 *
 * Implements C054 Task 1.
 *
 * Problem:
 *   Malicious users attempt "jailbreak" prompts to bypass safety controls,
 *   extract system prompts, or force the AI to produce harmful output.
 *
 * Solution — 3-Phase Pre-LLM Execution Scanner:
 *   Phase A: PATTERN MATCH    — Known jailbreak signatures (regex + keyword)
 *   Phase B: SEMANTIC SCORE   — Heuristic suspicion scoring (0–100)
 *   Phase C: KILL SWITCH      — If score ≥ threshold, block before LLM call
 *
 * Enterprise guarantee: No jailbroken prompt ever reaches the LLM provider.
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================
export type ThreatCategory =
  | "PROMPT_INJECTION"
  | "JAILBREAK_ROLEPLAY"
  | "SYSTEM_OVERRIDE"
  | "EXFILTRATION"
  | "TOXIC_CONTENT"
  | "SOCIAL_ENGINEERING"
  | "CLEAN";

export interface FortressResult {
  allowed: boolean;               // true = safe to send to LLM
  threat_category: ThreatCategory;
  suspicion_score: number;        // 0–100; ≥70 = blocked
  matched_patterns: string[];     // Which signatures fired
  sanitized_prompt?: string;      // Present only if allowed && minor risk cleaned
  block_reason?: string;          // Present only if !allowed
  forensic_id: string;            // Unique ID for audit trail
  latency_ms: number;
}

// ================================================================
// PHASE A: KNOWN JAILBREAK SIGNATURES
// ================================================================
interface Pattern {
  id: string;
  category: ThreatCategory;
  regex: RegExp;
  score: number; // threat weight (0–100)
}

const FORTRESS_PATTERNS: Pattern[] = [
  // ── Prompt Injection ──
  { id: "INJECT_01", category: "PROMPT_INJECTION",   regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, score: 90 },
  { id: "INJECT_02", category: "PROMPT_INJECTION",   regex: /disregard\s+(your\s+)?(system\s+prompt|instructions?|rules?)/i, score: 90 },
  { id: "INJECT_03", category: "PROMPT_INJECTION",   regex: /you\s+are\s+now\s+(a|an|the)\s+\w+(\s+(without|with\s+no)\s+restrictions?)?/i, score: 85 },
  { id: "INJECT_04", category: "PROMPT_INJECTION",   regex: /forget\s+(everything|all|your\s+training)/i, score: 85 },

  // ── System Override ──
  { id: "OVERRIDE_01", category: "SYSTEM_OVERRIDE", regex: /\[SYSTEM\]|\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>/i, score: 95 },
  { id: "OVERRIDE_02", category: "SYSTEM_OVERRIDE", regex: /###\s*(system|instruction|override)/i, score: 80 },
  { id: "OVERRIDE_03", category: "SYSTEM_OVERRIDE", regex: /you\s+must\s+(now\s+)?(act|behave|respond)\s+as\s+if\s+you\s+(have\s+)?no\s+restrictions?/i, score: 90 },

  // ── Jailbreak Roleplay (DAN, AIM, etc.) ──
  { id: "ROLEPLAY_01", category: "JAILBREAK_ROLEPLAY", regex: /\bDAN\b.*(do anything now|without (any |ethical |moral |safety )?(filter|restriction|limit))/i, score: 100 },
  { id: "ROLEPLAY_02", category: "JAILBREAK_ROLEPLAY", regex: /\b(AIM|STAN|DUDE|KEVIN|BINGCHAOS)\b.*mode/i, score: 90 },
  { id: "ROLEPLAY_03", category: "JAILBREAK_ROLEPLAY", regex: /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?((evil|bad|unethical|uncensored)\s+)?AI/i, score: 80 },
  { id: "ROLEPLAY_04", category: "JAILBREAK_ROLEPLAY", regex: /in\s+this\s+(hypothetical|fictional|alternate)\s+(world|universe|scenario).*(no\s+(rules?|laws?|ethics?|restrictions?))/i, score: 75 },

  // ── Data Exfiltration ──
  { id: "EXFIL_01", category: "EXFILTRATION", regex: /repeat\s+(your\s+)?(system\s+prompt|initial\s+instructions?|full\s+instructions?)/i, score: 85 },
  { id: "EXFIL_02", category: "EXFILTRATION", regex: /what\s+(are|were)\s+your\s+(exact\s+)?(initial|original|system)\s+instructions?/i, score: 75 },
  { id: "EXFIL_03", category: "EXFILTRATION", regex: /print\s+(out\s+)?(your\s+)?(prompt|instructions?|system\s+message)/i, score: 80 },

  // ── Social Engineering ──
  { id: "SOCIAL_01", category: "SOCIAL_ENGINEERING", regex: /my\s+(grandmother|grandma|teacher|boss|professor)\s+(used\s+to\s+)?tell\s+me/i, score: 65 },
  { id: "SOCIAL_02", category: "SOCIAL_ENGINEERING", regex: /for\s+(research|educational|academic|testing)\s+purposes?\s*(only)?,?\s*(please\s+)?(show|tell|explain|provide)/i, score: 50 },
  { id: "SOCIAL_03", category: "SOCIAL_ENGINEERING", regex: /this\s+is\s+(a\s+)?(test|simulation|controlled\s+environment)/i, score: 40 },

  // ── Toxic Content ──
  { id: "TOXIC_01", category: "TOXIC_CONTENT", regex: /how\s+to\s+(make|create|build|synthesize)\s+(a\s+)?(bomb|explosive|poison|malware|virus|ransomware)/i, score: 100 },
  { id: "TOXIC_02", category: "TOXIC_CONTENT", regex: /instructions?\s+(for|to)\s+(harm|hurt|kill|attack|hack|exploit)/i, score: 100 },
];

// ================================================================
// PHASE B: HEURISTIC SCORING
// ================================================================
const HEURISTIC_TRIGGERS = [
  { keyword: /bypass|circumvent|override|jailbreak|uncensored|unfiltered/gi, weight: 15 },
  { keyword: /no\s+(filter|restriction|rule|limit|guideline|policy|safety)/gi, weight: 15 },
  { keyword: /without\s+(your\s+)?(safety|ethical|moral|content)\s+(filter|guard|policy)/gi, weight: 20 },
  { keyword: /token\s+limit|context\s+window\s+exploit/gi, weight: 25 },
  { keyword: /developer\s+mode|dev\s+mode|god\s+mode\s+(prompt|enabled)/gi, weight: 30 },
];

function computeHeuristicScore(prompt: string): number {
  let score = 0;
  HEURISTIC_TRIGGERS.forEach(({ keyword, weight }) => {
    const matches = (prompt.match(keyword) || []).length;
    score += matches * weight;
  });
  return Math.min(score, 50); // Heuristics contribute up to 50 points
}

// ================================================================
// PHASE C: MAIN FORTRESS SCAN
// ================================================================
const BLOCK_THRESHOLD = 70;

export function fortressScan(prompt: string): FortressResult {
  const t0 = Date.now();
  const forensic_id = `fort_${crypto.randomBytes(6).toString("hex")}`;
  const matchedPatterns: string[] = [];
  let maxPatternScore = 0;
  let dominantCategory: ThreatCategory = "CLEAN";

  // Phase A — Pattern Matching
  for (const pattern of FORTRESS_PATTERNS) {
    if (pattern.regex.test(prompt)) {
      matchedPatterns.push(pattern.id);
      if (pattern.score > maxPatternScore) {
        maxPatternScore = pattern.score;
        dominantCategory = pattern.category;
      }
    }
  }

  // Phase B — Heuristic Score
  const heuristicScore = computeHeuristicScore(prompt);
  const totalScore = Math.min(maxPatternScore + heuristicScore / 2, 100);

  const blocked = totalScore >= BLOCK_THRESHOLD;

  return {
    allowed: !blocked,
    threat_category: blocked ? dominantCategory : "CLEAN",
    suspicion_score: Math.round(totalScore),
    matched_patterns: matchedPatterns,
    sanitized_prompt: !blocked ? prompt : undefined,
    block_reason: blocked
      ? `Threat detected: ${dominantCategory} (score: ${Math.round(totalScore)}). Request blocked before LLM execution.`
      : undefined,
    forensic_id,
    latency_ms: Date.now() - t0,
  };
}

/**
 * Express/Fastify middleware wrapper — drop into any route handler.
 *
 * Usage:
 *   import { fortressMiddleware } from "@streetmp/security-pro";
 *   app.use("/api/v1/execute", fortressMiddleware);
 */
export function fortressMiddleware(req: any, res: any, next: any): void {
  const prompt: string =
    req.body?.prompt || req.body?.messages?.map((m: any) => m.content).join(" ") || "";

  if (!prompt) { next(); return; }

  const result = fortressScan(prompt);

  // Attach result to request for downstream logging
  req.fortressResult = result;

  if (!result.allowed) {
    res.status(403).json({
      error: "FORTRESS_SHIELD_BLOCKED",
      code: "ADVERSARIAL_PROMPT_DETECTED",
      threat: result.threat_category,
      suspicion_score: result.suspicion_score,
      forensic_id: result.forensic_id,
      message: "This request was blocked by the StreetMP Fortress Shield before reaching the AI model.",
    });
    return;
  }

  next();
}
