"use client";

import React, { useState, useCallback, useEffect, useId } from "react";
import Link from "next/link";
import {
  Zap,
  Shield,
  Globe,
  Plus,
  Trash2,
  Play,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader,
  ArrowLeft,
  GitBranch,
  Lock,
  Activity,
  Copy,
  Info,
  FileText,
  DollarSign,
  TrendingUp,
  Sparkles,
} from "lucide-react";

/**
 * @file app/dashboard/builder/page.tsx
 * @description App Builder — V92 Sovereign No-Code Workflow
 *
 * Phase 5 additions:
 *  - Enterprise Starter template cards (empty canvas)
 *  - Live cost widget fetching from /api/builder/execution-cost
 *  - Cost-per-run estimate next to Run Workflow button
 *  - Cost recording via POST after each successful run
 */

// ──────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────

type StepType = "AI_PROMPT" | "DLP_SCAN" | "WEBHOOK";

interface WorkflowStep {
  id:          string;
  label:       string;
  type:        StepType;
  prompt?:     string;
  provider?:   string;
  model?:      string;
  webhookUrl?: string;
}

interface StepResult {
  stepId:          string;
  stepLabel:       string;
  stepType:        StepType;
  success:         boolean;
  output:          string;
  error?:          string;
  durationMs:      number;
  merkleLeafHash?: string;
}

interface WorkflowRunResult {
  executionId:    string;
  workflowName:   string;
  tenantId:       string;
  status:         "completed" | "partial" | "failed";
  steps:          StepResult[];
  merkleRootHash: string | null;
  startedAt:      string;
  completedAt:    string;
  durationMs:     number;
}

interface LiveCost {
  total_cost_usd:   number;
  monthly_cost_usd: number;
  total_tokens:     number;
  request_count:    number;
  model_breakdown:  { model: string; cost_usd: number; request_count: number }[];
}

// ──────────────────────────────────────────────────────────────────
// TEMPLATE DEFINITIONS
// ──────────────────────────────────────────────────────────────────

interface TemplateCard {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  colorClass:  string;
  badgeLabel:  string;
  steps:       Omit<WorkflowStep, "id">[];
}

const ENTERPRISE_TEMPLATES: TemplateCard[] = [
  {
    id:          "resume-screener",
    label:       "Prodigy Resume Screener",
    description: "Scans uploaded resumes, redacts PII using the DLP engine, then ranks candidates with AI — all in one secure pipeline.",
    icon:        <FileText className="w-5 h-5" />,
    colorClass:  "emerald",
    badgeLabel:  "HR & Recruiting",
    steps: [
      {
        label:    "DLP Scan — Redact Candidate PII",
        type:     "DLP_SCAN",
      },
      {
        label:    "AI Screening — Rank Candidates",
        type:     "AI_PROMPT",
        provider: "openai",
        model:    "gpt-4o-mini",
        prompt:   "You are an expert HR recruiter. Review the following redacted resume and score the candidate 1–10 on technical fit, communication clarity, and relevant experience. Output a structured JSON with fields: score, strengths, concerns, recommendation.\n\nResume:\n{{previous_output}}",
      },
    ],
  },
  {
    id:          "financial-auditor",
    label:       "Financial Privacy Auditor",
    description: "Detects credit card numbers, GST/TIN identifiers, and financial PII in documents. Flags violations and generates a compliance report.",
    icon:        <Shield className="w-5 h-5" />,
    colorClass:  "blue",
    badgeLabel:  "Compliance",
    steps: [
      {
        label: "DLP Scan — Detect Financial PII",
        type:  "DLP_SCAN",
      },
      {
        label:    "AI Audit — Generate Compliance Report",
        type:     "AI_PROMPT",
        provider: "openai",
        model:    "gpt-4o-mini",
        prompt:   "You are a compliance officer. Analyze the following DLP scan output and generate a formal compliance report. Identify any detected financial PII (credit cards, GST numbers, TINs). Rate risk as LOW / MEDIUM / HIGH. Output structured JSON with fields: risk_level, violations[], remediation_steps[].\n\nDLP Output:\n{{previous_output}}",
      },
      {
        label:      "Webhook — Send to Compliance System",
        type:       "WEBHOOK",
        webhookUrl: "",
      },
    ],
  },
  {
    id:          "legal-summarizer",
    label:       "Legal Contract Summarizer",
    description: "Securely summarizes contracts through AI with full audit logging. Zero data retention — every token routed through the Merkle ledger.",
    icon:        <Zap className="w-5 h-5" />,
    colorClass:  "violet",
    badgeLabel:  "Legal Tech",
    steps: [
      {
        label:    "AI Summary — Extract Key Clauses",
        type:     "AI_PROMPT",
        provider: "openai",
        model:    "gpt-4o-mini",
        prompt:   "You are a senior legal analyst. Summarize the following contract in plain English. Extract: (1) Parties involved, (2) Key obligations for each party, (3) Termination clauses, (4) Liability limits, (5) Any non-standard or risky clauses. Output as structured JSON.\n\nContract:\n{{previous_output}}",
      },
      {
        label: "DLP Scan — Redact Sensitive Terms",
        type:  "DLP_SCAN",
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
// STEP LIBRARY DEFINITIONS
// ──────────────────────────────────────────────────────────────────

const STEP_LIBRARY: {
  type:        StepType;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  color:       string;
  glow:        string;
  defaults:    Partial<WorkflowStep>;
}[] = [
  {
    type:        "AI_PROMPT",
    label:       "AI Prompt",
    description: "Route through the full V81/V85 sovereign pipeline. Supports {{previous_output}} chaining.",
    icon:        <Zap className="w-5 h-5" />,
    color:       "emerald",
    glow:        "rgba(16,185,129,0.15)",
    defaults:    { provider: "openai", model: "gpt-4o-mini", prompt: "" },
  },
  {
    type:        "DLP_SCAN",
    label:       "DLP Scan",
    description: "Run the V67 bi-directional PII scrubber over the previous step's output.",
    icon:        <Shield className="w-5 h-5" />,
    color:       "blue",
    glow:        "rgba(59,130,246,0.15)",
    defaults:    {},
  },
  {
    type:        "WEBHOOK",
    label:       "Webhook",
    description: "POST the execution state to any external endpoint with a signed V92 receipt.",
    icon:        <Globe className="w-5 h-5" />,
    color:       "violet",
    glow:        "rgba(139,92,246,0.15)",
    defaults:    { webhookUrl: "" },
  },
];

const STEP_TYPE_META: Record<StepType, { color: string; bg: string; border: string; iconColor: string }> = {
  AI_PROMPT: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", iconColor: "text-emerald-400" },
  DLP_SCAN:  { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    iconColor: "text-blue-400" },
  WEBHOOK:   { color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20",  iconColor: "text-violet-400" },
};

function getStepIcon(type: StepType, size = "w-4 h-4") {
  if (type === "AI_PROMPT") return <Zap    className={size} />;
  if (type === "DLP_SCAN")  return <Shield className={size} />;
  return <Globe className={size} />;
}

// ── Model cost estimates (per run) ────────────────────────────────
const MODEL_COST_ESTIMATE: Record<string, number> = {
  "gpt-4o-mini":       0.00013,
  "gpt-4o":            0.00850,
  "claude-3-5-sonnet": 0.01200,
  "gemini-1.5-flash":  0.00006,
  "streetmp-auto":     0.00013,
};

function estimateRunCost(steps: WorkflowStep[]): number {
  return steps.reduce((sum, s) => {
    if (s.type !== "AI_PROMPT") return sum;
    const rate = MODEL_COST_ESTIMATE[s.model ?? "gpt-4o-mini"] ?? 0.00013;
    return sum + rate;
  }, 0);
}

// ──────────────────────────────────────────────────────────────────
// ENV
// ──────────────────────────────────────────────────────────────────

const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

// ──────────────────────────────────────────────────────────────────
// LIVE COST WIDGET
// ──────────────────────────────────────────────────────────────────

function LiveCostWidget({ refreshTrigger }: { refreshTrigger: number }) {
  const [cost, setCost]       = useState<LiveCost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/builder/execution-cost")
      .then(r => r.json())
      .then((json: { success: boolean; data: LiveCost }) => {
        if (json.success) setCost(json.data);
      })
      .catch(() => { /* fail-open */ })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="mx-4 mb-4 p-3 rounded-xl animate-pulse" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
        <div className="h-3 w-20 rounded mb-2" style={{ background: "var(--border-default)" }} />
        <div className="h-5 w-14 rounded" style={{ background: "var(--border-default)" }} />
      </div>
    );
  }

  const totalUsd   = cost?.monthly_cost_usd ?? 0;
  const reqCount   = cost?.request_count    ?? 0;

  return (
    <div
      className="mx-4 mb-4 p-3 rounded-xl"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <DollarSign className="w-3 h-3" style={{ color: "var(--brand-primary)" }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Live Invoice
        </span>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
        ${totalUsd.toFixed(4)}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        This month · {reqCount} execution{reqCount !== 1 ? "s" : ""}
      </p>
      {(cost?.model_breakdown ?? []).length > 0 && (
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {cost!.model_breakdown.slice(0, 3).map(m => (
            <div key={m.model} className="flex items-center justify-between">
              <span className="text-[9px] truncate max-w-[60%]" style={{ color: "var(--text-dimmed)" }}>{m.model}</span>
              <span className="text-[9px] font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                ${m.cost_usd.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// TEMPLATE CARD — Empty Canvas state
// ──────────────────────────────────────────────────────────────────

const TEMPLATE_COLOR_MAP: Record<string, { bg: string; border: string; icon: string; badge: string; badgeBg: string }> = {
  emerald: {
    bg:      "rgba(5,150,105,0.04)",
    border:  "rgba(5,150,105,0.20)",
    icon:    "#059669",
    badge:   "#059669",
    badgeBg: "rgba(5,150,105,0.08)",
  },
  blue: {
    bg:      "rgba(59,130,246,0.04)",
    border:  "rgba(59,130,246,0.20)",
    icon:    "#3B82F6",
    badge:   "#3B82F6",
    badgeBg: "rgba(59,130,246,0.08)",
  },
  violet: {
    bg:      "rgba(124,58,237,0.04)",
    border:  "rgba(124,58,237,0.20)",
    icon:    "#7C3AED",
    badge:   "#7C3AED",
    badgeBg: "rgba(124,58,237,0.08)",
  },
};

function TemplateCardGrid({ onSelect }: { onSelect: (t: TemplateCard) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-8">
      {/* Header */}
      <div className="text-center mb-8 max-w-sm">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
          style={{ background: "linear-gradient(135deg, var(--brand-primary), #047857)", boxShadow: "0 4px 20px rgba(5,150,105,0.20)" }}
        >
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Start with a Template
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Choose an Enterprise Starter template or add steps from the library on the left.
        </p>
      </div>

      {/* Template cards */}
      <div className="w-full max-w-2xl space-y-3">
        {ENTERPRISE_TEMPLATES.map((tmpl) => {
          const colors = TEMPLATE_COLOR_MAP[tmpl.colorClass]!;
          return (
            <button
              key={tmpl.id}
              id={`template-${tmpl.id}`}
              onClick={() => onSelect(tmpl)}
              className="w-full text-left group transition-all duration-200 rounded-2xl hover:-translate-y-0.5"
              style={{
                background:   colors.bg,
                border:       `1px solid ${colors.border}`,
                padding:      "16px 20px",
                boxShadow:    "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200"
                  style={{ background: `${colors.icon}18`, border: `1px solid ${colors.border}` }}
                >
                  <span style={{ color: colors.icon }}>{tmpl.icon}</span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {tmpl.label}
                    </span>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: colors.badgeBg, color: colors.badge }}
                    >
                      {tmpl.badgeLabel}
                    </span>
                  </div>
                  <p className="text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                    {tmpl.description}
                  </p>
                  <p className="text-[10px] mt-1.5 font-medium" style={{ color: "var(--text-dimmed)" }}>
                    {tmpl.steps.length} steps · {tmpl.steps.filter(s => s.type === "AI_PROMPT").length} AI node{tmpl.steps.filter(s => s.type === "AI_PROMPT").length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Arrow */}
                <div
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5"
                  style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", color: "var(--text-dimmed)" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const uid = useId();

  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [steps,        setSteps]        = useState<WorkflowStep[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);

  const [runStatus,    setRunStatus]    = useState<"idle" | "running" | "done">("idle");
  const [runResult,    setRunResult]    = useState<WorkflowRunResult | null>(null);
  const [runError,     setRunError]     = useState<string | null>(null);
  const [copiedHash,   setCopiedHash]   = useState(false);
  const [costRefresh,  setCostRefresh]  = useState(0); // bump to trigger LiveCostWidget refetch

  const selectedStep     = steps.find(s => s.id === selectedId) ?? null;
  const estimatedCostUsd = estimateRunCost(steps);
  const hasAiSteps       = steps.some(s => s.type === "AI_PROMPT");

  // ── Step Mutations ────────────────────────────────────────────────

  const makeId = () => `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const addStep = useCallback((type: StepType, defaults: Partial<WorkflowStep>) => {
    const lib  = STEP_LIBRARY.find(l => l.type === type)!;
    const step: WorkflowStep = { id: makeId(), label: lib.label, type, ...defaults };
    setSteps(prev => [...prev, step]);
    setSelectedId(step.id);
  }, []);

  const loadTemplate = useCallback((tmpl: TemplateCard) => {
    const hydrated: WorkflowStep[] = tmpl.steps.map(s => ({ ...s, id: makeId() }));
    setSteps(hydrated);
    setWorkflowName(tmpl.label);
    setSelectedId(hydrated[0]?.id ?? null);
    setRunResult(null);
    setRunError(null);
    setRunStatus("idle");
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const updateStep = useCallback((id: string, patch: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const moveStep = useCallback((id: string, dir: -1 | 1) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next]!, arr[idx]!];
      return arr;
    });
  }, []);

  // ── Run Workflow + Cost Recording ─────────────────────────────────

  const runWorkflow = async () => {
    if (steps.length === 0 || runStatus === "running") return;
    setRunStatus("running");
    setRunResult(null);
    setRunError(null);

    try {
      const res = await fetch(`${ROUTER_URL}/api/v1/workflow/run`, {
        method:  "POST",
        headers: {
          "Content-Type":    "application/json",
          "x-streetmp-role": "ADMIN",
          "x-tenant-id":     "dev-sandbox",
        },
        body: JSON.stringify({ name: workflowName, steps, tenant_id: "dev-sandbox" }),
      });

      const json = await res.json() as { success: boolean; data?: WorkflowRunResult; error?: { message: string } };

      if (!res.ok || !json.success) throw new Error(json.error?.message ?? `HTTP ${res.status}`);

      setRunResult(json.data!);
      setRunStatus("done");

      // Record cost for each AI_PROMPT step that succeeded
      const aiSteps = steps.filter(s => s.type === "AI_PROMPT");
      for (const step of aiSteps) {
        const costUsd = MODEL_COST_ESTIMATE[step.model ?? "gpt-4o-mini"] ?? 0.00013;
        await fetch("/api/builder/execution-cost", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model:      step.model ?? "gpt-4o-mini",
            tokens_in:  300,
            tokens_out: 500,
            cost_usd:   costUsd,
          }),
        }).catch(() => { /* fail-silent — cost recording never blocks UX */ });
      }

      // Trigger LiveCostWidget refresh
      setCostRefresh(n => n + 1);

    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : String(err));
      setRunStatus("done");
    }
  };

  const copyHash = (hash: string) => {
    void navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1800);
  };

  // ──────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: "var(--bg-canvas)", color: "var(--text-primary)" }}
    >
      {/* ══ LEFT PANEL — Step Library ══════════════════════════════════ */}
      <aside
        className="w-72 shrink-0 flex flex-col z-10 relative"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border-subtle)" }}
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-medium mb-5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, var(--brand-primary), #047857)" }}
            >
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>App Builder</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "var(--brand-primary)" }}>
                Enterprise
              </p>
            </div>
          </div>
        </div>

        {/* Live Cost Widget */}
        <div className="pt-4">
          <LiveCostWidget refreshTrigger={costRefresh} />
        </div>

        {/* Step Library */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest px-1 mb-3" style={{ color: "var(--text-dimmed)" }}>
            Step Library
          </p>
          {STEP_LIBRARY.map(lib => (
            <button
              key={lib.type}
              id={`lib-step-${uid}-${lib.type}`}
              onClick={() => addStep(lib.type, lib.defaults ?? {})}
              className="w-full text-left p-4 rounded-2xl transition-all duration-200 group relative overflow-hidden"
              style={{
                background:   "var(--bg-panel)",
                border:       "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${STEP_TYPE_META[lib.type].bg} ${STEP_TYPE_META[lib.type].border} border`}>
                  <span className={STEP_TYPE_META[lib.type].iconColor}>{lib.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{lib.label}</p>
                  <p className="text-[11px] mt-0.5 leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>{lib.description}</p>
                </div>
                <Plus className="w-4 h-4 shrink-0 transition-colors" style={{ color: "var(--text-dimmed)" }} />
              </div>
            </button>
          ))}
        </div>

        {/* Merkle badge */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--brand-primary)" }} />
            <p className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
              All steps anchored to{" "}
              <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>V89 Merkle Ledger</span>
            </p>
          </div>
        </div>
      </aside>

      {/* ══ CENTER PANEL — Canvas ═════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">

        {/* Canvas Header */}
        <header
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-panel)" }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <input
              id={`wf-name-${uid}`}
              type="text"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              className="bg-transparent text-lg font-bold border-b border-transparent hover:border-current focus:outline-none transition-colors py-0.5 min-w-0 w-64"
              style={{
                color: "var(--text-primary)",
                borderBottomColor: "var(--border-default)",
              }}
              placeholder="Workflow Name"
            />
            {steps.length > 0 && (
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
                {steps.length} step{steps.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Run button + cost estimate */}
          <div className="flex items-center gap-3">
            {hasAiSteps && steps.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                <TrendingUp className="w-3 h-3" style={{ color: "var(--brand-primary)" }} />
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
                  ~${estimatedCostUsd.toFixed(5)}/run
                </span>
              </div>
            )}
            <button
              id={`run-btn-${uid}`}
              onClick={runWorkflow}
              disabled={steps.length === 0 || runStatus === "running"}
              className="flex items-center gap-2.5 px-5 py-2.5 font-bold text-sm rounded-xl transition-all duration-200 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:  "linear-gradient(135deg, var(--brand-primary), #047857)",
                boxShadow:   "0 4px 16px rgba(5,150,105,0.25)",
              }}
            >
              {runStatus === "running" ? (
                <><Loader className="w-4 h-4 animate-spin" />Running…</>
              ) : (
                <><Play className="w-4 h-4" />Run Workflow</>
              )}
            </button>
          </div>
        </header>

        {/* Canvas Body */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {steps.length === 0 ? (
            <TemplateCardGrid onSelect={loadTemplate} />
          ) : (
            <div className="max-w-xl mx-auto space-y-3">
              {steps.map((step, idx) => {
                const meta     = STEP_TYPE_META[step.type];
                const isActive = selectedId === step.id;
                const result   = runResult?.steps.find(r => r.stepId === step.id);

                return (
                  <div key={step.id} className="step-card-enter" style={{ animationDelay: `${idx * 40}ms` }}>
                    {idx > 0 && (
                      <div className="flex justify-center -mb-1">
                        <div className="w-px h-4" style={{ background: "linear-gradient(to bottom, var(--border-default), var(--border-subtle))" }} />
                      </div>
                    )}
                    <button
                      id={`canvas-step-${uid}-${step.id}`}
                      onClick={() => setSelectedId(isActive ? null : step.id)}
                      className="w-full text-left p-4 rounded-2xl transition-all duration-200 group"
                      style={{
                        background:  isActive ? "var(--bg-active)" : "var(--bg-panel)",
                        border:      `1px solid ${isActive ? "rgba(5,150,105,0.30)" : "var(--border-subtle)"}`,
                        boxShadow:   isActive ? "0 0 0 3px rgba(5,150,105,0.08)" : "var(--shadow-sm)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                        </div>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg} ${meta.border}`}>
                          <span className={meta.iconColor}>{getStepIcon(step.type)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{step.label}</p>
                          <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {step.type === "AI_PROMPT" && `${step.provider ?? "openai"} / ${step.model ?? "gpt-4o-mini"}`}
                            {step.type === "DLP_SCAN"  && "V67 Bi-Directional PII Scrubber"}
                            {step.type === "WEBHOOK"   && (step.webhookUrl || "No URL set")}
                          </p>
                        </div>
                        {result && (
                          <div className="shrink-0">
                            {result.success
                              ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                              : <XCircle    className="w-5 h-5 text-red-400" />
                            }
                          </div>
                        )}
                        {runStatus === "running" && !result && (
                          <Loader className="w-4 h-4 animate-spin shrink-0" style={{ color: "var(--text-muted)" }} />
                        )}
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? "rotate-90" : ""}`}
                          style={{ color: "var(--text-dimmed)" }}
                        />
                      </div>
                      {isActive && step.type === "AI_PROMPT" && step.prompt && (
                        <div className="mt-3 pl-14">
                          <p className="text-[11px] font-mono line-clamp-2" style={{ color: "var(--text-muted)" }}>{step.prompt}</p>
                        </div>
                      )}
                    </button>

                    <div
                      className="flex justify-end gap-1 mt-1 px-1 transition-opacity duration-200"
                      style={{ opacity: isActive ? 1 : 0 }}
                    >
                      <button title="Move up" onClick={() => moveStep(step.id, -1)} disabled={idx === 0}
                        className="p-1.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all"
                        style={{ color: "var(--text-muted)" }}
                      >↑</button>
                      <button title="Move down" onClick={() => moveStep(step.id, 1)} disabled={idx === steps.length - 1}
                        className="p-1.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all"
                        style={{ color: "var(--text-muted)" }}
                      >↓</button>
                      <button title="Remove step" onClick={() => removeStep(step.id)}
                        className="p-1.5 rounded-lg transition-all text-red-400 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add step shortcuts */}
              <div className="flex justify-center pt-2">
                <div className="w-px h-4" style={{ background: "var(--border-subtle)" }} />
              </div>
              <div className="flex justify-center gap-2 flex-wrap pt-1">
                {STEP_LIBRARY.map(lib => (
                  <button
                    key={lib.type}
                    onClick={() => addStep(lib.type, lib.defaults ?? {})}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200"
                    style={{
                      background: "var(--bg-raised)",
                      border:     "1px solid var(--border-subtle)",
                      color:      "var(--text-muted)",
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    {lib.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══ RIGHT PANEL — Config + Results ═══════════════════════════ */}
      <aside
        className="w-80 shrink-0 flex flex-col z-10 relative overflow-y-auto"
        style={{ background: "var(--bg-panel)", borderLeft: "1px solid var(--border-subtle)" }}
      >
        <div className="flex-1 overflow-y-auto">

          {/* Config Panel */}
          {selectedStep ? (
            <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${STEP_TYPE_META[selectedStep.type].bg} ${STEP_TYPE_META[selectedStep.type].border} border`}>
                  <span className={STEP_TYPE_META[selectedStep.type].iconColor}>
                    {getStepIcon(selectedStep.type, "w-3.5 h-3.5")}
                  </span>
                </div>
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{selectedStep.label} Config</h2>
              </div>

              {/* Label */}
              <label className="block mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Label</span>
                <input
                  type="text"
                  value={selectedStep.label}
                  onChange={e => updateStep(selectedStep.id, { label: e.target.value })}
                  className="mt-1.5 w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                  style={{
                    background:  "var(--bg-raised)",
                    border:      "1px solid var(--border-default)",
                    color:       "var(--text-primary)",
                  }}
                />
              </label>

              {/* AI_PROMPT config */}
              {selectedStep.type === "AI_PROMPT" && (
                <>
                  <label className="block mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Provider</span>
                    <select
                      value={selectedStep.provider ?? "openai"}
                      onChange={e => updateStep(selectedStep.id, { provider: e.target.value })}
                      className="mt-1.5 w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-all appearance-none"
                      style={{ background: "var(--bg-raised)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                      <option value="streetmp">StreetMP Auto</option>
                    </select>
                  </label>
                  <label className="block mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Model</span>
                    <select
                      value={selectedStep.model ?? "gpt-4o-mini"}
                      onChange={e => updateStep(selectedStep.id, { model: e.target.value })}
                      className="mt-1.5 w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-all appearance-none"
                      style={{ background: "var(--bg-raised)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="streetmp-auto">StreetMP Auto</option>
                    </select>
                    {/* Per-step cost estimate */}
                    <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--text-dimmed)" }}>
                      Est. ~${(MODEL_COST_ESTIMATE[selectedStep.model ?? "gpt-4o-mini"] ?? 0.00013).toFixed(5)} per run
                    </p>
                  </label>
                  <label className="block">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Prompt</span>
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-dimmed)" }}>
                        <Info className="w-3 h-3" />
                        <span>Use <code className="font-mono" style={{ color: "var(--brand-primary)" }}>{"{{previous_output}}"}</code></span>
                      </div>
                    </div>
                    <textarea
                      rows={6}
                      value={selectedStep.prompt ?? ""}
                      onChange={e => updateStep(selectedStep.id, { prompt: e.target.value })}
                      placeholder="Enter your prompt here…"
                      className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none resize-none transition-all font-mono placeholder:opacity-50"
                      style={{
                        background: "var(--bg-raised)",
                        border:     "1px solid var(--border-default)",
                        color:      "var(--text-primary)",
                      }}
                    />
                  </label>
                </>
              )}

              {/* DLP_SCAN config */}
              {selectedStep.type === "DLP_SCAN" && (
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
                  <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
                    This step automatically scans <strong>the previous step&apos;s output</strong> using the V67 bi-directional PII scrubber. No configuration required.
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>Detects: SSN, CC, GSTIN, email, phone, and custom tenant rules.</p>
                </div>
              )}

              {/* WEBHOOK config */}
              {selectedStep.type === "WEBHOOK" && (
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Endpoint URL</span>
                  <input
                    type="url"
                    value={selectedStep.webhookUrl ?? ""}
                    onChange={e => updateStep(selectedStep.id, { webhookUrl: e.target.value })}
                    placeholder="https://hooks.yourapp.com/v1/receive"
                    className="mt-1.5 w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                    style={{ background: "var(--bg-raised)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                  <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                    Receives POST with signed V92 execution receipt and full state payload.
                  </p>
                </label>
              )}
            </div>
          ) : (
            <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Configuration</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Click a step on the canvas to configure it.</p>
            </div>
          )}

          {/* Execution Results */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <h2 className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Execution Results</h2>
            </div>

            {runStatus === "idle" && !runResult && (
              <div className="text-center py-8 opacity-50">
                <Play className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Results appear here after running.</p>
              </div>
            )}

            {runStatus === "running" && (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Pipeline executing…</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>V81 NeMo · V85 APAC · V67 DLP active</p>
              </div>
            )}

            {runError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs font-bold text-red-400">Execution Error</p>
                </div>
                <p className="text-[11px] text-red-400/90 mt-1 leading-relaxed">{runError}</p>
              </div>
            )}

            {runResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${
                  runResult.status === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : runResult.status === "partial"
                      ? "bg-amber-500/10 border-amber-500/20"
                      : "bg-red-500/10 border-red-500/20"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {runResult.status === "completed"
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <XCircle    className="w-4 h-4 text-red-400" />
                    }
                    <p className={`text-xs font-bold capitalize ${
                      runResult.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"
                    }`}>
                      {runResult.status} · {runResult.durationMs}ms
                    </p>
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {runResult.steps.filter(s => s.success).length}/{runResult.steps.length} steps passed
                  </p>
                  {hasAiSteps && (
                    <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--brand-primary)" }}>
                      Cost recorded: ~${estimatedCostUsd.toFixed(5)}
                    </p>
                  )}
                </div>

                {runResult.merkleRootHash && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>V89 Merkle Root</p>
                    <div className="relative p-3 rounded-xl group" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                      <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 break-all leading-relaxed pr-6">
                        {runResult.merkleRootHash}
                      </p>
                      <button
                        title="Copy hash"
                        onClick={() => copyHash(runResult.merkleRootHash!)}
                        className="absolute top-3 right-3 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {copiedHash
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          : <Copy        className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Step Log</p>
                  <div className="space-y-2">
                    {runResult.steps.map((sr, i) => (
                      <div
                        key={sr.stepId}
                        className="p-3 rounded-xl text-[11px]"
                        style={{
                          background: sr.success ? "var(--bg-raised)" : "rgba(239,68,68,0.05)",
                          border:     sr.success ? "1px solid var(--border-subtle)" : "1px solid rgba(239,68,68,0.20)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                          {sr.success
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            : <XCircle    className="w-3.5 h-3.5 text-red-400" />
                          }
                          <span className="font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{sr.stepLabel}</span>
                          <span className="shrink-0" style={{ color: "var(--text-dimmed)" }}>{sr.durationMs}ms</span>
                        </div>
                        {sr.success ? (
                          <p className="line-clamp-3 leading-relaxed pl-5" style={{ color: "var(--text-muted)" }}>{sr.output}</p>
                        ) : (
                          <p className="text-red-500 pl-5 leading-relaxed">{sr.error}</p>
                        )}
                        {sr.merkleLeafHash && (
                          <p className="font-mono text-[9px] pl-5 mt-1 truncate" style={{ color: "var(--text-dimmed)" }}>
                            leaf: {sr.merkleLeafHash.substring(0, 24)}…
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-[9px] font-mono break-all" style={{ color: "var(--text-dimmed)" }}>
                    exec: {runResult.executionId}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes stepCardEnter {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .step-card-enter {
          animation: stepCardEnter 0.25s ease-out both;
        }
      `}</style>
    </div>
  );
}
