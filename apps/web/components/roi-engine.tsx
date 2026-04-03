"use client";

import React, { useState } from 'react';

export function ROIEngine() {
  const [millionsTokens, setMillionsTokens] = useState(50); // M tokens / month

  // Simple pricing algorithm
  const gpt4CostPerM = 30.00; // Blended input/output generic estimate
  const rawCost = millionsTokens * gpt4CostPerM;
  
  // StreetMP Auto-pilot routing & caching saves ~65% on average
  const savingsRate = 0.65;
  const osCost = rawCost * (1 - savingsRate);
  
  const monthlySavings = rawCost - osCost;

  return (
    <div className="w-full bg-[#0a0a0a] rounded-3xl border border-white/10 p-8 md:p-12 shadow-2xl">
      <div className="mb-10">
        <div className="flex justify-between items-end mb-4">
          <label className="text-sm font-mono text-zinc-400 uppercase tracking-widest">Monthly Token Throughput</label>
          <span className="text-3xl font-black text-white">{millionsTokens} M</span>
        </div>
        <input 
          id="token-throughput"
          type="range" 
          min="1" 
          max="500" 
          value={millionsTokens}
          title="Monthly Token Throughput (millions)"
          aria-label="Monthly Token Throughput"
          onChange={(e) => setMillionsTokens(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Raw GPT-4 Cost */}
        <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
          <p className="text-red-400 text-xs font-mono uppercase tracking-widest mb-2">Standard GPT-4 API Spend</p>
          <p className="text-4xl font-black text-red-50">${rawCost.toLocaleString()}</p>
          <p className="text-red-400/50 text-sm mt-2">No caching. No load balancing. Zero-Privacy.</p>
        </div>

        {/* StreetMP OS Cost */}
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full" />
          <p className="text-emerald-400 text-xs font-mono uppercase tracking-widest mb-2">StreetMP Caching + Auto-Router</p>
          <p className="text-4xl font-black text-emerald-400 truncate">${Math.round(osCost).toLocaleString()}</p>
          <p className="text-emerald-400/70 text-sm mt-2 font-medium bg-emerald-500/10 inline-block px-3 py-1 rounded-full border border-emerald-500/20">
            You Save ${Math.round(monthlySavings).toLocaleString()} /mo
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-center pt-8 border-t border-white/5">
        <p className="text-zinc-500 text-sm">
          Return on Investment achieved in approximately <strong className="text-white">14 days</strong> of deployment.
        </p>
      </div>
    </div>
  );
}
