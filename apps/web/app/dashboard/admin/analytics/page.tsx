"use client";

import React, { useState, useEffect, useCallback } from "react";

// ─── Types (mirrored from telemetryService.ts) ───────────────────────────────

interface DailyDataPoint {
  date: string;
  requests: number;
  threats: number;
  interventions: number;
  latency_ms: number;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  type: "V12_POLICY_DENY" | "V17_COGNITIVE_BLOCK" | "V18_INVALID_KEY" | "V16_PROOF_FAIL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  tenant_id: string;
  model: string;
  action: string;
}

interface TelemetryPayload {
  tenant_id: string;
  generated_at: string;
  period_days: number;
  total_requests: number;
  threats_blocked: number;
  cognitive_interventions: number;
  policy_denials: number;
  avg_latency_ms: number;
  trust_score: number;
  compliance_rating: string;
  time_series: DailyDataPoint[];
  recent_events: SecurityEvent[];
  top_violations: { reason: string; count: number; pct: number }[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const ROUTER_URL = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

const TENANT_OPTIONS = [
  { id: "jpmc",        label: "JPMC — Financial",     icon: "🏦" },
  { id: "stanford",    label: "Stanford — Academic",   icon: "🎓" },
  { id: "pentagon",    label: "Pentagon — Defense",    icon: "🛡️" },
  { id: "dev-sandbox", label: "Dev Sandbox",           icon: "🔧" },
];

const PERIOD_OPTIONS = [
  { value: 7,  label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const SEV_STYLES: Record<SecurityEvent["severity"], string> = {
  CRITICAL: "text-red-300 bg-red-500/10 border-red-500/25",
  HIGH:     "text-orange-300 bg-orange-500/10 border-orange-500/25",
  MEDIUM:   "text-amber-300 bg-amber-500/10 border-amber-500/25",
  LOW:      "text-slate-400 bg-slate-700/30 border-slate-600/25",
};

const TYPE_LABEL: Record<SecurityEvent["type"], { label: string; color: string }> = {
  V12_POLICY_DENY:     { label: "V12 Policy",   color: "text-violet-400" },
  V17_COGNITIVE_BLOCK: { label: "V17 Governor",  color: "text-fuchsia-400" },
  V18_INVALID_KEY:     { label: "V18 API Key",   color: "text-yellow-400" },
  V16_PROOF_FAIL:      { label: "V16 ZK Proof",  color: "text-blue-400" },
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── CSS Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ data, metric }: { data: DailyDataPoint[]; metric: "requests" | "threats" }) {
  const values = data.map((d) => d[metric]);
  const max    = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-1.5 h-24 w-full">
      {data.map((d, i) => {
        const h = Math.max(4, (values[i]! / max) * 96);
        const isToday = i === data.length - 1;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
              <div className="text-[9px] font-mono bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                {fmt(values[i]!)} · {d.date.slice(5)}
              </div>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
            </div>
            {/* Bar */}
            <div
              className={`w-full rounded-t-sm transition-all duration-300 ${
                metric === "requests"
                  ? isToday ? "bg-blue-500" : "bg-blue-500/50 hover:bg-blue-400/70"
                  : isToday ? "bg-red-500" : "bg-red-500/50 hover:bg-red-400/70"
              }`}
              style={{ height: `${h}px` }}
            />
            {/* Day label */}
            <span className="text-[8px] text-slate-600 font-mono">
              {d.date.slice(8)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon, accent, delta,
}: {
  label: string; value: string; sub?: string; icon: string;
  accent: string; delta?: { value: string; positive: boolean };
}) {
  return (
    <div className={`rounded-2xl border ${accent} bg-slate-900/50 backdrop-blur-md p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-mono font-bold text-white tracking-tight">{value}</span>
        {delta && (
          <span className={`text-xs font-semibold pb-0.5 ${delta.positive ? "text-emerald-400" : "text-red-400"}`}>
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-slate-500 leading-relaxed">{sub}</p>}
    </div>
  );
}

// ─── Trust Score Ring ────────────────────────────────────────────────────────

function TrustRing({ score, rating }: { score: number; rating: string }) {
  const color = score >= 95 ? "#10b981" : score >= 85 ? "#3b82f6" : score >= 70 ? "#f59e0b" : "#ef4444";
  const pct   = (score / 100) * 282.7;   // circumference of r=45 circle

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${pct} 282.7`}
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white font-mono">{score}</span>
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-white">Trust Score</p>
        <p className="text-[10px] font-mono text-slate-500">Rating: {rating}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RiskAnalyticsPage() {
  const [tenantId, setTenantId] = useState("jpmc");
  const [period, setPeriod]     = useState(7);
  const [data, setData]         = useState<TelemetryPayload | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"requests" | "threats">("requests");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${ROUTER_URL}/api/v1/admin/analytics/${tenantId}?period=${period}`);
      const json = await res.json() as { success: boolean; data?: TelemetryPayload; error?: { message: string } };
      if (!json.success || !json.data) { setError(json.error?.message ?? "Failed to load analytics."); return; }
      setData(json.data);
    } catch {
      setError("Cannot reach Router Service. Ensure it's running on port 4000.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, period]);

  useEffect(() => { void fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: "#0F172A", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Risk Analytics</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/20">V20</span>
            <span className="text-xs text-slate-600">SIEM Intelligence Layer</span>
          </div>
          <p className="text-sm text-slate-500">Threat telemetry, policy interventions, and trust posture for Board reporting.</p>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tenant selector */}
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            {TENANT_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTenantId(t.id)}
                title={t.label}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tenantId === t.id
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.id}</span>
              </button>
            ))}
          </div>
          {/* Period selector */}
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.value ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            aria-label="Refresh analytics"
            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-xs transition-all"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-4 flex items-center gap-3">
          <span className="text-red-400">⚠</span>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-24 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin" />
          <span className="text-sm text-slate-500">Aggregating telemetry…</span>
        </div>
      )}

      {data && (
        <>
          {/* ── Row 1: KPI Cards + Trust Ring ─────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <MetricCard
              label="Total Requests"
              value={fmt(data.total_requests)}
              icon="📡"
              accent="border-blue-500/20"
              sub={`Past ${data.period_days} days`}
              delta={{ value: "12.4%", positive: true }}
            />
            <MetricCard
              label="Threats Blocked"
              value={fmt(data.threats_blocked)}
              icon="🚫"
              accent="border-red-500/20"
              sub="By V12 PAC + V17 Governor"
              delta={{ value: "3.1%", positive: false }}
            />
            <MetricCard
              label="Cognitive Interventions"
              value={fmt(data.cognitive_interventions)}
              icon="🧠"
              accent="border-fuchsia-500/20"
              sub="V17 Governor activations"
            />
            <MetricCard
              label="Avg Latency"
              value={`${data.avg_latency_ms}ms`}
              icon="⚡"
              accent="border-emerald-500/20"
              sub="Enclave overhead included"
            />
            {/* Trust Ring — spans 1 col on XL, 2 on smaller */}
            <div className="col-span-2 xl:col-span-1 rounded-2xl border border-indigo-500/20 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-5">
              <TrustRing score={data.trust_score} rating={data.compliance_rating} />
            </div>
          </div>

          {/* ── Row 2: Activity Chart + Top Violations ─────────────────── */}
          <div className="grid xl:grid-cols-3 gap-4">

            {/* Chart */}
            <div className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Activity — {data.period_days}-Day
                  </span>
                </div>
                <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-0.5">
                  <button
                    onClick={() => setChartMetric("requests")}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${chartMetric === "requests" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}
                  >
                    Volume
                  </button>
                  <button
                    onClick={() => setChartMetric("threats")}
                    className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${chartMetric === "threats" ? "bg-red-600 text-white" : "text-slate-500 hover:text-white"}`}
                  >
                    Threats
                  </button>
                </div>
              </div>

              <BarChart data={data.time_series} metric={chartMetric} />

              {/* Chart legend */}
              <div className="flex items-center gap-5 pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-blue-500/50" />
                  <span className="text-[10px] text-slate-500">Total Requests</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-red-500/50" />
                  <span className="text-[10px] text-slate-500">Threats Blocked</span>
                </div>
                <div className="ml-auto text-[10px] text-slate-600">
                  Peak: {fmt(Math.max(...data.time_series.map((d) => d[chartMetric])))} / day
                </div>
              </div>
            </div>

            {/* Top Violations */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Top Violations</span>
              </div>
              {data.top_violations.map((v, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-slate-300 leading-relaxed flex-1">{v.reason}</p>
                    <span className="text-[10px] font-mono text-red-300 shrink-0">{fmt(v.count)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500/60 transition-all duration-700"
                      style={{ width: `${Math.min(100, v.pct)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-600 text-right">{v.pct}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Row 3: Security Events Feed ─────────────────────────────── */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Recent Security Events
                </span>
              </div>
              <span className="text-[10px] text-slate-600">{data.recent_events.length} events · last 48h</span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {data.recent_events.map((evt) => {
                const typeInfo = TYPE_LABEL[evt.type];
                return (
                  <div key={evt.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
                    {/* Severity badge */}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${SEV_STYLES[evt.severity]}`}>
                      {evt.severity}
                    </span>
                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs text-slate-300 leading-relaxed">{evt.description}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-semibold ${typeInfo?.color ?? "text-slate-400"}`}>
                          {typeInfo?.label}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono">{evt.model}</span>
                        <span className="text-[10px] font-bold text-red-400/70 border border-red-500/15 rounded px-1.5 py-0.5">
                          {evt.action}
                        </span>
                      </div>
                    </div>
                    {/* Time */}
                    <span className="text-[10px] text-slate-600 font-mono shrink-0">{timeAgo(evt.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Row 4: Board Report Footer ───────────────────────────────── */}
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-300">Board-Ready Summary</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                In the last {data.period_days} days, StreetMP processed{" "}
                <span className="text-white font-mono">{fmt(data.total_requests)}</span> AI requests for{" "}
                <span className="text-violet-300 font-mono">{data.tenant_id}</span>,
                blocking <span className="text-red-300 font-mono">{fmt(data.threats_blocked)}</span> threats
                ({((data.threats_blocked / data.total_requests) * 100).toFixed(2)}% block rate).
                Trust Score: <span className="text-emerald-300 font-mono">{data.trust_score}/100</span>.
                Compliance Rating: <span className="text-blue-300 font-mono">{data.compliance_rating}</span>.
              </p>
            </div>
            <div className="text-[10px] text-slate-600 shrink-0 font-mono">
              Generated {new Date(data.generated_at).toLocaleString()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
