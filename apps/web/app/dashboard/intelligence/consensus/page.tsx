"use client";

import React, { useState, useEffect } from "react";

/**
 * @file page.tsx
 * @description V48 Cognitive Consensus Dashboard
 * Live BFT Voting matrix isolating AI Hallucinations.
 */

export default function CognitiveConsensusPage() {
  const [mounted, setMounted] = useState(false);
  const [activeCycle, setActiveCycle] = useState(false);
  const [simulatedMetrics, setSimulatedMetrics] = useState(142);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
       setActiveCycle(prev => !prev);
       setSimulatedMetrics(prev => prev + (Math.random() > 0.7 ? 1 : 0));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans p-8">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-400">V48</span>
            Cognitive Consensus Engine
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Byzantine Fault Tolerant (BFT) Multi-Model Inference Routing.
          </p>
        </div>
        
        {/* Metric Block */}
        <div className="flex flex-col sm:flex-row items-end gap-6 md:gap-8 border-l border-white/10 pl-8">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Active Voting Nodes</p>
            <p className="text-lg font-bold text-emerald-400 uppercase tracking-widest">3 / 3</p>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Consensus Latency</p>
            <p className="text-xl font-mono text-emerald-400 mt-1">45ms</p>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Hallucinations Prevented</p>
            <p className="text-xl font-mono text-emerald-400 mt-1">{simulatedMetrics}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Matrix */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            <span className="text-emerald-500 inline-block mr-2 text-lg leading-none align-middle">🧠</span> 
            Live BFT Voting Agreement Matrix
          </h2>
          
          <div className="bg-black border border-white/10 rounded-md p-6 min-h-[500px] flex flex-col relative overflow-hidden">
             
             {/* Dynamic Signal Beam */}
             <div className={`absolute top-0 left-1/2 -ml-[1px] w-[2px] h-32 bg-gradient-to-b from-transparent to-emerald-500/50 transition-all duration-1000 ${activeCycle ? 'opacity-100 translate-y-12' : 'opacity-0 -translate-y-8'}`} />

             {/* Single Origin Prompt */}
             <div className="flex justify-center z-10">
                <div className="border border-white/10 bg-[#050505] p-3 rounded-md w-64 text-center">
                   <p className="text-[9px] uppercase font-bold text-zinc-500 mb-1">Incoming Client Payload</p>
                   <p className="text-xs font-mono text-white truncate">"Generate OS Kernel Specs..."</p>
                </div>
             </div>

             {/* Fan-Out Paths */}
             <div className="flex justify-center w-full mt-4 mb-4 z-10 px-8">
                <div className="flex justify-between w-full max-w-xl">
                   {/* Lines connecting prompt to nodes */}
                   <div className="h-8 border-l border-white/10 rotate-[-30deg] origin-top opacity-50 ml-12" />
                   <div className="h-8 border-l border-white/10 opacity-50" />
                   <div className="h-8 border-l border-white/10 rotate-[30deg] origin-top opacity-50 mr-12" />
                </div>
             </div>

             {/* Three LLM Execution Nodes */}
             <div className="flex justify-center gap-12 sm:gap-16 lg:gap-24 w-full z-10">
                
                {/* Node A */}
                <div className={`flex flex-col items-center gap-3 transition-opacity duration-500 ${activeCycle ? 'opacity-100' : 'opacity-40'}`}>
                   <div className="w-16 h-16 rounded-lg border border-emerald-500/50 bg-[#0A0A0A] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <span className="text-sm font-bold text-emerald-400">A</span>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] text-zinc-500 uppercase font-mono">OpenAI-GPT4</p>
                     <p className="text-[9px] text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 rounded px-2 mt-1">SEMANTIC: 0xA1</p>
                   </div>
                </div>

                {/* Node B */}
                <div className={`flex flex-col items-center gap-3 transition-opacity duration-500 ${activeCycle ? 'opacity-100' : 'opacity-40 delay-100'}`}>
                   <div className="w-16 h-16 rounded-lg border border-emerald-500/50 bg-[#0A0A0A] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <span className="text-sm font-bold text-emerald-400">B</span>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] text-zinc-500 uppercase font-mono">Claude-3</p>
                     <p className="text-[9px] text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 rounded px-2 mt-1">SEMANTIC: 0xA1</p>
                   </div>
                </div>

                {/* Node C (The Outlier) */}
                <div className={`flex flex-col items-center gap-3 transition-opacity duration-500 ${activeCycle ? 'opacity-100' : 'opacity-40 delay-200'}`}>
                   <div className="w-16 h-16 rounded-lg border border-red-500/50 bg-[#0A0A0A] flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                      <span className="text-sm font-bold text-red-500">C</span>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] text-zinc-500 uppercase font-mono">Local-Llama</p>
                     <p className="text-[9px] text-red-500 border border-red-500/20 bg-red-500/5 rounded px-2 mt-1">SEMANTIC: 0xF9</p>
                   </div>
                </div>

             </div>

             {/* Agreement Comparator */}
             <div className="mt-12 flex flex-col items-center z-10">
                <div className={`border p-4 rounded-xl w-full max-w-md text-center transition-colors duration-1000 ${activeCycle ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5 bg-[#050505]'}`}>
                   <p className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Evaluate Agreement Quorum</p>
                   <div className="flex items-center justify-center gap-4 text-xs font-mono">
                      <span className={activeCycle ? 'text-emerald-400' : 'text-zinc-600'}>Hash(A)</span>
                      <span className={activeCycle ? 'text-emerald-400' : 'text-zinc-600'}>==</span>
                      <span className={activeCycle ? 'text-emerald-400' : 'text-zinc-600'}>Hash(B)</span>
                      <span className={activeCycle ? 'text-red-400' : 'text-zinc-600'}>!=</span>
                      <span className={activeCycle ? 'text-red-400' : 'text-zinc-600'}>Hash(C)</span>
                   </div>

                   <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs px-2">
                       <span className="text-zinc-400">Consensus Achieved:</span>
                       <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">TRUE (2/3)</span>
                   </div>
                   <div className="mt-2 flex justify-between items-center text-xs px-2">
                       <span className="text-zinc-400">Node Dropped:</span>
                       <span className="font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Node_C (Local-Llama)</span>
                   </div>
                </div>
             </div>

          </div>
        </div>

        {/* Info Right Panel */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            BFT Ruleset
          </h2>
          
          <div className="bg-[#050505] border border-white/10 rounded-md p-6 h-full flex flex-col">
            <div className="space-y-6">
               <div className="space-y-2">
                 <p className="text-sm text-white font-medium">Byzantine Fault Tolerance</p>
                 <p className="text-xs text-zinc-500">
                   Requires strict semantic agreement across a minimum of 2 isolated execution nodes before routing back to OS Kernel.
                 </p>
               </div>
               
               <div className="space-y-2">
                 <p className="text-sm text-white font-medium">Hallucination Mitigation</p>
                 <p className="text-xs text-zinc-500">
                   If a single model enters anomalous generation ("poisoning"), the hash mismatch drops the payload instantly.
                 </p>
               </div>
            </div>
            
            <div className="mt-auto pt-6 border-t border-white/10 font-mono text-[9px] text-zinc-600 space-y-1">
              <p>{"{"}</p>
              <p className="pl-2">"bft_status": "active",</p>
              <p className="pl-2">"quorum_size": 3,</p>
              <p className="pl-2">"deviation_limit": 1</p>
              <p>{"}"}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
