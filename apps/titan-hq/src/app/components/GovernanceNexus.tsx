"use client";

import { useEffect, useRef, useState } from "react";

interface ChurnOrg {
  id: string;
  name: string;
  last_activity: string | null;
}

export function GovernanceNexus() {
  const [churnWarning, setChurnWarning] = useState<ChurnOrg[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [policyCode, setPolicyCode] = useState("define user message\n  ...");

  const fetchChurnRef = useRef(async () => {
    try {
      const res = await fetch("/api/bridge/churn");
      const data = await res.json() as { success: boolean; data: ChurnOrg[] };
      if (data.success) {
        setChurnWarning(data.data);
      }
    } catch {}
  });

  useEffect(() => {
    const doFetch = fetchChurnRef.current;
    let mounted = true;
    if (mounted) void doFetch();
    return () => { mounted = false; };
  }, []);

  const toggleMaintenance = async () => {
    const nextState = !maintenance;
    await fetch("/api/bridge/maintenance", {
      method: "POST",
      body: JSON.stringify({ active: nextState })
    });
    setMaintenance(nextState);
  };

  const pushPolicy = async () => {
    const res = await fetch("/api/bridge/policy", {
      method: "POST",
      body: JSON.stringify({ colang_content: policyCode })
    });
    const data = await res.json();
    if (data.success) {
      alert("Policy successfully pushed and NeMo sidecar hot-reloaded.");
    } else {
      alert("Error pushing policy: " + data.error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 border-b border-zinc-800 pb-8">
      {/* Steering Wheel - Governance Controls */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div>
            <h3 className="text-lg font-semibold text-white">The Steering Wheel</h3>
            <p className="text-xs text-zinc-500">Live Governance Controls</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
            <div>
              <h4 className="text-sm font-semibold text-white">Remote Maintenance Lock</h4>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Returns a 503 to all external Gateway traffic immediately via Redis. HQ traffic remains functional.
              </p>
            </div>
            <button
               onClick={toggleMaintenance}
               className={`px-4 py-2 font-semibold text-xs rounded transition-colors uppercase tracking-wider ${maintenance ? 'bg-red-900/50 text-red-500 border border-red-800' : 'bg-emerald-900/20 text-emerald-500 border border-emerald-800 hover:bg-emerald-900/40'}`}
            >
               {maintenance ? "Deactivate" : "Activate Mode"}
            </button>
          </div>

          <div className="pt-4 border-t border-zinc-800">
             <h4 className="text-sm font-semibold text-white mb-2">Policy Pusher</h4>
             <p className="text-xs text-zinc-500 mb-3">Live overwrite NeMo Guardrails configuration. This triggers a sidecar `/v1/reload` hook over the bridge.</p>
             <textarea 
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700"
                value={policyCode}
                onChange={e => setPolicyCode(e.target.value)}
             />
             <button onClick={pushPolicy} className="mt-3 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs px-4 py-2 rounded transition-colors">
                PUSH CONFIG TO LIVE KERNEL
             </button>
          </div>
        </div>
      </section>

      {/* Churn Watch */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center">
            <div>
               <h3 className="text-lg font-semibold text-white">Churn Watch <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded ml-2">CRITICAL</span></h3>
               <p className="text-xs text-zinc-500">Organizations with 0 execution logs in 7+ days.</p>
            </div>
        </div>
        <div className="p-0 overflow-y-auto max-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
             <thead className="bg-zinc-950 text-zinc-500 sticky top-0">
               <tr>
                 <th className="font-medium px-6 py-3 border-b border-zinc-800">Org</th>
                 <th className="font-medium px-6 py-3 border-b border-zinc-800">Last Activity</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-zinc-800 bg-zinc-900">
               {churnWarning.length === 0 ? (
                 <tr><td colSpan={2} className="px-6 py-8 text-center text-zinc-500 italic text-xs">No organizations at risk.</td></tr>
               ) : (
                 churnWarning.map(org => (
                   <tr key={org.id} className="hover:bg-zinc-800/30 transition-colors">
                     <td className="px-6 py-4 font-medium text-zinc-200">
                        {org.name}
                        <div className="text-xs text-zinc-500 font-mono mt-1">{org.id.split('-')[0]}***</div>
                     </td>
                     <td className="px-6 py-4 text-xs text-orange-300 font-mono">
                        {org.last_activity ? new Date(org.last_activity).toLocaleDateString() : "Never Active"}
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
