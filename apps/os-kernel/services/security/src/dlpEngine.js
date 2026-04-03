"use strict";
/**
 * @file dlpEngine.ts
 * @service os-kernel/services/security
 * @version V51
 * @description Bi-Directional Data Loss Prevention (DLP) & PII Tokenization — StreetMP OS
 *
 * Intercepts outgoing prompts, detects sensitive PII (SSNs, Credit Cards, Names,
 * Emails, Addresses, Medical IDs), replaces each entity with a synthetic StreetMP
 * secure token, then restores the original values in the AI response before the
 * payload returns to the client. Zero PII ever reaches an external LLM provider.
 *
 * Tech Stack Lock : TypeScript · Next.js (App Router) · No Python
 * Aesthetic Lock  : Obsidian & Emerald
 * Compliance      : HIPAA · PCI-DSS · GDPR
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalDLP = exports.DataLossPrevention = void 0;
const PII_PATTERNS = [
    // U.S. Social Security Numbers (XXX-XX-XXXX or XXXXXXXXX)
    {
        category: "SSN",
        pattern: /\b(\d{3}-\d{2}-\d{4}|\d{9})\b/g,
    },
    // Credit / Debit card numbers (Luhn-compatible structure, major networks)
    {
        category: "CREDIT_CARD",
        pattern: /\b((?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
    },
    // Medical Record / National Provider Identifiers (10-digit sequences after keyword)
    {
        category: "MEDICAL_ID",
        pattern: /\b(?:MRN|NPI|Patient ID|Medical ID)[:\s#]*(\d{6,10})\b/gi,
    },
    // Date of Birth (various formats)
    {
        category: "DOB",
        pattern: /\b(?:DOB|Date of Birth|Born)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
    },
    // Email addresses
    {
        category: "EMAIL",
        pattern: /\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g,
    },
    // International phone numbers
    {
        category: "PHONE",
        pattern: /\b(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/g,
    },
    // IPv4 addresses
    {
        category: "IP_ADDRESS",
        pattern: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
    },
    // Full names preceded by common honorifics / identifiers
    {
        category: "FULL_NAME",
        pattern: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Patient|Client|Employee|User)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g,
    },
    // Street addresses (number + street keyword)
    {
        category: "ADDRESS",
        pattern: /\b(\d{1,6}\s+[A-Za-z0-9\s]{3,40}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\.?)\b/gi,
    },
];
// Token prefix for all StreetMP-issued synthetic markers
const TOKEN_PREFIX = "STREETMP_SECURE";
// ================================================================
// DLP ENGINE CLASS
// ================================================================
class DataLossPrevention {
    /**
     * In-memory token map keyed by contextId.
     * Maps `token → originalValue` for bi-directional resolution.
     */
    tokenStore = new Map();
    totalTokenized = 0;
    totalViolationsPrevented = 0;
    // ── Private Helpers ─────────────────────────────────────────────
    generateContextId() {
        return `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    generateToken(category, index) {
        return `[${TOKEN_PREFIX}_${category}_${String(index + 1).padStart(2, "0")}]`;
    }
    // ── Public API ───────────────────────────────────────────────────
    /**
     * Scans `prompt` for PII entities, replaces each with a synthetic token,
     * and stores the original→token map for later de-tokenization.
     *
     * @param prompt     Raw user/application prompt to be sent to an LLM.
     * @param contextId  Optional pre-assigned context ID (auto-generated if omitted).
     */
    tokenizePayload(prompt, contextId) {
        const start = Date.now();
        const id = contextId ?? this.generateContextId();
        const tokenMap = new Map();
        let sanitized = prompt;
        const detections = [];
        let entityIndex = 0;
        for (const { category, pattern } of PII_PATTERNS) {
            // Reset lastIndex for global patterns
            pattern.lastIndex = 0;
            sanitized = sanitized.replace(pattern, (fullMatch, capturedGroup) => {
                const original = capturedGroup ?? fullMatch;
                const token = this.generateToken(category, entityIndex++);
                // Store original so we can restore it later
                tokenMap.set(token, original);
                detections.push({
                    original,
                    token,
                    category,
                    index: sanitized.indexOf(fullMatch),
                });
                // Replace only the captured group, preserving surrounding keywords
                return fullMatch.replace(original, token);
            });
        }
        this.tokenStore.set(id, tokenMap);
        this.totalTokenized += detections.length;
        if (detections.length > 0)
            this.totalViolationsPrevented += 1;
        const latencyMs = Date.now() - start;
        if (detections.length > 0) {
            console.info(`[V51:DLP] Tokenized ${detections.length} PII entities in ${latencyMs}ms (ctx: ${id})`);
        }
        return {
            sanitizedPayload: sanitized,
            detections,
            contextId: id,
            entityCount: detections.length,
            latencyMs,
        };
    }
    /**
     * Restores original PII values in an AI response using the context's token map.
     *
     * @param aiOutput   Raw response text from the LLM provider.
     * @param contextId  Context ID returned by `tokenizePayload`.
     */
    detokenizeResponse(aiOutput, contextId) {
        const tokenMap = this.tokenStore.get(contextId);
        if (!tokenMap || tokenMap.size === 0) {
            return { restoredResponse: aiOutput, resolvedCount: 0 };
        }
        let restored = aiOutput;
        let resolvedCount = 0;
        for (const [token, original] of tokenMap.entries()) {
            if (restored.includes(token)) {
                restored = restored.replaceAll(token, original);
                resolvedCount += 1;
            }
        }
        // Clean up memory after de-tokenization
        this.tokenStore.delete(contextId);
        console.info(`[V51:DLP] De-tokenized ${resolvedCount} entities for ctx: ${contextId}`);
        return { restoredResponse: restored, resolvedCount };
    }
    /** Total PII entities masked since startup. */
    getTotalTokenized() {
        return this.totalTokenized;
    }
    /** Total requests where at least one PII violation was prevented. */
    getTotalViolationsPrevented() {
        return this.totalViolationsPrevented;
    }
    /** Number of active in-flight request contexts. */
    getActiveContextCount() {
        return this.tokenStore.size;
    }
}
exports.DataLossPrevention = DataLossPrevention;
// ================================================================
// SINGLETON EXPORT — consumed by the proxy pipeline
// ================================================================
exports.globalDLP = new DataLossPrevention();
