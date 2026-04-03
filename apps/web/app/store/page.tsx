"use client";

import React, { useEffect, useState } from "react";
import { getWorkflowStore, rentWorkflow } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

export default function AgentStore() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkflowStore()
      .then(data => { setWorkflows(data || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  const handleRun = async (workflow: any) => {
    // Prompt to connect BYOK and Authorize Micro-Payment
    try {
      const res = await rentWorkflow(workflow.id);
      
      if (res.payment_required && res.client_secret) {
        // Trigger Stripe element flow here.
        // Simulated Stripe flow for user UX demonstration
        const connectNow = confirm(`Please authorize a micro-payment of $${workflow.price_per_execution} to run this pipeline.\n(We will automatically use your BYOK Vault keys for the models)\nClick OK to confirm Stripe Payment.`);
        if (connectNow) {
          alert("Payment successful! Funds held in Escrow.\\nRedirecting to Mission Control...");
          router.push(`/dashboard/workflows/${workflow.id}/execute`);
        }
      } else {
        // Free workflow
        alert("This workflow is free! Redirecting to Mission Control...");
        router.push(`/dashboard/workflows/${workflow.id}/execute`);
      }
    } catch (e: any) {
       alert("Error renting workflow: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col space-y-2">
           <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 text-transparent bg-clip-text">Workflow App Store</h1>
           <p className="text-neutral-400">Discover and rent powerful autonomous pipelines built by top engineers.</p>
        </header>

        {loading ? (
           <div className="animate-pulse flex space-x-4"><div className="w-full h-48 bg-neutral-900 rounded-xl"></div></div>
        ) : workflows.length === 0 ? (
           <div className="text-neutral-500 py-12 text-center border-2 border-dashed border-neutral-800 rounded-xl">
             No published workflows available yet.
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors flex flex-col items-start relative group shadow-lg">
                <div className="absolute top-4 right-4 bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded font-mono font-bold tracking-wide">
                  ${Number(wf.price_per_execution).toFixed(2)} / run
                </div>
                
                <h3 className="text-lg font-semibold text-white/90 mb-1 pr-16">{wf.workflow_name}</h3>
                <p className="text-sm text-neutral-400 mb-4 line-clamp-2 min-h-[40px]">{wf.description || "A powerful agentic pipeline."}</p>
                
                <div className="flex flex-col space-y-4 w-full mt-auto">
                  <div className="flex items-center justify-between text-xs text-neutral-500 bg-neutral-950 p-3 rounded-md border border-neutral-800">
                    <div>
                       <span className="block text-neutral-600 mb-0.5">Creator HCQ</span>
                       <span className="font-mono text-cyan-400 font-semibold">{Number(wf.creator_hcq || 100).toFixed(2)}</span>
                    </div>
                    <div>
                       <span className="block text-neutral-600 mb-0.5">Total Rentals</span>
                       <span className="font-mono text-white/80 font-medium">{wf.total_rentals}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleRun(wf)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-md text-sm font-medium transition-colors shadow-md flex items-center justify-center space-x-2"
                  >
                    <span>🚀</span>
                    <span>Run this Pipeline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
