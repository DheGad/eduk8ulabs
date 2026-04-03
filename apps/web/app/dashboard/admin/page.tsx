"use client";

import { useEffect, useState } from "react";
import { 
  getEnterpriseNodes, 
  updateNodeStatus, 
  EnterpriseNodeRow 
} from "@/lib/apiClient";

export default function AdminDashboardPage() {
  const [nodes, setNodes] = useState<EnterpriseNodeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNodes = async () => {
    try {
      const data = await getEnterpriseNodes();
      setNodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load nodes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    // Poll every 10 seconds to keep the grid live
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleStatus = async (nodeId: string, currentStatus: boolean) => {
    setProcessingId(nodeId);
    try {
      const newStatus = currentStatus ? "suspended" : "active";
      await updateNodeStatus(nodeId, newStatus);
      // Optimistic update
      setNodes((prev) =>
        prev.map((n) =>
          n.node_id === nodeId ? { ...n, is_active: !currentStatus } : n
        )
      );
    } catch (err) {
      alert(`Failed to update node status: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Pricing Model (Phase 1 placeholders -> Phase 2 actuals)
  // Let's assume a blended average of $0.01 per 1k tokens for revenue estimation
  const estimateRevenue = (input: number | null, output: number | null) => {
    const total = (input || 0) + (output || 0);
    const revenue = (total / 1000) * 0.01;
    return `$${revenue.toFixed(2)}`;
  };

  const isPulseRecent = (receivedAt: string | null) => {
    if (!receivedAt) return false;
    const pulseDate = new Date(receivedAt);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    return pulseDate > twoHoursAgo;
  };

  return (
    <div className="min-h-screen bg-black/95 p-8 text-white">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">
              Mission Control
            </h1>
            <p className="text-sm text-zinc-400">
              Global Infrastructure Map & Enterprise Master Kill-Switch
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Active
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
             <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
            {error}
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-zinc-500">
            No enterprise nodes deployed yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {nodes.map((node) => {
              const recent = isPulseRecent(node.received_at);
              const isSuspended = !node.is_active;

              return (
                <div
                  key={node.node_id}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border transition-all ${
                    isSuspended 
                      ? "border-zinc-800 bg-zinc-900/50" 
                      : "border-white/10 bg-black backdrop-blur-md hover:border-white/20"
                  }`}
                >
                  {/* Glass Top Bar */}
                  <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {node.client_name || node.node_id}
                      </span>
                      <span className="text-xs text-zinc-500 truncate max-w-[150px]" title={node.node_id}>
                        {node.node_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                        {isSuspended ? "Suspended" : recent ? "Online" : "Offline"}
                      </span>
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          isSuspended
                            ? "bg-zinc-600"
                            : recent
                            ? "bg-emerald-500 animate-pulse drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                            : "bg-red-500"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Body Metrics */}
                  <div className="flex-1 p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">
                          Executions
                        </span>
                        <span className="text-2xl font-light text-white font-mono">
                          {(node.total_executions || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">
                          Revenue
                        </span>
                        <span className="text-2xl font-light text-emerald-400 font-mono">
                          {estimateRevenue(node.total_input_tokens, node.total_output_tokens)}
                        </span>
                      </div>
                      <div className="col-span-2 mt-2 flex flex-col gap-1">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">
                          Token Throughput
                        </span>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden flex">
                          {/* Visual proportion of input vs output using simple calc */}
                          <div 
                            className="bg-blue-500/80 h-full" 
                            style={{ 
                              width: `${((node.total_input_tokens || 0) / ((node.total_input_tokens || 1) + (node.total_output_tokens || 0))) * 100}%` 
                            }} 
                          />
                          <div className="bg-emerald-500/80 h-full flex-1" />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-1">
                          <span>IN: {(node.total_input_tokens || 0).toLocaleString()}</span>
                          <span>OUT: {(node.total_output_tokens || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Base */}
                  <div className="border-t border-white/5 p-4 flex justify-between items-center bg-black">
                    <span className="text-xs text-zinc-500 shrink-0">
                      Tier: <span className="text-zinc-300 capitalize">{node.billing_tier}</span>
                    </span>
                    <button
                      onClick={() => handleToggleStatus(node.node_id, node.is_active)}
                      disabled={processingId === node.node_id}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50
                        ${
                          isSuspended
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                        }
                      `}
                    >
                      {processingId === node.node_id 
                        ? "Processing..." 
                        : isSuspended 
                        ? "Reactivate Bolt" 
                        : "Suspend Bolt"}
                    </button>
                  </div>
                  
                  {/* Suspended Overlay */}
                  {isSuspended && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none z-10" />
                  )}
                  {/* Bring button above overlay */}
                  {isSuspended && (
                    <div className="absolute bottom-4 right-4 z-20">
                      <button
                        onClick={() => handleToggleStatus(node.node_id, node.is_active)}
                        disabled={processingId === node.node_id}
                        className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                         {processingId === node.node_id ? "Processing..." : "Reactivate Bolt"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
