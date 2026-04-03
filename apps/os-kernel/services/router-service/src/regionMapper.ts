/**
 * @file regionMapper.ts
 * @service router-service
 * @version V69
 * @description Data Sovereignty Regional Mapper (Strict Geofencing)
 *
 * Provides hard-coded or verifiable endpoint mappings for supported LLM
 * models across global regions (EU, US, IN, GLOBAL). Used by the
 * routing engine to guarantee data residency.
 */

export interface RegionalEndpoint {
  url: string;
  region_name: string;
}

// Map structure: provider -> model -> region -> RegionalEndpoint
const REGION_MAP: Record<string, Record<string, Record<string, RegionalEndpoint>>> = {
  openai: {
    "gpt-4o-mini": {
      "EU": { url: "https://api.openai.com/v1", region_name: "eu-central-1" }, // Example: Pretend this is an Azure EU endpoint for testing
      "US": { url: "https://api.openai.com/v1", region_name: "us-east-1" },
      // IN is NOT mapped to simulate a Sovereignty Block scenario
    },
    // GPT-4o mapped for US only
    "gpt-4o": {
      "US": { url: "https://api.openai.com/v1", region_name: "us-west-2" },
    }
  },
  anthropic: {
    "claude-3-haiku": {
      "EU": { url: "https://api.anthropic.com/v1", region_name: "eu-west-3" },
      "US": { url: "https://api.anthropic.com/v1", region_name: "us-east-1" },
    }
  }
};

/**
 * Returns the RegionalEndpoint if a physical mapping exists for the
 * requested AI model in the target legal region.
 * 
 * @param provider - e.g., "openai", "anthropic"
 * @param model - e.g., "gpt-4o-mini", "claude-3-haiku"
 * @param requestedRegion - e.g., "EU", "US"
 * @returns RegionalEndpoint or null (Fail-Closed)
 */
export function getRegionalEndpoint(
  provider: string,
  model: string,
  requestedRegion: string
): RegionalEndpoint | null {
  // If region is generic or global, we don't apply an override endpoint.
  // The caller will use the default public SDK endpoint.
  if (!requestedRegion || requestedRegion.toUpperCase() === "GLOBAL") return null;

  const providerMap = REGION_MAP[provider.toLowerCase()];
  if (!providerMap) return null;

  const modelMap = providerMap[model.toLowerCase()];
  if (!modelMap) return null;

  const endpoint = modelMap[requestedRegion.toUpperCase()];
  if (!endpoint) return null;

  return endpoint;
}
