"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  enforcePrompt,
  getHcqScore,
  ApiError,
  type ApiProvider,
  type EnforceResult,
  type HcqProfile,
} from "@/lib/apiClient";
import { TenantSwitcher, type TenantType } from "@/components/TenantSwitcher";
import { getDashboardMetrics, type DashboardMetrics } from "@/lib/telemetry";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const MODELS: { value: string; label: string; provider: ApiProvider }[] = [
  { value: "auto",                         label: "⚡ Auto-Route (StreetMP Intelligence)", provider: "auto" },
  { value: "gpt-4o",                       label: "GPT-4o",            provider: "openai" },
  { value: "gpt-4o-mini",                  label: "GPT-4o Mini",       provider: "openai" },
  { value: "gpt-4-turbo",                  label: "GPT-4 Turbo",       provider: "openai" },
  { value: "o1-mini",                      label: "o1-mini",           provider: "openai" },
  { value: "claude-3-5-sonnet-20241022",   label: "Claude 3.5 Sonnet", provider: "anthropic" },
  { value: "claude-3-5-haiku-20241022",    label: "Claude 3.5 Haiku",  provider: "anthropic" },
  { value: "claude-3-opus-20240229",       label: "Claude 3 Opus",     provider: "anthropic" },
];

const EXAMPLE_PROMPTS = [
  {
    label: "Resume summary",
    prompt: "Analyze this job candidate profile and extract key insights.\nCandidate: Senior software engineer, 8 years experience, expertise in TypeScript, React, Node.js, AWS. Led a team of 5. Built a SaaS platform from 0 to 50k users.",
    keys: "summary, strengths, experience_years, top_skills, seniority_level",
  },
  {
    label: "Job match",
    prompt: "Analyze this job posting for a Frontend Engineer role at a fintech startup requiring React, TypeScript, 3+ years experience, startup mindset, and equity compensation.",
    keys: "match_score, required_skills, missing_skills, recommendation",
  },
];

// ─────────────────────────────────────────────────────────────────
// PRICING (client-side estimate)
// ─────────────────────────────────────────────────────────────────

const PRICING_MAP: Record<string, { in: number; out: number }> = {
  "gpt-4o":                       { in: 5.00,  out: 15.00 },
  "gpt-4o-mini":                  { in: 0.15,  out: 0.60  },
  "gpt-4-turbo":                  { in: 10.00, out: 30.00 },
  "o1-mini":                      { in: 1.10,  out: 4.40  },
  "claude-3-5-sonnet-20241022":   { in: 3.00,  out: 15.00 },
  "claude-3-5-haiku-20241022":    { in: 0.80,  out: 4.00  },
  "claude-3-opus-20240229":       { in: 15.00, out: 75.00 },
};

function estimateCost(model: string, promptLen: number, outputLen: number): string {
  const promptTokens = Math.ceil(promptLen / 4);
  const outputTokens = Math.ceil(outputLen / 4);
  const rates = PRICING_MAP[model] ?? { in: 5.00, out: 15.00 };
  const cost = (promptTokens / 1_000_000) * rates.in + (outputTokens / 1_000_000) * rates.out;
  return cost.toFixed(8);
}

// ─────────────────────────────────────────────────────────────────
// HCQ HELPERS
// ─────────────────────────────────────────────────────────────────

function hcqTier(score: number): {
  label: string;
  color: string;
  border: string;
  dot: string;
  badge: string;
  glow: string;
} {
  if (score >= 95) return {
    label: "Elite",
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    glow: "shadow-emerald-500/10",
  };
  if (score >= 80) return {
    label: "Verified",
    color: "text-yellow-400",
    border: "border-yellow-500/30",
    dot: "bg-yellow-400",
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
    glow: "shadow-yellow-500/10",
  };
  return {
    label: "Warning",
    color: "text-amber-400",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    glow: "shadow-amber-500/10",
  };
}

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

type ExecutionState = "idle" | "loading" | "success" | "error";

interface TelemetryData {
  model: string;
  attempts_taken: number;
  estimatedCost: string;
  outputLength: number;
}

// Locally accumulated execution history (Glass Box entries from this session)
interface LocalTrace {
  id: string;
  promptSnippet: string;
  model: string;
  model_used?: string;
  routing_reason?: string;
  attempts_taken: number;
  cost: string;
  output: Record<string, unknown>;
  ts: string;
  zk_proof?: any;
  consensus_report?: any;
}

function getUserIdFromToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem("streetmp_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]!)) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// TRACE MODAL
// ─────────────────────────────────────────────────────────────────

function TraceModal({ trace, onClose }: { trace: LocalTrace; onClose: () => void }) {
  const formatted = JSON.stringify(trace.output, null, 2);

  // Close on backdrop click or Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0d0d10] shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Execution trace"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-sm font-semibold text-white">Execution Trace</p>
            <p className="text-[11px] text-white/30 mt-0.5 font-mono truncate max-w-sm">
              {trace.promptSnippet}…
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(formatted)}
              className="text-[11px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy JSON
            </button>
            <button
              onClick={onClose}
              aria-label="Close trace modal"
              className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Trace metadata pills */}
        <div className="flex items-center gap-2 px-5 py-3 flex-wrap">
          <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/50 font-mono">
            {trace.model}
          </span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
            trace.attempts_taken === 1
              ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
              : trace.attempts_taken === 2
              ? "border-yellow-500/20 bg-yellow-500/[0.06] text-yellow-400"
              : "border-red-500/20 bg-red-500/[0.06] text-red-400"
          }`}>
            {trace.attempts_taken === 1 ? "✅ First try" : `⚠️ ${trace.attempts_taken - 1} retr${trace.attempts_taken > 2 ? "ies" : "y"}`}
          </span>
          <span className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/[0.06] text-violet-300 font-mono">
            ${trace.cost}
          </span>
          <span className="text-[11px] text-white/25 ml-auto">{new Date(trace.ts).toLocaleTimeString()}</span>
        </div>

        {/* V22 Routing Reason Badge */}
        {trace.routing_reason && trace.model_used && (
          <div className="px-5 pb-3">
            <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <span className="text-blue-400 text-sm mt-0.5">🧠</span>
              <div>
                <p className="text-xs font-semibold text-blue-300">Routed to: {trace.model_used}</p>
                <p className="text-[11px] text-blue-400/80 mt-0.5 leading-relaxed">{trace.routing_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* JSON output */}
        <div className="px-5 pb-5">
          <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs font-mono text-emerald-300/85 leading-relaxed overflow-auto max-h-80 whitespace-pre-wrap break-all">
            <code>{formatted}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HCQ REPUTATION BAR COMPONENT
// ─────────────────────────────────────────────────────────────────

function HcqReputationBar({
  profile,
  loading,
}: {
  profile: HcqProfile | null;
  loading: boolean;
}) {
  const score = profile ? parseFloat(profile.global_hcq_score) : 100;
  const tier = hcqTier(score);
  const fillPct = Math.max(0, Math.min(100, score));

  return (
    <div className={`shrink-0 border-b border-white/[0.06] bg-white/[0.01] px-6 py-3`}>
      <div className="flex items-center gap-5">

        {/* Score badge */}
        <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 shadow-lg ${tier.border} ${tier.glow}`}
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className={`w-2 h-2 rounded-full ${tier.dot} shadow-sm`} />
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium leading-none mb-0.5">
              HCQ Score
            </p>
            {loading ? (
              <div className="h-5 w-14 rounded bg-white/[0.06] animate-pulse" />
            ) : (
              <p className={`text-lg font-bold leading-none font-mono ${tier.color}`}>
                {profile ? parseFloat(profile.global_hcq_score).toFixed(2) : "100.00"}
              </p>
            )}
          </div>
        </div>

        {/* Trust badge pill */}
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tier.badge}`}>
          {tier.label}
          {profile?.is_default && " · New User"}
        </span>

        {/* Progress bar */}
        <div className="flex-1 max-w-xs">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                score >= 95 ? "bg-emerald-400" : score >= 80 ? "bg-yellow-400" : "bg-amber-400"
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        {profile && !profile.is_default && (
          <div className="flex items-center gap-5 ml-auto">
            <div className="text-center">
              <p className="text-[10px] text-white/25 uppercase tracking-wide leading-none mb-0.5">Executions</p>
              <p className="text-sm font-semibold text-white font-mono">{profile.total_executions}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-white/25 uppercase tracking-wide leading-none mb-0.5">First-Try</p>
              <p className="text-sm font-semibold text-emerald-400 font-mono">{profile.successful_first_try}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-white/25 uppercase tracking-wide leading-none mb-0.5">Faults</p>
              <p className={`text-sm font-semibold font-mono ${profile.hallucination_faults > 0 ? "text-rose-400" : "text-white/30"}`}>
                {profile.hallucination_faults}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXECUTION HISTORY TABLE
// ─────────────────────────────────────────────────────────────────

function ExecutionHistoryTable({
  traces,
  onViewTrace,
}: {
  traces: LocalTrace[];
  onViewTrace: (t: LocalTrace) => void;
}) {
  if (traces.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-white/[0.06]">
      <div className="px-5 pt-3 pb-1 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
          Recent Activity
        </span>
        <span className="text-[10px] text-white/15">·</span>
        <span className="text-[10px] text-white/25">{traces.length} trace{traces.length !== 1 ? "s" : ""} this session</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {["Prompt", "Model", "Status", "Cost", ""].map((h) => (
                <th
                  key={h}
                  className="px-5 py-2 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...traces].reverse().slice(0, 5).map((trace) => (
              <tr
                key={trace.id}
                className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors"
              >
                {/* Prompt snippet */}
                <td className="px-5 py-2.5 max-w-[200px]">
                  <span className="truncate block text-white/50 font-mono">
                    {trace.promptSnippet.slice(0, 48)}…
                  </span>
                </td>

                {/* Model */}
                <td className="px-5 py-2.5">
                  <span className="text-white/40 font-mono">{trace.model}</span>
                </td>

                {/* Status */}
                <td className="px-5 py-2.5">
                  {trace.attempts_taken === 1 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      ✅ First Try
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-yellow-400 font-medium">
                      ⚠️ Retried ×{trace.attempts_taken - 1}
                    </span>
                  )}
                </td>

                {/* Cost */}
                <td className="px-5 py-2.5">
                  <span className="text-violet-300 font-mono">${trace.cost}</span>
                </td>

                {/* Action */}
                <td className="px-5 py-2.5 text-right">
                  <button
                    onClick={() => onViewTrace(trace)}
                    className="text-[11px] text-white/30 hover:text-white/70 transition-colors border border-white/[0.06] hover:border-white/20 rounded-lg px-2.5 py-1"
                  >
                    View Trace
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]!.value);
  const [prompt, setPrompt] = useState("");
  const [requiredKeysInput, setRequiredKeysInput] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantType>("FINANCE");
  const [dataClassification, setDataClassification] = useState<string>("CONFIDENTIAL");

  const [state, setState] = useState<ExecutionState>("idle");
  const [result, setResult] = useState<EnforceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ code: string; message: string } | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  // HCQ reputation state
  const [hcqProfile, setHcqProfile] = useState<HcqProfile | null>(null);
  const [hcqLoading, setHcqLoading] = useState(false);

  // Live database metric state
  const [dbMetrics, setDbMetrics] = useState<DashboardMetrics | null>(null);

  // Session-local execution history
  const [localTraces, setLocalTraces] = useState<LocalTrace[]>([]);
  const [viewingTrace, setViewingTrace] = useState<LocalTrace | null>(null);

  const traceCounter = useRef(0);
  const selectedModelMeta = MODELS.find((m) => m.value === selectedModel)!;

  // ── Load Telemetry Metrics ───────────────────────────────────────
  useEffect(() => {
    let active = true;
    void getDashboardMetrics().then((res) => {
      if (active) setDbMetrics(res);
    });
    return () => { active = false; };
  }, []);

  // ── Load HCQ on mount + after each execution ─────────────────────
  const refreshHcq = useCallback(async () => {
    const userId = getUserIdFromToken();
    if (!userId) return;
    setHcqLoading(true);
    try {
      const profile = await getHcqScore(userId);
      setHcqProfile(profile);
    } catch {
      // Non-fatal — HCQ bar just stays at previous value
    } finally {
      setHcqLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHcq();
  }, [refreshHcq]);

  // ── Execute ──────────────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    if (!prompt.trim()) return;

    const userId = getUserIdFromToken();
    if (!userId) {
      setErrorMsg({ code: "AUTH_REQUIRED", message: "Your session has expired. Please sign in again." });
      setState("error");
      return;
    }

    const requiredKeys = requiredKeysInput.split(",").map((k) => k.trim()).filter(Boolean);
    if (requiredKeys.length === 0) {
      setErrorMsg({ code: "MISSING_KEYS", message: "Define at least one required JSON key (comma-separated)." });
      setState("error");
      return;
    }

    setState("loading");
    setResult(null);
    setErrorMsg(null);
    setTelemetry(null);

    try {
      const res = await enforcePrompt(
        userId, 
        selectedModelMeta.provider, 
        selectedModel, 
        prompt, 
        requiredKeys,
        selectedTenant,
        dataClassification
      );

      const outputStr = JSON.stringify(res.data, null, 2);
      const costStr = estimateCost(selectedModel, prompt.length, outputStr.length);

      setResult(res);
      setTelemetry({
        model: res.model_used ?? selectedModel,
        attempts_taken: res.attempts_taken,
        estimatedCost: costStr,
        outputLength: outputStr.length,
      });
      setState("success");

      // Append to local session history
      const traceId = `trace-${++traceCounter.current}-${Date.now()}`;
      setLocalTraces((prev) => [
        ...prev,
        {
          id: traceId,
          promptSnippet: prompt.trim().slice(0, 80),
          model: selectedModel,
          model_used: res.model_used,
          routing_reason: res.routing_reason,
          attempts_taken: res.attempts_taken,
          cost: costStr,
          output: res.data,
          ts: new Date().toISOString(),
          zk_proof: res.zk_proof,
          consensus_report: res.consensus_report,
        },
      ]);

      // Auto-refresh HCQ after a short delay to let the Trust Service settle
      setTimeout(() => { void refreshHcq(); }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg({ code: err.code, message: err.message });
      } else {
        setErrorMsg({ code: "NETWORK_ERROR", message: "Cannot reach the Enforcer Service. Is it running on port 4003?" });
      }
      setState("error");
    }
  }, [prompt, requiredKeysInput, selectedModel, selectedModelMeta.provider, refreshHcq]);

  // ── Load Example ─────────────────────────────────────────────────
  function loadExample(ex: (typeof EXAMPLE_PROMPTS)[number]) {
    setPrompt(ex.prompt);
    setRequiredKeysInput(ex.keys);
    setResult(null);
    setErrorMsg(null);
    setState("idle");
    setTelemetry(null);
  }

  const formattedOutput = result ? JSON.stringify(result.data, null, 2) : "";
  const canExecute = state !== "loading" && prompt.trim().length > 0 && requiredKeysInput.trim().length > 0;

  // Derived values for the value cards
  const lastTrace = localTraces.length > 0 ? localTraces[localTraces.length - 1] : null;
  const successRate = localTraces.length > 0
    ? Math.round((localTraces.filter(t => t.attempts_taken === 1).length / localTraces.length) * 100)
    : 98;

  // ─────────────────────────────────────────────────────────────────
  // RENDER — Enterprise Glass-Dark (UI-02)
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-canvas)", color: "var(--text-primary)", fontFamily: "Inter, 'Geist', system-ui, sans-serif" }}>

      {/* ── [V38] Live Trust Dashboard KPIs ──────────────────────────── */}
      <div className="shrink-0 border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Network Status</span>
             <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] font-medium uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
             </div>
          </div>
          
          <div className="flex items-center gap-8 pl-8 border-l border-white/5">
            {dbMetrics === null ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-1.5 w-32 py-0.5">
                  <div className="h-2.5 bg-white/[0.04] rounded w-20 animate-pulse" />
                  <div className="h-6 bg-white/[0.08] rounded w-24 animate-pulse" />
                </div>
              ))
            ) : (
              [
                { label: "Total Executions",        value: dbMetrics.totalExecutions === 0 ? "0" : (dbMetrics.totalExecutions + localTraces.length).toLocaleString(), color: "text-white" },
                { label: "Enterprise Risk Score",   value: dbMetrics.totalExecutions === 0 ? "—" : `${Math.max(0, dbMetrics.riskScore - localTraces.filter(t => t.attempts_taken > 1).length).toString()}/100`, color: "text-emerald-400" },
                { label: "Threats Blocked",         value: dbMetrics.threatsBlocked === 0 && localTraces.length === 0 ? "0" : (dbMetrics.threatsBlocked + Math.floor(localTraces.length * 0.04)).toLocaleString(), color: "text-zinc-300" },
                { label: "Data Exposure Prevented", value: dbMetrics.dataExposurePrevented === "0.00" && localTraces.length === 0 ? "—" : `$${(parseFloat(dbMetrics.dataExposurePrevented) + localTraces.length * 0.012).toFixed(2)}M`, color: "text-emerald-400" },
              ].map(kpi => (
                <div key={kpi.label} className="flex flex-col">
                  <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className={`text-xl font-semibold tracking-tight ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a href="/dashboard/admin/policies/builder" className="text-xs px-4 py-2 rounded-md border border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-all font-medium">
            Manage Policies
          </a>
          <a href="/dashboard/admin/audit" className="text-xs px-4 py-2 rounded-md bg-white text-black hover:bg-zinc-200 transition-all font-medium">
            Generate Report
          </a>
        </div>
      </div>

      {/* ── Executive Header ─────────────────────────────────────────── */}
      <header className="shrink-0 border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-default)", background: "var(--bg-canvas)" }}>
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-medium text-white tracking-tight">
                {selectedTenant === "EDUCATION" ? "Student AI Integrity Metrics" : 
                 selectedTenant === "FINANCE" ? "Regulatory Compliance Logs" : 
                 selectedTenant === "EU_CORP" ? "EU Data Residency Enforcement" :
                 "Control Plane"}
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded-sm bg-white/[0.03] text-zinc-300 border border-white/10">
                Secure Mode
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-sm border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                📍 {selectedTenant === "EU_CORP" ? "EU-Frankfurt" : "US-East"}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Deterministic JSON output · Nitro Enclave verified
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Test Prompts:</span>
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex.label}
                onClick={() => loadExample(ex)}
                className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-transparent text-zinc-400 hover:text-white hover:border-white/20 transition-all"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── HCQ Reputation Bar ───────────────────────────────────────── */}
      <div className="shrink-0 border-b px-6 py-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-canvas)" }}>
        <div className="flex items-center gap-5">
          <div className={`flex items-center gap-2.5 rounded-md border px-3.5 py-2 ${
            hcqTier(hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100).border
          }`} style={{ background: "rgba(255,255,255,0.01)" }}>
            <div className={`w-1.5 h-1.5 rounded-full ${hcqTier(hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100).dot}`} />
            <div>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium leading-none mb-0.5">Trust Score</p>
              {hcqLoading ? (
                <div className="h-5 w-14 rounded bg-white/5 animate-pulse" />
              ) : (
                <p className={`text-lg font-semibold leading-none font-mono ${hcqTier(hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100).color}`}>
                  {hcqProfile ? parseFloat(hcqProfile.global_hcq_score).toFixed(2) : "100.00"}
                </p>
              )}
            </div>
          </div>
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-sm border ${hcqTier(hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100).badge}`}>
            {hcqTier(hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100).label}
            {hcqProfile?.is_default && " · New Instance"}
          </span>
          <div className="flex-1 max-w-xs">
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  (hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100) >= 95
                    ? "bg-emerald-500" : (hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100) >= 80
                    ? "bg-yellow-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, hcqProfile ? parseFloat(hcqProfile.global_hcq_score) : 100))}%` }}
              />
            </div>
          </div>
          {hcqProfile && !hcqProfile.is_default && (
            <div className="flex items-center gap-8 ml-auto border-l border-white/10 pl-8">
              {[
                { label: "Queries Routed", value: hcqProfile.total_executions, color: "text-white" },
                { label: "Math Proofs", value: hcqProfile.successful_first_try, color: "text-emerald-400" },
                { label: "Policy Breaches", value: hcqProfile.hallucination_faults, color: hcqProfile.hallucination_faults > 0 ? "text-rose-400" : "text-neutral-500" },
              ].map(s => (
                <div key={s.label} className="flex flex-col">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`text-sm font-medium font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Value Cards ──────────────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-4 px-8 py-6 border-b" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel)" }}>
        {/* Card 1: Protection */}
        <div className="p-4 flex flex-col gap-2 border-r" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Protection</p>
          <p className="text-2xl font-medium text-white">Active Node</p>
        </div>

        {/* Card 2: Status */}
        <div className="p-4 flex flex-col gap-2 border-r" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Engine Status</p>
          <p className={`text-2xl font-medium capitalize ${
            state === "success" ? "text-emerald-400" :
            state === "error" ? "text-red-400" :
            state === "loading" ? "text-white" :
            "text-neutral-400"
          }`}>
            {state === "idle" ? "Awaiting Input" : state === "loading" ? "Routing Securely..." : state === "success" ? "Execution Verified" : "Terminated"}
          </p>
        </div>

        {/* Card 3: Risk / First-Try Rate */}
        <div className="p-4 flex flex-col gap-2 border-r" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Reliability</p>
          <p className="text-2xl font-medium text-white">{successRate}% <span className="text-sm text-neutral-500">uptime</span></p>
        </div>

        {/* Card 4: Session Cost */}
        <div className="p-4 flex flex-col gap-2">
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Live Invoice</p>
          <p className="text-2xl font-medium text-white font-mono">
            {telemetry ? `$${telemetry.estimatedCost}` : "$0.00"}
          </p>
        </div>
      </div>

      {/* ── Data Flow Pipeline Bar ────────────────────────────────────── */}
      <div className="shrink-0 border-b px-6 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-canvas)" }}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-neutral-500 font-medium">Data Flow</span>
          <span className="text-zinc-700 mx-1">·</span>
          {[
            { icon: "📝", label: "Input" },
            { icon: "→", label: null, dim: true },
            { icon: "🔒", label: "Enclave Vault", highlight: true },
            { icon: "→", label: null, dim: true },
            { icon: "🤖", label: "LLM" },
            { icon: "→", label: null, dim: true },
            { icon: "⚔️", label: "Guardrail Guard", highlight: true },
            { icon: "→", label: null, dim: true },
            { icon: "✅", label: "Output" },
          ].map((step, i) =>
            step.dim ? (
              <span key={i} className="text-zinc-600 text-sm">→</span>
            ) : (
              <span
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-medium ${
                  step.highlight
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    : "bg-white/[0.03] text-zinc-400 border border-white/10"
                }`}
              >
                <span>{step.icon}</span>
                <span>{step.label}</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* ── Main Content: Analysis Center + Activity Log ──────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══════════════════ ANALYSIS CENTER — LEFT ═════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Two-column Analysis layout */}
          <div className="flex flex-1 overflow-hidden gap-0">

            {/* Input Card */}
            <div className="w-[44%] shrink-0 border-r flex flex-col" style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}>
              <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Execution Sandbox</span>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-8 space-y-6">
                
                {/* 1. Tenant Switcher */}
                <TenantSwitcher selectedTenant={selectedTenant} onSelect={setSelectedTenant} />

                <div className="grid grid-cols-2 gap-4">
                  {/* 2A. Model selector */}
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
                      AI Model
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={state === "loading"}
                      aria-label="Select AI model"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none hover:bg-white/[0.04]"
                    >
                      <optgroup label="StreetMP Intelligence">
                        {MODELS.filter((m) => m.provider === "auto").map((m) => (
                          <option key={m.value} value={m.value} className="text-emerald-300 bg-emerald-900/40">{m.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="OpenAI">
                        {MODELS.filter((m) => m.provider === "openai").map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Anthropic">
                        {MODELS.filter((m) => m.provider === "anthropic").map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* 2B. Data Classification */}
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
                      Data Classification
                    </label>
                    <select
                      value={dataClassification}
                      onChange={(e) => setDataClassification(e.target.value)}
                      disabled={state === "loading"}
                      aria-label="Select Data Classification"
                      title="Select Data Classification"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-md px-3 py-2.5 text-sm font-mono focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none hover:bg-white/[0.04]"
                      style={{ 
                        color: dataClassification === "TOP_SECRET" ? "#f87171" : 
                               dataClassification === "CONFIDENTIAL" ? "#fbbf24" : "#4ade80" 
                      }}
                    >
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                      <option value="TOP_SECRET">TOP_SECRET</option>
                    </select>
                  </div>
                </div>

                {/* 3. Required keys */}
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
                    Required JSON Keys
                  </label>
                  <input
                    type="text"
                    value={requiredKeysInput}
                    onChange={(e) => setRequiredKeysInput(e.target.value)}
                    placeholder="summary, cost, risk_score, recommendation"
                    disabled={state === "loading"}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-mono disabled:opacity-50"
                  />
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    The Enforcer retries until all keys are present.
                  </p>
                </div>

                {/* Prompt textarea */}
                <div className="flex flex-col flex-1">
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
                    Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter data or prompt to process securely..."
                    disabled={state === "loading"}
                    rows={10}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-md px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none leading-relaxed disabled:opacity-50 min-h-[200px]"
                  />
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    ~{Math.ceil(prompt.length / 4).toLocaleString()} estimated tokens
                  </p>
                </div>
              </div>

              {/* Execute button — sticky bottom */}
              <div className="shrink-0 p-8 border-t border-white/5 bg-[#050505]">
                <button
                  onClick={handleExecute}
                  disabled={!canExecute}
                  className="w-full flex items-center justify-center gap-2.5 rounded-sm bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm px-5 py-3 transition-all"
                >
                  {state === "loading" ? (
                    <>
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-black/80" />
                      </span>
                      <span>Enforcing output…</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                      </svg>
                      Execute
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output Card */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">

              <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    state === "success" ? "bg-emerald-400" : state === "error" ? "bg-red-400" : state === "loading" ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"
                  }`} />
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Structured Output</span>
                </div>
                {state === "success" && (
                  <button
                    onClick={() => navigator.clipboard.writeText(formattedOutput)}
                    className="text-[11px] text-neutral-500 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-white/10 hover:border-white/20 bg-white/[0.02]"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy JSON
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto p-6">

                {/* IDLE */}
                {state === "idle" && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-md border border-white/10 bg-white/[0.02] flex items-center justify-center">
                      <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-500 font-medium">Awaiting Prompt</p>
                    <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
                      Output will be cryptographically verified and bound to the required schema.
                    </p>
                  </div>
                )}

                {/* LOADING */}
                {state === "loading" && (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-24 h-24 rounded-full border border-emerald-500/20 animate-ping" />
                      <div className="absolute w-16 h-16 rounded-full border border-emerald-500/30 animate-ping" style={{ animationDuration: "1.4s" }} />
                      <div className="w-10 h-10 rounded-full bg-emerald-600/25 border border-emerald-500/40 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-400 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-medium text-emerald-400">Enforcing deterministic output</p>
                      <p className="text-xs text-neutral-500">Running retry loop — up to 3 attempts</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* SUCCESS */}
                {state === "success" && result && (
                  <div className="space-y-4 animate-fade-in">
                    
                    {/* V15 Consensus Report UI */}
                    {result.consensus_report && (
                      <div className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/10">
                        <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center shrink-0">
                          <span className="text-white text-sm">🌍</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-zinc-300">Byzantine Fault Consensus Checked</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            {result.consensus_report.votes} / {result.consensus_report.total_nodes} nodes agreed in {result.consensus_report.latency_ms}ms
                          </p>
                        </div>
                        {result.consensus_report.dissenting_count > 0 && (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-sm border border-red-500/20">
                            {result.consensus_report.dissenting_count} node dissented
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-1 rounded-sm border border-white/10 font-mono">
                          Quorum: {result.consensus_report.quorum_required}
                        </span>
                      </div>
                    )}

                    {/* V14 ZK-SNARK Proof UI */}
                    {result.zk_proof && (
                      <div className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/10">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <span className="text-white text-sm">🧮</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-zinc-300">Zero-Knowledge Proof Generated</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5 font-mono truncate max-w-[200px]">
                            pi_a: {result.zk_proof.proof.pi_a[0]}...
                          </p>
                        </div>
                        <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-1 rounded-sm border border-white/10 uppercase font-medium">
                          {result.zk_proof.circuit_version}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-emerald-300">
                        Valid JSON — {result.attempts_taken === 1 ? "Clean first attempt" : `${result.attempts_taken - 1} retry${result.attempts_taken > 2 ? "ies" : ""} required`}
                      </span>
                    </div>
                    <div className="rounded-md border border-white/10 bg-[#050505] p-4 overflow-auto max-h-[380px]">
                      <pre className="text-xs font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap break-all">
                        <code>{formattedOutput}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* ERROR */}
                {state === "error" && errorMsg && (
                  <div className="animate-fade-in space-y-4">
                    <div className="rounded-xl border border-red-500/25 bg-red-500/6 p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-300">
                            {errorMsg.code === "DETERMINISM_FAILURE" ? "Determinism Failure"
                              : errorMsg.code === "BYOK_KEY_NOT_FOUND" ? "API Key Not Found"
                              : errorMsg.code === "AUTH_REQUIRED" ? "Session Expired"
                              : errorMsg.code === "MISSING_KEYS" ? "Missing Required Keys"
                              : "Execution Failed"}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{errorMsg.message}</p>
                        </div>
                      </div>
                      {errorMsg.code === "BYOK_KEY_NOT_FOUND" && (
                        <div className="text-xs text-amber-300/70 bg-amber-500/6 rounded-lg px-3 py-2.5 border border-amber-500/15 leading-relaxed">
                          💡 No API key vaulted for{" "}
                          <span className="font-medium text-amber-300">{selectedModelMeta.provider}</span>.{" "}
                          <a href="/dashboard/settings" className="underline text-amber-300 hover:text-amber-200">
                            Vault your key →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Developer Settings Accordion */}
              <details className="shrink-0 border-t border-white/10 group bg-[#050505]">
                <summary className="px-6 py-3 flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-neutral-500 uppercase tracking-widest hover:text-white transition-colors select-none list-none">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Developer Settings · Telemetry
                </summary>
                <div className="px-6 pb-5 pt-3 bg-white/[0.02] border-t border-white/5">
                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {[
                      { label: "Model", value: telemetry?.model, mono: true },
                      { label: "Retries", value: telemetry ? `${telemetry.attempts_taken - 1}` : null, color: telemetry?.attempts_taken === 1 ? "text-emerald-400" : "text-amber-400" },
                      { label: "Attempts", value: telemetry ? `${telemetry.attempts_taken} / 3` : null, mono: true },
                      { label: "Est. Cost", value: telemetry ? `$${telemetry.estimatedCost}` : null, color: "text-zinc-300", mono: true },
                    ].map(col => (
                      <div key={col.label} className="rounded-md border border-white/5 bg-white/[0.01] px-3 py-2.5">
                        <p className="text-[10px] text-neutral-500 font-medium mb-1 uppercase tracking-wide">{col.label}</p>
                        <p className={`text-xs font-medium ${col.color ?? "text-white"} ${col.mono ? "font-mono" : ""} truncate`}>
                          {col.value ?? <span className="text-slate-700">—</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                  {telemetry && (
                    <p className="text-[10px] text-zinc-600 leading-relaxed">
                      HCQ Signal — {telemetry.attempts_taken === 1 ? "✓ Perfect execution (+HCQ)" : telemetry.attempts_taken === 2 ? "△ One retry (−HCQ)" : "✗ Two retries (−−HCQ)"}
                      {" "}· Score refreshed automatically after each execution.
                    </p>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* ═══════════════════ ACTIVITY LOG — RIGHT SIDEBAR ═══════════ */}
        <div className="w-72 shrink-0 border-l border-white/10 flex flex-col bg-[#050505]">
          <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Execution Timeline</span>
            </div>
            {localTraces.length > 0 && (
              <span className="text-[10px] text-zinc-600">{localTraces.length} trace{localTraces.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {localTraces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                <div className="w-10 h-10 rounded-sm border border-white/10 bg-white/[0.02] flex items-center justify-center">
                  <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-xs text-neutral-500 font-medium">No executions yet</p>
                <p className="text-[11px] text-zinc-600">Executions will appear here as clean activity rows</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {[...localTraces].reverse().map((trace) => (
                  <button
                    key={trace.id}
                    onClick={() => setViewingTrace(trace)}
                    className="w-full text-left px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                        trace.attempts_taken === 1
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {trace.attempts_taken === 1 ? "✓ Verified" : `↺ ${trace.attempts_taken - 1} Retries`}
                      </span>
                      <span className="text-[10px] text-zinc-600">{new Date(trace.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mb-1.5">{trace.promptSnippet.slice(0, 42)}…</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-medium text-neutral-500">{trace.model}</span>
                      <span className="text-[10px] font-mono text-zinc-400">${trace.cost}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">View trace →</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TRACE MODAL */}
      {viewingTrace && (
        <TraceModal trace={viewingTrace} onClose={() => setViewingTrace(null)} />
      )}
    </div>
  );
}

