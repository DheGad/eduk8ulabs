"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

/**
 * @file page.tsx
 * @description V42 Global Infrastructure Command
 * Applies UX-03 Obsidian & Emerald Design System
 */

export default function InfrastructureCommandPage() {
  const [activeTab, setActiveTab] = useState("AWS_NITRO");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const meshTargets = [
    {
      id: "AWS_NITRO",
      name: "AWS Nitro Enclave",
      region: "eu-west-1",
      latency: "45ms",
      status: "Active",
      description: "Cryptographically verifiable compute isolation for TOP_SECRET payloads.",
      icon: "⚡"
    },
    {
      id: "AZURE_CONFIDENTIAL",
      name: "Azure Confidential",
      region: "us-east-1",
      latency: "38ms",
      status: "Active",
      description: "Hardware-based Trusted Execution Environment for FINANCIAL payloads.",
      icon: "☁️"
    },
    {
      id: "GCP_SHIELDED",
      name: "GCP Shielded VM",
      region: "us-central1",
      latency: "22ms",
      status: "Optimized",
      description: "Verifiable integrity with vTPM for DEFAULT routing.",
      icon: "🛡️"
    }
  ];

  const activeTargetData = meshTargets.find(t => t.id === activeTab);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans p-8">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-400">V42</span>
            Global Infrastructure Command
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Live Cloud Mesh. Hardware-secured payload routing.
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Multi-Cloud Uptime</p>
            <p className="text-lg font-mono text-emerald-400">99.999%</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Active Secure Enclaves</p>
            <p className="text-lg font-mono text-white">3 / 3 Nodes</p>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Target List (Matrix) */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">Live Cloud Mesh</h2>
          <div className="grid grid-cols-1 gap-3">
            {meshTargets.map((target) => {
              const isActive = activeTab === target.id;
              return (
                <button
                  key={target.id}
                  onClick={() => setActiveTab(target.id)}
                  className={`relative flex items-center gap-4 p-4 rounded-md transition-all border text-left overflow-hidden group
                    ${isActive
                      ? "bg-black border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      : "bg-white/[0.01] border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
                    }`}
                >
                  {/* Glowing background hint for active node */}
                  {isActive && <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />}
                  
                  <div className={`text-2xl z-10 ${isActive ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "text-zinc-500 drop-shadow-none"}`}>
                    {target.icon}
                  </div>
                  <div className="flex-1 z-10">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-bold ${isActive ? "text-white" : "text-zinc-300"}`}>
                        {target.name}
                      </span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm
                        ${isActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-zinc-500 border border-transparent"}`}>
                        {target.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">{target.region}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column - Target Details */}
        <div className="lg:col-span-2 space-y-4">
           <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">Telemetry Dashboard</h2>
           
           <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-md relative overflow-hidden">
             {/* Decorative Background grid */}
             <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                  style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
             
             {activeTargetData && (
              <div className="relative z-10 flex flex-col h-full space-y-8">
                {/* Top Section */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-white">{activeTargetData.name}</h3>
                    <p className="text-sm text-zinc-400 mt-1">{activeTargetData.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Avg Route Latency</p>
                    <p className="text-2xl font-mono text-emerald-400">{activeTargetData.latency}</p>
                  </div>
                </div>

                {/* Simulated Terminal Output */}
                <div className="flex-1 bg-black rounded border border-white/5 p-4 font-mono text-[10px] text-zinc-400 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
                  <p className="text-zinc-500 mb-2">{'// V42 CloudMesh Router Diagnostic'}</p>
                  <p>{`> target established: ${activeTargetData.id}`}</p>
                  <p>{`> region lock: ${activeTargetData.region}`}</p>
                  <p>{`> verifying enclave signature...`}</p>
                  <p className="text-emerald-400">{`[OK] Sovereign boundaries confirmed.`}</p>
                  <p>{`> waiting for payload...`}</p>
                  <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse mt-2" />
                </div>
              </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
