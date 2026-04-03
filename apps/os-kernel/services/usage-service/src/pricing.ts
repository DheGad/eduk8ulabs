/**
 * @file pricing.ts
 * @service usage-service
 * @description Cost Calculation Engine — The Financial Oracle.
 *
 * ================================================================
 * PRICING MODEL
 * ================================================================
 * All prices are stored as USD per 1,000,000 tokens (per-1M).
 * The formula is:
 *
 *   cost = (tokens / 1_000_000) * price_per_million
 *
 * Total cost = input cost + output cost.
 *
 * ================================================================
 * PRECISION
 * ================================================================
 * JavaScript floating point is used here for calculation.
 * The result is stored in PostgreSQL as NUMERIC(12,8), which
 * preserves 8 decimal places. This gives sub-cent precision
 * suitable for micro-billing (fractions of a cent per call).
 *
 * For reference: a 1000-token gpt-4o call costs $0.00001 input.
 * NUMERIC(12,8) stores this exactly as 0.00001000.
 *
 * ================================================================
 * MAINTENANCE
 * ================================================================
 * Update this dictionary when provider pricing changes.
 * Phase 2 will move this to a database-driven pricing table
 * so updates don't require a service redeploy.
 * ================================================================
 */

/**
 * Per-model pricing definition in USD/1M tokens.
 */
interface ModelPricing {
  /** USD per 1,000,000 input (prompt) tokens */
  inputPerMillion: number;
  /** USD per 1,000,000 output (completion) tokens */
  outputPerMillion: number;
  /** Human-readable display name for logging/billing UI */
  displayName: string;
}

/**
 * Phase 1 Pricing Dictionary.
 *
 * Sources (as of Q1 2026 — verify against provider pricing pages):
 *   OpenAI:    https://openai.com/api/pricing
 *   Anthropic: https://anthropic.com/api/pricing
 *   Google:    https://ai.google.dev/pricing
 *   Mistral:   https://mistral.ai/technology/#pricing
 */
const PRICING_REGISTRY: Record<string, ModelPricing> = {
  // ── OpenAI ──────────────────────────────────────────────────────
  "gpt-4o": {
    inputPerMillion: 5.00,
    outputPerMillion: 15.00,
    displayName: "GPT-4o",
  },
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    displayName: "GPT-4o Mini",
  },
  "gpt-4-turbo": {
    inputPerMillion: 10.00,
    outputPerMillion: 30.00,
    displayName: "GPT-4 Turbo",
  },
  "gpt-3.5-turbo": {
    inputPerMillion: 0.50,
    outputPerMillion: 1.50,
    displayName: "GPT-3.5 Turbo",
  },
  "o1": {
    inputPerMillion: 15.00,
    outputPerMillion: 60.00,
    displayName: "o1",
  },
  "o1-mini": {
    inputPerMillion: 1.10,
    outputPerMillion: 4.40,
    displayName: "o1-mini",
  },

  // ── Anthropic ───────────────────────────────────────────────────
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3.00,
    outputPerMillion: 15.00,
    displayName: "Claude 3.5 Sonnet",
  },
  "claude-3-5-haiku-20241022": {
    inputPerMillion: 0.80,
    outputPerMillion: 4.00,
    displayName: "Claude 3.5 Haiku",
  },
  "claude-3-opus-20240229": {
    inputPerMillion: 15.00,
    outputPerMillion: 75.00,
    displayName: "Claude 3 Opus",
  },
  "claude-3-sonnet-20240229": {
    inputPerMillion: 3.00,
    outputPerMillion: 15.00,
    displayName: "Claude 3 Sonnet",
  },
  "claude-3-haiku-20240307": {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    displayName: "Claude 3 Haiku",
  },

  // ── Google ──────────────────────────────────────────────────────
  "gemini-1.5-pro": {
    inputPerMillion: 3.50,
    outputPerMillion: 10.50,
    displayName: "Gemini 1.5 Pro",
  },
  "gemini-1.5-flash": {
    inputPerMillion: 0.075,
    outputPerMillion: 0.30,
    displayName: "Gemini 1.5 Flash",
  },
  "gemini-2.0-flash": {
    inputPerMillion: 0.10,
    outputPerMillion: 0.40,
    displayName: "Gemini 2.0 Flash",
  },

  // ── Mistral ─────────────────────────────────────────────────────
  "mistral-large-latest": {
    inputPerMillion: 2.00,
    outputPerMillion: 6.00,
    displayName: "Mistral Large",
  },
  "mistral-small-latest": {
    inputPerMillion: 0.20,
    outputPerMillion: 0.60,
    displayName: "Mistral Small",
  },
  "open-mistral-nemo": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.15,
    displayName: "Mistral Nemo",
  },
};

/**
 * The result of a cost calculation, returned by `calculateCost`.
 */
export interface CostBreakdown {
  /** Total USD cost, 8 decimal places of precision */
  totalCost: number;
  /** USD cost of the input tokens only */
  inputCost: number;
  /** USD cost of the output tokens only */
  outputCost: number;
  /** The named model that was resolved — useful for logging unknowns */
  resolvedModel: string;
  /** Whether the model was found in the registry or fell back to default */
  isKnownModel: boolean;
}

/**
 * Fallback pricing for models not in the registry.
 * Uses gpt-4o rates as a conservative upper-bound — avoids
 * under-billing on unknown expensive models.
 * The boolean `isKnownModel: false` is returned so that the
 * Usage Service can log a warning for unrecognized models.
 */
const FALLBACK_PRICING: ModelPricing = {
  inputPerMillion: 5.00,
  outputPerMillion: 15.00,
  displayName: "Unknown Model (gpt-4o fallback)",
};

/**
 * Calculates the exact API cost for a single LLM call.
 *
 * @param modelUsed        — The model identifier as returned by the LLM SDK
 *                           (e.g., "gpt-4o", "claude-3-5-sonnet-20241022")
 * @param tokensPrompt     — Number of input/prompt tokens consumed
 * @param tokensCompletion — Number of output/completion tokens generated
 *
 * @returns {CostBreakdown} Full cost breakdown with 8-decimal precision.
 *
 * @example
 * const cost = calculateCost("gpt-4o", 1500, 800);
 * // inputCost:  0.0000075  (1500 / 1M * $5.00)
 * // outputCost: 0.000012   (800  / 1M * $15.00)
 * // totalCost:  0.0000195
 */
export function calculateCost(
  modelUsed: string,
  tokensPrompt: number,
  tokensCompletion: number
): CostBreakdown {
  if (tokensPrompt < 0 || tokensCompletion < 0) {
    throw new Error(
      `[UsageService:pricing] Token counts must be non-negative. ` +
        `Received: tokensPrompt=${tokensPrompt}, tokensCompletion=${tokensCompletion}`
    );
  }

  const normalizedModel = modelUsed.toLowerCase().trim();
  const pricing = PRICING_REGISTRY[normalizedModel];
  const isKnownModel = pricing !== undefined;

  const activePricing = pricing ?? FALLBACK_PRICING;

  if (!isKnownModel) {
    console.warn(
      `[UsageService:pricing] Unknown model "${modelUsed}" — applying fallback pricing ` +
        `(${FALLBACK_PRICING.displayName}). Add this model to PRICING_REGISTRY.`
    );
  }

  const inputCost = (tokensPrompt / 1_000_000) * activePricing.inputPerMillion;
  const outputCost = (tokensCompletion / 1_000_000) * activePricing.outputPerMillion;
  const totalCost = inputCost + outputCost;

  // Round to 8 decimal places to match NUMERIC(12,8) in PostgreSQL,
  // preventing floating-point drift on the final stored value.
  return {
    totalCost: parseFloat(totalCost.toFixed(8)),
    inputCost: parseFloat(inputCost.toFixed(8)),
    outputCost: parseFloat(outputCost.toFixed(8)),
    resolvedModel: normalizedModel,
    isKnownModel,
  };
}

/**
 * Returns the list of all model identifiers supported by the pricing registry.
 * Useful for validation and frontend model-picker UIs.
 */
export function getSupportedModels(): string[] {
  return Object.keys(PRICING_REGISTRY);
}

/**
 * Returns the display name for a model, or undefined if unknown.
 */
export function getModelDisplayName(modelUsed: string): string | undefined {
  return PRICING_REGISTRY[modelUsed.toLowerCase().trim()]?.displayName;
}
