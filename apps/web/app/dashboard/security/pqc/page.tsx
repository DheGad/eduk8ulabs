"use client";

import React, { useState, useEffect } from "react";

/**
 * @file page.tsx
 * @description V44 Quantum Resistance PQC Visualizer Dashboard
 * Strict Obsidian & Emerald Aesthetics enforced.
 */

export default function PostQuantumPrepPage() {
  const [mounted, setMounted] = useState(false);
  const [frameTick, setFrameTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Animation loop for the lattice
    const interval = setInterval(() => {
      setFrameTick((prev) => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  // Generate deterministic grid pattern based on time
  const generateLattice = () => {
    const grid = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        // Pseudo-random activation based on grid coordinates + time loop
        const hashVal = ((r * 7) + (c * 11) + frameTick) % 15;
        const isActive = hashVal > 11;
        
        grid.push(
          <div 
            key={`${r}-${c}`}
            className={`w-full aspect-square border ${
              isActive 
                ? "border-emerald-400/80 bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.5)] z-10 scale-110 transition-all duration-300"
                : "border-white/5 bg-transparent scale-100 transition-all duration-1000"
            }`}
          >
            {isActive && (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[6px] text-emerald-300 font-mono opacity-60">
                   0x{hashVal.toString(16).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        );
      }
    }
    return grid;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans p-8">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-400">V44</span>
            Quantum Resistance Prep
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            NIST-Standardized Lattice Cryptography (CRYSTALS-Kyber/Dilithium) Integration.
          </p>
        </div>
        
        {/* Metric Block */}
        <div className="flex flex-col sm:flex-row items-end gap-6 md:gap-8 border-l border-white/10 pl-8">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Qubit Threat Level</p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <p className="text-sm font-bold text-white uppercase tracking-widest">Monitored</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Active Kyber-768 Signatures</p>
            <p className="text-xl font-mono text-emerald-400 mt-1">12,409</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Span (2 cols): Cryptographic Lattice Visualizer */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            <span className="text-emerald-500 inline-block mr-2 text-lg leading-none align-middle">⚿</span> 
            Cryptographic Lattice Visualizer
          </h2>
          
          <div className="bg-black border border-white/10 rounded-md p-6 h-[400px] flex flex-col items-center justify-center relative overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,1)]">
             {/* Background glow behind the lattice matrix */}
             <div className="absolute inset-0 bg-emerald-900/10 blur-[100px] z-0 rounded-full" />
             
             <div className="z-10 w-full max-w-2xl relative">
                {/* Simulated Central Data Execution Hash */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-[#050505] border border-emerald-500/40 p-3 rounded shadow-[0_0_15px_rgba(16,185,129,0.2)] flex flex-col items-center">
                   <span className="text-[9px] text-zinc-500 font-bold tracking-widest mb-1">V36 EXECUTION HASH</span>
                   <span className="text-sm text-white font-mono blur-[0.6px]">0x3F8B...9A2C</span>
                </div>
                
                {/* The Lattice Grid */}
                <div className="grid grid-cols-12 grid-rows-8 gap-[1px] opacity-70">
                   {generateLattice()}
                </div>
             </div>
             
             {/* Readout */}
             <div className="absolute bottom-4 right-6 font-mono text-[10px] text-emerald-500 tracking-widest">
               [ LATTICE WRAPPER ACTIVE ]
             </div>
          </div>
        </div>

        {/* Right Span (1 col): Status Checklist & Logs */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            System Compliance Matrix
          </h2>
          
          <div className="bg-[#050505] border border-white/10 rounded-md p-6 h-[400px] flex flex-col justify-between">
            <div className="space-y-6">
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">RSA Deprecation Status</p>
                   <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(16,185,129,0.2)]">ACTIVE</span>
                 </div>
                 <p className="text-xs text-zinc-500">Legacy PKI fallback layers disabled on proxy entrypoints.</p>
               </div>
               
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Lattice Parameter Integrity</p>
                   <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(16,185,129,0.2)]">SECURE</span>
                 </div>
                 <p className="text-xs text-zinc-500">CRYSTALS-Kyber-768 parameters are continuously regenerated.</p>
               </div>
               
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Shor's Algorithm Emulation</p>
                   <span className="text-[10px] text-white/50 border border-white/10 bg-white/5 px-2 py-0.5 rounded">IDLE</span>
                 </div>
                 <p className="text-xs text-zinc-500">Quantum adversary emulation currently not detecting anomalies.</p>
               </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/10 font-mono text-[9px] text-zinc-600 space-y-1">
              <p>v44.pqc.engine_loaded()...</p>
              <p>awaiting_next_execution_stamp()...</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
