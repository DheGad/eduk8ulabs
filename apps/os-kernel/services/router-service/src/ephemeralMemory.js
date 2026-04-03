/**
 * @file ephemeralMemory.ts
 * @service router-service
 * @version V37
 * @description Zero-Impact Leakage — Ephemeral Buffer Zeroization
 *
 * Registers sensitive buffers against an execution certificate ID.
 * The instant the certificate is issued (V36), all registered buffers
 * are zeroized — overwritten with a zero-byte pattern in-place.
 *
 * ADDITIVE ONLY: Does not modify any V1-V36 logic.
 */
import { destroyManifest } from "./fragmentationEngine.js";
/** In-memory ephemeral registry — keyed by execution certificate ID */
const registry = new Map();
/** Counters for the V37 UI panel */
let totalZeroized = 0; // Total buffers zeroized lifetime
let totalManifests = 0; // Total manifests destroyed lifetime
/**
 * Registers buffers and fragment manifests to be destroyed when
 * `zeroize(exec_id)` is called.
 *
 * Call this BEFORE execution begins for any sensitive execution context.
 */
export function registerEphemeral(params) {
    const existing = registry.get(params.exec_id);
    if (existing) {
        if (params.manifest_ids)
            existing.manifest_ids.push(...params.manifest_ids);
        if (params.buffers)
            existing.buffers.push(...params.buffers);
    }
    else {
        registry.set(params.exec_id, {
            exec_id: params.exec_id,
            manifest_ids: params.manifest_ids ?? [],
            buffers: params.buffers ?? [],
            registered_at: Date.now(),
        });
    }
}
/**
 * Zeroizes ALL registered buffers and destroys all fragment manifests
 * associated with this execution ID.
 *
 * Called immediately after the V36 ExecutionCertificate is issued.
 * Returns the count of buffers zeroized.
 */
export function zeroize(exec_id) {
    const reg = registry.get(exec_id);
    if (!reg) {
        return { buffers_zeroized: 0, manifests_destroyed: 0 };
    }
    // Overwrite each Buffer in-place with zeros
    let buffersZeroized = 0;
    for (const buf of reg.buffers) {
        buf.fill(0);
        buffersZeroized++;
    }
    // Destroy all fragment manifests
    let manifestsDestroyed = 0;
    for (const mid of reg.manifest_ids) {
        if (destroyManifest(mid))
            manifestsDestroyed++;
    }
    reg.destroyed_at = Date.now();
    totalZeroized += buffersZeroized;
    totalManifests += manifestsDestroyed;
    reg.buffers.length = 0;
    reg.manifest_ids.length = 0;
    // Remove from registry after destruction
    registry.delete(exec_id);
    console.info(`[V37:EphemeralMemory] Zeroized exec=${exec_id} | ` +
        `Buffers: ${buffersZeroized} | Manifests: ${manifestsDestroyed} | ` +
        `Elapsed: ${reg.destroyed_at - reg.registered_at}ms`);
    return { buffers_zeroized: buffersZeroized, manifests_destroyed: manifestsDestroyed };
}
/**
 * Force-purge all registrations older than `maxAgeMs`.
 * Called on server startup and as a periodic safety net.
 */
export function purgeStaleRegistrations(maxAgeMs = 30_000) {
    let purged = 0;
    const now = Date.now();
    for (const [exec_id, reg] of registry.entries()) {
        if (now - reg.registered_at > maxAgeMs) {
            zeroize(exec_id);
            purged++;
        }
    }
    if (purged > 0) {
        console.warn(`[V37:EphemeralMemory] Purged ${purged} stale registrations (TTL exceeded).`);
    }
    return purged;
}
/** Returns live V37 telemetry for the UI Security panel */
export function getEphemeralStats() {
    return {
        active_registrations: registry.size,
        total_buffers_zeroized: totalZeroized,
        total_manifests_destroyed: totalManifests,
    };
}
