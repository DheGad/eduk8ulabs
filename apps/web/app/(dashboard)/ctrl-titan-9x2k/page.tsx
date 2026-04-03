"use client";

import { useEffect, useState } from "react";
import { LiveKernelTrace } from "./components/LiveKernelTrace";

interface OrgRow {
  id:               string;
  name:             string;
  billing_provider: string | null;
  plan_tier:        string;
  usage:            number;
  limit:            number;
}

interface ThreatRow {
  id:         string;
  risk_score: number;
  event_type: string;
  ip_address: string;
  org_name:   string | null;
}

export default function TitanCommandCenter() {
  const [orgs, setOrgs]       = useState<OrgRow[]>([]);
  const [threats, setThreats] = useState<ThreatRow[]>([]);
  const [revenue, setRevenue] = useState<{ stripe_usd: number; razorpay_inr: number; total_usd_approx: number } | null>(null);

  // Note: Standard Next.js fetching from router-service through a proxy or directly if CORS allows.
  // We assume apps/web/next.config.js routes `/api/internal/...` to `:4000/api/v1/...`
  // But since we just built the endpoint on :4000 and the Next.js routes to router-service via `ROUTER_SERVICE_URL` server-side,
  // we will call Next.js API endpoints we create below (proxy pattern) or fetch directly if exposed.
  // For simplicity, we'll hit proxy routes under `/api/ctrl-titan-9x2k/proxy/...`
  
  const fetchAll = async () => {
    try {
      const [oRes, tRes, rRes] = await Promise.all([
        fetch("/api/ctrl-titan-9x2k/proxy/titan/organizations"),
        fetch("/api/ctrl-titan-9x2k/proxy/titan/threats"),
        fetch("/api/ctrl-titan-9x2k/proxy/titan/revenue")
      ]);
      const [o, t, r] = await Promise.all([oRes.json(), tRes.json(), rRes.json()]);
      if (o.success) setOrgs(o.data);
      if (t.success) setThreats(t.data);
      if (r.success) setRevenue(r.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const suspendOrg = async (id: string) => {
    await fetch(`/api/ctrl-titan-9x2k/proxy/titan/organizations/${id}/suspend`, { method: "PATCH" });
    fetchAll();
  };

  const upgradeOrg = async (id: string) => {
    await fetch(`/api/ctrl-titan-9x2k/proxy/titan/organizations/${id}/upgrade`, { method: "PATCH" });
    fetchAll();
  };

  const blockIp = async (ip: string) => {
    await fetch(`/api/ctrl-titan-9x2k/proxy/titan/threats/block`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip_address: ip, reason: "Titan UI Override" })
    });
    alert(`IP ${ip} Blocked Globally`);
    fetchAll();
  };

  const runOverride = async (type: "backup" | "audit") => {
    await fetch(`/api/ctrl-titan-9x2k/proxy/titan/override/${type}`, { method: "POST" });
    // Response is intentionally not logged to the browser console (audit security hardening)
    alert(`${type.toUpperCase()} execution completed. Check the system audit log for stdout.`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span className="text-red-500">◈</span> Titan Command Center
            </h1>
            <p className="text-zinc-500 mt-1">SuperAdmin Node • Strict Access Only</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => runOverride("backup")} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium text-sm transition-colors border border-zinc-700">
              Run Manual Backup
            </button>
            <button onClick={() => runOverride("audit")} className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-100 rounded font-medium text-sm transition-colors border border-red-800">
              Trigger Full Audit
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column (Widgets 1 & 2) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Widget 1: The Nexus */}
            <section className="bg-[#111] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                <h2 className="text-lg font-semibold text-white">The Nexus &mdash; Org Manager</h2>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-zinc-500 pb-2">
                    <tr>
                      <th className="font-medium pb-4">Organization</th>
                      <th className="font-medium pb-4">Provider</th>
                      <th className="font-medium pb-4">Tier</th>
                      <th className="font-medium pb-4">Usage (M)</th>
                      <th className="font-medium pb-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {orgs.map(org => (
                      <tr key={org.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 font-medium text-zinc-200">{org.name}</td>
                        <td className="py-3"><span className="px-2 py-1 rounded-md text-xs bg-zinc-800 text-zinc-400 font-mono">{org.billing_provider || "NONE"}</span></td>
                        <td className="py-3 text-zinc-400">{org.plan_tier}</td>
                        <td className="py-3">
                           <div className="flex items-center gap-2">
                             <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                               <div className="h-full bg-blue-500" style={{ width: `${Math.min((org.usage / org.limit) * 100, 100)}%` }}></div>
                             </div>
                             <span className="text-xs text-zinc-500">{org.usage} / {org.limit}</span>
                           </div>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button onClick={() => suspendOrg(org.id)} className="text-xs text-orange-400 hover:text-orange-300">Suspend</button>
                          <span className="text-zinc-700">|</span>
                          <button onClick={() => upgradeOrg(org.id)} className="text-xs text-emerald-400 hover:text-emerald-300">Upgrade (Pro)</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orgs.length === 0 && <div className="text-zinc-600 italic text-center py-4">No organizations found.</div>}
              </div>
            </section>

            {/* Widget 2: The Sentinel Hub */}
            <section className="bg-[#111] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
               <div className="px-6 py-4 border-b border-zinc-800 bg-red-950/20 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  The Sentinel Hub
                </h2>
              </div>
              <div className="p-6 overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="font-medium pb-4">Severity</th>
                      <th className="font-medium pb-4">Event</th>
                      <th className="font-medium pb-4">Source IP</th>
                      <th className="font-medium pb-4">Org Target</th>
                      <th className="font-medium pb-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {threats.map(t => (
                      <tr key={t.id} className="hover:bg-red-950/10 transition-colors group">
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.risk_score > 80 ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"}`}>
                            {t.risk_score}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-xs text-zinc-300">{t.event_type}</td>
                        <td className="py-3 font-mono text-xs text-zinc-400">{t.ip_address}</td>
                        <td className="py-3 text-zinc-400">{t.org_name || "Public API"}</td>
                        <td className="py-3 text-right">
                          <button onClick={() => blockIp(t.ip_address)} className="text-xs px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded border border-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                            Block IP
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                 {threats.length === 0 && <div className="text-zinc-600 italic text-center py-4">No active threats detected.</div>}
              </div>
            </section>

          </div>

          {/* Right Column (Widget 3 & 4) */}
          <div className="space-y-8 h-full flex flex-col">
            
            {/* Widget 3: Revenue Analytics */}
            <section className="bg-[#111] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
               <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                <h2 className="text-lg font-semibold text-white">Revenue Status</h2>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="text-sm border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 rounded inline-flex text-emerald-400 mb-2 font-mono">Total Estimated ARR</div>
                  <div className="text-5xl font-light text-white tracking-tight">
                    ${revenue ? revenue.total_usd_approx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                     <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Stripe Global</div>
                     <div className="text-xl text-zinc-200">${revenue?.stripe_usd.toLocaleString() || "0"}</div>
                  </div>
                  <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                     <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Razorpay India</div>
                     <div className="text-xl text-zinc-200">₹{revenue?.razorpay_inr.toLocaleString() || "0"}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Widget 4: Live Kernel Trace WS Terminal */}
            <section className="flex-1 min-h-[400px]">
              <LiveKernelTrace />
            </section>
            
          </div>

        </div>
      </div>
    </div>
  );
}
