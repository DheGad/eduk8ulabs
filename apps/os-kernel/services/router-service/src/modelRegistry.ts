/**
 * @file modelRegistry.ts
 * @service router-service
 * @description V12-02 Global AI Model Registry
 *
 * Single source of truth for all recognised AI models in StreetMP OS.
 * Each model entry carries a Security Tier tag used by the PaC engine
 * to write classification-aware policies without hardcoding model names.
 *
 * SECURITY TIERS (ascending sensitivity restriction):
 * ────────────────────────────────────────────────────────────────────
 *  SOVEREIGN_ONLY   → On-premise / Nitro Enclave. No data ever leaves the VPC.
 *                     Required for TOP_SECRET and ITAR-controlled data.
 *
 *  LOCAL_VPC        → Self-hosted open-weights models inside the customer VPC
 *                     (Llama, Mixtral, DeepSeek, Gemma). Data stays in-region.
 *                     Suitable for CONFIDENTIAL data with a residency SLA.
 *
 *  CLOUD_ENTERPRISE → Fully managed commercial APIs with BAA / DPA agreements
 *                     (GPT-4o, Claude, Gemini Pro, Command R+). INTERNAL/PUBLIC.
 *
 *  CLOUD_CONSUMER   → Lightweight / free-tier commercial APIs.
 *                     PUBLIC non-sensitive data only.
 */

import type { DataRegion } from "./residencyManager.js";

// ─── Tier Enum ────────────────────────────────────────────────────────────────

export type ModelTier =
  | "SOVEREIGN_ONLY"    // StreetMP internal Nitro Enclave
  | "LOCAL_VPC"         // Self-hosted open-weights in customer VPC
  | "CLOUD_ENTERPRISE"  // Managed commercial API + BAA/DPA
  | "CLOUD_CONSUMER";   // Lightweight / consumer commercial API

// ─── Model Entry ─────────────────────────────────────────────────────────────

export interface ModelEntry {
  id:           string;        // canonical model ID (used as request.model)
  display_name: string;
  provider:     string;        // normalised provider key
  tier:         ModelTier;
  /** Known aliases / short names that resolve to this entry */
  aliases:      string[];
  /** Maximum context window tokens */
  context_window: number;
  /** Whether the model supports batched / async inference */
  supports_async: boolean;
  /** Approximate cost tier: 1=cheapest, 5=most expensive */
  cost_rank:    1 | 2 | 3 | 4 | 5;
  /** V23: Approved geopolitical availability zones */
  supported_regions: DataRegion[];
}

// ─── Global Registry ─────────────────────────────────────────────────────────

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── SOVEREIGN_ONLY ────────────────────────────────────────────
  {
    id:             "streetmp-auto",
    display_name:   "StreetMP Sovereign Enclave",
    provider:       "streetmp",
    tier:           "SOVEREIGN_ONLY",
    aliases:        ["streetmp", "sovereign", "enclave"],
    context_window: 32_768,
    supports_async: false,
    cost_rank:      1,
    supported_regions: ["US", "EU", "APAC"],
  },

  // ── LOCAL_VPC ─────────────────────────────────────────────────
  {
    id:             "llama-3.1-405b",
    display_name:   "Meta Llama 3.1 405B",
    provider:       "meta",
    tier:           "LOCAL_VPC",
    aliases:        ["llama-405b", "llama3-405b", "meta-llama-3.1-405b"],
    context_window: 131_072,
    supports_async: true,
    cost_rank:      3,
    supported_regions: ["US", "EU"], // 405B only in US/EU DCs
  },
  {
    id:             "llama-3.1-70b",
    display_name:   "Meta Llama 3.1 70B",
    provider:       "meta",
    tier:           "LOCAL_VPC",
    aliases:        ["llama-70b", "llama3-70b", "meta-llama-3.1-70b"],
    context_window: 131_072,
    supports_async: true,
    cost_rank:      2,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "llama-3.1-8b",
    display_name:   "Meta Llama 3.1 8B",
    provider:       "meta",
    tier:           "LOCAL_VPC",
    aliases:        ["llama-8b", "llama3-8b"],
    context_window: 131_072,
    supports_async: true,
    cost_rank:      1,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "mixtral-8x22b",
    display_name:   "Mistral Mixtral 8x22B",
    provider:       "mistral",
    tier:           "LOCAL_VPC",
    aliases:        ["mixtral-22b", "mistral-8x22b"],
    context_window: 65_536,
    supports_async: true,
    cost_rank:      2,
    supported_regions: ["EU"], // localized European model!
  },
  {
    id:             "mixtral-8x7b",
    display_name:   "Mistral Mixtral 8x7B",
    provider:       "mistral",
    tier:           "LOCAL_VPC",
    aliases:        ["mixtral-7b", "mistral-8x7b"],
    context_window: 32_768,
    supports_async: true,
    cost_rank:      1,
    supported_regions: ["EU", "US"],
  },
  {
    id:             "deepseek-v3",
    display_name:   "DeepSeek V3",
    provider:       "deepseek",
    tier:           "LOCAL_VPC",
    aliases:        ["deepseek", "deepseek-chat"],
    context_window: 64_000,
    supports_async: true,
    cost_rank:      2,
    supported_regions: ["APAC"], // localized APAC model
  },
  {
    id:             "deepseek-r1",
    display_name:   "DeepSeek R1 (Reasoning)",
    provider:       "deepseek",
    tier:           "LOCAL_VPC",
    aliases:        ["deepseek-reasoner", "r1"],
    context_window: 64_000,
    supports_async: false,
    cost_rank:      3,
    supported_regions: ["APAC", "US"],
  },
  {
    id:             "gemma-2-27b",
    display_name:   "Google Gemma 2 27B",
    provider:       "google",
    tier:           "LOCAL_VPC",
    aliases:        ["gemma-27b", "gemma2-27b"],
    context_window: 8_192,
    supports_async: true,
    cost_rank:      1,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "falcon-180b",
    display_name:   "TII Falcon 180B",
    provider:       "tii",
    tier:           "LOCAL_VPC",
    aliases:        ["falcon", "falcon180"],
    context_window: 4_096,
    supports_async: true,
    cost_rank:      3,
    supported_regions: ["US", "EU"],
  },
  {
    id:             "grok-3",
    display_name:   "xAI Grok 3",
    provider:       "xai",
    tier:           "LOCAL_VPC",  // xAI offers on-prem enterprise
    aliases:        ["grok", "xai-grok-3"],
    context_window: 131_072,
    supports_async: true,
    cost_rank:      3,
    supported_regions: ["US"],
  },

  // ── CLOUD_ENTERPRISE ──────────────────────────────────────────
  {
    id:             "gpt-4o",
    display_name:   "OpenAI GPT-4o",
    provider:       "openai",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["gpt4o", "openai-gpt-4o", "chatgpt-4o"],
    context_window: 128_000,
    supports_async: true,
    cost_rank:      4,
    supported_regions: ["US", "EU", "APAC"], // Global presence
  },
  {
    id:             "gpt-4o-mini",
    display_name:   "OpenAI GPT-4o Mini",
    provider:       "openai",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["gpt4o-mini", "openai-gpt-4o-mini"],
    context_window: 128_000,
    supports_async: true,
    cost_rank:      2,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "claude-3-5-sonnet",
    display_name:   "Anthropic Claude 3.5 Sonnet",
    provider:       "anthropic",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["claude-sonnet", "claude-3.5-sonnet", "claude-3-sonnet"],
    context_window: 200_000,
    supports_async: true,
    cost_rank:      4,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "claude-3-haiku",
    display_name:   "Anthropic Claude 3 Haiku",
    provider:       "anthropic",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["claude-haiku", "claude-3.0-haiku"],
    context_window: 200_000,
    supports_async: true,
    cost_rank:      2,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "claude-3-opus",
    display_name:   "Anthropic Claude 3 Opus",
    provider:       "anthropic",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["claude-opus", "claude-3.0-opus"],
    context_window: 200_000,
    supports_async: true,
    cost_rank:      5,
    supported_regions: ["US"], // Example: Opus only available in US
  },
  {
    id:             "gemini-1.5-pro",
    display_name:   "Google Gemini 1.5 Pro",
    provider:       "google",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["gemini-pro", "google-gemini-pro"],
    context_window: 1_048_576,
    supports_async: true,
    cost_rank:      4,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "command-r-plus",
    display_name:   "Cohere Command R+",
    provider:       "cohere",
    tier:           "CLOUD_ENTERPRISE",
    aliases:        ["cohere-r+", "command-r-plus", "cohere-command-r-plus"],
    context_window: 128_000,
    supports_async: true,
    cost_rank:      3,
    supported_regions: ["US", "EU"],
  },

  // ── CLOUD_CONSUMER ────────────────────────────────────────────
  {
    id:             "gemini-1.5-flash",
    display_name:   "Google Gemini 1.5 Flash",
    provider:       "google",
    tier:           "CLOUD_CONSUMER",
    aliases:        ["gemini-flash"],
    context_window: 1_048_576,
    supports_async: true,
    cost_rank:      1,
    supported_regions: ["US", "EU", "APAC"],
  },
  {
    id:             "mistral-small",
    display_name:   "Mistral Small",
    provider:       "mistral",
    tier:           "CLOUD_CONSUMER",
    aliases:        ["mistral-7b-instruct", "mistral-small-latest"],
    context_window: 32_768,
    supports_async: true,
    cost_rank:      1,
    supported_regions: ["US", "EU", "APAC"],
  },
];

// ─── Index for O(1) Lookup ────────────────────────────────────────────────────

/** Primary ID → ModelEntry */
const BY_ID = new Map<string, ModelEntry>(
  MODEL_REGISTRY.map(e => [e.id.toLowerCase(), e])
);

/** Alias → ModelEntry (lower-case) */
const BY_ALIAS = new Map<string, ModelEntry>();
for (const entry of MODEL_REGISTRY) {
  for (const alias of entry.aliases) {
    BY_ALIAS.set(alias.toLowerCase(), entry);
  }
}

// ─── Public Helpers ──────────────────────────────────────────────────────────

/**
 * Look up a model by its canonical ID or any registered alias.
 * Returns undefined for unrecognised model strings (caller should treat as
 * UNKNOWN_TIER and apply the most restrictive policy).
 */
export function resolveModelEntry(modelId: string): ModelEntry | undefined {
  const key = modelId.toLowerCase().trim();
  return BY_ID.get(key) ?? BY_ALIAS.get(key);
}

/**
 * Resolve the security tier for a given model string.
 * Returns "CLOUD_ENTERPRISE" as a conservative default for unknown models
 * (better than silently permitting them at a lower tier).
 */
export function resolveModelTier(modelId: string): ModelTier {
  return resolveModelEntry(modelId)?.tier ?? "CLOUD_ENTERPRISE";
}

/**
 * Returns all models belonging to a given tier.
 */
export function getModelsByTier(tier: ModelTier): ModelEntry[] {
  return MODEL_REGISTRY.filter(e => e.tier === tier);
}

/**
 * Returns all canonical model IDs for a given tier.
 * Useful for building allowlist conditions in policy documents.
 */
export function tierModelIds(tier: ModelTier): string[] {
  return getModelsByTier(tier).map(e => e.id);
}

// ─── Self-Test ───────────────────────────────────────────────────────────────

const isMain = process.argv[1]?.includes("modelRegistry");
if (isMain) {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  V12-02 Model Registry — Self-Test");
  console.log("══════════════════════════════════════════════════\n");

  let passed = 0; let failed = 0;
  const pass = (m: string) => { console.log(`  ✅ ${m}`); passed++; };
  const fail = (m: string) => { console.log(`  ❌ ${m}`); failed++; };

  // Canonical ID lookup
  const gpt4o = resolveModelEntry("gpt-4o");
  gpt4o?.tier === "CLOUD_ENTERPRISE" ? pass("gpt-4o → CLOUD_ENTERPRISE") : fail("gpt-4o tier wrong");

  // Alias lookup
  const llama = resolveModelEntry("llama-405b");
  llama?.tier === "LOCAL_VPC" ? pass("llama-405b alias → LOCAL_VPC") : fail("llama alias failed");

  // Sovereign
  const sov = resolveModelEntry("streetmp-auto");
  sov?.tier === "SOVEREIGN_ONLY" ? pass("streetmp-auto → SOVEREIGN_ONLY") : fail("sovereign tier wrong");

  // Unknown → conservative default
  const unk = resolveModelTier("totally-unknown-model");
  unk === "CLOUD_ENTERPRISE" ? pass("Unknown model → CLOUD_ENTERPRISE (conservative)") : fail("Unknown tier wrong");

  // Tier counts
  const local  = getModelsByTier("LOCAL_VPC").length;
  const cloud  = getModelsByTier("CLOUD_ENTERPRISE").length;
  local  >= 6 ? pass(`LOCAL_VPC has ${local} models`)      : fail("LOCAL_VPC count low");
  cloud  >= 5 ? pass(`CLOUD_ENTERPRISE has ${cloud} models`) : fail("CLOUD_ENTERPRISE count low");

  // V23 Regions
  const claudeOpus = resolveModelEntry("claude-3-opus");
  claudeOpus?.supported_regions.includes("US") ? pass("Opus available in US") : fail("Opus region wrong");
  const mixtral = resolveModelEntry("mixtral-8x22b");
  mixtral?.supported_regions.includes("EU") ? pass("Mixtral available in EU") : fail("Mixtral region wrong");

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed / ${failed} failed`);
  console.log(`══════════════════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}
