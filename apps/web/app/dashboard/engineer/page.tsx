"use client";

/**
 * @version V2 — REAL-DATA-02
 * SIMULATION KILLED: Removed MOCK constant and silent fallback.
 * The page now surfaces real API errors rather than fabricating data.
 * Backend: getEngineerDashboard() → trust-service /engineer/dashboard → hcq_profiles + execution_traces tables.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getEngineerDashboard,
  createStripeOnboardingLink,
  EngineerDashboardData,
  ExecutionTrace,
} from "@/lib/apiClient";

// ================================================================
// ERROR STATE COMPONENT
// Shown when the backend is genuinely unavailable — no fake data.
// ================================================================
function BackendErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-14 h-14 rounded-2xl border border-red-900/40 bg-red-950/20 flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-white mb-2">Backend Unavailable</h2>
      <p className="text-sm text-zinc-500 max-w-sm mb-1">{message}</p>
      <p className="text-xs text-zinc-700 mb-6 font-mono">Source: trust-service /engineer/dashboard</p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ================================================================
// TIER CONFIG
// ================================================================
const TIER = {
  rising:   { label: "Rising",   color: "rgba(52,211,153,0.9)",  bg: "rgba(16,185,129,0.08)",  border: "rgba(52,211,153,0.2)",  icon: "🌱" },
  verified: { label: "Verified", color: "rgba(139,92,246,0.9)", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)", icon: "⚡" },
  elite:    { label: "Elite",    color: "rgba(251,191,36,0.9)",  bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  icon: "👑" },
};

// ================================================================
// HELPERS
// ================================================================
function fmtTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function RingGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <span className="absolute font-mono text-sm font-bold text-white">{value.toFixed(1)}%</span>
      </div>
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

function StatPill({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <span className="font-mono text-2xl font-bold text-white">{value}</span>
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
    </div>
  );
}

function ExecutionRow({ ex }: { ex: ExecutionTrace }) {
  const ok = ex.status === "success";
  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
      {/* Status dot */}
      <td className="py-3 pl-4 pr-2 w-8">
        <div
          className="h-2 w-2 rounded-full mx-auto"
          style={{ background: ok ? "rgba(52,211,153,0.9)" : "rgba(248,113,113,0.9)" }}
          title={ok ? "Success" : "Failed"}
        />
      </td>
      {/* Model */}
      <td className="py-3 pr-3">
        <span className="text-xs font-mono text-zinc-300">{ex.model_used}</span>
      </td>
      {/* Attempts */}
      <td className="py-3 pr-3 text-center hidden sm:table-cell">
        <span className={`text-xs font-mono ${ex.attempts_taken === 1 ? "text-emerald-400" : "text-yellow-400"}`}>
          {ex.attempts_taken}×
        </span>
      </td>
      {/* Tokens */}
      <td className="py-3 pr-3 text-right hidden md:table-cell">
        <span className="text-xs text-zinc-500">{ex.tokens_used?.toLocaleString() ?? "—"}</span>
      </td>
      {/* Proof ID */}
      <td className="py-3 pr-3">
        {ex.proof_id ? (
          <Link
            href={`/verify/${ex.proof_id}`}
            className="font-mono text-[10px] text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
          >
            {ex.proof_id.slice(0, 8)}…
          </Link>
        ) : (
          <span className="text-[10px] text-zinc-700">no proof</span>
        )}
      </td>
      {/* Time */}
      <td className="py-3 pr-4 text-right">
        <span className="text-[10px] text-zinc-600">{fmtTime(ex.created_at)}</span>
      </td>
    </tr>
  );
}

// ================================================================
// STRIPE PAYOUT CARD
// ================================================================
function StripePayoutCard({
  profile,
}: {
  profile: EngineerDashboardData["hcq_profile"];
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setErr(null);
    try {
      const { onboarding_url } = await createStripeOnboardingLink();
      window.location.href = onboarding_url;
    } catch {
      setErr("Unable to start Stripe onboarding. Please try again.");
      setLoading(false);
    }
  }

  if (profile.payouts_enabled) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Bank Verified</span>
          </div>
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="font-mono text-xl font-bold text-white">
              {fmtUSD(profile.available_balance ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Available to Pay Out</div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="font-mono text-xl font-bold text-yellow-300">
              {fmtUSD(profile.pending_balance ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Pending (in escrow)</div>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">
          Payouts are released automatically when escrow is resolved.{" "}
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer noopener" className="text-zinc-500 hover:text-zinc-400 transition-colors">
            Open Stripe →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Connect Bank Account</p>
          <p className="text-xs text-zinc-500">Required to receive escrow payouts</p>
        </div>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        Clients lock funds in escrow before you start work. Connect your bank account via Stripe to receive automatic releases when the job is approved.
      </p>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
          {err}
        </div>
      )}

      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 focus:outline-none"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.7) 0%, rgba(139,92,246,0.9) 50%, rgba(167,139,250,0.8) 100%)",
          border: "1px solid rgba(139,92,246,0.4)",
        }}
      >
        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(255,255,255,0.06)" }} />
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Connecting to Stripe…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
              </svg>
              Connect Bank via Stripe
            </>
          )}
        </span>
      </button>

      <p className="text-[10px] text-zinc-700 text-center">
        Powered by Stripe Connect Express — bank-grade security
      </p>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================
export default function EngineerDashboardPage() {
  const [data, setData]         = useState<EngineerDashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEngineerDashboard(true); // bust cache on every load
      setData(result);
    } catch (err) {
      // Surface the real error — never silently swap in fake data
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[EngineerDashboard] Failed to fetch real data:", msg);
      setError(`Could not load your dashboard: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const tier   = data ? TIER[data.hcq_profile.account_tier] : null;
  const hcq    = data?.hcq_profile;
  const recent = data?.recent_executions ?? [];

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-24">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-[10px] text-violet-400 font-mono uppercase tracking-widest">Engineer Hub</span>
            </div>
            <h1 className="text-3xl font-extralight tracking-tight text-white">
              {loading ? "Loading…" : `Hey, ${data?.user.name.split(" ")[0] ?? "dev"}`}
            </h1>
            {data && (
              <p className="text-sm text-zinc-500 mt-1">{data.user.email}</p>
            )}
          </div>
          {tier && (
            <div
              className="flex items-center gap-2 rounded-xl border px-4 py-2"
              style={{ background: tier.bg, borderColor: tier.border, color: tier.color }}
            >
              <span>{tier.icon}</span>
              <span className="text-sm font-semibold">{tier.label}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <BackendErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* ── SECTION 1: Trust Identity ─────────────────────── */}
            <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Trust Identity</h2>
                  <p className="text-xs text-zinc-500">Your cryptographic reputation on the OS</p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">

                  {/* HCQ Score — big number */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="relative">
                      {/* Outer glow ring */}
                      <div className="absolute inset-0 rounded-full blur-xl opacity-30"
                        style={{ background: tier?.color }} />
                      <div
                        className="relative h-28 w-28 rounded-full border-4 flex flex-col items-center justify-center"
                        style={{ borderColor: tier?.color, background: tier?.bg }}
                      >
                        <span className="font-mono text-3xl font-black text-white">
                          {hcq!.global_hcq_score.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">HCQ</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2">Human Capability Quotient</p>
                  </div>

                  {/* Ring gauges */}
                  <div className="flex gap-6 flex-wrap">
                    <RingGauge
                      value={hcq!.success_rate}
                      label="Success Rate"
                      color="rgba(139,92,246,0.9)"
                    />
                    <RingGauge
                      value={hcq!.first_try_rate}
                      label="1st-Try Rate"
                      color="rgba(52,211,153,0.9)"
                    />
                  </div>

                  {/* Stat pills */}
                  <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                    <StatPill
                      value={hcq!.total_executions.toLocaleString()}
                      label="Total Executions"
                      sub="All time"
                    />
                    <StatPill
                      value={`${hcq!.success_rate.toFixed(1)}%`}
                      label="Global Success Rate"
                      sub="Verifiable on PoE"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── SECTION 2: Financial Status (Stripe) ─────────── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Financial Status</h2>
                {!hcq!.payouts_enabled && (
                  <span className="text-[10px] text-yellow-500 border border-yellow-500/20 bg-yellow-500/[0.06] rounded-full px-2.5 py-1">
                    Action Required
                  </span>
                )}
              </div>
              <StripePayoutCard profile={hcq!} />
            </div>

            {/* ── SECTION 3: Execution Ledger ───────────────────── */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Execution Ledger</h2>
                  <p className="text-xs text-zinc-500">Recent execution traces — click proof_id to verify</p>
                </div>
                <Link
                  href="/dashboard"
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  View all →
                </Link>
              </div>
              {recent.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-zinc-600">No executions yet.</p>
                  <p className="text-xs text-zinc-700 mt-1">Your execution history will appear here.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="py-2.5 pl-4 pr-2 text-[10px] text-zinc-600 uppercase tracking-widest text-left w-8" />
                      <th className="py-2.5 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-left">Model</th>
                      <th className="py-2.5 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-center hidden sm:table-cell">Tries</th>
                      <th className="py-2.5 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-right hidden md:table-cell">Tokens</th>
                      <th className="py-2.5 pr-3 text-[10px] text-zinc-600 uppercase tracking-widest text-left">Proof ID</th>
                      <th className="py-2.5 pr-4 text-[10px] text-zinc-600 uppercase tracking-widest text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((ex) => <ExecutionRow key={ex.id} ex={ex} />)}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
