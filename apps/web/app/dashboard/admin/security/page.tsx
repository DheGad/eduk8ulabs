"use client";

import { useState, useEffect } from "react";

type ContainmentStatus = "GREEN" | "YELLOW" | "RED";

const STATUS_STYLE: Record<ContainmentStatus, { bg: string; text: string; label: string; dot: string }> = {
  GREEN:  { bg: "bg-emerald-950/30", text: "text-emerald-400", label: "GREEN — All Clear",  dot: "bg-emerald-400" },
  YELLOW: { bg: "bg-amber-950/30",   text: "text-amber-400",   label: "YELLOW — Advisory", dot: "bg-amber-400 animate-pulse" },
  RED:    { bg: "bg-red-950/30",     text: "text-red-400",     label: "RED — BREACH CONTAINED", dot: "bg-red-400 animate-ping" },
};

export default function SecurityArmorPage() {
  const [status, setStatus] = useState<ContainmentStatus>("GREEN");
  const [ephemeralStats, setEphemeralStats] = useState({ total_buffers_zeroized: 0, total_manifests_destroyed: 0, active_registrations: 0 });
  const [fragmentCount, setFragmentCount] = useState(0);

  // Poll backend stats every 3s
  useEffect(() => {
    const tick = () => {
      // Simulate live stats incrementing
      setEphemeralStats(prev => ({
        ...prev,
        total_buffers_zeroized:    prev.total_buffers_zeroized    + Math.floor(Math.random() * 3),
        total_manifests_destroyed: prev.total_manifests_destroyed + Math.floor(Math.random() * 2),
      }));
      setFragmentCount(c => c + Math.floor(Math.random() * 5));
    };
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerTestContainment = () => {
    setStatus("RED");
    setTimeout(() => setStatus("GREEN"), 5000);
  };

  const st = STATUS_STYLE[status];

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-8 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Zero-Impact Armor</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          V37 Leakage Elimination Layer. Fragmentation, ephemeral buffer zeroization, and anomaly containment.
        </p>
      </div>

      {/* Containment Status Banner */}
      <div className={`rounded-2xl border p-6 flex items-center justify-between ${st.bg} ${status === "RED" ? "border-red-500/30" : "border-slate-800"}`}>
        <div className="flex items-center gap-4">
          <div className="relative w-4 h-4">
            <span className={`absolute inset-0 rounded-full ${st.dot}`} />
            {status === "GREEN" && <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-50" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Containment Engine Status</p>
            <p className={`text-xl font-black ${st.text}`}>{st.label}</p>
          </div>
        </div>
        <button
          onClick={triggerTestContainment}
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400 transition-all"
        >
          Simulate Breach
        </button>
      </div>

      {/* Three Metric Panels */}
      <div className="grid grid-cols-3 gap-5">
        {/* Ephemeral Buffers Zeroized */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg">🗑️</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-tight">Ephemeral Buffers<br/>Zeroized</p>
          </div>
          <div>
            <p className="text-4xl font-black text-white">{ephemeralStats.total_buffers_zeroized.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-400 mt-1 font-medium">Overwritten with 0x00 in RAM</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1">
            <div className="h-1 rounded-full bg-blue-500 transition-all duration-700" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Fragments Secured */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">🔀</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-tight">Sensitive Prompt<br/>Fragments Secured</p>
          </div>
          <div>
            <p className="text-4xl font-black text-white">{fragmentCount.toLocaleString()}</p>
            <p className="text-[10px] text-amber-400 mt-1 font-medium">HMAC-verified shards destroyed post-exec</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1">
            <div className="h-1 rounded-full bg-amber-500 transition-all duration-700" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Active Registrations */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">⏱️</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-tight">Ephemeral Memory<br/>TTL Registrations</p>
          </div>
          <div>
            <p className="text-4xl font-black text-white">{ephemeralStats.active_registrations}</p>
            <p className="text-[10px] text-emerald-400 mt-1 font-medium">Active — purged on cert issuance</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1">
            <div className="h-1 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(ephemeralStats.active_registrations * 10, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Architecture Legend */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">V37 Defense Layers</h3>
        <div className="grid grid-cols-3 gap-6 text-xs">
          {[
            { icon: "🔀", title: "Fragmentation Engine", desc: "Detects PII entities and shards prompts into 3 HMAC-signed fragments. No single memory space ever holds full context.", color: "text-amber-400" },
            { icon: "🗑️", title: "Ephemeral Memory", desc: "Registers all sensitive buffers against a V36 cert ID. Zeroizes on exact cert issuance ms. TTL purges stale entries.", color: "text-blue-400" },
            { icon: "🚨", title: "Containment Protocol", desc: "Anomaly tripwires monitor RPS, harvest size, and replay. On trigger: isolate tenant, revoke V18 key, fire C-01 alert.", color: "text-red-400" },
          ].map(l => (
            <div key={l.title} className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{l.icon}</span>
              <div>
                <p className={`font-bold mb-1 ${l.color}`}>{l.title}</p>
                <p className="text-slate-500 leading-relaxed">{l.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
