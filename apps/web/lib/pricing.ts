/**
 * @file lib/pricing.ts
 * @description V22 Real-time token pricing models for LLMs
 */

export const MODEL_PRICING: Record<string, { prompt: number, completion: number }> = {
  "gpt-4o": { prompt: 5.00, completion: 15.00 }, // per 1M tokens
  "gpt-4o-mini": { prompt: 0.15, completion: 0.60 },
  "gpt-4-turbo": { prompt: 10.00, completion: 30.00 },
  "claude-3-5-sonnet": { prompt: 3.00, completion: 15.00 },
  "claude-3-opus": { prompt: 15.00, completion: 75.00 },
  "gemini-1-5-pro": { prompt: 3.50, completion: 10.50 },
  "meta-llama-3-70b": { prompt: 0.60, completion: 0.60 },
  "streetmp-auto": { prompt: 1.00, completion: 3.00 }, // Blended avg
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = MODEL_PRICING[model] || MODEL_PRICING["streetmp-auto"];
  const cost = (promptTokens / 1_000_000) * rates.prompt + (completionTokens / 1_000_000) * rates.completion;
  return Number(cost.toFixed(6));
}
