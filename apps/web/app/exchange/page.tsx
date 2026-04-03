"use client";

import React, { useEffect, useState } from "react";
import { getWorkflowStore } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

export default function StreetMPExchange() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // User Portfolio Mock State
  const portfolio = [
    { name: "Global SEO Analyzer", shares: 25.00, dividendEarned: 145.20 },
    { name: "PII Sanitizer Pro", shares: 10.50, dividendEarned: 32.10 },
  ];

  useEffect(() => {
    getWorkflowStore()
      .then(data => { setAgents(data || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  const handleBuyEquity = (agent: any) => {
    // Simulated buying action for frontend
    const sharesToBuy = prompt(`Buy fractional shares of ${agent.workflow_name}\nCurrent Market Cap Valuation: $${(agent.total_rentals * 15 || 5000).toLocaleString()}\nHow much equity (%) do you want to buy? (Max 10%)`, "1.00");
    if (sharesToBuy) {
      alert(`Order submitted for ${sharesToBuy}% equity in ${agent.workflow_name} at market price. Cleared through the OS ledger.`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <header className="flex flex-col space-y-2 pb-6 border-b border-neutral-800">
           <h1 className="text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-emerald-400 to-teal-500 text-transparent bg-clip-text">THE AI NASDAQ</h1>
           <p className="text-neutral-400 font-medium">The Liquid Equity Market for Autonomous Workflows.</p>
        </header>

        {/* Portfolio Section */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
           <h2 className="text-lg font-bold text-white mb-6 flex items-center space-x-2">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             <span>Your Passive Income Portfolio</span>
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {portfolio.map((p, i) => (
                <div key={i} className="bg-black border border-neutral-800 rounded-xl p-5">
                   <div className="text-sm font-semibold text-neutral-300 mb-1">{p.name}</div>
                   <div className="flex justify-between items-end mt-4">
                      <div>
                         <div className="text-xs text-neutral-500">Ownership</div>
                         <div className="font-mono text-indigo-400">{p.shares.toFixed(2)}%</div>
                      </div>
                      <div className="text-right">
                         <div className="text-xs text-neutral-500">Dividends Paid</div>
                         <div className="font-mono text-emerald-400 font-bold">${p.dividendEarned.toFixed(2)}</div>
                      </div>
                   </div>
                </div>
             ))}
             <div className="bg-gradient-to-br from-indigo-900/40 to-black border border-indigo-500/30 rounded-xl p-5 flex flex-col justify-center items-center">
                <div className="text-xs text-indigo-300 font-medium uppercase tracking-widest mb-1">Total Yield</div>
                <div className="text-3xl font-mono text-white font-bold">$177.30</div>
             </div>
           </div>
        </section>

        {/* Market Grid Section */}
        <section>
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold border-l-4 border-emerald-500 pl-3">Top Performing Agents</h2>
             <div className="text-xs font-mono text-neutral-500">MARKET OPEN</div>
          </div>

          {loading ? (
             <div className="animate-pulse space-y-4">
               {[1,2,3].map(i => <div key={i} className="w-full h-20 bg-neutral-900 rounded-lg"></div>)}
             </div>
          ) : agents.length === 0 ? (
             <div className="text-neutral-600 py-16 text-center border border-dashed border-neutral-800 rounded-xl">
               Market is quiet. No workflows have IPO'd yet.
             </div>
          ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500 uppercase">
                     <th className="py-4 px-4 font-medium">Agent Name</th>
                     <th className="py-4 px-4 font-medium text-right">Creator HCQ</th>
                     <th className="py-4 px-4 font-medium text-right">24H Agentic GDP</th>
                     <th className="py-4 px-4 font-medium text-right">Share Price (Est.)</th>
                     <th className="py-4 px-4 font-medium text-center">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-neutral-800/50">
                   {agents.map((agent) => {
                     // Deriving stats dynamically for the exchange UX
                     const gdp = (agent.total_rentals * parseFloat(agent.price_per_execution || "0")).toFixed(2);
                     const sharePrice = ((parseFloat(gdp) * 10) / 100).toFixed(2); // Mock valuation: 10x revenue / 100 shares
                     
                     return (
                       <tr key={agent.id} className="hover:bg-neutral-900/50 transition-colors group">
                         <td className="py-4 px-4">
                           <div className="font-semibold text-white/90">{agent.workflow_name}</div>
                           <div className="text-xs text-neutral-500 font-mono mt-1 w-32 truncate" title={agent.id}>{agent.id}</div>
                         </td>
                         <td className="py-4 px-4 text-right">
                           <span className="text-cyan-400 font-mono bg-cyan-900/20 px-2 py-1 rounded inline-block">
                             {parseFloat(agent.creator_hcq || 100).toFixed(2)}
                           </span>
                         </td>
                         <td className="py-4 px-4 text-right">
                           <span className="text-emerald-400 font-mono font-medium">${gdp}</span>
                         </td>
                         <td className="py-4 px-4 text-right">
                           <span className="text-white font-mono">${sharePrice === "0.00" ? "0.50" : sharePrice}</span>
                         </td>
                         <td className="py-4 px-4 text-center">
                           <button
                             onClick={() => handleBuyEquity(agent)}
                             className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-4 rounded transition-all opacity-80 group-hover:opacity-100"
                           >
                             BUY EQUITY
                           </button>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          )}
        </section>

      </div>
    </div>
  );
}
