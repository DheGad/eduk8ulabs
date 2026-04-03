"use client";

/**
 * @file page.tsx
 * @route /dashboard/client
 * @description Client Mission Control — Escrow Vault, Live Workflow Tracker,
 *              and Compliance Audit Export.
 *
 * Architecture:
 *   <ClientDashboard>         — main async loader (polls every 8s)
 *   <ErrorBoundary>           — isolates section failures
 *   <EscrowVault>             — locked funds + active jobs
 *   <WorkflowTracker>         — live DAG progress steppers
 *   <CompletedJobsTable>      — audit trail + Download Receipt links
 *   <ZeroState>               — premium empty state CTA
 */

import {
  useState, useEffect, useCallback, useRef,
  Component, type ReactNode, type ErrorInfo,
} from "react";
import Link from "next/link";
import {
  getClientDashboard,
  ClientDashboardData,
  ActiveJob,
  EscrowStatus,
} from "@/lib/apiClient";
import type { WorkflowExecutionStatus } from "@/lib/apiClient";

// ================================================================
// MOCK (when backend is unavailable)
// ================================================================
const MOCK: ClientDashboardData = {
  user: { id: "demo", name: "Priya Kapoor", email: "priya@enterprise.io" },
  summary: {
    total_locked_usd_cents:  850_00,
    active_jobs_count:       3,
    completed_jobs_count:    11,
    total_spent_usd_cents:   4_750_00,
  },
  active_jobs: [
    {
      id: "job-1", engineer_id: "eng-1", engineer_name: "Alex Chen",
      description: "GPT-4o competitor analysis for Q2 pitch deck",
      escrow_amount: 250_00, escrow_status: "validating",
      proof_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      created_at: new Date(Date.now() - 7_200_000).toISOString(),
    },
    {
      id: "job-2", engineer_id: "eng-2", engineer_name: "rin.eth",
      description: "Multi-step workflow: Research → Outreach Copy",
      escrow_amount: 400_00, escrow_status: "locked",
      workflow_id: "wf-99", execution_id: "exec-demo-1",
      created_at: new Date(Date.now() - 1_800_000).toISOString(),
    },
    {
      id: "job-3", engineer_id: "eng-3", engineer_name: "Yuki Tanaka",
      description: "Claude-3 contract clause risk extraction",
      escrow_amount: 200_00, escrow_status: "pending_payment",
      created_at: new Date(Date.now() - 300_000).toISOString(),
    },
  ],
  completed_jobs: [
    {
      id: "job-c1", engineer_id: "eng-1", engineer_name: "Alex Chen",
      description: "Market sizing model — Series B materials",
      escrow_amount: 350_00, escrow_status: "released",
      proof_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      completed_at: new Date(Date.now() - 80_000_000).toISOString(),
    },
    {
      id: "job-c2", engineer_id: "eng-4", engineer_name: "Sam Park",
      description: "LLM security audit report",
      escrow_amount: 500_00, escrow_status: "released",
      proof_id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
      created_at: new Date(Date.now() - 172_800_000).toISOString(),
      completed_at: new Date(Date.now() - 160_000_000).toISOString(),
    },
  ],
  live_workflows: [
    {
      id: "exec-demo-1", workflow_id: "wf-99",
      status: "running", current_step: "step_2_outreach",
      step_results: { step_1_research: { output: { summary: "…" }, duration_ms: 4200, model_used: "claude-3-haiku", attempts: 1, proof_id: "d4e5f6a7" } },
      started_at: new Date(Date.now() - 300_000).toISOString(),
      duration_ms: 300_000,
    } as WorkflowExecutionStatus,
  ],
};

// ================================================================
// HELPERS
// ================================================================
function fmtUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ================================================================
// ERROR BOUNDARY
// ================================================================
interface EBProps { label: string; children: ReactNode }
interface EBState { crashed: boolean; err: string }

class ErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { crashed: false, err: "" };
  static getDerivedStateFromError(err: Error): EBState {
    return { crashed: true, err: err.message };
  }
  componentDidCatch(_err: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, info.componentStack);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center">
          <p className="text-sm text-red-400 font-medium">{this.props.label} failed to load</p>
          <p className="text-xs text-zinc-600 mt-1">{this.state.err}</p>
          <button
            type="button"
            onClick={() => this.setState({ crashed: false, err: "" })}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================================================================
// ESCROW STATUS CHIP
// ================================================================
const ESCROW_CFG: Record<EscrowStatus, { label: string; dot: string; text: string; animate: boolean }> = {
  pending_payment: { label: "Awaiting Payment",  dot: "bg-yellow-400", text: "text-yellow-400", animate: false },
  locked:          { label: "Enforcer Working",  dot: "bg-violet-400", text: "text-violet-400", animate: true  },
  validating:      { label: "Trust Validating",  dot: "bg-blue-400",   text: "text-blue-400",   animate: true  },
  released:        { label: "Released",          dot: "bg-emerald-400",text: "text-emerald-400", animate: false },
  disputed:        { label: "Disputed",          dot: "bg-orange-400", text: "text-orange-400", animate: false },
  refunded:        { label: "Refunded",          dot: "bg-zinc-400",   text: "text-zinc-500",   animate: false },
};

function EscrowChip({ status }: { status: EscrowStatus }) {
  const cfg = ESCROW_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.animate ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ================================================================
// SECTION CARD WRAPPER
// ================================================================
function SectionCard({ title, subtitle, icon, action, children }: {
  title: string; subtitle: string; icon: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ================================================================
// SKELETON LOADER
// ================================================================
function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse"
          style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

// ================================================================
// ZERO STATE
// ================================================================
function ZeroState() {
  return (
    <div className="flex flex-col items-center gap-5 py-14 px-6 text-center">
      {/* Orbital rings */}
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border border-violet-500/10 animate-spin" style={{ animationDuration: "8s" }} />
        <div className="absolute inset-3 rounded-full border border-violet-500/15 animate-spin" style={{ animationDuration: "5s", animationDirection: "reverse" }} />
        <div className="absolute inset-6 rounded-full border border-violet-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl">🚀</span>
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        <h3 className="text-lg font-light text-white">No active jobs yet</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Browse the Marketplace and hire a verified engineer to start your first Sovereign AI job — fully escrowed and cryptographically auditable.
        </p>
      </div>

      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-6 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/60 transition-all duration-200"
      >
        Browse Marketplace →
      </Link>
    </div>
  );
}

// ================================================================
// ESCROW VAULT
// ================================================================
function EscrowVault({ jobs, totalLocked }: { jobs: ActiveJob[]; totalLocked: number }) {
  if (jobs.length === 0) return <ZeroState />;

  return (
    <div>
      {/* Total locked banner */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.04] bg-violet-500/[0.02]">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Total Locked in Escrow</span>
        <span className="font-mono text-lg font-bold text-violet-300">{fmtUSD(totalLocked)}</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors">
            {/* Amount badge */}
            <div className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center">
              <span className="font-mono text-sm font-bold text-white block">{fmtUSD(job.escrow_amount)}</span>
              <span className="text-[9px] text-zinc-600 uppercase">Locked</span>
            </div>

            {/* Job info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 truncate">{job.description}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <EscrowChip status={job.escrow_status} />
                {job.engineer_name && (
                  <span className="text-[10px] text-zinc-600">
                    Engineer: <span className="text-zinc-400">{job.engineer_name}</span>
                  </span>
                )}
                <span className="text-[10px] text-zinc-600">{fmtRelative(job.created_at)}</span>
              </div>
            </div>

            {/* Proof link if ready */}
            {job.proof_id && (
              <Link
                href={`/verify/${job.proof_id}`}
                className="shrink-0 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-1.5 text-[10px] font-medium text-violet-400 hover:bg-violet-500/[0.12] transition-colors"
              >
                Verify ↗
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================================================================
// WORKFLOW PROGRESS STEPPER
// ================================================================
function WorkflowStepper({ wf }: { wf: WorkflowExecutionStatus }) {
  // Extract stable step names from step_results keys + current_step
  const completedSteps = Object.keys(wf.step_results ?? {});
  const currentStep    = wf.current_step;
  const allSteps       = currentStep && !completedSteps.includes(currentStep)
    ? [...completedSteps, currentStep]
    : completedSteps;

  const statusColor = wf.status === "completed"
    ? "rgba(52,211,153,0.9)" : wf.status === "failed"
    ? "rgba(248,113,113,0.9)" : "rgba(139,92,246,0.9)";

  return (
    <div className="px-6 py-5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-zinc-500">exec: {wf.id.slice(0, 10)}…</span>
        <span className="text-[10px] uppercase tracking-widest font-medium"
          style={{ color: statusColor }}>
          {wf.status}
        </span>
      </div>

      <div className="flex items-center gap-0">
        {allSteps.map((step, i) => {
          const isDone    = completedSteps.includes(step);
          const isRunning = step === currentStep && wf.status === "running";
          const isLast    = i === allSteps.length - 1;

          return (
            <div key={step} className="flex items-center gap-0 flex-1">
              {/* Node */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className="h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-500"
                  style={{
                    borderColor: isDone
                      ? "rgba(52,211,153,0.6)"
                      : isRunning
                      ? "rgba(139,92,246,0.8)"
                      : "rgba(255,255,255,0.1)",
                    background: isDone
                      ? "rgba(52,211,153,0.1)"
                      : isRunning
                      ? "rgba(139,92,246,0.15)"
                      : "transparent",
                  }}
                >
                  {isDone ? (
                    <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isRunning ? (
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  )}
                </div>
                <span className="text-[9px] font-mono text-zinc-600 max-w-[60px] text-center truncate">
                  {step.replace(/^step_\d+_/, "")}
                </span>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className="flex-1 h-px mx-1 rounded-full"
                  style={{ background: isDone ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.06)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Duration */}
      <p className="text-[10px] text-zinc-700 mt-2">
        Running for {Math.round(wf.duration_ms / 60_000)}m —
        {completedSteps.length}/{allSteps.length} steps complete
      </p>
    </div>
  );
}

// ================================================================
// COMPLETED JOBS TABLE (Audit / Compliance)
// ================================================================
function CompletedJobsTable({ jobs }: { jobs: ActiveJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-xs text-zinc-600">Completed jobs will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.04]">
            <th className="py-2.5 pl-6 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-left">Job</th>
            <th className="py-2.5 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-left hidden sm:table-cell">Engineer</th>
            <th className="py-2.5 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-right">Amount</th>
            <th className="py-2.5 pr-6 text-[10px] text-zinc-600 uppercase tracking-widest text-right">Audit</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.015] transition-colors">
              <td className="py-3.5 pl-6 pr-3">
                <p className="text-xs text-zinc-200 max-w-[180px] truncate">{job.description}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{job.completed_at ? fmtRelative(job.completed_at) : "—"}</p>
              </td>
              <td className="py-3.5 pr-3 hidden sm:table-cell">
                <span className="text-xs text-zinc-400">{job.engineer_name ?? "—"}</span>
              </td>
              <td className="py-3.5 pr-3 text-right">
                <span className="font-mono text-xs text-white">{fmtUSD(job.escrow_amount)}</span>
              </td>
              <td className="py-3.5 pr-6 text-right">
                {job.proof_id ? (
                  <Link
                    href={`/verify/${job.proof_id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/[0.12] hover:border-emerald-500/40 transition-all"
                    title="Download Cryptographic Audit Receipt"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Audit Trail
                  </Link>
                ) : (
                  <span className="text-[10px] text-zinc-700">No proof</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ================================================================
// SUMMARY STAT CARDS
// ================================================================
function SummaryBar({ data }: { data: ClientDashboardData }) {
  const s = data.summary;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        { value: fmtUSD(s.total_locked_usd_cents),  label: "In Escrow",       color: "text-violet-300" },
        { value: String(s.active_jobs_count),         label: "Active Jobs",     color: "text-yellow-300" },
        { value: String(s.completed_jobs_count),      label: "Completed",       color: "text-emerald-300" },
        { value: fmtUSD(s.total_spent_usd_cents),    label: "Total Deployed",  color: "text-cyan-300" },
      ].map((s) => (
        <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <span className={`font-mono text-xl font-bold ${s.color} block`}>{s.value}</span>
          <span className="text-xs text-zinc-500 mt-0.5">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================
export default function ClientMissionControlPage() {
  const [data, setData]       = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (bust = false) => {
    try {
      const result = await getClientDashboard(bust);
      setData(result);
    } catch {
      // Demo fallback
      await new Promise((r) => setTimeout(r, 600));
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll every 8s — gentle enough to not hammer the DB, responsive enough for live jobs
    pollRef.current = setInterval(() => void load(true), 8_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const hasActive    = (data?.active_jobs.length ?? 0) > 0;
  const hasCompleted = (data?.completed_jobs.length ?? 0) > 0;
  const hasWorkflows = (data?.live_workflows.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-24">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest">Mission Control</span>
            </div>
            <h1 className="text-3xl font-extralight tracking-tight text-white">
              {loading ? "Loading…" : `${data?.user.name.split(" ")[0] ?? "Client"}'s Hub`}
            </h1>
            {data && <p className="text-sm text-zinc-500 mt-1">{data.user.email}</p>}
          </div>
          <Link
            href="/marketplace"
            className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/[0.08] px-4 py-2.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/[0.15] transition-all"
          >
            + New Job
          </Link>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-white/[0.04] animate-pulse" />
          </div>
        ) : data ? (
          <>
            {/* Summary stats */}
            <SummaryBar data={data} />

            <div className="space-y-6">
              {/* ── SECTION 1: Escrow Vault ─────────────────── */}
              <ErrorBoundary label="Escrow Vault">
                <SectionCard
                  icon="🔐"
                  title="Escrow Vault"
                  subtitle="Active smart escrow contracts"
                  action={
                    hasActive ? (
                      <span className="flex items-center gap-1.5 text-[10px] text-violet-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                        {data.active_jobs.length} live
                      </span>
                    ) : undefined
                  }
                >
                  <EscrowVault
                    jobs={data.active_jobs}
                    totalLocked={data.summary.total_locked_usd_cents}
                  />
                </SectionCard>
              </ErrorBoundary>

              {/* ── SECTION 2: Live Workflow Tracker ────────── */}
              {(hasWorkflows || hasActive) && (
                <ErrorBoundary label="Workflow Tracker">
                  <SectionCard
                    icon="🕸"
                    title="Live Workflow Tracker"
                    subtitle="Real-time DAG pipeline progress"
                    action={
                      <span className="text-[10px] text-zinc-600">
                        Auto-refreshes every 8s
                      </span>
                    }
                  >
                    {data.live_workflows.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-xs text-zinc-600">No active workflow pipelines.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {data.live_workflows.map((wf) => (
                          <WorkflowStepper key={wf.id} wf={wf} />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </ErrorBoundary>
              )}

              {/* ── SECTION 3: Completed / Audit ────────────── */}
              <ErrorBoundary label="Audit Trail">
                <SectionCard
                  icon="📋"
                  title="Audit Trail"
                  subtitle="Compliance-ready cryptographic receipts"
                  action={
                    hasCompleted ? (
                      <Link
                        href="/dashboard"
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        View all →
                      </Link>
                    ) : undefined
                  }
                >
                  {!hasCompleted ? (
                    <div className="px-6 py-10 text-center">
                      <p className="text-xs text-zinc-600">
                        Completed jobs with auditable PoE receipts will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="px-6 py-3 border-b border-white/[0.04] bg-emerald-500/[0.02]">
                        <p className="text-[10px] text-zinc-600 leading-relaxed">
                          Each <span className="text-emerald-400 font-medium">Audit Trail</span> link opens a public, permanently verifiable cryptographic receipt (HMAC-SHA256 proof) signed by the OS — suitable for compliance and legal review.
                        </p>
                      </div>
                      <CompletedJobsTable jobs={data.completed_jobs} />
                    </>
                  )}
                </SectionCard>
              </ErrorBoundary>

              {/* ── No jobs at all → zero state ─────────────── */}
              {!hasActive && !hasCompleted && (
                <ErrorBoundary label="Zero State">
                  <SectionCard
                    icon="🚀"
                    title="Start Your First Job"
                    subtitle="Sovereign AI with bank-grade escrow"
                  >
                    <ZeroState />
                  </SectionCard>
                </ErrorBoundary>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
