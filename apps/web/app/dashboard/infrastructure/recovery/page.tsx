"use client";

import React, { useState, useEffect } from "react";

/**
 * @file page.tsx
 * @route /dashboard/infrastructure/recovery
 * @version V55
 * @description Automated Disaster Recovery — Global Cluster Topology
 *
 * Simulates a catastrophic primary node failure, triggering a 2-second global
 * failover lock via Redlock (V54) and rerouting traffic to the hot-standby node.
 * Tech Stack Lock: Next.js · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

type ClusterState = "ACTIVE" | "STANDBY" | "OFFLINE" | "FAILING_OVER";

interface ClusterNode {
  id: string;
  name: string;
  region: string;
  state: ClusterState;
}

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString();

export default function DisasterRecoveryPage() {
  const [mounted, setMounted] = useState(false);
  const [primary, setPrimary] = useState<ClusterNode>({ id: "cl-pri-01", name: "KL-Primary", region: "ap-southeast-1", state: "ACTIVE" });
  const [backup, setBackup] = useState<ClusterNode>({ id: "cl-bak-01", name: "TYO-Standby", region: "ap-northeast-1", state: "STANDBY" });
  const [uptime, setUptime] = useState("99.999");
  const [lastFailover, setLastFailover] = useState<string>("Never");
  const [events, setEvents] = useState<{ id: number, ts: string, msg: string, type: string }[]>([]);
  const [isFailingOver, setIsFailingOver] = useState(false);
  const [activeTrafficLines, setActiveTrafficLines] = useState<"PRIMARY" | "BACKUP" | "NONE">("PRIMARY");

  // On mount
  useEffect(() => {
    setMounted(true);
    addEvent("Topology monitor initialized. Heartbeat stable.", "info");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addEvent = (msg: string, type: "info" | "warn" | "fatal" | "success") => {
    setEvents(prev => [{ id: Date.now(), ts: new Date().toISOString().slice(11, 23), msg, type }, ...prev].slice(0, 8));
  };

  const simulateFailure = () => {
    if (isFailingOver || primary.state === "OFFLINE") return;

    setIsFailingOver(true);
    setPrimary(p => ({ ...p, state: "OFFLINE" }));
    setActiveTrafficLines("NONE");
    addEvent(`CATASTROPHIC FAILURE DETECTED ON ${primary.name}`, "fatal");

    setTimeout(() => {
      setBackup(b => ({ ...b, state: "FAILING_OVER" }));
      addEvent(`V54 Mutex locked. Rerouting global BGP/DNS to ${backup.region}...`, "warn");
      setUptime("99.998");
    }, 500);

    setTimeout(() => {
      setBackup(b => ({ ...b, state: "ACTIVE" }));
      setActiveTrafficLines("BACKUP");
      setLastFailover(formatTime(Date.now()));
      addEvent(`Failover complete. Traffic hot-swapped to ${backup.name}.`, "success");
      setIsFailingOver(false);
    }, 2500);
  };

  const resetTopology = () => {
    setPrimary({ id: "cl-pri-01", name: "KL-Primary", region: "ap-southeast-1", state: "ACTIVE" });
    setBackup({ id: "cl-bak-01", name: "TYO-Standby", region: "ap-northeast-1", state: "STANDBY" });
    setActiveTrafficLines("PRIMARY");
    setUptime("99.999");
    setLastFailover("Never");
    addEvent("Topology reset to nominal state.", "info");
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                V55
              </span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
                Automated Disaster Recovery
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Global Cluster <span className="text-emerald-400">Failover Matrix</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Monitors active heartbeat across sovereign partitions. In the event of catastrophic physical or network failure, traffic is paused via V54 locks and hot-swapped to standby nodes for 99.999% HA.
            </p>
          </div>

          <div className="flex items-center gap-8 border-l border-white/8 lg:pl-8">
            <div className="text-right">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Uptime SLA</p>
              <p className={`text-sm font-black tracking-wide ${uptime === "99.999" ? "text-emerald-400" : "text-amber-400"}`}>{uptime}%</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Active Cluster</p>
              <p className="text-sm font-black tracking-wide text-white">{activeTrafficLines === "PRIMARY" ? primary.name : backup.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Last Failover</p>
              <p className="text-sm font-black tracking-wide text-zinc-400 font-mono">{lastFailover}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <div className="p-8 space-y-6">

        {/* Action Controls */}
        <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-sm font-bold text-zinc-400">
            {isFailingOver ? "🚨 EVACUATING TRAFFIC... DO NOT INTERRUPT." : "System operating nominally. Heartbeats optimal."}
          </p>
          <div className="flex gap-4">
            <button
              onClick={resetTopology}
              disabled={isFailingOver || primary.state === "ACTIVE"}
              className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition disabled:opacity-30"
            >
              Reset Topology
            </button>
            <button
              onClick={simulateFailure}
              disabled={isFailingOver || primary.state === "OFFLINE"}
              className={`text-xs font-black uppercase tracking-widest px-6 py-2 rounded transition ${
                primary.state === "OFFLINE" 
                  ? "opacity-30 bg-red-900/20 text-red-500 border border-red-900/50" 
                  : "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              }`}
            >
              Simulate Catastrophic Failure
            </button>
          </div>
        </div>

        {/* Global Topology Map */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-8 items-center bg-[url('/grid-pattern.svg')] bg-center rounded-2xl p-8 border border-white/10 relative overflow-hidden">
          
          {/* Traffic Source */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center z-10">
              <span className="text-2xl">🌍</span>
            </div>
            <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mt-4 text-center">Global Ingress Router</p>
          </div>

          {/* Connection Lines (Simulated SVG) */}
          <div className="relative h-48 w-full flex flex-col justify-center opacity-80 z-0">
            {/* Primary Line */}
            <div className={`absolute top-1/4 left-0 w-full h-[2px] transition-all duration-500 shadow-[0_0_10px_currentColor] ${
              activeTrafficLines === "PRIMARY" ? "bg-emerald-500 text-emerald-500" : "bg-white/5 text-transparent"
            }`}>
              {activeTrafficLines === "PRIMARY" && (
                <div className="absolute top-0 left-0 h-full bg-white/50 w-24 animate-[moveRight_1.5s_linear_infinite]" />
              )}
            </div>
            
            {/* Backup Line */}
            <div className={`absolute bottom-1/4 left-0 w-full h-[2px] transition-all duration-500 shadow-[0_0_10px_currentColor] ${
              activeTrafficLines === "BACKUP" ? "bg-emerald-500 text-emerald-500" : "bg-white/5 text-transparent"
            }`}>
               {activeTrafficLines === "BACKUP" && (
                <div className="absolute top-0 left-0 h-full bg-white/50 w-24 animate-[moveRight_1.5s_linear_infinite]" />
              )}
            </div>
          </div>

          {/* Node Clusters */}
          <div className="flex flex-col gap-12 z-10 w-full">
            <ClusterCard node={primary} />
            <ClusterCard node={backup} />
          </div>
        </div>

        {/* Event Logs & Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-white/10 rounded-xl bg-[#0a0a0a] flex flex-col h-64">
             <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">DR Event Matrix</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[10px]">
                {events.map(ev => (
                  <div key={ev.id} className="flex gap-4 items-start">
                    <span className="text-zinc-600 flex-shrink-0">{ev.ts}</span>
                    <span className={
                      ev.type === "fatal" ? "text-red-400 font-bold" :
                      ev.type === "warn" ? "text-amber-400" :
                      ev.type === "success" ? "text-emerald-400 font-bold" : "text-zinc-400"
                    }>
                      {ev.msg}
                    </span>
                  </div>
                ))}
             </div>
          </div>

          <div className="border border-white/10 rounded-xl bg-[#0a0a0a] p-6 flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Pipeline Interception (V55)</p>
            <code className="text-[10px] text-zinc-400 block whitespace-pre bg-black p-4 rounded border border-white/5 font-mono">
{`async function proxyRoutes(req, res) {
  // [V55] Automated Disaster Recovery Check
  await globalDR.ensureRoutingClearance();
  
  // Uses V54 DistributedLockEngine key:
  // "system:dr:failover_in_progress"
  
  // If no failover, bypass cost is 0ms.
  // If failover active, locks request 
  // until DNS/BGP propagation completes,
  // preventing 502 Bad Gateway responses.

  // Proceed to V49 Attestation -> V52 Tenant -> etc
}`}
            </code>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes moveRight {
          0% { transform: translateX(0%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(400%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── SUBCOMPONENTS ──────────────────────────────────────────────

function ClusterCard({ node }: { node: ClusterNode }) {
  const isPrimary = node.id.includes("pri");

  let statusBg = "bg-zinc-900/50";
  let statusBorder = "border-zinc-800";
  let statusText = "text-zinc-500";
  let statusLabel = "UNKNOWN";

  if (node.state === "ACTIVE") {
    statusBg = "bg-emerald-950/30";
    statusBorder = "border-emerald-500/50";
    statusText = "text-emerald-400";
    statusLabel = "ACTIVE (PROCESSING)";
  } else if (node.state === "OFFLINE") {
    statusBg = "bg-red-950/30";
    statusBorder = "border-red-500/60";
    statusText = "text-red-500";
    statusLabel = "OFFLINE (CATASTROPHIC)";
  } else if (node.state === "STANDBY") {
    statusBg = "bg-amber-950/20";
    statusBorder = "border-amber-500/30";
    statusText = "text-amber-500";
    statusLabel = "HOT STANDBY";
  } else if (node.state === "FAILING_OVER") {
    statusBg = "bg-blue-950/30";
    statusBorder = "border-blue-500/50";
    statusText = "text-blue-400";
    statusLabel = "SPINNING UP...";
  }

  return (
    <div className={`p-4 rounded-xl border transition-all duration-700 w-64 ${statusBorder} ${statusBg} ${node.state === 'ACTIVE' ? 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' : ''} ${node.state === 'OFFLINE' ? 'animate-pulse' : ''}`}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-black tracking-widest uppercase text-white">{node.name}</span>
        {isPrimary && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-bold text-zinc-300">PRI</span>}
        {!isPrimary && <span className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-bold text-zinc-500">SEC</span>}
      </div>
      
      <div className="space-y-2">
         <div className="flex justify-between">
           <span className="text-[9px] uppercase tracking-widest text-zinc-600">Region</span>
           <span className="text-[10px] font-mono text-zinc-400">{node.region}</span>
         </div>
         <div className="flex justify-between items-center">
           <span className="text-[9px] uppercase tracking-widest text-zinc-600">Status</span>
           <span className={`text-[9px] font-black ${statusText}`}>{statusLabel}</span>
         </div>
      </div>
    </div>
  );
}
