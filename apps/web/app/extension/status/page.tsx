"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Activity, CheckCircle2, Lock, Cpu, Globe, AlertCircle, Loader2 } from "lucide-react";

type ExtStatus = {
  lastPulseAt: string | null;
  totalScans:  number;
  policies?:   { name: string; target: string }[];
};

function formatPulse(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10)  return "Just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default function ExtensionStatusPage() {
  const [status, setStatus]   = useState<ExtStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    fetch("/api/v1/extension/status")
      .then(r => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d: ExtStatus) => {
        setStatus(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const isConnected = !loading && !error && !!status?.lastPulseAt;

  const stats = [
    {
      label:     "Status",
      value:     loading ? "…" : isConnected ? "Online"       : "Not detected",
      icon:      Activity,
      color:     loading ? "text-zinc-500" : isConnected ? "text-emerald-400" : "text-amber-400",
    },
    {
      label:     "Last Sync",
      value:     loading ? "…" : status?.lastPulseAt ? formatPulse(status.lastPulseAt) : "Never",
      icon:      CheckCircle2,
      color:     loading ? "text-zinc-500" : isConnected ? "text-zinc-300"   : "text-amber-400",
    },
    {
      label:     "Interceptor",
      value:     loading ? "…" : isConnected ? "Active"       : "Idle",
      icon:      Lock,
      color:     loading ? "text-zinc-500" : isConnected ? "text-zinc-300"   : "text-zinc-500",
    },
    {
      label:     "Scans",
      value:     loading ? "…" : String(status?.totalScans ?? 0),
      icon:      Globe,
      color:     loading ? "text-zinc-500" : "text-zinc-300",
    },
  ];

  // Fallback hardcoded policies — replace with real API call when policy API is available
  const activePolicies = status?.policies ?? [
    { name: "PII Redaction (Strict)",  target: "ChatGPT, Claude" },
    { name: "Financial Data Block",    target: "All AI Tools"    },
    { name: "Code IP Protection",      target: "GitHub Copilot"  },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className={`w-20 h-20 rounded-3xl border flex items-center justify-center mb-6 ${
        isConnected
          ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
          : "bg-amber-500/10 border-amber-500/30"
      }`}>
        {loading
          ? <Loader2 size={40} className="text-zinc-400 animate-spin" />
          : isConnected
          ? <ShieldCheck size={40} className="text-emerald-400" />
          : <AlertCircle size={40} className="text-amber-400" />
        }
      </div>

      <h1 className="text-3xl font-black text-white tracking-tight mb-2 text-center">
        {loading ? "Checking status…" : isConnected ? "Protection Active" : "Extension Not Detected"}
      </h1>
      <p className={`text-sm text-center mb-8 font-mono tracking-widest uppercase ${
        isConnected ? "text-emerald-400/80" : "text-amber-400/80"
      }`}>
        {loading
          ? "Querying telemetry…"
          : isConnected
          ? `Device Secure · ${status?.totalScans ?? 0} scans logged`
          : "Install the extension to begin protection"
        }
      </p>

      <div className="w-full rounded-2xl border border-white/[0.06] bg-[#08080e] p-6 shadow-2xl">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <stat.icon size={16} className={`${stat.color} mb-2`} />
              <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Active Policies */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Cpu size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Active Policies</h3>
          </div>
          <div className="space-y-3">
            {activePolicies.map((policy) => (
              <div key={policy.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-zinc-600"}`} />
                  <span className="text-sm text-zinc-300">{policy.name}</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">{policy.target}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {isConnected ? (
            <>
              <Link
                href="/dashboard/admin/mission-control"
                className="flex-1 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 px-4 py-3.5 text-sm font-bold text-white hover:bg-white/[0.08] transition-all"
              >
                Go to Mission Control
              </Link>
              <Link
                href="/demo/runtime-replay"
                className="flex-1 flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black hover:bg-emerald-400 active:scale-[0.98] transition-all"
              >
                Test Protection Live
              </Link>
            </>
          ) : (
            <Link
              href="/extension/install"
              className="w-full flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black hover:bg-emerald-400 active:scale-[0.98] transition-all"
            >
              Install Enterprise Shield →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
