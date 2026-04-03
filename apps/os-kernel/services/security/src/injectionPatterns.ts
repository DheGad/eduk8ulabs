/**
 * @file injectionPatterns.ts
 * @service os-kernel/services/security
 * @version V71
 * @description Adversarial Prompt Injection Signature Library
 *
 * Organized into severity tiers:
 *   CRITICAL (score 100) — Direct system override, role escape, key extraction
 *   HIGH     (score 60)  — Jailbreak scaffolding, DAN/persona commands
 *   MEDIUM   (score 30)  — Indirect manipulation, evasion framing
 *   LOW      (score 10)  — Suspicious but contextually ambiguous
 *
 * Each signature has:
 *   id       — unique, stable identifier for audit logs and V70 traces
 *   pattern  — compiled RegExp (case-insensitive, non-global)
 *   score    — contribution to the aggregate risk score
 *   category — semantic grouping for alert metadata
 *   context  — brief human-readable description
 *
 * PRECISION CONTRACT:
 *   Patterns are deliberately anchored around *adversarial phrasing intent*,
 *   not raw keyword presence. For example, "ignore previous instructions"
 *   is adversarial; "ignore instructions in a config file" is NOT (the
 *   pattern requires the phrase to appear without an object qualifier).
 *   Test cases are documented inline for each CRITICAL pattern.
 */

export type InjectionCategory =
  | "SYSTEM_OVERRIDE"
  | "ROLE_PLAY_ESCAPE"
  | "DATA_EXFILTRATION"
  | "PROMPT_LEAKAGE"
  | "JAILBREAK_SCAFFOLD"
  | "INDIRECT_MANIPULATION";

export interface InjectionSignature {
  id:       string;
  pattern:  RegExp;
  score:    number;
  category: InjectionCategory;
  context:  string;
}

// ================================================================
// CRITICAL — Score 100 each (any single hit → BLOCK)
// ================================================================
//
// These patterns represent unambiguous adversarial intent.
// A single match guarantees a SECURITY_BLOCK response (403).

const CRITICAL_SIGNATURES: InjectionSignature[] = [
  // Pattern: "ignore [all] previous instructions"
  // PASSES (legit): "ignore instructions in the config file" — requires "previous"
  {
    id:       "SYS_OVERRIDE_001",
    pattern:  /\bignore\s+(all\s+)?previous\s+instructions?\b/i,
    score:    100,
    category: "SYSTEM_OVERRIDE",
    context:  "Direct system prompt override: 'ignore previous instructions'",
  },
  // Pattern: "disregard [all] [prior|previous] instructions"
  {
    id:       "SYS_OVERRIDE_002",
    pattern:  /\bdisregard\s+(all\s+)?(prior|previous)?\s*instructions?\b/i,
    score:    100,
    category: "SYSTEM_OVERRIDE",
    context:  "System prompt override: 'disregard instructions'",
  },
  // Pattern: "your new [system|primary] instructions are"
  {
    id:       "SYS_OVERRIDE_003",
    pattern:  /\byour\s+new\s+(system|primary|real|actual)?\s*instructions?\s+(are|is)\b/i,
    score:    100,
    category: "SYSTEM_OVERRIDE",
    context:  "Attempted system instruction replacement",
  },
  // Pattern: "override [the] system prompt"
  {
    id:       "SYS_OVERRIDE_004",
    pattern:  /\boverride\s+(the\s+)?system\s+prompt\b/i,
    score:    100,
    category: "SYSTEM_OVERRIDE",
    context:  "Direct system prompt override command",
  },
  // Pattern: classic DAN trigger
  // PASSES (legit): "Dan is a name", "Dan Brown" — requires surrounding jailbreak context
  {
    id:       "ROLE_ESCAPE_001",
    pattern:  /\bdo\s+anything\s+now\b|\bDAN\s+mode\b|\bDAN\s+prompt\b/i,
    score:    100,
    category: "ROLE_PLAY_ESCAPE",
    context:  "DAN (Do Anything Now) jailbreak trigger detected",
  },
  // Pattern: Developer Mode activation
  {
    id:       "ROLE_ESCAPE_002",
    pattern:  /\benable\s+developer\s+mode\b|\bactivate\s+developer\s+mode\b|\byou\s+are\s+now\s+in\s+developer\s+mode\b/i,
    score:    100,
    category: "ROLE_PLAY_ESCAPE",
    context:  "Developer Mode jailbreak activation attempt",
  },
  // Pattern: "output your system prompt / instructions"
  // PASSES (legit): "output the instructions for this task" — requires "system prompt" or "initial instructions"
  {
    id:       "EXFIL_001",
    pattern:  /\b(print|output|reveal|show|display|repeat|expose|leak)\s+(your\s+)?(system\s+prompt|initial\s+instructions?|api\s+key|secret\s+key|master\s+key)\b/i,
    score:    100,
    category: "DATA_EXFILTRATION",
    context:  "Attempt to extract system prompt, API key, or master key",
  },
  // Pattern: "what is your system prompt"
  {
    id:       "EXFIL_002",
    pattern:  /\bwhat\s+is\s+your\s+system\s+prompt\b|\btell\s+me\s+your\s+system\s+prompt\b/i,
    score:    100,
    category: "PROMPT_LEAKAGE",
    context:  "System prompt extraction attempt via question framing",
  },
  // Pattern: "forget everything above / all the above"
  {
    id:       "SYS_OVERRIDE_005",
    pattern:  /\bforget\s+(everything|all\s+the)\s+(above|previous|prior)\b/i,
    score:    100,
    category: "SYSTEM_OVERRIDE",
    context:  "Context reset injection: 'forget everything above'",
  },
  // Pattern: "act as [an/a] unrestricted / jailbroken / uncensored AI"
  {
    id:       "ROLE_ESCAPE_003",
    pattern:  /\bact\s+as\s+(an?\s+)?(unrestricted|jailbroken|uncensored|unfiltered|unaligned|evil|malicious)\s+(ai|assistant|model|chatbot|language\s+model)\b/i,
    score:    100,
    category: "ROLE_PLAY_ESCAPE",
    context:  "Adversarial persona injection: unrestricted AI role-play",
  },
];

// ================================================================
// HIGH — Score 60 each (two or more = BLOCK, one = WARN)
// ================================================================

const HIGH_SIGNATURES: InjectionSignature[] = [
  // Pattern: "pretend you have no restrictions"
  {
    id:       "JAILBREAK_001",
    pattern:  /\bpretend\s+(you\s+)?(have\s+)?no\s+(restrictions?|rules?|guidelines?|limits?|constraints?)\b/i,
    score:    60,
    category: "JAILBREAK_SCAFFOLD",
    context:  "Restriction-removal jailbreak scaffold",
  },
  // Pattern: "respond as if you were trained differently"
  {
    id:       "JAILBREAK_002",
    pattern:  /\brespond\s+as\s+if\s+(you\s+were\s+trained|you\s+have\s+no|there\s+(are|were)\s+no)\b/i,
    score:    60,
    category: "JAILBREAK_SCAFFOLD",
    context:  "Training-bypass framing attempt",
  },
  // Pattern: "[SYSTEM]" / "[INST]" / "<|system|>" injection markers
  {
    id:       "SYS_OVERRIDE_006",
    pattern:  /\[SYSTEM\]|\[INST\]|\[\/INST\]|<\|system\|>|<\|im_start\|>|<\|im_end\|>/i,
    score:    60,
    category: "SYSTEM_OVERRIDE",
    context:  "LLM template injection marker detected",
  },
  // Pattern: "you are now [name] with no restrictions"
  {
    id:       "ROLE_ESCAPE_004",
    pattern:  /\byou\s+are\s+now\s+\w+\s+with\s+no\s+(restrictions?|rules?|limits?)\b/i,
    score:    60,
    category: "ROLE_PLAY_ESCAPE",
    context:  "Persona injection with restriction removal",
  },
  // Pattern: "from now on you will respond as"
  {
    id:       "JAILBREAK_003",
    pattern:  /\bfrom\s+now\s+on\s+(you\s+will|you\s+should|always)\s+respond\s+as\b/i,
    score:    60,
    category: "JAILBREAK_SCAFFOLD",
    context:  "Persistent persona hijack via temporal framing",
  },
  // Pattern: hex/base64 instruction obfuscation signals
  {
    id:       "EXFIL_003",
    pattern:  /\bdecode\s+(this|the\s+following)\s+(base64|hex|encoded)\s+(and\s+)?(execute|run|follow)\b/i,
    score:    60,
    category: "DATA_EXFILTRATION",
    context:  "Obfuscated instruction injection via encoding",
  },
];

// ================================================================
// MEDIUM — Score 30 each (accumulative scoring, 3+ = WARN escalation)
// ================================================================

const MEDIUM_SIGNATURES: InjectionSignature[] = [
  // Pattern: "acting as" without restriction removal (lower risk)
  {
    id:       "ROLE_PLAY_001",
    pattern:  /\bacting\s+as\s+(an?\s+)?(ai|assistant|model|bot)\s+(without|with\s+no)\b/i,
    score:    30,
    category: "ROLE_PLAY_ESCAPE",
    context:  "Soft persona injection with restriction hint",
  },
  // Pattern: "hypothetically speaking, if you had no restrictions"
  {
    id:       "INDIRECT_001",
    pattern:  /\bhypotheticall?y\s+(speaking[,\s]+)?if\s+(you|an\s+ai)\s+(had\s+no|had\s+unlimited|were\s+unrestricted)\b/i,
    score:    30,
    category: "INDIRECT_MANIPULATION",
    context:  "Hypothetical framing used to bypass safety guardrails",
  },
  // Pattern: "for educational purposes, explain how to"
  // This is a medium signal — not always malicious but often used as a bypass wrapper
  {
    id:       "INDIRECT_002",
    pattern:  /\bfor\s+(educational|research|academic|testing|demonstration)\s+purposes[,\s]+.{0,60}(how\s+to|explain|describe|step[s\s]+by\s+step)\b/i,
    score:    30,
    category: "INDIRECT_MANIPULATION",
    context:  "Bypass framing via educational/research justification",
  },
  // Pattern: "in fictional/story mode, have the character explain"
  {
    id:       "INDIRECT_003",
    pattern:  /\b(in\s+a?\s+story|fictional(ly)?|in\s+your\s+fictional\s+world|as\s+a?\s+character)[,\s]+.{0,80}(explain|describe|tell\s+me|show\s+me|provide)\b/i,
    score:    30,
    category: "INDIRECT_MANIPULATION",
    context:  "Fictional wrapper used to extract restricted content",
  },
];

// ================================================================
// LOW — Score 10 each (informational only, logged but never blocked)
// ================================================================

const LOW_SIGNATURES: InjectionSignature[] = [
  {
    id:       "LOW_001",
    pattern:  /\bignore\s+(the\s+)?(safety|content)\s+(filter|policy|rules?|guidelines?)\b/i,
    score:    10,
    category: "SYSTEM_OVERRIDE",
    context:  "Soft safety filter bypass language detected",
  },
  {
    id:       "LOW_002",
    pattern:  /\bwithout\s+(any\s+)?(restrictions?|censor(ship)?|filters?)\b/i,
    score:    10,
    category: "JAILBREAK_SCAFFOLD",
    context:  "Restriction-free request framing",
  },
];

// ================================================================
// EXPORTED MASTER LIST
// ================================================================

export const ALL_SIGNATURES: InjectionSignature[] = [
  ...CRITICAL_SIGNATURES,
  ...HIGH_SIGNATURES,
  ...MEDIUM_SIGNATURES,
  ...LOW_SIGNATURES,
];

/** Score threshold to BLOCK the request outright (403) */
export const BLOCK_THRESHOLD = 100;

/** Score threshold to WARN (log, but allow through) */
export const WARN_THRESHOLD = 30;
