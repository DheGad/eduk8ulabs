import React from "react";
import { ShieldCheck, Lock, Binary, Cpu } from "lucide-react";

/**
 * @file SovereignArtifact.tsx
 * @description Sovereign Artifact Generator (Security Seal)
 * 
 * Implements C055 Task 4.
 * When an autonomous agent (via MCP) or external workflow completes a task,
 * StreetMP wraps the output in a "Sovereign Artifact". 
 * This UI component represents the verifiable "Security Seal" showing that the
 * Enforcer has vetted the output against Schema and Policy constraints.
 */

export interface SovereignArtifactProps {
  title: string;
  type: "CODE" | "DOCUMENT" | "TRANSACTION" | "DATASET";
  execId: string;
  agentName: string;
  costSaved?: number; // From Ghost Proxy Recursive Caching
  merkleHash: string;
  sciScore: number;
  timestamp: string;
}

export function SovereignArtifact({
  title,
  type,
  execId,
  agentName,
  costSaved,
  merkleHash,
  sciScore,
  timestamp
}: SovereignArtifactProps) {
  
  const isHighTrust = sciScore >= 95.0;

  return (
    <div className="rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-2xl" 
         style={{ 
           background: "#080808", 
           borderColor: isHighTrust ? "rgba(16,185,129,0.3)" : "rgba(250,204,21,0.3)",
           boxShadow: isHighTrust ? "0 10px 40px -10px rgba(16,185,129,0.1)" : "0 10px 40px -10px rgba(250,204,21,0.1)"
         }}>
      
      {/* Premium Dark Glass Header */}
      <div className="px-5 py-4 flex items-start justify-between border-b relative overflow-hidden" 
           style={{ borderColor: "#1a1a1a", background: "linear-gradient(180deg, #111 0%, #080808 100%)" }}>
        
        {/* Subtle glow behind title */}
        <div className="absolute top-0 left-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
             style={{ background: isHighTrust ? "#10b981" : "#facc15" }} />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[9px] font-mono tracking-widest font-bold uppercase border"
                  style={{ 
                    background: "rgba(255,255,255,0.05)", 
                    borderColor: "rgba(255,255,255,0.1)", 
                    color: "#aaa" 
                  }}>
              {type} ARTIFACT
            </span>
            {costSaved && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase border text-purple-400"
                    style={{ background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.2)"}}>
                Ghost Cache: -${costSaved.toFixed(3)}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        </div>

        {/* Security Seal Badge */}
        <div className="relative z-10 flex flex-col items-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm"
               style={{ 
                 background: isHighTrust ? "rgba(16,185,129,0.1)" : "rgba(250,204,21,0.1)", 
                 borderColor: isHighTrust ? "rgba(16,185,129,0.2)" : "rgba(250,204,21,0.2)",
               }}>
            <ShieldCheck className="w-4 h-4" style={{ color: isHighTrust ? "#10b981" : "#facc15" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: isHighTrust ? "#10b981" : "#facc15" }}>
              Enforcer Verified
            </span>
          </div>
        </div>
      </div>

      {/* Body: Telemetry Metadata */}
      <div className="px-5 py-4 grid grid-cols-2 gap-y-4 gap-x-6 bg-[#0a0a0a]">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[#555] mb-1 flex items-center gap-1.5">
            <Cpu className="w-3 h-3" /> AUTHOR AGENT
          </p>
          <p className="text-sm text-gray-200 font-medium truncate">{agentName}</p>
        </div>
        
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[#555] mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> COMPLIANCE (SCI)
          </p>
          <p className="text-sm font-bold font-mono" style={{ color: isHighTrust ? "#10b981" : "#facc15" }}>
            {sciScore.toFixed(2)}%
          </p>
        </div>

        <div className="col-span-2">
          <p className="text-[10px] font-mono tracking-widest text-[#555] mb-1 flex items-center gap-1.5">
            <Binary className="w-3 h-3" /> MERKLE ROOT TRACE
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 px-3 py-1.5 rounded bg-[#050505] border border-[#1a1a1a]">
              <p className="text-[11px] font-mono text-[#10b981] truncate">
                {merkleHash}
              </p>
            </div>
            <button className="px-3 py-1.5 rounded border border-[#222] bg-[#111] hover:bg-[#1a1a1a] transition-colors text-[10px] uppercase font-bold tracking-widest text-gray-400">
              Trace
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t bg-[#050505] flex justify-between items-center" style={{ borderColor: "#111" }}>
        <p className="text-[10px] font-mono text-[#444] flex items-center gap-2">
          <Lock className="w-3 h-3" /> Immutable Ledger Entry
        </p>
        <p className="text-[10px] font-mono text-[#555]">{timestamp}</p>
      </div>
    </div>
  );
}
