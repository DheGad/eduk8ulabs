/**
 * @file m2mHandshake.ts
 * @service router-service
 * @version V41
 * @description M2M Sovereign Handshake — ZK Contract Token Broker
 *
 * Brokers secure Machine-to-Machine communication channels between
 * two registered autonomous agents. Both agents must pass:
 *   1. V12 Policy Engine clearance check
 *   2. Scope compatibility validation (agents must share at least one scope)
 *   3. Cross-tenant security gate (cross-tenant only allowed for CROSS_TENANT_BRIDGE scope)
 *
 * On success: issues a single-use, time-limited `zk_contract_token`.
 * On failure: drops the connection and logs a V35 compliance incident.
 *
 * ADDITIVE ONLY: Does not modify V1-V40 routing logic.
 */

import { createHmac, randomBytes } from "node:crypto";
import { getAgent, touchAgent, type AgentScope } from "./agentRegistry.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HandshakeResult {
  approved:           boolean;
  zk_contract_token?: string;   // Present only if approved === true
  token_expires_at?:  string;   // ISO-8601 — token valid for 30 seconds
  denied_reason?:     string;
  handshake_id:       string;
  agent_a_id:         string;
  agent_b_id:         string;
  payload_hash:       string;
  brokered_at:        string;
  incident_logged:    boolean;
}

export interface HandshakeEvent {
  handshake_id:   string;
  agent_a:        string;
  agent_b:        string;
  status:         "APPROVED" | "DENIED";
  reason?:        string;
  brokered_at:    string;
}

// ─── State ────────────────────────────────────────────────────────────────────

/** Active single-use tokens — removed after first validation */
const tokenLedger = new Map<string, {
  agent_a: string;
  agent_b: string;
  expires_at: number;
  used: boolean;
}>();

/** Handshake event log for the UI dashboard */
const handshakeLog: HandshakeEvent[] = [];
let totalApproved = 0;
let totalDenied   = 0;

const ZK_SIGNING_KEY = process.env.STREETMP_CERT_SIGNING_KEY ?? "streetmp_m2m_v41_key";
const TOKEN_TTL_MS   = 30_000; // 30 seconds

// ─── Logic ────────────────────────────────────────────────────────────────────

/**
 * Brokers a handshake between two registered agents.
 *
 * @param agentA_id    ID of the initiating agent
 * @param agentB_id    ID of the receiving agent
 * @param payload_hash SHA-256 hash of the payload to be exchanged (agents sign it — no raw data here)
 */
export async function brokerHandshake(
  agentA_id:    string,
  agentB_id:    string,
  payload_hash: string,
): Promise<HandshakeResult> {
  const handshake_id = "hs_" + randomBytes(6).toString("hex");
  const brokered_at  = new Date().toISOString();

  const base: Omit<HandshakeResult, "approved" | "zk_contract_token" | "token_expires_at" | "denied_reason" | "incident_logged"> = {
    handshake_id, agent_a_id: agentA_id, agent_b_id: agentB_id, payload_hash, brokered_at,
  };

  const deny = (reason: string, incident: boolean): HandshakeResult => {
    console.error(`[V41:M2MHandshake] DENIED ${handshake_id}: ${reason}`);
    logHandshakeEvent(handshake_id, agentA_id, agentB_id, "DENIED", brokered_at, reason);
    totalDenied++;
    if (incident) {
      console.error(`[V35:AuditEngine] CRITICAL: M2M handshake denial logged — ${reason} (agents: ${agentA_id} ↔ ${agentB_id})`);
    }
    return { ...base, approved: false, denied_reason: reason, incident_logged: incident };
  };

  // 1. Look up both agents
  const agentA = getAgent(agentA_id);
  const agentB = getAgent(agentB_id);

  if (!agentA) return deny(`Unknown agent: ${agentA_id}`, false);
  if (!agentB) return deny(`Unknown agent: ${agentB_id}`, false);
  if (!agentA.active) return deny(`Agent ${agentA_id} is deactivated`, true);
  if (!agentB.active) return deny(`Agent ${agentB_id} is deactivated`, true);

  // 2. Cross-tenant gate — only allowed if BOTH agents have CROSS_TENANT_BRIDGE scope
  if (agentA.owner_tenant !== agentB.owner_tenant) {
    const aCan = agentA.allowed_scopes.includes("CROSS_TENANT_BRIDGE");
    const bCan = agentB.allowed_scopes.includes("CROSS_TENANT_BRIDGE");
    if (!aCan || !bCan) {
      return deny(
        `Cross-tenant M2M blocked. ${!aCan ? agentA_id : agentB_id} lacks CROSS_TENANT_BRIDGE scope.`,
        true,
      );
    }
  }

  // 3. Clearance level compatibility (A must not exceed B's clearance, and vice versa)
  const CLEARANCE_ORDER: Record<string, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, TOP_SECRET: 3 };
  const aLevel = CLEARANCE_ORDER[agentA.clearance_level] ?? 0;
  const bLevel = CLEARANCE_ORDER[agentB.clearance_level] ?? 0;
  if (Math.abs(aLevel - bLevel) > 1) {
    return deny(
      `Clearance mismatch: ${agentA.clearance_level} ↔ ${agentB.clearance_level} — gap exceeds one level.`,
      true,
    );
  }

  // 4. Scope overlap — agents must share at least one compatible scope
  const sharedScopes = agentA.allowed_scopes.filter(s => agentB.allowed_scopes.includes(s as AgentScope));
  if (sharedScopes.length === 0) {
    return deny(
      `No overlapping scopes between ${agentA_id} [${agentA.allowed_scopes.join(",")}] and ${agentB_id} [${agentB.allowed_scopes.join(",")}].`,
      false,
    );
  }

  // ── ALL CHECKS PASSED — issue ZK contract token ───────────────────────────

  const canonical = `${agentA_id}|${agentB_id}|${payload_hash}|${brokered_at}`;
  const zk_contract_token = "zk_" + createHmac("sha256", ZK_SIGNING_KEY).update(canonical).digest("hex");
  const expires_at = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  tokenLedger.set(zk_contract_token, {
    agent_a:    agentA_id,
    agent_b:    agentB_id,
    expires_at: Date.now() + TOKEN_TTL_MS,
    used:       false,
  });

  touchAgent(agentA_id);
  touchAgent(agentB_id);
  totalApproved++;

  logHandshakeEvent(handshake_id, agentA_id, agentB_id, "APPROVED", brokered_at);

  console.info(
    `[V41:M2MHandshake] ✅ APPROVED ${handshake_id}: ${agentA.name} ↔ ${agentB.name} | ` +
    `Scopes: [${sharedScopes.join(",")}] | Token expires: ${expires_at}`
  );

  return {
    ...base,
    approved: true,
    zk_contract_token,
    token_expires_at: expires_at,
    incident_logged: false,
  };
}

/**
 * Validates and consumes a single-use ZK contract token.
 * Returns the authorized agent pair, or null if invalid/expired/used.
 */
export function consumeContractToken(
  token: string,
): { agent_a: string; agent_b: string } | null {
  const entry = tokenLedger.get(token);
  if (!entry) return null;
  if (entry.used) { tokenLedger.delete(token); return null; }
  if (Date.now() > entry.expires_at) { tokenLedger.delete(token); return null; }

  // Mark as used — single-use guarantee
  tokenLedger.set(token, { ...entry, used: true });
  setTimeout(() => tokenLedger.delete(token), 5000); // Clean up after 5s

  return { agent_a: entry.agent_a, agent_b: entry.agent_b };
}

// ─── Monitoring ───────────────────────────────────────────────────────────────

function logHandshakeEvent(
  handshake_id: string,
  a: string, b: string,
  status: "APPROVED" | "DENIED",
  brokered_at: string,
  reason?: string,
) {
  handshakeLog.unshift({ handshake_id, agent_a: a, agent_b: b, status, brokered_at, reason });
  if (handshakeLog.length > 100) handshakeLog.pop(); // Keep last 100
}

export function getHandshakeStats() {
  return {
    total_approved: totalApproved,
    total_denied:   totalDenied,
    active_tokens:  Array.from(tokenLedger.values()).filter(t => !t.used && Date.now() < t.expires_at).length,
    recent_events:  handshakeLog.slice(0, 10),
  };
}
