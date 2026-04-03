/**
 * @file smartRouter.ts
 * @version V23
 * @description V23 Multi-Model Smart Router with Geopolitical Firewall.
 *
 * Dynamically selects the best AI model based on:
 * - Data Classification (TOP_SECRET, CONFIDENTIAL, PUBLIC)
 * - Active Compliance Rules (V21 Frameworks)
 * - Data Residency (V23 Geo-fencing)
 * - Latency & Cost Optimization
 */
import { getTenantCompliance } from "./complianceService.js";
import { enforceResidency, getTenantRegion } from "./residencyManager.js";
import { resolveModelEntry } from "./modelRegistry.js";
/**
 * Determines the optimal model and provider based on enterprise context,
 * strictly enforcing geographic borders.
 */
export function determineOptimalModel(tenant_id, data_classification, prompt_length) {
    const compliance = getTenantCompliance(tenant_id);
    const activeFrameworks = compliance.active_frameworks.map(f => f.framework.id);
    const tenantRegion = getTenantRegion(tenant_id);
    // Helper to test if a route is legally allowed to process this data
    const checkRoute = (provider, model, baseReason) => {
        const entry = resolveModelEntry(model);
        if (!entry)
            return null; // model doesn't exist
        const isAllowed = enforceResidency(tenant_id, entry.supported_regions);
        if (isAllowed) {
            return {
                provider,
                model,
                reason: `${baseReason} (Region: ${tenantRegion} ✓)`,
            };
        }
        return null;
    };
    // 1. Strict Compliance Checks (V21)
    if (activeFrameworks.includes("SEC_FINANCE") || activeFrameworks.includes("HIPAA_HEALTH")) {
        const route = checkRoute("streetmp", "streetmp-auto", `Compliance Enforcement: Active [${activeFrameworks.join(", ")}] requires Sovereign/Local VPC execution.`);
        if (route)
            return route;
    }
    // 2. Data Classification Routes
    const classification = data_classification.toUpperCase();
    if (classification === "TOP_SECRET") {
        const route = checkRoute("streetmp", "streetmp-auto", "Data Classification: TOP_SECRET requires zero-knowledge Sovereign Enclave routing.");
        if (route)
            return route;
    }
    if (classification === "CONFIDENTIAL") {
        // Primary Choice
        let route = checkRoute("anthropic", "claude-3-5-sonnet", "Data Classification: CONFIDENTIAL routed to Claude-3.5-Sonnet.");
        if (route)
            return route;
        // Fallback if Claude is not in region
        route = checkRoute("meta", "llama-3.1-70b", "Geoblock Fallback: Routed to Local VPC Llama 3.1 70B.");
        if (route)
            return route;
    }
    // 3. Cost & Latency Optimization (Default/PUBLIC)
    if (prompt_length > 10000) {
        let route = checkRoute("google", "gemini-1.5-flash", "Optimization: Large context length routed to Gemini-1.5-Flash for minimal cost.");
        if (route)
            return route;
        // Fallback 
        route = checkRoute("mistral", "mixtral-8x22b", "Geoblock Fallback (Large Context): Routed to Mixtral 8x22B.");
        if (route)
            return route;
    }
    // Lowest latency general default
    let route = checkRoute("openai", "gpt-4o-mini", "Optimization: Standard context routed to GPT-4o-Mini for ultra-low latency.");
    if (route)
        return route;
    // Ultimate Fallback - Sovereign
    return {
        provider: "streetmp",
        model: "streetmp-auto",
        reason: `Geoblock Ultimate Fallback: No commercial models available in ${tenantRegion}. Forced Sovereign Enclave routing.`,
    };
}
