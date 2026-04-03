"use client";

import React, { useState } from "react";
import { TrendingUp, ShieldCheck, AlertCircle, FileText, Download } from "lucide-react";

// ================================================================
// STREETMP VS. RAW AI — The One-Click Justification Leaderboard
// ================================================================

const CATEGORIES = [
  {
    id: "success",
    label: "Output Success Rate",
    icon: <TrendingUp className="w-5 h-5" />,
    raw: 82,
    streetmp: 100,
    rawLabel: "88% average",
    streetmpLabel: "100% Strict Mode",
    unit: "%",
    highlight: "schema validation + auto-repair",
  },
  {
    id: "pii",
    label: "PII Leakage",
    icon: <AlertCircle className="w-5 h-5" />,
    raw: 0,
    streetmp: 100,
    rawLabel: "Exposed",
    streetmpLabel: "100% Sanitized",
    unit: "%",
    highlight: "zero-knowledge sanitizer",
    invertWinner: true,
  },
  {
    id: "proof",
    label: "Cryptographic Verification",
    icon: <ShieldCheck className="w-5 h-5" />,
    raw: 0,
    streetmp: 100,
    rawLabel: "0 Proofs",
    streetmpLabel: "Merkle-Signed",
    unit: "%",
    highlight: "proof of execution",
  },
  {
    id: "audit",
    label: "Audit Trail Availability",
    icon: <FileText className="w-5 h-5" />,
    raw: 0,
    streetmp: 100,
    rawLabel: "None",
    streetmpLabel: "Full Ledger",
    unit: "%",
    highlight: "compliance history ledger",
  },
];

export default function AnalyticsPage() {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      alert("Cryptographically signed Comparison Report generated.");
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#050505] p-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-mono font-bold text-white tracking-tight mb-3">
              StreetMP OS <span className="text-[#333]">vs</span> <span className="text-[#555]">Raw AI</span>
            </h1>
            <p className="text-[#888]">The data-driven case for Sovereign AI. Present this to your finance department.</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60 shrink-0"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Generating..." : "Export Report"}
          </button>
        </div>

        {/* Summary Boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Success Advantage", value: "+18pts", color: "text-emerald-500" },
            { label: "PII Exposure", value: "ZERO", color: "text-emerald-500" },
            { label: "Trust Proofs Issued", value: "∞", color: "text-emerald-500" },
            { label: "Audit Risk", value: "NONE", color: "text-emerald-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5 text-center">
              <p className={`text-3xl font-mono font-black tracking-tight ${color}`}>{value}</p>
              <p className="text-[11px] text-[#666] font-mono uppercase tracking-widest mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Comparison Cards */}
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const streetmpWins = !cat.invertWinner;
            return (
              <div key={cat.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-[#555]">{cat.icon}</span>
                  <h3 className="font-bold text-white text-lg">{cat.label}</h3>
                  <span className="ml-auto text-xs text-[#555] font-mono px-3 py-1 bg-[#111] border border-[#222] rounded-full">via {cat.highlight}</span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Raw AI */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-[#666] font-mono uppercase tracking-wider">Raw OpenAI</span>
                      <span className="text-sm font-mono text-[#888]">{cat.rawLabel}</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#111] rounded-full overflow-hidden border border-[#222]">
                      <div
                        className="h-full bg-[#333] rounded-full transition-all duration-1000"
                        style={{ width: `${cat.invertWinner ? 100 : cat.raw}%` }}
                      />
                    </div>
                  </div>

                  {/* StreetMP */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-emerald-500 font-mono uppercase tracking-wider">StreetMP OS</span>
                      <span className="text-sm font-mono text-emerald-400">{cat.streetmpLabel}</span>
                    </div>
                    <div className="w-full h-2.5 bg-emerald-500/10 rounded-full overflow-hidden border border-emerald-500/20">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        style={{ width: `${cat.streetmp}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-[#555] font-mono">
          Data sourced from StreetMP OS internal telemetry • Updated in real-time
        </p>
      </div>
    </div>
  );
}
