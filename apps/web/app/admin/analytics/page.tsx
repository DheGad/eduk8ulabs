"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Zap,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Activity,
  TrendingUp,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
  FlaskConical,
} from "lucide-react";
import styles from "./analytics.module.css";

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
interface TenantRecord {
  tenantId: string;
  usedTokens: number;
  estimatedCostUSD: number;
}

interface AnalyticsPayload {
  success: boolean;
  timestamp: string;
  totalTenantsActive: number;
  globalTokensUsed: number;
  data: TenantRecord[];
}

type SortKey = "tenantId" | "usedTokens" | "estimatedCostUSD";
type SortDir = "asc" | "desc";

// ─────────────────────────────────────────────────────────────────
// DEMO DATA — shown when backend is unreachable
// ─────────────────────────────────────────────────────────────────
const DEMO_PAYLOAD: AnalyticsPayload = {
  success: true,
  timestamp: new Date().toISOString(),
  totalTenantsActive: 6,
  globalTokensUsed: 5_842_300,
  data: [
    { tenantId: "quantum-llm-corp",    usedTokens: 2_100_000, estimatedCostUSD: 10.5   },
    { tenantId: "neo-cyber-systems",   usedTokens: 1_430_000, estimatedCostUSD: 7.15   },
    { tenantId: "arc-finance-ai",      usedTokens: 890_500,   estimatedCostUSD: 4.4525 },
    { tenantId: "sovereign-healthco",  usedTokens: 742_100,   estimatedCostUSD: 3.7105 },
    { tenantId: "streetmp-dev-sandbox",usedTokens: 480_200,   estimatedCostUSD: 2.401  },
    { tenantId: "test-tenant-alpha",   usedTokens: 199_500,   estimatedCostUSD: 0.9975 },
  ],
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function burnBadge(tokens: number): {
  label: string;
  color: string;
  bg: string;
  dot: string;
} {
  if (tokens > 1_000_000)
    return {
      label: "High Burn",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      dot: "bg-red-400",
    };
  if (tokens > 100_000)
    return {
      label: "Elevated",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/30",
      dot: "bg-yellow-400",
    };
  return {
    label: "Healthy",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-400",
  };
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function TelemetryDashboard() {
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("usedTokens");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Port 4000 is the router-service's actual local port
  const backendUrl =
    process.env.NEXT_PUBLIC_ROUTER_BACKEND_URL || "http://localhost:4000";
  const adminSecret =
    process.env.NEXT_PUBLIC_ADMIN_SECRET || "dev_admin_secret_key";

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await fetch(`${backendUrl}/api/v1/admin/analytics/usage`, {
          headers: {
            "x-admin-secret": adminSecret,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || `HTTP ${res.status}`);
        }
        const data: AnalyticsPayload = await res.json();
        setPayload(data);
        setDemoMode(false);
        setLastFetched(new Date());
      } catch {
        // Fall back to demo data so the dashboard is always usable
        setPayload({ ...DEMO_PAYLOAD, timestamp: new Date().toISOString() });
        setDemoMode(true);
        setLastFetched(new Date());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [backendUrl, adminSecret]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = payload
    ? [...payload.data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "string" && typeof bv === "string")
          return sortDir === "asc"
            ? av.localeCompare(bv)
            : bv.localeCompare(av);
        return sortDir === "asc"
          ? (av as number) - (bv as number)
          : (bv as number) - (av as number);
      })
    : [];

  const maxTokens = sorted.length > 0 ? sorted[0].usedTokens : 1;
  const ecosystemCost =
    payload?.data.reduce((acc, t) => acc + t.estimatedCostUSD, 0) ?? 0;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <Minus className="w-3 h-3 text-[#444]" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-cyan-400" />
    );
  };

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-t-cyan-500 border-cyan-500/10 animate-spin" />
            <Activity className="absolute inset-0 m-auto w-6 h-6 text-cyan-500" />
          </div>
          <p className="text-[#555] font-mono text-sm tracking-widest uppercase">
            Initializing Telemetry Engine...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error (hard failure — this should never show now) ──────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
        <div className="text-center max-w-lg space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-mono font-bold text-xl mb-2">
              Telemetry Error
            </h2>
            <p className="text-[#666] text-sm font-mono">{error}</p>
          </div>
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-mono text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // MAIN DASHBOARD
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── DEMO MODE WARNING BANNER ── */}
        {demoMode && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <FlaskConical className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs font-mono text-amber-400">
              <span className="font-bold">DEMO MODE</span> — Router-service
              unreachable at{" "}
              <span className="text-amber-300">{backendUrl}</span>. Showing
              synthetic data. Start the backend to see live telemetry.
            </p>
            <button
              onClick={() => fetchData()}
              className="ml-auto text-xs font-mono text-amber-400 hover:text-amber-200 underline underline-offset-2 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-[0.3em] font-semibold">
                Command 061 · V61
              </span>
            </div>
            <h1 className="text-3xl font-mono font-black text-white tracking-tight">
              Telemetry Engine
            </h1>
            <p className="text-[#555] text-sm mt-1 font-mono">
              Real-time tenant token burn · USD cost intelligence · Ecosystem
              health
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                demoMode
                  ? "bg-amber-500/10 border-amber-500/20"
                  : "bg-emerald-500/10 border-emerald-500/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  demoMode ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span
                className={`text-xs font-mono font-semibold tracking-wide ${
                  demoMode ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {demoMode ? "DEMO" : autoRefresh ? "LIVE · 30s" : "PAUSED"}
              </span>
            </div>

            {lastFetched && (
              <div className="flex items-center gap-1.5 text-[#444] font-mono text-xs">
                <Clock className="w-3 h-3" />
                {lastFetched.toLocaleTimeString()}
              </div>
            )}

            <button
              onClick={() => setAutoRefresh((p) => !p)}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                autoRefresh
                  ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                  : "bg-[#111] border-[#1a1a1a] text-[#555] hover:text-white"
              }`}
            >
              {autoRefresh ? "Pause" : "Resume"}
            </button>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-black font-mono text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Active Tenants */}
          <div className="relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 overflow-hidden hover:border-[#2a2a2a] transition-colors">
            <div className={styles.kpiGlowIndigo} />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-xs text-[#555] font-mono uppercase tracking-widest">
                Active Tenants
              </span>
            </div>
            <p className="text-4xl font-mono font-black text-white tabular-nums">
              {payload?.totalTenantsActive ?? 0}
            </p>
            <p className="text-xs text-[#444] font-mono mt-2">
              Tenants with quota activity this month
            </p>
            <div className="mt-4 flex gap-1 items-end h-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm bg-indigo-500/20 ${styles["bar-" + i]}`}
                />
              ))}
            </div>
          </div>

          {/* Global Token Burn */}
          <div className="relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 overflow-hidden hover:border-[#2a2a2a] transition-colors">
            <div className={styles.kpiGlowYellow} />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-xs text-[#555] font-mono uppercase tracking-widest">
                Global Token Burn
              </span>
            </div>
            <p className="text-4xl font-mono font-black text-yellow-400 tabular-nums">
              {formatTokens(payload?.globalTokensUsed ?? 0)}
            </p>
            <p className="text-xs text-[#444] font-mono mt-2">
              {(payload?.globalTokensUsed ?? 0).toLocaleString()} raw tokens
            </p>
            <div className="mt-4 h-1.5 bg-[#111] rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-700 ${styles.burnBar}`}
                data-pct={Math.min(
                  100,
                  ((payload?.globalTokensUsed ?? 0) / 10_000_000) * 100
                )}
              />
            </div>
          </div>

          {/* Ecosystem Cost */}
          <div className="relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 overflow-hidden hover:border-[#2a2a2a] transition-colors">
            <div className={styles.kpiGlowEmerald} />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs text-[#555] font-mono uppercase tracking-widest">
                Ecosystem Cost
              </span>
            </div>
            <p className="text-4xl font-mono font-black text-emerald-400 tabular-nums">
              ${ecosystemCost.toFixed(4)}
            </p>
            <p className="text-xs text-[#444] font-mono mt-2">
              Blended avg · $0.005 per 1K tokens
            </p>
            <div className="mt-4 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-mono text-emerald-700 uppercase tracking-wider">
                MTD Projection Running
              </span>
            </div>
          </div>
        </div>

        {/* ── SECONDARY STATS BAR ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Avg Cost / Tenant",
              value:
                payload && payload.totalTenantsActive > 0
                  ? `$${(ecosystemCost / payload.totalTenantsActive).toFixed(4)}`
                  : "$0.0000",
              color: "text-white",
            },
            {
              label: "Avg Tokens / Tenant",
              value:
                payload && payload.totalTenantsActive > 0
                  ? formatTokens(
                      Math.floor(
                        (payload.globalTokensUsed ?? 0) /
                          payload.totalTenantsActive
                      )
                    )
                  : "0",
              color: "text-white",
            },
            {
              label: "High Burn Tenants",
              value: String(
                sorted.filter((t) => t.usedTokens > 1_000_000).length
              ),
              color: "text-red-400",
            },
            {
              label: "Healthy Tenants",
              value: String(
                sorted.filter((t) => t.usedTokens <= 100_000).length
              ),
              color: "text-emerald-400",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3"
            >
              <p className="text-[10px] font-mono text-[#444] uppercase tracking-widest mb-1">
                {stat.label}
              </p>
              <p
                className={`text-xl font-mono font-black tabular-nums ${stat.color}`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── BURN RATE TABLE ── */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#141414]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-[#444]" />
              <h2 className="font-mono font-bold text-white text-sm uppercase tracking-widest">
                Tenant Burn Ledger
              </h2>
              <span className="text-[10px] font-mono text-[#444] bg-[#111] border border-[#1a1a1a] px-2 py-0.5 rounded-full">
                {sorted.length} tenants
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  demoMode ? "bg-amber-500" : "bg-cyan-500 animate-pulse"
                }`}
              />
              <span className="text-xs text-[#444] font-mono">
                {demoMode ? "DEMO" : "V61 LIVE"}
              </span>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Zap className="w-8 h-8 text-[#222] mx-auto mb-4" />
              <p className="text-[#444] font-mono text-sm">
                No tenant activity found for this period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#111]">
                    {(
                      [
                        { key: "tenantId", label: "Tenant ID", align: "left" },
                        {
                          key: "usedTokens",
                          label: "Tokens Consumed",
                          align: "right",
                        },
                        {
                          key: "estimatedCostUSD",
                          label: "Est. Cost (USD)",
                          align: "right",
                        },
                        { key: null, label: "Burn Rate", align: "center" },
                        { key: null, label: "Status", align: "center" },
                      ] as const
                    ).map((col) => (
                      <th
                        key={col.label}
                        onClick={() =>
                          col.key && handleSort(col.key as SortKey)
                        }
                        className={`px-6 py-3 text-[10px] font-mono text-[#444] uppercase tracking-widest ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        } ${
                          col.key
                            ? "cursor-pointer hover:text-[#666] select-none"
                            : ""
                        } transition-colors`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.key && <SortIcon col={col.key as SortKey} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0d0d0d]">
                  {sorted.map((tenant, i) => {
                    const badge = burnBadge(tenant.usedTokens);
                    const pct =
                      maxTokens > 0
                        ? Math.min(
                            100,
                            (tenant.usedTokens / maxTokens) * 100
                          )
                        : 0;
                    const barClass =
                      pct > 75
                        ? styles.burnBarRed
                        : pct > 40
                        ? styles.burnBarYellow
                        : styles.burnBarGreen;

                    return (
                      <tr
                        key={tenant.tenantId}
                        className="group hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-[#333] w-5 tabular-nums">
                              #{i + 1}
                            </span>
                            <div>
                              <p className="font-mono text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                                {tenant.tenantId}
                              </p>
                              <p className="text-[10px] font-mono text-[#333] mt-0.5">
                                {new Date().toISOString().slice(0, 7)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-mono font-bold text-white tabular-nums">
                            {formatTokens(tenant.usedTokens)}
                          </p>
                          <p className="text-[10px] font-mono text-[#333] tabular-nums">
                            {tenant.usedTokens.toLocaleString()} raw
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-mono font-bold text-emerald-400 tabular-nums">
                            ${tenant.estimatedCostUSD.toFixed(4)}
                          </p>
                        </td>
                        <td className="px-6 py-4 w-48">
                          <div className="w-full h-1.5 bg-[#111] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[9px] font-mono text-[#333] mt-1 text-center tabular-nums">
                            {pct.toFixed(1)}% of top
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold ${badge.bg} ${badge.color}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}
                            />
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-3 border-t border-[#111] flex items-center justify-between">
            <p className="text-[10px] font-mono text-[#333]">
              Period: {new Date().toISOString().slice(0, 7)} · $0.005 / 1K
              tokens blended rate
            </p>
            <p className="text-[10px] font-mono text-[#333]">
              {demoMode ? "Demo data" : "Redis · quota:monthly:*"}
            </p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-[#0d0d0d]">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  demoMode ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
                {demoMode ? "V61 Demo Mode" : "V61 Telemetry Engine · Online"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
                scanStream · Non-Blocking
              </span>
            </div>
          </div>
          <p className="text-[10px] font-mono text-[#333]">
            STREETMP OS ·{" "}
            {payload?.timestamp
              ? new Date(payload.timestamp).toLocaleString()
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
