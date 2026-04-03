"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { LogHunter } from "./components/LogHunter";
import { GovernanceNexus } from "./components/GovernanceNexus";
import { AIWorkspace } from "./components/AIWorkspace";
import { ComplianceConsole } from "./components/ComplianceConsole";
import type { PIIEvent } from "./components/AIWorkspace";

// ── Types ────────────────────────────────────────────────────────────────────

interface Org {
  id: string;
  name: string;
  plan_tier: string;
  usage: number;
  limit: number;
}

interface Revenue {
  stripe_usd: number;
  razorpay_inr: number;
  total_usd_approx: number;
}

interface InfraSnapshot {
  cpu?: { usagePct: number; model: string };
  ram?: { usagePct: number; usedGb: number; totalGb: number };
  redis?: { status: string; latencyMs: number };
  database?: { activeConnections: number };
}

export default function HQDashboard() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [infra, setInfra] = useState<InfraSnapshot | null>(null);
  const [piiEvents, setPIIEvents] = useState<PIIEvent[]>([]);

  // fetchAll as a ref so we can call it both immediately and in the interval
  // without adding it as a useEffect dep (it doesn't change)
  const fetchAllRef = useRef(async () => {
    try {
      const [oRes, tRes, rRes, iRes] = await Promise.all([
        fetch("/api/bridge/organizations"),
        fetch("/api/bridge/threats"),
        fetch("/api/bridge/revenue"),
        fetch("/api/bridge/infra")
      ]);
      const [o, , r, i] = await Promise.all([oRes.json(), tRes.json(), rRes.json(), iRes.json()]);
      if (o.success) setOrgs(o.data as Org[]);
      if (r.success) setRevenue(r.data as Revenue);
      if (i.success) setInfra(i.data as InfraSnapshot);
    } catch {
      // Silenced — bridge may be offline during local dev
    }
  });

  useEffect(() => {
    // Capture value at mount time to avoid stale closure
    const doFetch = fetchAllRef.current;
    const controller = new AbortController();
    void doFetch();
    const interval = setInterval(() => void doFetch(), 10000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  const suspendOrg = async (id: string) => {
    await fetch(`/api/bridge/organizations/${id}/suspend`, { method: "PATCH" });
    void fetchAllRef.current();
  };

  const upgradeOrg = async (id: string) => {
    await fetch(`/api/bridge/organizations/${id}/upgrade`, { method: "PATCH" });
    void fetchAllRef.current();
  };

  const runOverride = async (type: "backup" | "audit") => {
    const res = await fetch(`/api/bridge/override/${type}`, { method: "POST" });
    const data = await res.json();
    // Phase 6: no raw console.log with server data
    const label = type === "backup" ? "Backup Shell" : "Full Audit";
    alert(`${label} override completed. Status: ${data.success ? "OK" : data.error ?? "unknown"}`);
  };

  const impersonate = async (userId: string) => {
    const res = await fetch("/api/bridge/impersonate", {
      method: "POST",
      body: JSON.stringify({ target_user_id: userId, staff_user_id: "local_staff" })
    });
    const data = await res.json();
    if (data.success) {
      alert(`[Impersonation Vault]\n\nToken generated for ${data.target_email}.\nValid for 15m. Attach this to your frontend URL param to jump in.`);
    } else {
      alert("Impersonation failed: " + data.error);
    }
  };

  const handlePIIEvent = useCallback((event: PIIEvent) => {
    setPIIEvents((prev) => [event, ...prev]);
  }, []);

  return (
    <div className="p-8 space-y-8">
      {/* Top Header - The Cockpit */}
      <header className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold text-white tracking-tight">Business Operations Cockpit</h2>
           <p className="text-zinc-500">Real-time HQ metrics and infrastructure monitoring.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => runOverride("backup")} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium text-sm transition-colors border border-zinc-700">
            Trigger Backup Shell
          </button>
          <button onClick={() => runOverride("audit")} className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-100 rounded font-medium text-sm transition-colors border border-red-800">
            Trigger Full Audit
          </button>
        </div>
      </header>

      {/* Active Governance UI */}
      <GovernanceNexus />

      {/* Row 1: Infrastructure Pulse & Revenue Nexus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Infra Pulse */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Infrastructure Pulse</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/50">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">CPU Load</div>
              <div className="text-2xl text-zinc-200">{infra?.cpu?.usagePct || 0}%</div>
              <div className="text-xs text-zinc-600 mt-1 truncate">{infra?.cpu?.model || "Calculating..."}</div>
            </div>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/50">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">RAM Usage</div>
              <div className="text-2xl text-zinc-200">{infra?.ram?.usagePct || 0}%</div>
              <div className="text-xs text-zinc-600 mt-1">{infra?.ram?.usedGb || 0}GB / {infra?.ram?.totalGb || 0}GB</div>
            </div>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/50">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Redis</div>
              <div className="text-2xl text-zinc-200 flex items-center gap-2">
                {infra?.redis?.status === "ONLINE" ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-red-500" />}
                {(infra?.redis?.latencyMs ?? -1) >= 0 ? `${infra?.redis?.latencyMs}ms` : "OFFLINE"}
              </div>
            </div>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/50">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Postgres Pool</div>
              <div className="text-2xl text-zinc-200">
                {infra?.database?.activeConnections || 0} <span className="text-sm text-zinc-500">active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Revenue Nexus */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Nexus</h3>
          <div className="bg-zinc-950 p-6 rounded-lg border border-zinc-800/50 mb-4">
             <div className="text-sm text-emerald-500 font-mono mb-2">Total Net ARR Approximation</div>
             <div className="text-4xl font-light text-white tracking-tight">
               ${revenue ? revenue.total_usd_approx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
               <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Stripe Global (USD)</div>
               <div className="text-xl text-zinc-200">${revenue?.stripe_usd.toLocaleString() || "0"}</div>
            </div>
            <div>
               <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Razorpay India (INR)</div>
               <div className="text-xl text-zinc-200">₹{revenue?.razorpay_inr.toLocaleString() || "0"}</div>
               <div className="text-xs text-zinc-500 italic">Pre-GST collection amount</div>
            </div>
          </div>
        </section>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Organization Overlord */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Organization Overlord</h3>
            <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-400">Total: {orgs.length}</span>
          </div>
          <div className="p-0 overflow-y-auto max-h-[400px]">
             <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950 text-zinc-500 sticky top-0">
                <tr>
                  <th className="font-medium px-6 py-3 border-b border-zinc-800">Org</th>
                  <th className="font-medium px-6 py-3 border-b border-zinc-800">Tier &amp; Usage</th>
                  <th className="font-medium px-6 py-3 border-b border-zinc-800 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900">
                {orgs.map(org => (
                  <tr key={org.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-200">
                       {org.name}
                       <div className="text-xs text-zinc-500 font-mono mt-1">{org.id.split('-')[0]}***</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded text-xs font-semibold mr-3 ${org.plan_tier === 'ENTERPRISE' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>{org.plan_tier}</span>
                       <span className="text-xs text-zinc-500 font-mono">{org.usage} / {org.limit} reqs</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => suspendOrg(org.id)} className="text-xs text-orange-400 hover:text-orange-300">Suspend</button>
                      <button onClick={() => upgradeOrg(org.id)} className="text-xs text-emerald-400 hover:text-emerald-300">Upgrade (Pro)</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* The Impersonation Vault */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-white">The Impersonation Vault</h3>
            <p className="text-xs text-zinc-500 mt-1">Generate 15-minute secure access tokens for target accounts.</p>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center items-center text-center border-b border-zinc-800">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-emerald-500/50 mb-4 mx-auto"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <p className="text-sm text-zinc-400 max-w-sm mb-6">Enter a User ID to construct a temporary JWT mirroring their organizational context. This action will be logged.</p>
            <form onSubmit={(e) => { e.preventDefault(); void impersonate((e.currentTarget.elements.namedItem("userId") as HTMLInputElement).value); }} className="flex w-full max-w-sm">
               <input name="userId" placeholder="Enter target User UUID..." className="flex-1 bg-zinc-950 border border-zinc-800 rounded-l px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700" required />
               <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium rounded-r transition-colors">Mint Token</button>
            </form>
          </div>
        </section>

      </div>

      {/* ── Phase 6: Sovereign AI Workspace + Compliance Console ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <div className="xl:col-span-3">
          <AIWorkspace onPIIEvent={handlePIIEvent} />
        </div>
        <div className="xl:col-span-2">
          <ComplianceConsole events={piiEvents} />
        </div>
      </div>

      {/* Full Width Log Hunter */}
      <section>
         <LogHunter />
      </section>

    </div>
  );
}
