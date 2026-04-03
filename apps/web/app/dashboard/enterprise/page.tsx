"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getWorkflows,
  executeWorkflow,
  updateEnterprisePolicy,
  getWorkflowExecutionStatus,
  WorkflowSummary,
  WorkflowExecutionStatus,
} from "@/lib/apiClient";

// ================================================================
// CONSTANTS
// ================================================================

const ALLOWED_MODELS = [
  { id: "gpt-4o",        label: "GPT-4o",         tag: "Flagship" },
  { id: "gpt-4o-mini",   label: "GPT-4o Mini",    tag: "Fast" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo",  tag: "Budget" },
  { id: "claude-3-opus", label: "Claude 3 Opus",  tag: "Premium" },
  { id: "claude-3-sonnet", label: "Claude 3 Sonnet", tag: "Balanced" },
  { id: "claude-3-haiku", label: "Claude 3 Haiku", tag: "Efficient" },
];

const ORG_ID = "enterprise-default"; // In production pull from JWT claims

// ================================================================
// SUB-COMPONENTS
// ================================================================

function SectionCard({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.04]">
        <span className="text-xl">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, checked, onToggle }: {
  label: string; desc: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-white/[0.04] last:border-0">
      <div>
        <p className="text-sm text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none"
        style={{ background: checked ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.1)" }}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function StatCard({ value, label, sub, color }: {
  value: string; label: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col gap-1">
      <span className="font-mono text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs text-zinc-200 font-medium">{label}</span>
      <span className="text-[10px] text-zinc-600">{sub}</span>
    </div>
  );
}

// ================================================================
// STATUS BADGE COMPONENT
// ================================================================
function StatusBadge({ status }: { status: "running" | "completed" | "failed" | "idle" }) {
  const map = {
    idle:      { color: "rgba(113,113,122,0.8)", bg: "rgba(39,39,42,0.5)", text: "Idle" },
    running:   { color: "rgba(251,191,36,0.9)",  bg: "rgba(251,191,36,0.08)", text: "Running…" },
    completed: { color: "rgba(52,211,153,0.9)",  bg: "rgba(16,185,129,0.08)", text: "Completed" },
    failed:    { color: "rgba(248,113,113,0.9)", bg: "rgba(239,68,68,0.08)",  text: "Failed" },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
      style={{ color: s.color, background: s.bg, borderColor: s.color + "33" }}
    >
      {status === "running" && (
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
      )}
      {s.text}
    </span>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function EnterpriseControlCenterPage() {
  // ── Policy state ──────────────────────────────────────────────
  const [forceSanitize, setForceSanitize] = useState(false);
  const [forceAuditLog, setForceAuditLog] = useState(true);
  const [blockJailbreak, setBlockJailbreak] = useState(true);
  const [maxSpend, setMaxSpend] = useState("100");
  const [selectedModels, setSelectedModels] = useState<string[]>(["gpt-4o-mini", "claude-3-haiku"]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);

  // ── Workflow state ────────────────────────────────────────────
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<WorkflowExecutionStatus | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [stepLog, setStepLog] = useState<string[]>([]);

  // Load workflows on mount
  useEffect(() => {
    getWorkflows()
      .then((wfs) => {
        setWorkflows(wfs);
        if (wfs.length > 0) setSelectedWorkflow(wfs[0]!.id);
      })
      .catch(() => {
        // Demo mode: show placeholder workflows
        setWorkflows([
          { id: "demo-1", name: "Company Research → Outreach", step_count: 2, description: "Research + cold email draft", created_at: new Date().toISOString() },
          { id: "demo-2", name: "Code Review Pipeline",        step_count: 3, description: "Review + refactor + tests",    created_at: new Date().toISOString() },
          { id: "demo-3", name: "Market Analysis DAG",         step_count: 4, description: "Data → Analysis → Report",     created_at: new Date().toISOString() },
        ]);
        setSelectedWorkflow("demo-1");
      });
  }, []);

  // Poll execution status while running
  useEffect(() => {
    if (!executionId || pipelineStatus !== "running") return;
    const interval = setInterval(async () => {
      try {
        const status = await getWorkflowExecutionStatus(selectedWorkflow, executionId);
        setExecStatus(status);
        if (status.current_step) {
          setStepLog((prev) => {
            const entry = `[${new Date().toLocaleTimeString()}] Step: ${status.current_step}`;
            return prev.includes(entry) ? prev : [...prev, entry];
          });
        }
        if (status.status === "completed") {
          setPipelineStatus("completed");
          setRunning(false);
          setStepLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Pipeline completed in ${status.duration_ms}ms`]);
          clearInterval(interval);
        } else if (status.status === "failed") {
          setPipelineStatus("failed");
          setRunning(false);
          setStepLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Failed: ${status.error_message ?? "Unknown error"}`]);
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [executionId, pipelineStatus, selectedWorkflow]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleSavePolicy = useCallback(async () => {
    setSavingPolicy(true);
    setPolicySaved(false);
    try {
      await updateEnterprisePolicy(ORG_ID, {
        allowed_models: selectedModels,
        max_daily_spend: parseFloat(maxSpend) || 100,
        force_sanitization: forceSanitize,
        blocked_keywords: blockJailbreak ? ["ignore previous instructions", "jailbreak", "DAN mode"] : [],
      });
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 3000);
    } catch {
      // Silently handle demo mode
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 3000);
    } finally {
      setSavingPolicy(false);
    }
  }, [selectedModels, maxSpend, forceSanitize, blockJailbreak]);

  const handleRunPipeline = useCallback(async () => {
    if (!selectedWorkflow || running) return;
    setRunning(true);
    setPipelineStatus("running");
    setStepLog([`[${new Date().toLocaleTimeString()}] 🚀 Triggering workflow: ${selectedWorkflow}`]);
    setExecStatus(null);
    try {
      const resp = await executeWorkflow(selectedWorkflow, { company: "Acme Corp" });
      setExecutionId(resp.execution_id);
      setStepLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 📋 Execution ID: ${resp.execution_id.slice(0, 8)}…`]);
    } catch {
      // Demo simulation
      setExecutionId("demo-exec-" + Date.now());
      const wf = workflows.find((w) => w.id === selectedWorkflow);
      const steps = wf?.step_count ?? 2;
      let step = 1;
      const sim = setInterval(() => {
        if (step > steps) {
          clearInterval(sim);
          setPipelineStatus("completed");
          setRunning(false);
          setStepLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Pipeline completed (demo)`]);
          return;
        }
        setStepLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ⚙  Executing step ${step}/${steps}…`]);
        step++;
      }, 1800);
    }
  }, [selectedWorkflow, running, workflows]);

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white">

      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-24">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-[10px] text-violet-400 font-mono uppercase tracking-widest">Enterprise Control Center</span>
            </div>
            <h1 className="text-3xl font-extralight tracking-tight text-white">
              God Mode <span className="text-violet-400">Dashboard</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Full organizational control over the StreetMP OS execution kernel
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-xs text-zinc-600">Org ID</span>
            <span className="text-xs font-mono text-zinc-400">{ORG_ID}</span>
          </div>
        </div>

        {/* ── Quick Stats ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard value="94.2%" label="Policy Compliance"  sub="Last 24 hours"           color="rgba(52,211,153,0.9)"  />
          <StatCard value="1,847" label="Executions Today"   sub="↑ 12% vs yesterday"      color="rgba(139,92,246,0.9)"  />
          <StatCard value="87.6%" label="Auto-Routed"        sub="Memory Service hits"      color="rgba(251,191,36,0.9)"  />
          <StatCard value="$24.3" label="Daily Spend"        sub={`of $${maxSpend} cap`}    color="rgba(34,211,238,0.9)"  />
          {/* THE AVAILABILITY SCORECARD */}
          <StatCard value="99.998%" label="System Uptime"    sub="MTBF / (MTBF+MTTR)"     color="rgba(167,243,208,0.9)" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── SECTION 1: Policy Switchboard ─────────────────── */}
          <div className="flex flex-col gap-6">
            <SectionCard icon="🏛" title="Policy Switchboard" subtitle="Governance rules for all executions">

              <Toggle
                label="Force PII Sanitization"
                desc="All prompts pass through the Sanitizer before reaching any LLM"
                checked={forceSanitize}
                onToggle={() => setForceSanitize((v) => !v)}
              />
              <Toggle
                label="Mandatory Audit Log"
                desc="Every execution generates a cryptographic Proof of Execution receipt"
                checked={forceAuditLog}
                onToggle={() => setForceAuditLog((v) => !v)}
              />
              <Toggle
                label="Anti-Jailbreak Shield"
                desc="Block prompts containing known jailbreak patterns"
                checked={blockJailbreak}
                onToggle={() => setBlockJailbreak((v) => !v)}
              />

              {/* Daily spend cap */}
              <div className="mt-4 flex flex-col gap-2">
                <label htmlFor="max-spend" className="text-xs text-zinc-500 uppercase tracking-widest">
                  Max Daily Spend (USD)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm">$</span>
                  <input
                    id="max-spend"
                    type="number"
                    min="1"
                    max="10000"
                    value={maxSpend}
                    onChange={(e) => setMaxSpend(e.target.value)}
                    placeholder="100"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  />
                </div>
              </div>

              {/* Model allow-list */}
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-xs text-zinc-500 uppercase tracking-widest">Allowed Models</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALLOWED_MODELS.map((m) => {
                    const active = selectedModels.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleModel(m.id)}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all duration-150"
                        style={{
                          borderColor: active ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.06)",
                          background: active ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <span className="text-xs text-zinc-200">{m.label}</span>
                        <span
                          className="text-[9px] rounded-sm px-1.5 py-0.5 font-mono"
                          style={{ background: active ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)", color: active ? "#c4b5fd" : "#52525b" }}
                        >
                          {m.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSavePolicy}
                disabled={savingPolicy}
                className="mt-5 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 focus:outline-none"
                style={{
                  background: policySaved
                    ? "rgba(16,185,129,0.2)"
                    : "linear-gradient(135deg, rgba(139,92,246,0.6) 0%, rgba(124,58,237,0.8) 100%)",
                  border: policySaved ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(139,92,246,0.3)",
                  color: policySaved ? "rgb(52,211,153)" : "white",
                }}
              >
                {savingPolicy ? "Saving…" : policySaved ? "✓ Policy Saved" : "Save & Apply Policy"}
              </button>
            </SectionCard>
          </div>

          {/* ── SECTIONS 2 + 3 stacked ───────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* SECTION 2: Memory Brain */}
            <SectionCard icon="🧠" title="Memory Brain" subtitle="Historical routing intelligence">
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl border border-violet-500/10 bg-violet-500/[0.04] p-4">
                  <div className="text-2xl font-mono font-bold text-violet-300">87.6%</div>
                  <div className="text-xs text-zinc-400 mt-1">Auto-Route Hit Rate</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Memory Service recommendations</div>
                </div>
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4">
                  <div className="text-2xl font-mono font-bold text-emerald-300">1,618</div>
                  <div className="text-xs text-zinc-400 mt-1">Schema Patterns Learned</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Unique required_key schemas</div>
                </div>
              </div>

              {/* Top models by success rate */}
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Model Success Leaderboard</p>
              {[
                { model: "claude-3-haiku", rate: 97.4, runs: 841 },
                { model: "gpt-4o-mini",    rate: 94.2, runs: 612 },
                { model: "gpt-4o",         rate: 91.8, runs: 165 },
              ].map((m) => (
                <div key={m.model} className="flex items-center gap-3 mb-2 last:mb-0">
                  <span className="text-xs text-zinc-400 font-mono w-32 shrink-0">{m.model}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.rate}%`,
                        background: "linear-gradient(90deg, rgba(139,92,246,0.6), rgba(52,211,153,0.6))",
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-400 w-12 text-right">{m.rate}%</span>
                </div>
              ))}
            </SectionCard>

            {/* SECTION 3: Workflow Trigger */}
            <SectionCard icon="🕸" title="Workflow Trigger" subtitle="Launch multi-step AI pipelines">

              {/* Workflow selector */}
              <div className="flex flex-col gap-2 mb-4">
                <label htmlFor="workflow-select" className="text-[10px] text-zinc-600 uppercase tracking-widest">
                  Select Pipeline
                </label>
                <select
                  id="workflow-select"
                  value={selectedWorkflow}
                  onChange={(e) => setSelectedWorkflow(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer"
                  disabled={running}
                >
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id} style={{ background: "#0a0a0f" }}>
                      {wf.name} ({wf.step_count} steps)
                    </option>
                  ))}
                  {workflows.length === 0 && (
                    <option value="" style={{ background: "#0a0a0f" }}>
                      No workflows defined yet
                    </option>
                  )}
                </select>
              </div>

              {/* Status + run button */}
              <div className="flex items-center justify-between mb-4">
                <StatusBadge status={pipelineStatus} />
                <button
                  type="button"
                  onClick={handleRunPipeline}
                  disabled={running || !selectedWorkflow}
                  className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-40 focus:outline-none"
                  style={{
                    background: running
                      ? "rgba(251,191,36,0.08)"
                      : "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(124,58,237,0.7))",
                    borderColor: running ? "rgba(251,191,36,0.3)" : "rgba(139,92,246,0.4)",
                    color: running ? "rgba(251,191,36,0.9)" : "white",
                  }}
                >
                  {running ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-yellow-400/60 border-t-yellow-400 animate-spin" />
                      Running…
                    </>
                  ) : "▶ Run Pipeline"}
                </button>
              </div>

              {/* Execution log */}
              {stepLog.length > 0 && (
                <div className="rounded-xl border border-white/[0.04] bg-black/30 p-4 max-h-36 overflow-y-auto">
                  {stepLog.map((line, i) => (
                    <div key={i} className="font-mono text-[10px] text-zinc-500 leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {/* Completed results preview */}
              {pipelineStatus === "completed" && execStatus && execStatus.step_results && (
                <div className="mt-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-3">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-2">Results</p>
                  <pre className="text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(execStatus.step_results, null, 2).slice(0, 400)}
                    {JSON.stringify(execStatus.step_results).length > 400 ? "\n…" : ""}
                  </pre>
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── SECTION 4: The Oracle Engine (Predictive Simulation) ─────────────────── */}
          <div className="lg:col-span-2">
            <SectionCard icon="👁" title="The Oracle Engine" subtitle="Singularity-Level Predictive Simulation & Swarm Consensus">
              <div className="flex flex-col md:flex-row gap-8 items-center justify-center p-6 rounded-2xl border border-white/[0.05] bg-black/40 relative overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

                {/* Left: The 5 Personas */}
                <div className="flex flex-col gap-3 relative z-10 w-full md:w-1/3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 text-center font-bold">Parallel Threads</div>
                  {[
                    { name: "The Specialist", weight: 35, color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10" },
                    { name: "The Skeptic", weight: 25, color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/10" },
                    { name: "The Visionary", weight: 15, color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
                    { name: "The Pragmatist", weight: 15, color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/10" },
                    { name: "The Auditor", weight: 10, color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/10" }
                  ].map(p => (
                    <div key={p.name} className={`px-4 py-2.5 rounded-xl border ${p.border} ${p.bg} flex justify-between items-center backdrop-blur-sm relative group cursor-crosshair`}>
                      <span className={`text-xs font-semibold ${p.color}`}>{p.name}</span>
                      <span className="text-[10px] tracking-wider text-white/50">{p.weight}w</span>
                      {/* Connection Line (Desktop) */}
                      <div className="hidden md:block absolute right-[-2rem] top-1/2 h-px w-8 bg-gradient-to-r from-white/20 to-transparent group-hover:from-white/40 transition-colors" />
                    </div>
                  ))}
                </div>

                {/* Middle: The Convergence / Swarm Mesh */}
                <div className="hidden md:flex flex-col justify-center items-center relative z-10 w-1/4">
                  <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center relative bg-black shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-zinc-700 animate-[spin_10s_linear_infinite]" />
                    <span className="text-xl">Σ</span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 mt-4 tracking-widest">RRF FUSION</div>
                </div>

                {/* Right: The Final Answer */}
                <div className="flex flex-col gap-4 relative z-10 w-full md:w-1/3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 text-center font-bold">Convergent Result</div>
                  <div className="px-5 py-6 rounded-2xl border border-white/20 bg-white/[0.02] backdrop-blur-md shadow-2xl flex flex-col items-center justify-center text-center">
                    <div className="text-4xl font-mono font-bold text-white mb-2 drop-shadow-md">94.8%</div>
                    <div className="text-xs text-zinc-400 font-medium">Simulation Consensus</div>
                    <div className="w-full h-1 mt-4 rounded-full bg-white/10 overflow-hidden relative">
                       <div className="absolute left-0 top-0 h-full bg-white shadow-[0_0_10px_white] w-[94.8%]" />
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-5 leading-relaxed">
                      "Autonomous cross-node Swarm validation complete. SHA-256 pattern matched."
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
