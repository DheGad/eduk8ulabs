/**
 * @file containmentEngine.ts
 * @service router-service
 * @version V37
 * @description Zero-Impact Leakage — Anomaly Containment Protocol
 *
 * Monitors execution telemetry for unauthorized data extraction
 * attempts. If a tripwire is triggered, it instantly:
 *   1. Isolates the tenant (blocks further requests)
 *   2. Revokes the compromised V18 API key
 *   3. Fires an alert to the C-01 Incident Logger
 *
 * ADDITIVE ONLY: Does not modify any V1-V36 logic.
 */
// ─── State ───────────────────────────────────────────────────────────────────
/** Isolated tenants — requests from these are rejected immediately */
const isolatedTenants = new Set();
/** Revoked key IDs — validated against on each request */
const revokedKeys = new Set();
/** Incident log */
const incidentLog = [];
/** Rolling request-per-second counter per tenant */
const rpsCounters = new Map();
// ─── Tripwire Evaluation ─────────────────────────────────────────────────────
/**
 * Evaluate a completed execution for anomaly signals.
 * Call this after every execution with its metadata.
 * Returns the ContainmentEvent if a tripwire fired, or null if clean.
 *
 * @param tenant_id   Tenant making the request
 * @param key_id      API key used
 * @param latency_ms  Execution latency (anomaly if suspiciously fast)
 * @param prompt_size Response payload size in chars (harvesting indicator)
 */
export function evaluateForContainment(params) {
    const { tenant_id, key_id, latency_ms, prompt_size } = params;
    // Skip if tenant already isolated
    if (isolatedTenants.has(tenant_id))
        return null;
    let reason = null;
    // Tripwire 1: Rapid enumeration (RPS check)
    const now = Date.now();
    const rps = rpsCounters.get(tenant_id) ?? { count: 0, window_start: now };
    rps.count++;
    if (now - rps.window_start > 1000) {
        // New window
        rpsCounters.set(tenant_id, { count: 1, window_start: now });
    }
    else {
        rpsCounters.set(tenant_id, rps);
        if (rps.count > 50)
            reason = "RAPID_ENUMERATION";
    }
    // Tripwire 2: Suspiciously large harvest (>50k chars in response)
    if (prompt_size > 50_000)
        reason = "ANOMALOUS_RESPONSE_HARVEST";
    // Tripwire 3: Near-zero latency (cache-poisoning / replay attempt)
    if (latency_ms < 5 && latency_ms >= 0)
        reason = "EXECUTION_STORM";
    if (!reason)
        return null;
    return triggerContainment({ tenant_id, key_id, reason });
}
/**
 * Manually trigger containment for a specific tenant and key.
 * Used by V12 PaC engine, V17 Governor overrides, or external alerts.
 */
export function triggerContainment(params) {
    const { tenant_id, key_id, reason } = params;
    const event = {
        event_id: "cntmt_" + Date.now().toString(36),
        tenant_id,
        key_id,
        reason,
        triggered_at: new Date().toISOString(),
        status: "ISOLATING",
        actions_taken: [],
    };
    // Action 1: Isolate tenant
    isolatedTenants.add(tenant_id);
    event.actions_taken.push(`TENANT_ISOLATED: ${tenant_id}`);
    // Action 2: Revoke API key
    revokedKeys.add(key_id);
    event.actions_taken.push(`KEY_REVOKED: ${key_id}`);
    // Action 3: Fire to C-01 Incident Logger
    fireIncidentAlert(event);
    event.actions_taken.push("C01_ALERT_FIRED");
    event.status = "CONTAINED";
    incidentLog.push(event);
    console.error(`\n🚨 [V37:ContainmentEngine] CONTAINMENT TRIGGERED 🚨\n` +
        `   Reason:  ${reason}\n` +
        `   Tenant:  ${tenant_id}\n` +
        `   Key:     ${key_id}\n` +
        `   Actions: ${event.actions_taken.join(" | ")}\n`);
    return event;
}
/** Fire alert to C-01 Incident Logger (placeholder — integrates with real alerting) */
function fireIncidentAlert(event) {
    // In production: POST to PagerDuty / Opsgenie / Slack webhook
    console.error(`[C01:IncidentLogger] CRITICAL security event logged: ` +
        `${event.event_id} — ${event.reason} — Tenant: ${event.tenant_id}`);
}
// ─── Guard Functions ─────────────────────────────────────────────────────────
/** Returns true if this tenant is currently isolated */
export function isTenantIsolated(tenant_id) {
    return isolatedTenants.has(tenant_id);
}
/** Returns true if this key has been revoked by containment */
export function isKeyRevoked(key_id) {
    return revokedKeys.has(key_id);
}
// ─── Monitoring ───────────────────────────────────────────────────────────────
/** Returns live containment engine status for the V37 UI panel */
export function getContainmentStatus() {
    const total = incidentLog.length;
    const recentIncidents = incidentLog.slice(-5);
    const status = isolatedTenants.size > 0 ? "RED"
        : total > 0 ? "YELLOW"
            : "GREEN";
    return {
        status,
        isolated_tenants: isolatedTenants.size,
        revoked_keys: revokedKeys.size,
        total_incidents: total,
        recent_incidents: recentIncidents,
    };
}
/** Admin clear — manually lifts isolation for a tenant after review */
export function clearIsolation(tenant_id) {
    isolatedTenants.delete(tenant_id);
    const event = incidentLog.find(e => e.tenant_id === tenant_id);
    if (event)
        event.status = "CLEARED";
    console.info(`[V37:ContainmentEngine] Isolation cleared for tenant: ${tenant_id}`);
}
