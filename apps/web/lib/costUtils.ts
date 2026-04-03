/**
 * @file lib/costUtils.ts
 * @description Pure client-safe cost utility functions.
 *
 * Contains only synchronous, pure functions with ZERO Node.js dependencies.
 * Safe to import in both server and client components.
 *
 * DB-dependent functions (getSpendingTotals, getRecentCostEvents) remain
 * in costEngine.ts (server-only).
 */

export interface ModelRates {
  /** USD per 1M input tokens */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  provider: "openai" | "anthropic" | "google" | "mistral" | "unknown";
}

const PRICING_TABLE: Record<string, ModelRates> = {
  // ── OpenAI ──────────────────────────────────────────────────
  "gpt-4o":                { inputPerMillion: 5.00,   outputPerMillion: 15.00,  provider: "openai" },
  "gpt-4o-mini":           { inputPerMillion: 0.15,   outputPerMillion: 0.60,   provider: "openai" },
  "gpt-4-turbo":           { inputPerMillion: 10.00,  outputPerMillion: 30.00,  provider: "openai" },
  "gpt-4":                 { inputPerMillion: 30.00,  outputPerMillion: 60.00,  provider: "openai" },
  "gpt-3.5-turbo":         { inputPerMillion: 0.50,   outputPerMillion: 1.50,   provider: "openai" },
  "o1":                    { inputPerMillion: 15.00,  outputPerMillion: 60.00,  provider: "openai" },
  "o1-mini":               { inputPerMillion: 1.10,   outputPerMillion: 4.40,   provider: "openai" },
  "o3-mini":               { inputPerMillion: 1.10,   outputPerMillion: 4.40,   provider: "openai" },
  // ── Anthropic ────────────────────────────────────────────────
  "claude-3-5-sonnet-20241022": { inputPerMillion: 3.00,  outputPerMillion: 15.00, provider: "anthropic" },
  "claude-3-5-sonnet-20240620": { inputPerMillion: 3.00,  outputPerMillion: 15.00, provider: "anthropic" },
  "claude-3-5-haiku-20241022":  { inputPerMillion: 0.80,  outputPerMillion: 4.00,  provider: "anthropic" },
  "claude-3-opus-20240229":     { inputPerMillion: 15.00, outputPerMillion: 75.00, provider: "anthropic" },
  "claude-3-sonnet-20240229":   { inputPerMillion: 3.00,  outputPerMillion: 15.00, provider: "anthropic" },
  "claude-3-haiku-20240307":    { inputPerMillion: 0.25,  outputPerMillion: 1.25,  provider: "anthropic" },
  // ── Google ────────────────────────────────────────────────────
  "gemini-1.5-pro":   { inputPerMillion: 3.50,  outputPerMillion: 10.50, provider: "google" },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30,  provider: "google" },
  "gemini-2.0-flash": { inputPerMillion: 0.10,  outputPerMillion: 0.40,  provider: "google" },
  // ── Mistral ───────────────────────────────────────────────────
  "mistral-large-latest": { inputPerMillion: 2.00, outputPerMillion: 6.00, provider: "mistral" },
  "mistral-small-latest": { inputPerMillion: 0.20, outputPerMillion: 0.60, provider: "mistral" },
  "mistral-8x7b-instruct":{ inputPerMillion: 0.70, outputPerMillion: 0.70, provider: "mistral" },
};

/**
 * Resolves pricing for a model name.
 * Handles prefix-matching for versioned model names.
 * Falls back to gpt-4o rates if model is unknown.
 */
export function getRates(modelName: string): ModelRates {
  const key = modelName.toLowerCase().trim();
  if (PRICING_TABLE[key]) return PRICING_TABLE[key]!;
  for (const [pattern, rates] of Object.entries(PRICING_TABLE)) {
    if (key.startsWith(pattern)) return rates;
  }
  return { inputPerMillion: 5.00, outputPerMillion: 15.00, provider: "unknown" };
}

/**
 * Computes the exact USD cost for a single model invocation.
 */
export function computeCost(modelName: string, tokensIn: number, tokensOut: number): number {
  const rates = getRates(modelName);
  return (tokensIn / 1_000_000) * rates.inputPerMillion +
         (tokensOut / 1_000_000) * rates.outputPerMillion;
}

/**
 * Formats a USD cost number for display.
 * Sub-cent amounts use 6dp; dollar amounts use 2dp.
 */
export function formatCostUSD(cost: number): string {
  if (cost >= 1)    return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(6)}`;
}
