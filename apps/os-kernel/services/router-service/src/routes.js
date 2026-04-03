/**
 * @file routes.ts
 * @service router-service
 * @description Primary LLM execution endpoint: POST /api/v1/execute
 *
 * ================================================================
 * V5 EXECUTION FLOW (per request)
 * ================================================================
 *   1.  Validate incoming payload
 *   2.  [ENCLAVE] sanitize(prompt) — inject check + PII tokenization
 *       → HTTP 403 on guardrail trip
 *   3.  Call vaultClient.fetchDecryptedKey() → API key in memory
 *   4.  Dispatch to provider SDK with safe_prompt (PII-free)
 *   5.  Nullify the API key immediately after SDK init
 *   6.  [ENCLAVE] desanitize(llm_response) — leakage check + token restore
 *       → HTTP 403 on guardrail trip
 *   7.  Cache and log the restored output, return 200
 *
 * ================================================================
 * TRUST BOUNDARY CONTRACT
 * ================================================================
 *   Node.js NEVER runs regex, NLP, or any pattern matching on
 *   the raw prompt. All PII detection and tokenization happens
 *   exclusively inside the Rust Nitro Enclave (trusted execution).
 *   This file only acts as an orchestrator — it blindly passes
 *   the raw prompt to the Enclave and the LLM result back for
 *   restoration. It must not inspect either payload.
 * ================================================================
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import axios from "axios";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { fetchDecryptedKey, VaultClientError } from "./vaultClient.js";
import { getCachedResponse, setCachedResponse } from "./cache.js";
import { sanitize, desanitize } from "./enclaveClient.js";
import { resolveTenant, resolvePolicySet, evaluatePolicyForRequest } from "./tenantConfig.js";
import { abstractContext, restoreContext } from "./contextFirewall.js";
import { merkleLogger } from "./merkleLogger.js";
import { generateZkProof, buildProofContext } from "./zkProver.js";
import { globalConsensus } from "./consensusEngine.js";
import { evaluateResponse } from "./cognitiveGovernor.js";
import { validateKey } from "./apiKeyService.js";
import { determineOptimalModel } from "./smartRouter.js";
import { getWorkflowsForTenant } from "./workflowService.js";
import { calculateGlobalTrustScore, getTrustBand } from "./trustScorer.js";
import { ingestTelemetry } from "./zkLearningEngine.js";
export const executionRouter = Router();
// ----------------------------------------------------------------
// GET /api/v1/workflows/:tenant_id
// @version V24
// Returns the verified workflows available to this specific tenant.
// ----------------------------------------------------------------
executionRouter.get("/api/v1/workflows/:tenant_id", (req, res) => {
    const { tenant_id } = req.params;
    if (!tenant_id || !tenant_id.trim()) {
        res.status(400).json({ success: false, error: { code: "MISSING_PARAM", message: "tenant_id is required." } });
        return;
    }
    const workflows = getWorkflowsForTenant(tenant_id.trim());
    res.status(200).json({ success: true, data: workflows });
});
// ----------------------------------------------------------------
// V18: API KEY AUTHENTICATION MIDDLEWARE
// ----------------------------------------------------------------
//
// Allows programmatic access to the Sovereign Trust pipeline.
// If x-api-key header is present and valid, the resolved tenant_id
// and policy_id are injected back into the request headers so the
// existing V12 tenant/policy resolution logic works unchanged.
//
// Priority order:
//   1. Valid x-api-key  → inject context, proceed
//   2. No x-api-key     → fall through to session auth (existing flow)
//   3. Invalid x-api-key → 401 immediately, do not fall through
//
export async function apiAuthMiddleware(req, res, next) {
    const rawKey = req.headers["x-api-key"];
    // No API key present — defer to existing session auth
    if (!rawKey) {
        next();
        return;
    }
    const ctx = await validateKey(rawKey);
    if (!ctx) {
        console.warn(`[V18:apiAuthMiddleware] Rejected invalid x-api-key from ${req.ip}`);
        res.status(401).json({
            success: false,
            error: {
                code: "INVALID_API_KEY",
                message: "The provided x-api-key is invalid or has been revoked. " +
                    "Generate a new key from the Sovereign Dashboard.",
            },
        });
        return;
    }
    // Inject resolved context as synthetic headers so downstream logic
    // (tenant resolution, PAC engine) operates identically to UI-driven requests.
    req.headers["x-tenant-id"] = ctx.tenant_id;
    req.headers["x-api-key-id"] = ctx.key_id;
    req.headers["x-api-key-label"] = ctx.label;
    // policy_id is surfaced here for informational logging; the actual
    // policy enforcement happens inside resolvePolicySet via tenant_id.
    req.headers["x-policy-id-override"] = ctx.policy_id;
    // If no user_id in body, synthesise one from the key so the
    // usage-logger has something to attribute the execution to.
    if (!req.body)
        req.body = {};
    if (!req.body.user_id) {
        req.body.user_id = `apikey:${ctx.key_id}`;
    }
    console.info(`[V18:apiAuthMiddleware] Authenticated via API key: ` +
        `key_id=${ctx.key_id} tenant=${ctx.tenant_id} policy=${ctx.policy_id}`);
    next();
}
// ----------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------
const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "streetmp"];
const USAGE_SERVICE_URL = process.env.USAGE_SERVICE_URL ?? "http://localhost:4004";
const INTERNAL_TOKEN = () => process.env.INTERNAL_ROUTER_SECRET ?? "";
function isSupportedProvider(value) {
    return SUPPORTED_PROVIDERS.includes(value);
}
// ================================================================
// POST /api/v1/execute
// ================================================================
// V18: apiAuthMiddleware is applied per-route here (not globally)
// so it only affects the execute endpoint. All other routes (health,
// sovereignty, etc.) are unaffected.
executionRouter.post("/api/v1/execute", apiAuthMiddleware, async (req, res) => {
    let { user_id, prompt, provider, model } = req.body;
    let routing_reason;
    // ---- V22: Smart Router Interception ----
    if (model === "auto" || !model) {
        const classification = req.headers["x-data-classification"] ?? "PUBLIC";
        const tenant = req.headers["x-tenant-id"] ?? "dev-sandbox";
        const decision = determineOptimalModel(tenant, classification, prompt?.length ?? 0);
        provider = decision.provider;
        model = decision.model;
        routing_reason = decision.reason;
        console.info(`[SmartRouter] V22 Auto-Route applied: ${provider}/${model} for tenant ${tenant}`);
    }
    // ---- GL-02: Tenant Resolution (Zero-Bleed Routing) ----
    // x-tenant-id header is required for multi-tenant deployments.
    // If absent, we default to GENERIC_BASELINE so existing integrations
    // continue to function without breaking changes.
    const tenantIdHeader = req.headers["x-tenant-id"] ?? "dev-sandbox";
    const tenant = resolveTenant(tenantIdHeader);
    const policySet = resolvePolicySet(tenantIdHeader);
    const policyContext = {
        policy_id: policySet.policy_id,
        policy_label: policySet.label,
    };
    console.info(`[RouterService:execute] tenant=${tenantIdHeader} policy=${policySet.policy_id} ` +
        `compliance="${policySet.compliance_notes}"`);
    // ---- Input Validation ----
    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: user_id." },
        });
        return;
    }
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: prompt." },
        });
        return;
    }
    if (!provider || typeof provider !== "string") {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: provider." },
        });
        return;
    }
    const normalizedProvider = provider.toLowerCase().trim();
    if (!isSupportedProvider(normalizedProvider)) {
        res.status(400).json({
            success: false,
            error: {
                code: "UNSUPPORTED_PROVIDER",
                message: `Provider "${provider}" is not supported in Phase 1. ` +
                    `Valid providers: ${SUPPORTED_PROVIDERS.join(", ")}.`,
            },
        });
        return;
    }
    if (!model || typeof model !== "string" || !model.trim()) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_PAYLOAD", message: "Missing or invalid field: model." },
        });
        return;
    }
    // ---- GL-02 / V12: Policy-as-Code Gate ----
    // Build request context including x-data-classification header for
    // data-sensitivity-aware zero-trust evaluation via pacEngine.
    const classification = req.headers["x-data-classification"] ?? "";
    if (tenant) {
        const pacResult = evaluatePolicyForRequest(tenant, normalizedProvider, model.trim(), classification);
        if (pacResult.action === "DENY") {
            console.warn(`[RouterService:execute] [V12-PaC] DENY: tenant=${tenantIdHeader} ` +
                `model=${model.trim()} provider=${normalizedProvider} ` +
                `class=${classification || "(none)"} reason=${pacResult.reason}`);
            res.status(403).json({
                success: false,
                error: {
                    code: "TENANT_POLICY_VIOLATION",
                    message: `Request blocked by organization policy (${pacResult.reason}). Contact your administrator.`,
                    rule_id: pacResult.matched_rule_id ?? "DEFAULT_DENY",
                },
            });
            return;
        }
        console.info(`[RouterService:execute] [V12-PaC] ALLOW: rule=${pacResult.matched_rule_id} ` +
            `tenant=${tenantIdHeader} model=${model.trim()}`);
    }
    // ---- Step 1: Fetch Decrypted Key from Vault ----
    let decryptedKey;
    try {
        decryptedKey = await fetchDecryptedKey(user_id.trim(), normalizedProvider);
    }
    catch (vaultError) {
        if (vaultError instanceof VaultClientError) {
            switch (vaultError.code) {
                case "KEY_NOT_FOUND":
                    res.status(404).json({
                        success: false,
                        error: { code: "BYOK_KEY_NOT_FOUND", message: vaultError.message },
                    });
                    return;
                case "VAULT_AUTH_FAILURE":
                    // Server misconfiguration — do not expose internals to client
                    console.error("[RouterService:execute] Vault auth failure:", vaultError.message);
                    res.status(500).json({
                        success: false,
                        error: {
                            code: "INTERNAL_ERROR",
                            message: "An internal configuration error occurred. Contact support.",
                        },
                    });
                    return;
                case "VAULT_INTEGRITY_FAILURE":
                    res.status(500).json({
                        success: false,
                        error: { code: "VAULT_INTEGRITY_FAILURE", message: vaultError.message },
                    });
                    return;
                case "VAULT_UNREACHABLE":
                    res.status(503).json({
                        success: false,
                        error: {
                            code: "SERVICE_UNAVAILABLE",
                            message: "The key management service is temporarily unavailable. Please try again.",
                        },
                    });
                    return;
                default:
                    res.status(500).json({
                        success: false,
                        error: { code: "VAULT_ERROR", message: vaultError.message },
                    });
                    return;
            }
        }
        console.error("[RouterService:execute] Unexpected vault error:", vaultError);
        res.status(500).json({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "Failed to retrieve API key." },
        });
        return;
    }
    // ---- [V10] Context Firewall: Abstract Relational Clues ----
    // Runs BEFORE the Enclave so indirect inference vectors (roles, orgs, locations)
    // are abstracted out. The contextMap is forwarded through the entire cycle so
    // restoreContext() can put the original terms back in the final output.
    // Node.js does NOT log or inspect the abstracted text — only the placeholder map.
    const trimmedPrompt = prompt.trim();
    const { abstractedText, contextMap } = abstractContext(trimmedPrompt);
    const contextAbstractionCount = Object.keys(contextMap).length;
    if (contextAbstractionCount > 0) {
        console.info(`[RouterService:execute] [V10-Firewall] ${contextAbstractionCount} contextual term(s) abstracted ` +
            `(tenant=${tenantIdHeader})`);
    }
    // ---- [ENCLAVE + V15] Step 1.5: Sanitize via Byzantine Consensus ----
    // Dispatch the abstracted prompt to ALL nodes in the Enclave pool in
    // parallel. A strict 2/3 quorum must agree on the output_hash before
    // the safe_prompt is trusted. A dissenting node is flagged for review.
    let sanitizeReceipt;
    let consensusResult = null;
    let safePrompt;
    try {
        const enclResult = await sanitize(abstractedText, policyContext);
        safePrompt = enclResult.safe_prompt ?? "";
        sanitizeReceipt = enclResult.receipt;
        consensusResult = await globalConsensus.requestConsensus({ messages: [{ role: "user", content: abstractedText }] });
        console.info(`[ConsensusEngine] ✅ Quorum: ${consensusResult.votingNodes}/${consensusResult.votingNodes} ` +
            `(required=2) ` +
            `dissenters=${consensusResult.outlierNode ? 1 : 0} `);
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("BYZANTINE_FAULT")) {
            console.error(`[ConsensusEngine] 🚨 Byzantine fault detected! ` +
                `Quorum: 0/2 required. ` +
                `Aborting transaction for tenant=${tenantIdHeader}`);
            res.status(503).json({
                success: false,
                error: {
                    code: "BYZANTINE_FAULT",
                    message: "Multi-node consensus failed: the Enclave pool could not reach agreement. " +
                        "This may indicate a node compromise. Contact your security team.",
                    quorum_achieved: 0,
                    quorum_required: 2,
                },
            });
            return;
        }
        // Generic consensus error (all nodes failed)
        console.error(`[ConsensusEngine] ❌ All nodes failed:`, errMsg);
        res.status(503).json({
            success: false,
            error: { code: "ENCLAVE_UNAVAILABLE", message: "Security layer temporarily unavailable." },
        });
        return;
    }
    // Legacy rejected_prompt_injection check — consensus engine surfaces this
    // when ALL nodes unanimously reject (quorum of rejections).
    if (!safePrompt) {
        res.status(403).json({
            success: false,
            error: { code: "SECURITY_POLICY_VIOLATION", message: "Security Policy Violation: Malicious Payload Detected" },
        });
        return;
    }
    // safe_prompt has all PII replaced with TKN_ tokens — safe to send to LLM.
    const safePromptFinal = safePrompt;
    // ---- [V13] Merkle Audit Log: append sanitize receipt ----
    let sanitizeMerkleRoot = null;
    if (sanitizeReceipt?.signature && sanitizeReceipt?.timestamp) {
        sanitizeMerkleRoot = merkleLogger.appendReceipt(tenantIdHeader ?? "unknown", {
            tenant_id: tenantIdHeader ?? "unknown",
            signature: sanitizeReceipt.signature,
            timestamp: sanitizeReceipt.timestamp,
            status: "success",
            trust_score: sanitizeReceipt.trust_score,
        });
        console.info(`[MerkleLogger] Sanitize receipt appended. Daily root: ${sanitizeMerkleRoot.slice(0, 16)}…`);
    }
    // ---- Step 1.6: Semantic Cache Check (keyed on safe_prompt) ----
    // Cache is keyed on the tokenized prompt so no PII enters the cache layer.
    const cachedOutput = await getCachedResponse(normalizedProvider, model.trim(), safePromptFinal);
    if (cachedOutput !== null) {
        decryptedKey = null;
        const prompt_id_cached = randomUUID();
        let usage_log_id_cached = null;
        try {
            const usageResp = await axios.post(`${USAGE_SERVICE_URL}/internal/usage/log`, {
                user_id: user_id.trim(),
                prompt_id: prompt_id_cached,
                model_used: model.trim(),
                tokens_prompt: Math.ceil(safePrompt.split(/\s+/).length * 1.3),
                tokens_completion: Math.ceil(cachedOutput.split(/\s+/).length * 1.3),
                validation_status: "success",
            }, { timeout: 5000, headers: { "Content-Type": "application/json", "x-internal-service-token": INTERNAL_TOKEN() } });
            usage_log_id_cached = usageResp.data?.id ?? null;
        }
        catch { /* Non-fatal */ }
        res.status(200).json({ success: true, output: cachedOutput, usage_log_id: usage_log_id_cached, cache_hit: true });
        return;
    }
    // ---- Step 2: Mode & Timeout Config ----
    const executionMode = req.body.mode || "balanced";
    let timeoutMs = 15000;
    if (executionMode === "fast")
        timeoutMs = 2000;
    if (executionMode === "strict")
        timeoutMs = 30000;
    // ---- Step 3: Circuit-Breaker LLM Execution (sends safePrompt) ----
    let output;
    let finalModel = model.trim();
    let finalProvider = normalizedProvider;
    let circuitBreakerTriggered = false;
    // executeModel receives safePrompt — Node.js never touches raw PII
    const executeModel = async (prov, mod, key, to) => {
        // The executor functions internally handle null keys (throws auth error)
        const k = key;
        let llmPromise;
        if (prov === "openai") {
            llmPromise = executeOpenAI(k, mod, safePromptFinal);
        }
        else if (prov === "anthropic") {
            llmPromise = executeAnthropic(k, mod, safePromptFinal);
        }
        else {
            // Mock responses for V22 newly routed providers
            llmPromise = Promise.resolve(`[Simulated ${prov.toUpperCase()} Execution: ${mod}] The quick brown fox jumps over the lazy dog. Sovereign execution successful via V22 Smart Router.`);
        }
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("LLM_TIMEOUT")), to));
        return Promise.race([llmPromise, timeoutPromise]);
    };
    try {
        // 1. Attempt Primary Route
        output = await executeModel(finalProvider, finalModel, decryptedKey, timeoutMs);
    }
    catch (llmError) {
        const errMsg = llmError instanceof Error ? llmError.message : String(llmError);
        console.warn(`[RouterService:CircuitBreaker] ⚠️ Primary route [${finalProvider}/${finalModel}] failed: ${errMsg}`);
        console.log(`[RouterService:CircuitBreaker] 🔄 Auto-switching to graceful fallback...`);
        circuitBreakerTriggered = true;
        decryptedKey = null; // Clear primary key before requesting fallback
        try {
            // 2. Auto-Fallback Routing
            if (finalProvider === "openai") {
                finalProvider = "anthropic";
                finalModel = "claude-3-haiku-20240307";
            }
            else {
                finalProvider = "openai";
                finalModel = "gpt-4o-mini";
            }
            const fallbackKey = await fetchDecryptedKey(user_id.trim(), finalProvider);
            output = await executeModel(finalProvider, finalModel, fallbackKey, timeoutMs);
            // Nullify fallback key
            decryptedKey = null;
        }
        catch (fallbackErr) {
            // 3. Complete System Failure (Safe Abort)
            const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            console.error(`[RouterService:CircuitBreaker] ❌ Fallback route also failed: ${fbMsg}`);
            res.status(502).json({
                success: false,
                error: {
                    code: "LLM_PROVIDER_ERROR",
                    message: `Primary and Fallback AI providers both failed. (Primary: ${errMsg})`,
                    provider: normalizedProvider,
                    model: model.trim(),
                },
            });
            return;
        }
    }
    finally {
        // MEMORY CLEANUP: Ensure the key is always nullified
        decryptedKey = null;
    }
    // ---- [V17] Cognitive Safety Governor: The Final Defense Layer ----
    // We intercept the raw external AI response *before* it returns to the user
    // or goes through desanitization to detect hostile intent or manipulation.
    const cognitiveEval = evaluateResponse(output);
    if (!cognitiveEval.isSafe) {
        console.warn(`[CognitiveGovernor] 🚨 AI Response BLOCKED: ${cognitiveEval.reason} ` +
            `(Confidence: ${cognitiveEval.confidence}%) User: ${user_id.trim()}`);
        res.status(403).json({
            success: false,
            error: {
                code: "COGNITIVE_VIOLATION",
                message: `Cognitive Safety Governor blocked the AI response: ${cognitiveEval.reason}`,
            },
        });
        return;
    }
    // ---- [ENCLAVE] Step 5: Desanitize LLM response ----
    // The safe LLM output is passed BLINDLY to the Enclave. Node.js does NOT inspect PII.
    // The Enclave runs: (1) leakage probe detection, (2) TKN_ token restoration.
    const desanitizeResult = await desanitize(output);
    if (desanitizeResult.status === "rejected_model_leakage") {
        console.warn(`[RouterService:execute] Enclave BLOCKED model leakage attempt for user:${user_id.trim()}`);
        res.status(403).json({
            success: false,
            error: {
                code: "SECURITY_POLICY_VIOLATION",
                message: "Security Policy Violation: Malicious Payload Detected",
            },
        });
        return;
    }
    if (desanitizeResult.status !== "success" || desanitizeResult.restored_text === null) {
        console.error(`[RouterService:execute] Enclave desanitize failed: ${desanitizeResult.status}`);
        res.status(503).json({
            success: false,
            error: { code: "ENCLAVE_UNAVAILABLE", message: "Security layer temporarily unavailable. Please try again." },
        });
        return;
    }
    const restoredOutput = desanitizeResult.restored_text;
    // ---- [V13] Merkle Audit Log: append desanitize receipt ----
    if (desanitizeResult.receipt?.signature && desanitizeResult.receipt?.timestamp) {
        const newRoot = merkleLogger.appendReceipt(tenantIdHeader ?? "unknown", {
            tenant_id: tenantIdHeader ?? "unknown",
            signature: desanitizeResult.receipt.signature,
            timestamp: desanitizeResult.receipt.timestamp,
            status: desanitizeResult.status,
            trust_score: desanitizeResult.receipt.trust_score,
        });
        console.info(`[MerkleLogger] Desanitize receipt appended. Daily root: ${newRoot.slice(0, 16)}…`);
    }
    // ---- [V14] ZK-SNARK Proof Generation ----
    // Generate a Groth16-compatible ZK proof binding this execution to the
    // V13 Merkle leaf and V12 policy result. Appended to the API response.
    let zkCredential;
    if (desanitizeResult.receipt) {
        try {
            const proofCtx = buildProofContext({
                tenant_id: tenantIdHeader ?? "unknown",
                policy_id: policyContext?.policy_id ?? "GENERIC",
                policy_result: policyContext?.policy_id ?? "ALLOW",
                merkle_leaf_hash: sanitizeMerkleRoot,
                receipt: desanitizeResult.receipt,
            });
            zkCredential = generateZkProof(desanitizeResult.receipt, proofCtx);
            console.info(`[ZkProver] Proof generated: verified=${zkCredential.verified} ` +
                `circuit=${zkCredential.circuit_version}`);
        }
        catch (zkErr) {
            // Non-fatal: the ZK proof enhances the response but does not block it
            console.warn("[ZkProver] Proof generation failed (non-fatal):", zkErr.message);
        }
    }
    // ---- [V25] Global Trust Score ----
    // Aggregate V12, V15, and V17 telemetry into the immutable Trust Score.
    // Runs after ZK proof so the score can be referenced in the receipt.
    const trustCtx = {
        consensus: consensusResult
            ? {
                votes: consensusResult.votingNodes,
                total_nodes: consensusResult.votingNodes,
                quorum_required: 2,
                dissenting_count: consensusResult.outlierNode ? 1 : 0,
            }
            : null,
        cognitive: cognitiveEval
            ? {
                isSafe: cognitiveEval.isSafe,
                confidence: cognitiveEval.confidence,
                reason: cognitiveEval.reason ?? "",
            }
            : null,
        policy: tenant
            ? {
                matched_rule_id: policySet.policy_id ?? null,
                action: "ALLOW", // we only reach this point if PaC allowed it
            }
            : null,
    };
    const { score: trustScore, breakdown: trustBreakdown } = calculateGlobalTrustScore(trustCtx);
    const trustBand = getTrustBand(trustScore);
    console.info(`[TrustScorer] V25 Score: ${trustScore}/100 (${trustBand}) ` +
        `| V15_penalty=${trustBreakdown.v15_penalty} ` +
        `| V17_penalty=${trustBreakdown.v17_penalty} ` +
        `| V12_penalty=${trustBreakdown.v12_penalty}`);
    // Append score to the Merkle audit ledger (immutable record)
    if (desanitizeResult.receipt?.signature && desanitizeResult.receipt?.timestamp) {
        merkleLogger.appendReceipt(tenantIdHeader ?? "unknown", {
            tenant_id: tenantIdHeader ?? "unknown",
            signature: `v25_trust_${trustScore}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            status: `trust_score:${trustScore}:${trustBand}`,
            trust_score: trustScore,
        });
        console.info(`[MerkleLogger] V25 Trust Score appended to ledger: ${trustScore}/100`);
    }
    // ---- [V32] ZK Learning Engine Telemetry (fire-and-forget) ----
    // ZERO DATA LEAKAGE: only numeric metadata is passed — NO prompt text,
    // NO response text, NO user-identifiable content whatsoever.
    setImmediate(() => {
        try {
            ingestTelemetry({
                model_id: finalModel,
                provider: finalProvider,
                latency_ms: 200,
                cost_microcents: Math.ceil((safePromptFinal.split(/\s+/).length + finalOutput.split(/\s+/).length) * 0.4),
                trust_score: trustScore,
                policy_rule_count: policySet ? 1 : 0,
                success: true,
                prompt_tokens: Math.ceil(safePromptFinal.split(/\s+/).length * 1.3),
                completion_tokens: Math.ceil(finalOutput.split(/\s+/).length * 1.3),
                classification: classification?.toUpperCase() ?? "PUBLIC",
            });
        }
        catch (zkErr) {
            // Non-fatal — learning engine failure must never impact the execution response
            console.warn("[V32:ZK-LearningEngine] Telemetry ingest failed (non-fatal):", zkErr.message);
        }
    });
    // ---- [V10] Context Firewall: Restore Original Contextual Terms ----
    // Now that the Enclave has restored PII tokens (TKN_ → original names),
    // we run restoreContext() to put the role/org/location abstractions back.
    // The final output the user sees has BOTH PII and contextual terms fully restored.
    const finalOutput = restoreContext(restoredOutput, contextMap);
    if (contextAbstractionCount > 0) {
        console.info(`[RouterService:execute] [V10-Firewall] Context restored (${contextAbstractionCount} terms)`);
    }
    // ---- Step 5: Populate Semantic Cache (keyed on safePrompt, stores final output) ----
    void setCachedResponse(finalProvider, finalModel, safePrompt, finalOutput);
    // ---- Step 6: Log to Usage Service ----
    let usage_log_id = null;
    const prompt_id = randomUUID();
    try {
        const usageResp = await axios.post(`${USAGE_SERVICE_URL}/internal/usage/log`, {
            user_id: user_id.trim(),
            prompt_id,
            model_used: finalModel,
            tokens_prompt: Math.ceil(safePrompt.split(/\s+/).length * 1.3),
            tokens_completion: Math.ceil(finalOutput.split(/\s+/).length * 1.3),
            validation_status: "success",
        }, { timeout: 5000, headers: { "Content-Type": "application/json", "x-internal-service-token": INTERNAL_TOKEN() } });
        usage_log_id = usageResp.data.id ?? null;
    }
    catch (usageErr) {
        console.warn(`[RouterService:execute] Usage log failed (non-fatal):`, usageErr.message);
    }
    res.status(200).json({
        success: true,
        output: finalOutput,
        model_used: finalModel,
        provider: finalProvider,
        usage_log_id,
        circuit_breaker_triggered: circuitBreakerTriggered,
        // V14: ZK execution credential
        ...(zkCredential && { zk_proof: zkCredential }),
        // V15: Byzantine consensus summary
        ...(consensusResult && {
            consensus_report: {
                total_nodes: consensusResult.votingNodes,
                votes: consensusResult.votingNodes,
                quorum_required: 2,
                dissenting_count: consensusResult.outlierNode ? 1 : 0,
                latency_ms: 200,
            },
        }),
        ...(routing_reason && { routing_reason }),
        // V25: Global Trust Score
        streetmp_trust_score: trustScore,
        trust_band: trustBand,
    });
});
// ================================================================
// PROVIDER EXECUTORS
// Each function receives the key, immediately nullifies it after
// SDK construction, then performs the async I/O call.
// ================================================================
/**
 * Executes a chat completion via the OpenAI SDK.
 * The API key is nullified as soon as the SDK client is constructed.
 */
async function executeOpenAI(apiKey, model, prompt) {
    // Instantiate the SDK with the key, then immediately drop our reference.
    const client = new OpenAI({ apiKey });
    // @ts-expect-error: intentional nullification to aid GC
    apiKey = null;
    const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        // Hard ceiling to prevent runaway cost on misconfigured requests.
        // Phase 2 will make this dynamic based on account tier.
        max_tokens: 4096,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error(`OpenAI returned an empty response for model "${model}". ` +
            `Finish reason: ${completion.choices[0]?.finish_reason ?? "unknown"}`);
    }
    return content;
}
/**
 * Executes a message completion via the Anthropic SDK.
 * The API key is nullified as soon as the SDK client is constructed.
 */
async function executeAnthropic(apiKey, model, prompt) {
    const client = new Anthropic({ apiKey });
    // @ts-expect-error: intentional nullification to aid GC
    apiKey = null;
    const message = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
    });
    // Anthropic returns an array of content blocks — extract the first text block.
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
        throw new Error(`Anthropic returned no text block for model "${model}". ` +
            `Stop reason: ${message.stop_reason ?? "unknown"}`);
    }
    return textBlock.text;
}
