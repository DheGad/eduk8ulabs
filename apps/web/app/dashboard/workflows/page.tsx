"use client";

import { useState, useEffect, useCallback } from "react";
import { TenantSwitcher, type TenantType } from "@/components/TenantSwitcher";
import { enforcePrompt, type EnforceResult } from "@/lib/apiClient";

interface VerifiedWorkflow {
  id: string;
  name: string;
  description: string;
  category: "Legal" | "HR" | "Engineering" | "Compliance";
  icon: string;
  system_prompt: string;
  input_variables: string[];
  required_classification: "PUBLIC" | "CONFIDENTIAL" | "TOP_SECRET";
  supported_tenants: string[] | "ALL";
  required_compliance?: string;
}

const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000/api/v1";

export default function WorkflowStorePage() {
  const [selectedTenant, setSelectedTenant] = useState<TenantType>("FINANCE");
  const [workflows, setWorkflows] = useState<VerifiedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkflow, setActiveWorkflow] = useState<VerifiedWorkflow | null>(null);

  // Execution state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [result, setResult] = useState<EnforceResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkflows() {
      setLoading(true);
      try {
        const res = await fetch(`${ROUTER_URL}/workflows/${selectedTenant}`);
        if (res.ok) {
          const body = await res.json();
          setWorkflows(body.data ?? []);
        } else {
          setWorkflows([]);
        }
      } catch (err) {
        console.error("Failed to fetch workflows", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchWorkflows();
  }, [selectedTenant]);

  const handleExecute = useCallback(async () => {
    if (!activeWorkflow) return;
    setExecuting(true);
    setResult(null);
    setErrorMsg(null);

    try {
      // 1. Compile User Input
      const userPayload = Object.entries(formData)
        .map(([key, val]) => `[${key}]:\n${val}`)
        .join("\n\n");

      // 2. Wrap via Immutable System Prompt
      const fullPrompt = `${activeWorkflow.system_prompt}\n\n---\nUSER INPUT:\n${userPayload}`;

      // 3. Dispatch to Enforcer with strict classification locks
      const res = await enforcePrompt(
        "workflow-runner", // pseudo userId for demo
        "auto", // strictly auto-routed
        "streetmp-auto", // fallback
        fullPrompt,
        ["output_data", "summary"], // flexible keys since workflow isn't strictly defining JSON schema here, but the backend Enforcer expects them
        selectedTenant,
        activeWorkflow.required_classification
      );

      setResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Execution failed.");
    } finally {
      setExecuting(false);
    }
  }, [activeWorkflow, formData, selectedTenant]);

  const handleInputChange = (key: string, val: string) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0F172A] text-slate-100" style={{ fontFamily: "Inter, 'Geist', system-ui, sans-serif" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-white tracking-tight">Verified Workflow Store</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/20">
              Immutable Boundaries
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise AI Applications curated by InfoSec. Wild prompting is disabled.
          </p>
        </div>
      </header>

      {/* ── Main Layout ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane: Tenant & App Grid */}
        <div className="flex-1 overflow-auto p-6 space-y-6 flex flex-col border-r border-slate-800">
          <TenantSwitcher selectedTenant={selectedTenant} onSelect={(t) => { setSelectedTenant(t); setActiveWorkflow(null); }} />

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-slate-500 animate-pulse text-sm">Loading verified workflows...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => { setActiveWorkflow(wf); setFormData({}); setResult(null); setErrorMsg(null); }}
                  className={`text-left rounded-xl border p-5 flex flex-col gap-3 transition-all ${
                    activeWorkflow?.id === wf.id 
                      ? "bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/50" 
                      : "bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0">
                      {wf.icon}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Verified
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-200">{wf.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{wf.description}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-800/50">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      wf.required_classification === "TOP_SECRET" ? "bg-red-500/20 text-red-400" :
                      wf.required_classification === "CONFIDENTIAL" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {wf.required_classification}
                    </span>
                    {wf.required_compliance && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-violet-500/20 text-violet-400">
                        {wf.required_compliance}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right pane: Execution Panel */}
        <div className="w-[45%] shrink-0 flex flex-col bg-slate-900/20">
          {!activeWorkflow ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <span className="text-4xl mb-4 opacity-50">🏪</span>
              <p className="text-sm">Select an application from the store</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{activeWorkflow.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold">{activeWorkflow.name}</h2>
                    <p className="text-xs text-slate-400">Locked System Prompt via Router Service</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Immutable System Bounds</h3>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {activeWorkflow.system_prompt}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">User Payload Variables</h3>
                  <div className="space-y-4">
                    {activeWorkflow.input_variables.map((v) => (
                      <div key={v}>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">{v}</label>
                        <textarea
                          placeholder={`Enter ${v.toLowerCase()}...`}
                          className="w-full h-24 bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono placeholder-slate-600"
                          value={formData[v] || ""}
                          onChange={(e) => handleInputChange(v, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-800">
                  <button
                    onClick={handleExecute}
                    disabled={executing || activeWorkflow.input_variables.some(v => !(formData[v] || "").trim())}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-blue-900/20"
                  >
                    {executing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        Routing Safely via V23 Firewall...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>Execute Workflow</span>
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                      </span>
                    )}
                  </button>
                </div>

                {/* Results Panel */}
                {errorMsg && (
                  <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {errorMsg}
                  </div>
                )}

                {result && (
                  <div className="mt-6 flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Execution Output Received
                    </h3>
                    
                    {/* Routing Meta */}
                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-mono text-blue-300 leading-relaxed">
                       🧠 Auto-Routed to: {result.model_used || "streetmp-auto"}<br/>
                       💬 Reason: {result.routing_reason || "Workflow matched."}
                    </div>

                    <pre className="rounded-lg border border-slate-700/50 bg-slate-900/80 p-4 text-[11px] font-mono text-emerald-300 leading-relaxed overflow-auto max-h-60 whitespace-pre-wrap break-all shadow-inner">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
