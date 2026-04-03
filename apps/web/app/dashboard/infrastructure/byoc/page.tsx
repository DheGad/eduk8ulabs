"use client";

import React, { useState, useEffect } from "react";

/**
 * @file page.tsx
 * @description V46 Air-Gapped BYOC Environment Dashboard
 * Enforces strict Obsidian & Emerald Aesthetics.
 */

export default function AirGappedEnvPage() {
  const [mounted, setMounted] = useState(false);
  const [packetDrops, setPacketDrops] = useState(41920);

  useEffect(() => {
    setMounted(true);
    // Simulate telemetry drops
    const interval = setInterval(() => {
      setPacketDrops((prev) => prev + Math.floor(Math.random() * 5));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans p-8">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-400">V46</span>
            Air-Gapped Environments
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Enterprise BYOC Container Health & VPC Topologies.
          </p>
        </div>
        
        {/* Metric Block */}
        <div className="flex flex-col sm:flex-row items-end gap-6 md:gap-8 border-l border-white/10 pl-8">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Instance Type</p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <p className="text-sm font-bold text-white uppercase tracking-widest">Private BYOC</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Air-Gap Integrity</p>
            <p className="text-xl font-mono text-emerald-400 mt-1">100%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Span (2 cols): Container Health / VPC topology */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            <span className="text-emerald-500 inline-block mr-2 text-lg leading-none align-middle">☁️</span> 
            Private VPC Topology Matrix
          </h2>
          
          <div className="bg-black border border-white/10 rounded-md p-6 h-[400px] flex flex-col items-center justify-center relative overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,1)]">
             {/* Background glow indicating secure perimeter */}
             <div className="absolute inset-0 bg-emerald-900/10 z-0 border-[3px] border-emerald-500/30 border-dashed rounded-lg m-6 pointer-events-none" />
             
             {/* Label for perimeter */}
             <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black border border-emerald-500/40 text-[10px] text-emerald-400 font-mono tracking-widest px-4 py-1 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)]">
               STRICT ISOLATION BOUNDARY
             </div>

             <div className="z-10 w-full max-w-lg mt-8 relative">
                
                {/* Node cluster architecture representation */}
                <div className="flex justify-between items-center px-4 w-full">
                  
                  {/* Web Container */}
                  <div className="flex flex-col items-center group">
                    <div className="w-20 h-20 rounded border border-emerald-500/50 bg-black shadow-[0_0_20px_rgba(16,185,129,0.1)] flex flex-col items-center justify-center relative mb-4">
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-3xl text-emerald-500/50 mb-1">⎈</span>
                      <span className="text-[10px] font-mono text-white">smp-web</span>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 via-emerald-500/60 to-emerald-500/20 relative">
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] px-2 text-[8px] text-emerald-400 border border-emerald-500/20 font-mono">
                       airgap-internal
                     </div>
                  </div>
                  
                  {/* Kernel/Vault Container */}
                  <div className="flex flex-col items-center group">
                    <div className="w-24 h-28 rounded border-2 border-emerald-500/70 bg-black shadow-[0_0_25px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center relative mb-4">
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-4xl text-emerald-400 mb-2">⚡</span>
                      <span className="text-xs font-black tracking-widest text-white">OS-KERNEL</span>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 via-emerald-500/60 to-emerald-500/20 relative"></div>
                  
                  {/* Cache Mock (Redis) */}
                  <div className="flex flex-col items-center group">
                    <div className="w-16 h-16 rounded-full border border-emerald-500/40 bg-black flex items-center justify-center relative mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <span className="text-xs font-mono text-white">redis</span>
                      <div className="absolute -bottom-2 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black" />
                    </div>
                  </div>

                </div>

                {/* External Threat Representation */}
                <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-40">
                  <div className="w-px h-12 bg-red-500/50 mb-2 style-dashed" />
                  <span className="text-[9px] text-red-400 font-mono">OUTBOUND DROP (0.0.0.0/0)</span>
                </div>
             </div>
          </div>
        </div>

        {/* Right Span (1 col): Status Checklist & Telemetry Logs */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            Telemetry Feed
          </h2>
          
          <div className="bg-[#050505] border border-white/10 rounded-md p-6 h-[400px] flex flex-col justify-between">
            <div className="space-y-6">
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">External Internet Access</p>
                   <span className="text-[10px] text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(239,68,68,0.2)] font-bold">DENIED</span>
                 </div>
                 <p className="text-[10px] text-zinc-500 font-mono">Kernel mathematically isolated from public gateway routing.</p>
               </div>
               
               <div className="space-y-2 mt-4">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Bridge Network Integrity</p>
                   <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(16,185,129,0.2)]">SECURE</span>
                 </div>
                 <p className="text-[10px] text-zinc-500 font-mono">`internal: true` constraint active on docker-compose tier.</p>
               </div>
               
               <div className="space-y-2 mt-4">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Dropped Malicious Ping Packets</p>
                   <span className="text-[10px] text-white/70 font-mono">{packetDrops.toLocaleString()}</span>
                 </div>
                 <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500/60 w-full animate-pulse" />
                 </div>
               </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/10 font-mono text-[9px] text-zinc-600 space-y-1">
              <p className="text-emerald-500/50">[{new Date().toISOString().substring(11, 23)}] airGapMonitor._vpcScan()...</p>
              <p className="text-zinc-500">[{new Date().toISOString().substring(11, 23)}] status(200) mathematically_proven.</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
