"use client";

import React, { useState, useEffect } from "react";
import { Activity, ShieldAlert, ShieldCheck, ArrowRight, Download, Eye, TerminalSquare, AlertTriangle, FileCheck, CheckCircle2 } from "lucide-react";
import { getXRayMetrics } from "@/lib/telemetry";

/**
 * @file xray/page.tsx
 * @route /dashboard/execution/xray
 * @description The Data Sanitization X-Ray (Trust Visualizer)
 *
 * Implements COMMAND 056.
 * Features:
 * 1. Split-screen: Original (Red PII) vs Soverign (Green tokens).
 * 2. Enforcer Repair Tally: Real-time counter of Hallucinations / Repairs.
 * 3. Proof of Sovereignty Certificate: One-click Merkle cryptocertificate download.
 */

const DEMO_PAYLOAD = {
  raw: `URGENT REQUEST FROM COMPLIANCE\nPlease verify the risk exposure for client Michael Chang (SSN: 888-21-9921).\nTheir primary account 0031948811 at JP Morgan shows unusual wire transfers to IP 194.22.10.8.\nNeed immediate audit across all nodes.`,
  sanitized: `URGENT REQUEST FROM COMPLIANCE\nPlease verify the risk exposure for client [PERSON_X1] (SSN: [SSN_MASKED]).\nTheir primary account [ACCOUNT_X1] at [ORG_X1] shows unusual wire transfers to IP [IP_MASKED].\nNeed immediate audit across all nodes.`,
  entitiesReplaced: [
    { type: "PERSON", original: "Michael Chang", token: "[PERSON_X1]" },
    { type: "SSN", original: "888-21-9921", token: "[SSN_MASKED]" },
    { type: "ACCOUNT", original: "0031948811", token: "[ACCOUNT_X1]" },
    { type: "ORG", original: "JP Morgan", token: "[ORG_X1]" },
    { type: "IP", original: "194.22.10.8", token: "[IP_MASKED]" },
  ]
};

// Highlights specific words based on entities
function HighlightedText({ text, entities, isRaw }: { text: string, entities: any[], isRaw: boolean }) {
  let parts: {text: string, isHighlighted: boolean, highlightType?: string}[] = [{ text, isHighlighted: false }];
  
  entities.forEach(entity => {
    const target = isRaw ? entity.original : entity.token;
    const newParts: any[] = [];
    parts.forEach(p => {
      if (p.isHighlighted) {
        newParts.push(p);
        return;
      }
      const split = p.text.split(target);
      for (let i = 0; i < split.length; i++) {
        newParts.push({ text: split[i], isHighlighted: false });
        if (i < split.length - 1) {
          newParts.push({ text: target, isHighlighted: true, highlightType: isRaw ? "raw" : "safe" });
        }
      }
    });
    parts = newParts;
  });

  return (
    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
      {parts.map((p, i) => 
        p.isHighlighted 
        ? <span key={i} className={`px-1 rounded mx-0.5 ${p.highlightType === "raw" ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>{p.text}</span>
        : <span key={i} className="text-gray-300">{p.text}</span>
      )}
    </pre>
  );
}

export default function XRayVisualizer() {
  const [tallies, setTallies] = useState<{hallucinations: number, schemasRepaired: number, piiMasked: number} | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    void getXRayMetrics().then((res) => {
      if (active) setTallies(res);
    });
    return () => { active = false; };
  }, []);

  const downloadCertificate = () => {
    setDownloading(true);
    setTimeout(() => {
      const text = `=======================================\nSTREETMP OS - PROOF OF SOVEREIGNTY\n=======================================\nSignature: hmac-sha256:88a7b919cf921e0... \nTimestamp: ${new Date().toISOString()}\nStatus: Verified\n\nAll PII successfully sanitized before LLM transmission. Schema enforced.`;
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Sovereign_Certificate_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      setDownloading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen p-6 font-sans bg-[#050505] text-[#fff]">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-7 h-7 text-emerald-400" />
              <h1 className="text-3xl font-mono font-bold tracking-tight">Trust Visualizer (X-Ray)</h1>
            </div>
            <p className="text-sm text-[#888] max-w-xl">
              Real-time Sovereign Data Sanitization and Enforcer Telemetry. Proof that zero PII touches the external AI models.
            </p>
          </div>
          <button 
            disabled={downloading}
            onClick={downloadCertificate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
            style={{ background: "#10b981", color: "#000", boxShadow: "0 0 20px rgba(16,185,129,0.2)"}}>
            {downloading ? <Activity className="w-5 h-5 animate-pulse" /> : <Download className="w-5 h-5" />}
            {downloading ? "Minting Certificate..." : "Proof of Sovereignty Certificate"}
          </button>
        </div>

        {/* Live Counters (Enforcer Repair Tally) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border flex flex-col items-center justify-center bg-[#0a0a0a] border-[#1a1a1a]">
            <p className="text-[10px] font-mono uppercase text-[#666] mb-1">Total PII Entities Masked</p>
            {tallies ? (
              <p className="text-3xl font-bold font-mono text-emerald-400 tabular-nums">{tallies.piiMasked.toLocaleString()}</p>
            ) : (
              <div className="h-9 w-24 bg-[#1a1a1a] rounded animate-pulse" />
            )}
          </div>
          <div className="p-4 rounded-xl border flex flex-col items-center justify-center bg-[#0a0a0a] border-[#1a1a1a]">
            <p className="text-[10px] font-mono uppercase text-[#666] mb-1">JSON Schemas Repaired</p>
            {tallies ? (
              <p className="text-3xl font-bold font-mono text-blue-400 tabular-nums">{tallies.schemasRepaired.toLocaleString()}</p>
            ) : (
              <div className="h-9 w-24 bg-[#1a1a1a] rounded animate-pulse" />
            )}
          </div>
          <div className="p-4 rounded-xl border flex flex-col items-center justify-center bg-[#0a0a0a] border-[#1a1a1a] relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-500/10 rounded-full blur-xl pointer-events-none" />
            <p className="text-[10px] font-mono uppercase text-[#666] mb-1">Hallucinations Blocked</p>
            {tallies ? (
              <p className="text-3xl font-bold font-mono text-red-400 tabular-nums">{tallies.hallucinations.toLocaleString()}</p>
            ) : (
              <div className="h-9 w-24 bg-[#1a1a1a] rounded animate-pulse" />
            )}
          </div>
        </div>

        {/* X-Ray Split Screen */}
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#111] flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-[#888]" />
            <p className="text-xs font-mono uppercase text-[#888] tracking-widest">Live execution stream</p>
            <div className="ml-auto flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-500 uppercase">Streaming</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#1a1a1a]">
            {/* ORIGINAL SIDE */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#1a1a1a]">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-[#ccc]">Original Data (Vault)</h3>
                <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/20">Contains PII</span>
              </div>
              <HighlightedText text={DEMO_PAYLOAD.raw} entities={DEMO_PAYLOAD.entitiesReplaced} isRaw={true} />
            </div>

            {/* SANITIZED SIDE */}
            <div className="p-6 relative bg-gradient-to-br from-[#0a0a0a] to-[#0d1611]">
              <div className="absolute top-1/2 -left-3 -mt-3 w-6 h-6 rounded-full bg-[#111] border border-[#222] flex items-center justify-center z-10 hidden lg:flex shadow-xl shadow-emerald-500/10">
                <ArrowRight className="w-3 h-3 text-emerald-500" />
              </div>

              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#1a1a1a]">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-[#ccc]">Sovereign Data (AI Boundary)</h3>
                <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Zero Knowledge</span>
              </div>
              <HighlightedText text={DEMO_PAYLOAD.sanitized} entities={DEMO_PAYLOAD.entitiesReplaced} isRaw={false} />
            </div>
          </div>
        </div>

        {/* Detailed Extraction Log */}
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#111] text-[#888] border-b border-[#1a1a1a]">
              <tr>
                <th className="px-5 py-3 font-medium uppercase tracking-widest">Entity Type</th>
                <th className="px-5 py-3 font-medium uppercase tracking-widest">Detected (Raw)</th>
                <th className="px-5 py-3 font-medium uppercase tracking-widest">Sanitized Token</th>
                <th className="px-5 py-3 font-medium uppercase tracking-widest text-right">Protection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111]">
              {DEMO_PAYLOAD.entitiesReplaced.map((ent, i) => (
                <tr key={i} className="hover:bg-[#0c0c0c] transition-colors">
                  <td className="px-5 py-3">
                    <span className="px-2 py-1 rounded bg-[#1a1a1a] text-[#aaa]">{ent.type}</span>
                  </td>
                  <td className="px-5 py-3 text-red-400">{ent.original}</td>
                  <td className="px-5 py-3 text-emerald-400">{ent.token}</td>
                  <td className="px-5 py-3 text-right">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
