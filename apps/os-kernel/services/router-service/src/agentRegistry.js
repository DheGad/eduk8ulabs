/**
 * @file agentRegistry.ts
 * @service router-service
 * @version V41
 * @description M2M Sovereign Handshake — Agent Registry
 *
 * Registers autonomous enterprise AI agents, each with a clearance
 * level and an explicit set of allowed communication scopes.
 * Scopes are enforced during M2M handshake brokering.
 *
 * ADDITIVE ONLY: Does not modify V1-V40 routing logic.
 */
// ─── In-Memory Registry ───────────────────────────────────────────────────────
const agentStore = new Map();
// Pre-seed demo agents for three enterprise tenants
const seedAgents = [
    {
        agent_id: "agt_jpmc_finance_001",
        name: "JPMC Finance Agent",
        owner_tenant: "jpmc",
        clearance_level: "TOP_SECRET",
        allowed_scopes: ["READ_FINANCE", "WRITE_FINANCE"],
        model: "gpt-4o",
        registered_at: "2026-01-15T00:00:00Z",
        active: true,
    },
    {
        agent_id: "agt_jpmc_hr_001",
        name: "JPMC HR Agent",
        owner_tenant: "jpmc",
        clearance_level: "CONFIDENTIAL",
        allowed_scopes: ["READ_HR", "WRITE_HR"],
        model: "claude-3-5-sonnet",
        registered_at: "2026-01-15T00:00:00Z",
        active: true,
    },
    {
        agent_id: "agt_nhs_clinical_001",
        name: "NHS Clinical Agent",
        owner_tenant: "nhs",
        clearance_level: "TOP_SECRET",
        allowed_scopes: ["READ_MEDICAL"],
        model: "claude-3-5-sonnet",
        registered_at: "2026-01-20T00:00:00Z",
        active: true,
    },
    {
        agent_id: "agt_klust_rd_001",
        name: "Klust R&D Agent",
        owner_tenant: "klust",
        clearance_level: "INTERNAL",
        allowed_scopes: ["READ_FINANCE", "READ_HR"],
        model: "gemini-1.5-flash",
        registered_at: "2026-02-01T00:00:00Z",
        active: true,
    },
];
for (const a of seedAgents)
    agentStore.set(a.agent_id, a);
// ─── Public API ───────────────────────────────────────────────────────────────
export function registerAgent(params) {
    const agent = { ...params, registered_at: new Date().toISOString() };
    agentStore.set(agent.agent_id, agent);
    console.info(`[V41:AgentRegistry] Registered agent "${agent.name}" (${agent.agent_id}) — Clearance: ${agent.clearance_level}`);
    return agent;
}
export function getAgent(agent_id) {
    return agentStore.get(agent_id) ?? null;
}
export function listAgents(tenant_id) {
    const all = Array.from(agentStore.values());
    return tenant_id ? all.filter(a => a.owner_tenant === tenant_id) : all;
}
/** Touch last_active timestamp */
export function touchAgent(agent_id) {
    const a = agentStore.get(agent_id);
    if (a)
        agentStore.set(agent_id, { ...a, last_active: new Date().toISOString() });
}
export function deactivateAgent(agent_id) {
    const a = agentStore.get(agent_id);
    if (!a)
        return false;
    agentStore.set(agent_id, { ...a, active: false });
    return true;
}
export function getTotalAgentCount() { return agentStore.size; }
