"use client";

import React, { useState, useEffect } from "react";

/**
 * @file page.tsx
 * @description V43 Live Regulatory Oracles Telemetry Page
 * Applies UX-03 Obsidian & Emerald Design System
 */

export default function RegulatoryOraclesPage() {
  const [mounted, setMounted] = useState(false);
  const [feed, setFeed] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Simulate incoming legal telemetry
    const messages = [
      "0xORC: EU_AI_ACT Clause 4.2 received. Re-weighting risk graph...",
      "0xORC: SG_PDPA data sovereignty trigger confirmed. Routing modified.",
      "0xORC: US_HIPAA_UPDATE checksum evaluated. Enclaves protected.",
      "0xORC: Validating zero-knowledge proof from EU oracle network...",
      "0xORC: Oracle sync complete in 12ms. V12 Engine updated.",
      "0xORC: Blocklist appended: [cn-north-1, ru-central1]."
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      setFeed(prev => {
        const newFeed = [...prev, messages[index % messages.length]];
        if (newFeed.length > 5) newFeed.shift();
        return newFeed;
      });
      index++;
    }, 2500);
    
    // Initial paint load
    setFeed(["0xORC: Initializing Sovereign Oracle feed...", "0xORC: Waiting for incoming decentralized compliance attestations..."]);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans p-8">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-400">V43</span>
            Live Regulatory Oracles
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Decentralized Compliance Engine. Real-time V12 Engine synchronization.
          </p>
        </div>
        
        {/* V43 Matrix Metrics */}
        <div className="flex flex-col sm:flex-row items-end gap-6 md:gap-8">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Time Since Last Legal Sync</p>
            <p className="text-xl font-mono text-emerald-400 mt-1">12ms</p>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Active Compliance Rules</p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <p className="text-xl font-mono text-white">4,102</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column - Legal Telemetry Feed */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-2">
            <span className="text-emerald-500">⚡</span> Live Telemetry Feed
          </h2>
          
          <div className="bg-black border border-white/10 rounded-md p-5 h-[400px] overflow-hidden relative shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
            <div className="absolute top-0 w-full h-8 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
            
            <div className="flex flex-col justify-end h-full space-y-3 font-mono text-xs text-zinc-400 pb-2">
              {feed.map((msg, i) => (
                <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex items-start gap-3">
                  <span className="text-emerald-500/60 shrink-0">[{new Date().toISOString().substring(11, 23)}]</span>
                  <span className={i === feed.length - 1 ? "text-emerald-400" : ""}>{msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Global Jurisdiction Map (CSS/Text Based) */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-2">
            <span className="text-white">🌍</span> Global Jurisdiction Map
          </h2>
          
          <div className="bg-[#050505] border border-white/10 rounded-md p-6 h-[400px] relative overflow-hidden flex flex-col items-center justify-center">
             {/* Map Grid Background */}
             <div className="absolute inset-0 pointer-events-none opacity-[0.02]" 
                  style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
             
             <div className="relative z-10 w-full max-w-lg font-mono text-center space-y-8">
               
               {/* Ascii-style map representation for the target jurisdictions */}
               <div className="flex justify-between w-full px-8 relative">
                 {/* US Oracle */}
                 <div className="flex flex-col items-center group">
                    <div className="w-12 h-12 rounded-full border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center relative mb-3">
                      <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400/30" />
                      <span className="text-lg">🇺🇸</span>
                    </div>
                    <span className="text-xs font-bold text-white tracking-wider">US_HIPAA</span>
                    <span className="text-[9px] text-emerald-400 mt-1 uppercase">Oracle Active</span>
                 </div>
                 
                 {/* EU Oracle */}
                 <div className="flex flex-col items-center group">
                    <div className="w-12 h-12 rounded-full border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center relative mb-3">
                      <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400/30" style={{ animationDelay: '0.5s' }} />
                      <span className="text-lg">🇪🇺</span>
                    </div>
                    <span className="text-xs font-bold text-white tracking-wider">EU_AI_ACT</span>
                    <span className="text-[9px] text-emerald-400 mt-1 uppercase">Oracle Active</span>
                 </div>

                 {/* SG Oracle */}
                 <div className="flex flex-col items-center group">
                    <div className="w-12 h-12 rounded-full border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center relative mb-3">
                      <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400/30" style={{ animationDelay: '1s' }} />
                      <span className="text-lg">🇸🇬</span>
                    </div>
                    <span className="text-xs font-bold text-white tracking-wider">SG_PDPA</span>
                    <span className="text-[9px] text-emerald-400 mt-1 uppercase">Oracle Active</span>
                 </div>
               </div>

               {/* Connection lines via simple borders */}
               <div className="w-full max-w-[80%] mx-auto border-t border-emerald-500/20 mt-4 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 bg-[#050505] text-[10px] text-emerald-500 text-center tracking-widest font-bold">
                     ZK SYNC BRIDGE
                  </div>
               </div>

             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
