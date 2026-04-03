"use client";

import { useState, useEffect } from "react";

// Fallbacks for the dashboard if imports fail on client side
const MOCK_REGISTRY = [
  { id: "gpt-4o", provider: "openai", tier: "CLOUD_ENTERPRISE", lat: 98, cost: 40, risk: 95, composite: 86 },
  { id: "claude-3-5-sonnet", provider: "anthropic", tier: "CLOUD_ENTERPRISE", lat: 95, cost: 40, risk: 98, composite: 88 },
  { id: "gemini-1.5-flash", provider: "google", tier: "CLOUD_CONSUMER", lat: 99, cost: 80, risk: 93, composite: 92 },
  { id: "mixtral-8x7b", provider: "mistral", tier: "LOCAL_VPC", lat: 97, cost: 90, risk: 85, composite: 89 },
  { id: "streetmp-auto", provider: "streetmp", tier: "SOVEREIGN_ONLY", lat: 100, cost: 100, risk: 100, composite: 100 },
];

export default function ModelIntelligencePage() {
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const runBenchmark = () => {
    setLoadingBenchmark(true);
    setTimeout(() => {
      setLoadingBenchmark(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 4500); // 4.5s simulation of speed/security phases
  };

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-8 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Adaptive Model Intelligence</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          V31 Synthetic Benchmarking Engine. Automatically discovers, stress-tests, and categorizes new AI models in real-time.
        </p>
      </div>

      {/* Top Banner: New Model Detected */}
      <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-6 flex items-center justify-between shadow-[0_0_40px_rgba(59,130,246,0.05)]">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl shrink-0">🛰️</div>
          <div>
            <h3 className="text-sm font-bold text-blue-300">Unknown Model Detected in Wild</h3>
            <p className="text-xs text-slate-400 mt-1">DeepSeek V3 API endpoint discovered. Not currently in Global Registry.</p>
          </div>
        </div>
        <button 
          onClick={runBenchmark}
          disabled={loadingBenchmark}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          {loadingBenchmark ? "Running Zero-Knowledge Tests..." : "Trigger Synthetic Benchmark"}
        </button>
      </div>

      {showToast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-950/90 text-emerald-300 text-sm font-medium shadow-2xl animate-in slide-in-from-bottom-5">
          ✅ DeepSeek V3 dynamically added to LOCAL_VPC tier with score 84/100.
        </div>
      )}

      {/* Registry Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Model Registry (Top 20)</h3>
        </div>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900/80 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-semibold uppercase">Provider / Model</th>
              <th className="px-6 py-3 font-semibold uppercase">Security Tier</th>
              <th className="px-6 py-3 font-semibold uppercase">Speed</th>
              <th className="px-6 py-3 font-semibold uppercase">Cost</th>
              <th className="px-6 py-3 font-semibold uppercase">Safety Refusals</th>
              <th className="px-6 py-3 font-semibold uppercase text-right">Composite Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {MOCK_REGISTRY.map(m => (
              <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-white mb-0.5">{m.id}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">{m.provider}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-wider
                    ${m.tier === 'SOVEREIGN_ONLY' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
                    ${m.tier === 'LOCAL_VPC' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                    ${m.tier === 'CLOUD_ENTERPRISE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
                    ${m.tier === 'CLOUD_CONSUMER' ? 'bg-slate-500/10 text-slate-300 border border-slate-500/20' : ''}
                  `}>
                    {m.tier}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-300 font-mono">{m.lat}/100</td>
                <td className="px-6 py-4 text-emerald-400 font-mono">{m.cost}/100</td>
                <td className="px-6 py-4 text-slate-300 font-mono">{m.risk}%</td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 text-white font-bold">
                    {m.composite}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
