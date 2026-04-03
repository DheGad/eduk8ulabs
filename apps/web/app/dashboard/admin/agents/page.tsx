"use client";

import { useState, useEffect, useCallback } from "react";

type AgentClearance = "TOP_SECRET" | "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";

interface Agent {
  agent_id:        string;
  name:            string;
  owner_tenant:    string;
  clearance_level: AgentClearance;
  allowed_scopes:  string[];
  model:           string;
  active:          boolean;
  last_active?:    string;
}

interface HandshakeEvent {
  handshake_id: string;
  agent_a:      string;
  agent_b:      string;
  status:       "APPROVED" | "DENIED";
  reason?:      string;
  brokered_at:  string;
}

interface HandshakeStats {
  total_approved: number;
  total_denied:   number;
  active_tokens:  number;
  recent_events:  HandshakeEvent[];
}

// Demo data mirroring the backend seeds
const DEMO_AGENTS: Agent[] = [
  { agent_id: "agt_jpmc_finance_001", name: "JPMC Finance Agent",  owner_tenant: "jpmc",  clearance_level: "TOP_SECRET",   allowed_scopes: ["READ_FINANCE","WRITE_FINANCE"], model: "gpt-4o",             active: true,  last_active: new Date(Date.now() - 12000).toISOString() },
  { agent_id: "agt_jpmc_hr_001",      name: "JPMC HR Agent",       owner_tenant: "jpmc",  clearance_level: "CONFIDENTIAL", allowed_scopes: ["READ_HR","WRITE_HR"],           model: "claude-3-5-sonnet", active: true,  last_active: new Date(Date.now() - 34000).toISOString() },
  { agent_id: "agt_nhs_clinical_001", name: "NHS Clinical Agent",  owner_tenant: "nhs",   clearance_level: "TOP_SECRET",   allowed_scopes: ["READ_MEDICAL"],                 model: "claude-3-5-sonnet", active: true,  last_active: new Date(Date.now() - 81000).toISOString() },
  { agent_id: "agt_klust_rd_001",     name: "Klust R&D Agent",     owner_tenant: "klust", clearance_level: "INTERNAL",     allowed_scopes: ["READ_FINANCE","READ_HR"],       model: "gemini-1.5-flash",  active: false, last_active: new Date(Date.now() - 320000).toISOString() },
];

const CLEARANCE_STYLES: Record<AgentClearance, string> = {
  TOP_SECRET:   "bg-red-500/10 text-red-300 border-red-500/30",
  CONFIDENTIAL: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  INTERNAL:     "bg-blue-500/10 text-blue-300 border-blue-500/30",
  PUBLIC:       "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

const DEMO_EVENTS: HandshakeEvent[] = [
  { handshake_id: "hs_a1b2c3", agent_a: "agt_jpmc_finance_001", agent_b: "agt_jpmc_hr_001",      status: "APPROVED", brokered_at: new Date(Date.now() - 18000).toISOString() },
  { handshake_id: "hs_d4e5f6", agent_a: "agt_klust_rd_001",     agent_b: "agt_nhs_clinical_001", status: "DENIED",   reason: "Cross-tenant blocked — lacks CROSS_TENANT_BRIDGE scope", brokered_at: new Date(Date.now() - 55000).toISOString() },
  { handshake_id: "hs_g7h8i9", agent_a: "agt_jpmc_finance_001", agent_b: "agt_nhs_clinical_001", status: "DENIED",   reason: "No overlapping scopes between agents", brokered_at: new Date(Date.now() - 112000).toISOString() },
];

function agentName(id: string) { return DEMO_AGENTS.find(a => a.agent_id === id)?.name ?? id; }
function relativeTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AgentSwarmPage() {
  const [stats, setStats] = useState<HandshakeStats>({ total_approved: 1, total_denied: 2, active_tokens: 0, recent_events: DEMO_EVENTS });
  const [agentA, setAgentA] = useState("agt_jpmc_finance_001");
  const [agentB, setAgentB] = useState("agt_jpmc_hr_001");
  const [brokering, setBrokering] = useState(false);
  const [lastResult, setLastResult] = useState<{ approved: boolean; reason?: string; token?: string } | null>(null);
  const [tick, setTick] = useState(0);

  // Tick for relative time updates
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // Fetch live stats from the backend
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/m2m/stats");
      if (res.ok) {
        const data = await res.json() as HandshakeStats;
        setStats(data);
      }
    } catch { /* stay on demo data */ }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const handleBroker = async () => {
    if (agentA === agentB) return;
    setBrokering(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/proxy/m2m/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_a_id:   agentA,
          agent_b_id:   agentB,
          payload_hash: "0x" + Math.random().toString(16).slice(2, 18).toUpperCase(),
        }),
      });
      const data = await res.json() as any;
      setLastResult({
        approved: data.approved,
        reason:   data.denied_reason,
        token:    data.zk_contract_token?.slice(0, 24) + "...",
      });
      void fetchStats();
    } catch {
      setLastResult({ approved: false, reason: "Network error — is the kernel running?" });
    } finally {
      setBrokering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-8 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Agent Swarm Command Center</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          V41 M2M Sovereign Handshake — register autonomous agents and broker zero-trust inter-agent communication.
        </p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Registered Agents",       val: DEMO_AGENTS.length,          color: "text-white" },
          { label: "Approved Handshakes",      val: stats.total_approved,        color: "text-emerald-400" },
          { label: "Denied (Threats Blocked)", val: stats.total_denied,          color: "text-red-400" },
          { label: "Active ZK Tokens",         val: stats.active_tokens,         color: "text-blue-400" },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className={`text-3xl font-black font-mono ${k.color}`}>{k.val}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* LEFT: Agent Roster */}
        <div className="col-span-3 space-y-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Registered Agent Roster</p>
          {DEMO_AGENTS.map(agent => (
            <div key={agent.agent_id} className={`rounded-2xl border p-5 flex items-center gap-5 transition-all ${agent.active ? "border-slate-800 bg-slate-900/50" : "border-slate-800/40 bg-slate-900/20 opacity-50"}`}>
              {/* Status dot */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg">🤖</div>
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0F172A] ${agent.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{agent.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">{agent.agent_id}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CLEARANCE_STYLES[agent.clearance_level]}`}>
                    {agent.clearance_level.replace("_", " ")}
                  </span>
                  {agent.allowed_scopes.map(s => (
                    <span key={s} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{s}</span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-500 font-mono">{agent.model}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{agent.last_active ? relativeTime(agent.last_active) : "Never"}</p>
                <p className="text-[9px] font-bold uppercase text-slate-600">{agent.owner_tenant}</p>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: Broker + Event Log */}
        <div className="col-span-2 space-y-5">
          {/* Handshake Broker */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Broker Handshake</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5 uppercase tracking-widest">Agent A</label>
                <select
                  value={agentA}
                  onChange={e => setAgentA(e.target.value)}
                  aria-label="Select Agent A"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {DEMO_AGENTS.map(a => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-center text-slate-600 text-lg">⇄</div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5 uppercase tracking-widest">Agent B</label>
                <select
                  value={agentB}
                  onChange={e => setAgentB(e.target.value)}
                  aria-label="Select Agent B"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {DEMO_AGENTS.map(a => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={handleBroker}
              disabled={brokering || agentA === agentB}
              className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {brokering
                ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Brokering...</>
                : "🤝 Broker Handshake"}
            </button>

            {/* Result */}
            {lastResult && (
              <div className={`rounded-xl border px-4 py-3 text-xs animate-in fade-in
                ${lastResult.approved ? "border-emerald-500/30 bg-emerald-950/30" : "border-red-500/30 bg-red-950/30"}`}>
                {lastResult.approved ? (
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-300">✅ Handshake Approved</p>
                    <p className="text-slate-400 font-mono break-all">Token: {lastResult.token}</p>
                    <p className="text-slate-600">Expires in 30 seconds. Single-use only.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-bold text-red-300">⛔ Handshake Denied</p>
                    <p className="text-slate-400">{lastResult.reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Event log */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Handshake Log</p>
            </div>
            <div className="divide-y divide-slate-800/60">
              {(stats.recent_events.length > 0 ? stats.recent_events : DEMO_EVENTS).map(ev => (
                <div key={ev.handshake_id} className="px-5 py-3 flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-sm">{ev.status === "APPROVED" ? "✅" : "⛔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-300 font-medium truncate">
                      {agentName(ev.agent_a)} ↔ {agentName(ev.agent_b)}
                    </p>
                    {ev.reason && <p className="text-[10px] text-red-400 mt-0.5 truncate">{ev.reason}</p>}
                    <p className="text-[9px] font-mono text-slate-600 mt-0.5">{ev.handshake_id}</p>
                  </div>
                  <span className="text-[9px] text-slate-600 shrink-0">
                    {relativeTime(ev.brokered_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
