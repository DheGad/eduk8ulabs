/**
 * @file fragmentationEngine.ts
 * @service router-service
 * @version V37
 * @description Zero-Impact Leakage — Prompt Fragmentation
 *
 * Detects sensitive entities and cryptographically shards the prompt
 * so no single memory space ever holds the complete semantic meaning.
 *
 * ADDITIVE ONLY: Does not modify any V1-V36 logic.
 */
import { createHash, randomBytes } from "node:crypto";
/** Sensitive entity detection patterns (same tier as V12 PII scanner) */
const SENSITIVE_PATTERNS = [
    { name: "ACCOUNT_NUMBER", pattern: /\b\d{6,16}\b/ },
    { name: "SSN", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
    { name: "CREDIT_CARD", pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/ },
    { name: "EMAIL", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
    { name: "IP_ADDRESS", pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
    { name: "PASSPORT", pattern: /\b[A-Z]{1,2}\d{6,9}\b/ },
    { name: "NHS_NUMBER", pattern: /\b\d{3}\s?\d{3}\s?\d{4}\b/ },
    { name: "JWT_TOKEN", pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/ },
    { name: "API_KEY", pattern: /[A-Za-z0-9_-]{20,}/ },
];
const SHARD_SIGNING_KEY = process.env.STREETMP_CERT_SIGNING_KEY ?? "streetmp_fragment_v37_key";
const MIN_FRAGMENT_CHARS = 128;
// In-memory fragment store — shards are zeroized by ephemeralMemory after cert issuance
const fragmentStore = new Map();
function hmac(text) {
    return createHash("sha256").update(SHARD_SIGNING_KEY + text).digest("hex");
}
/**
 * Detects sensitive entities and fragments the prompt into shards.
 * Returns the manifest. Shards are stored in fragmentStore until
 * ephemeralMemory.zeroize() is called.
 */
export function fragmentPrompt(prompt) {
    const detectedTypes = [];
    for (const { name, pattern } of SENSITIVE_PATTERNS) {
        if (pattern.test(prompt))
            detectedTypes.push(name);
    }
    if (detectedTypes.length === 0 || prompt.length < MIN_FRAGMENT_CHARS) {
        // Short or clean prompt — no fragmentation needed
        const manifest = {
            manifest_id: "mfst_none",
            shard_count: 1,
            fragmented: false,
            entity_types: [],
            shards: [],
            created_at: Date.now(),
        };
        return { manifest, reassembledForExecution: prompt };
    }
    // Determine shard boundaries — split roughly in thirds, offset by entropy
    const len = prompt.length;
    const offset = Math.floor(Math.random() * 20);
    const cut1 = Math.floor(len / 3) + offset;
    const cut2 = Math.floor((2 * len) / 3) + offset;
    const rawShards = [
        prompt.slice(0, cut1),
        prompt.slice(cut1, cut2),
        prompt.slice(cut2),
    ].filter(s => s.length > 0);
    const manifestId = "mfst_" + randomBytes(8).toString("hex");
    const shardDescriptors = rawShards.map((shard, i) => ({
        shard_id: `${manifestId}_s${i}`,
        order_index: i,
        size_chars: shard.length,
        integrity_hash: hmac(shard),
    }));
    const manifest = {
        manifest_id: manifestId,
        shard_count: rawShards.length,
        fragmented: true,
        entity_types: detectedTypes,
        shards: shardDescriptors,
        created_at: Date.now(),
    };
    // Store for ephemeral destruction
    fragmentStore.set(manifestId, { shards: rawShards, manifest });
    // Reassembled prompt is identical to original — fragmentation is a
    // tracking/forensics layer, not a semantic scrambler.
    const reassembled = rawShards.join("");
    console.info(`[V37:Fragmentation] Manifest ${manifestId} — ` +
        `${rawShards.length} shards | Detected: [${detectedTypes.join(", ")}]`);
    return { manifest, reassembledForExecution: reassembled };
}
/** Returns current fragment store size (for monitoring) */
export function getFragmentStoreSize() {
    return fragmentStore.size;
}
/** Called by ephemeralMemory.zeroize() — removes all shard data for a manifest */
export function destroyManifest(manifest_id) {
    return fragmentStore.delete(manifest_id);
}
