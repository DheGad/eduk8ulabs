"use client";

import React, { useEffect, useState, use } from "react";
import { executeAutonomousWorkflow, getWorkflowStatus, getWorkflow } from "@/lib/apiClient";

export default function ExecuteWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = use(params);
  const [workflow, setWorkflow] = useState<any>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [cumulativeCost, setCumulativeCost] = useState<string>("0.00000000");
  const [statePayload, setStatePayload] = useState<any>({});

  // Fetch workflow definition
  useEffect(() => {
    getWorkflow(workflowId).then(wf => setWorkflow(wf)).catch(console.error);
  }, [workflowId]);

  // Start Pipeline
  const deployPipeline = async () => {
    try {
      setStatus("running");
      const res = await executeAutonomousWorkflow(workflowId);
      if (res.success && res.execution_id) {
        setExecutionId(res.execution_id);
      }
    } catch (e: any) {
      alert("Error deploying pipeline: " + e.message);
      setStatus("failed");
    }
  };

  // Polling
  useEffect(() => {
    if (!executionId) return;
    const interval = setInterval(async () => {
      try {
        const data = await getWorkflowStatus(executionId);
        if (data) {
          setStatus(data.status as any);
          setCurrentNode(data.current_node);
          setCumulativeCost(data.cumulative_cost || "0.00000000");
          setStatePayload(data.state_payload || {});
          
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [executionId]);

  if (!workflow) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Loading Mission Control...</div>;
  }

  const nodes = workflow.nodes || [];

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      {/* Header Pipeline Deployer */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">Mission Control: {workflow.workflow_name}</h1>
          <p className="text-xs text-neutral-500 mt-1">Autonomous Orchestration Engine</p>
        </div>
        <button
          onClick={deployPipeline}
          disabled={status !== "idle"}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-md text-sm font-semibold shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
        >
          {status === "running" ? (
            <span className="animate-pulse flex items-center"><span className="w-2 h-2 rounded-full bg-white mr-2" /> Deploying...</span>
          ) : status === "completed" ? (
            <span>Deployment Complete</span>
          ) : (
            <span>🚀 Deploy Pipeline</span>
          )}
        </button>
      </header>

      {/* Main Mission Control */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sequence Tracker */}
        <main className="flex-1 overflow-y-auto bg-neutral-950 p-8 relative">
          <div className="max-w-3xl mx-auto space-y-6">
            {nodes.map((node: any, index: number) => {
              const isActive = status === "running" && currentNode === node.id;
              const isDone = statePayload[node.id] !== undefined;
              const hasFailed = status === "failed" && currentNode === node.id;
              
              let borderClass = "border-neutral-700/60";
              let glowClass = "";
              let statusText = "Pending";
              
              if (isActive) {
                borderClass = "border-amber-400/80";
                glowClass = "shadow-[0_0_20px_rgba(251,191,36,0.2)]";
                statusText = "Excecuting...";
              } else if (isDone) {
                borderClass = "border-cyan-500/50";
                statusText = "Completed";
              } else if (hasFailed) {
                 borderClass = "border-red-500/80";
                 statusText = "Failed";
              }

              return (
                <div key={node.id} className="relative group">
                  {index !== 0 && (
                     <div className="absolute -top-6 left-1/2 w-0.5 h-6 bg-neutral-800 flex items-center justify-center pointer-events-none">
                       {/* Animated pulse traveling down */}
                       {(isActive || isDone) && (
                          <div className={`w-1 h-full ${isActive ? 'bg-amber-400' : 'bg-cyan-500'} absolute top-0 animate-pulse`}></div>
                       )}
                     </div>
                  )}
                  
                  <div className={`bg-neutral-900 border ${borderClass} rounded-xl p-5 transition-all duration-500 ${glowClass}`}>
                    <div className="flex justify-between items-center mb-3">
                       <h3 className="text-md font-semibold text-white/90">{node.type}</h3>
                       <div className="flex items-center space-x-3 text-xs">
                          {isActive && <span className="relative flex h-2 w-2 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>}
                          <span className={`${isActive ? 'text-amber-400' : isDone ? 'text-cyan-400' : hasFailed ? 'text-red-400' : 'text-neutral-500'}`}>{statusText}</span>
                          <span className="text-neutral-600 font-mono bg-neutral-950 px-2 py-1 rounded">{node.id}</span>
                       </div>
                    </div>
                    
                    <div className="text-sm text-neutral-400 font-mono truncate">Model: {node.model}</div>
                    
                    {/* Live JSON Output Reveal if Done */}
                    {isDone && (
                      <div className="mt-4 pt-4 border-t border-neutral-800">
                        <div className="text-xs text-neutral-500 mb-2 uppercase tracking-wider">Verified Payload State</div>
                        <pre className="text-xs text-cyan-300 bg-neutral-950 p-3 rounded-md overflow-x-auto border border-cyan-900/30">
                          {JSON.stringify(statePayload[node.id], null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Telemetry Sidebar */}
        <aside className="w-80 border-l border-neutral-800 bg-neutral-900/40 flex flex-col">
           <div className="p-6">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center space-x-2">
                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span>Live Telemetry</span>
              </h2>
           </div>
           
           <div className="px-6 space-y-6">
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5">
                 <div className="text-xs text-neutral-500 mb-1">Status</div>
                 <div className="text-lg font-medium capitalize flex items-center">
                    {status === "running" && <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse" />}
                    {status === "completed" && <span className="w-2 h-2 rounded-full bg-cyan-400 mr-2" />}
                    {status === "failed" && <span className="w-2 h-2 rounded-full bg-red-400 mr-2" />}
                    {status === "idle" && <span className="w-2 h-2 rounded-full bg-neutral-600 mr-2" />}
                    {status}
                 </div>
              </div>
              
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5">
                 <div className="text-xs text-neutral-500 mb-1">Cumulative Token Cost</div>
                 <div className="text-2xl font-mono text-green-400 font-semibold tracking-tight">
                    ${Number(cumulativeCost).toFixed(6)}
                 </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5">
                 <div className="text-xs text-neutral-500 mb-2">Active Node Data</div>
                 <div className="text-sm font-mono text-neutral-300 break-words">
                    {currentNode || "None"}
                 </div>
              </div>
           </div>
        </aside>
      </div>
    </div>
  );
}
