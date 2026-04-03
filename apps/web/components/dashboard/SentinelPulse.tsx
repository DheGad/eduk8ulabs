"use client";

/**
 * @file SentinelPulse.tsx
 * @component SentinelPulse
 * @phase Phase 3 — The Sentinel Layer
 * @description
 *   Engineer Dashboard widget showing:
 *     1. Real-time "Heartbeat" sparkline — combined compliance + threat event
 *        volume over the last 60 minutes, polled from /api/sentinel/threats.
 *     2. Agent Registry table — live rows from sentinel_registry via
 *        /api/sentinel/registry, updated every 15 s.
 *     3. Suspicious entity alert list — latest SUSPICIOUS_ENTITY records.
 *
 *   NO Math.random() / mock data. All data comes from the live PostgreSQL DB
 *   through the Next.js API routes.
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SentinelStatus = "ACTIVE" | "IDLE" | "ERROR";

interface SentinelAgent {
  id:           string;
  name:         string;
  capability:   string;
  status:       SentinelStatus;
  last_run:     string | null;
  success_rate: number;
  updated_at:   string;
}

interface HeartbeatPoint {
  label: string;   // "HH:MM"
  count: number;
}

interface ThreatEntity {
  id:         string;
  event_type: string;
  tenant_id:  string | null;
  payload:    Record<string, unknown>;
  severity:   string;
  created_at: string;
}

interface BlacklistEntry {
  id:           string;
  ip_address:   string;
  reason:       string;
  blocked_by:   string;
  risk_score:   number | null;
  expires_at:   string;
  unblocked_at: string | null;
  unblocked_by: string | null;
  created_at:   string;
  is_active:    boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<SentinelStatus, { dot: string; badge: string; label: string }> = {
  ACTIVE: {
    dot:   "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)] animate-pulse",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    label: "ACTIVE",
  },
  IDLE: {
    dot:   "bg-zinc-500",
    badge: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
    label: "IDLE",
  },
  ERROR: {
    dot:   "bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.5)]",
    badge: "border-red-500/30 bg-red-500/10 text-red-400",
    label: "ERROR",
  },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s <  60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function formatPercent(rate: number): string {
  return (rate * 100).toFixed(1) + "%";
}

// ── Heartbeat SVG line chart ──────────────────────────────────────────────────

interface HeartbeatChartProps {
  points: HeartbeatPoint[];
  height?: number;
}

function HeartbeatChart({ points, height = 80 }: HeartbeatChartProps) {
  const W = 480;
  const H = height;
  const PAD = { top: 8, right: 12, bottom: 20, left: 8 };

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
        Awaiting data…
      </div>
    );
  }

  const counts = points.map((p) => p.count);
  const maxVal = Math.max(...counts, 1);
  const minVal = 0;

  const xStep = (W - PAD.left - PAD.right) / (points.length - 1);
  const yScale = (v: number) =>
    PAD.top + ((maxVal - v) / (maxVal - minVal)) * (H - PAD.top - PAD.bottom);

  const pxCoords = points.map((p, i) => ({
    x: PAD.left + i * xStep,
    y: yScale(p.count),
    label: p.label,
  }));

  // SVG polyline path
  const linePath = pxCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  // Fill area below line
  const areaPath =
    `${linePath} L ${pxCoords[pxCoords.length - 1].x} ${H - PAD.bottom} ` +
    `L ${pxCoords[0].x} ${H - PAD.bottom} Z`;

  // Render every other label to avoid crowding
  const labelPoints = pxCoords.filter((_, i) => i % 2 === 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-20"
      aria-label="Agent activity heartbeat chart"
    >
      {/* Subtle horizontal grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const y = PAD.top + frac * (H - PAD.top - PAD.bottom);
        return (
          <line
            key={frac}
            x1={PAD.left} y1={y}
            x2={W - PAD.right} y2={y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        );
      })}

      {/* Gradient fill */}
      <defs>
        <linearGradient id="heartbeatGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"    />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#heartbeatGrad)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {pxCoords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r="2.5"
          fill="#7c3aed"
          stroke="#a78bfa"
          strokeWidth="1"
        />
      ))}

      {/* X-axis labels */}
      {labelPoints.map((c, i) => (
        <text
          key={i}
          x={c.x}
          y={H - 2}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.25)"
          fontFamily="JetBrains Mono, monospace"
        >
          {c.label}
        </text>
      ))}
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SentinelPulse() {
  const [agents,    setAgents]    = useState<SentinelAgent[]>([]);
  const [heartbeat, setHeartbeat] = useState<HeartbeatPoint[]>([]);
  const [threats,   setThreats]   = useState<ThreatEntity[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [lastSync,  setLastSync]  = useState<Date | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Manual Override state
  const [overrideIp,      setOverrideIp]      = useState("");
  const [overrideReason,  setOverrideReason]   = useState("");
  const [overrideLoading, setOverrideLoading]  = useState<string | null>(null); // ip being actioned
  const [overrideMsg,     setOverrideMsg]      = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [regRes, thrRes, blRes] = await Promise.all([
        fetch("/api/sentinel/registry"),
        fetch("/api/sentinel/threats"),
        fetch("/api/sentinel/blacklist"),
      ]);

      if (!regRes.ok || !thrRes.ok) throw new Error("API error");

      const regData = await regRes.json() as { success: boolean; agents: SentinelAgent[] };
      const thrData = await thrRes.json() as { success: boolean; heartbeat: HeartbeatPoint[]; entities: ThreatEntity[] };
      const blData  = blRes.ok ? await blRes.json() as { success: boolean; blocks: BlacklistEntry[] } : null;

      if (regData.success) setAgents(regData.agents);
      if (thrData.success) {
        setHeartbeat(thrData.heartbeat);
        setThreats(thrData.entities);
      }
      if (blData?.success) setBlacklist(blData.blocks);

      setLastSync(new Date());
      setError(null);
    } catch (e) {
      setError("Lost sync with OS kernel. Retrying…");
      console.error("[SentinelPulse] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    intervalRef.current = setInterval(fetchAll, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      id="sentinel-pulse"
      aria-label="Sentinel Pulse — Agentic Security Layer"
      className="flex flex-col gap-5"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-400" />
          </span>
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
            Sentinel Pulse
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
            Phase 3
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-zinc-600 font-mono">
          {error && (
            <span className="text-red-400 animate-pulse">{error}</span>
          )}
          {lastSync && !error && (
            <span>Synced {relativeTime(lastSync.toISOString())}</span>
          )}
          <button
            id="sentinel-refresh-btn"
            onClick={() => void fetchAll()}
            className="px-2 py-1 rounded border border-white/10 text-zinc-500 hover:text-white hover:border-white/20 transition-colors"
            aria-label="Force refresh sentinel data"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ── Heartbeat Chart ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-white">Agent Activity Heartbeat</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Combined compliance + threat events · 60 min · 5 min buckets
            </p>
          </div>
          <span className="text-[10px] font-mono text-zinc-700">
            {heartbeat.length > 0 && (
              `Peak: ${Math.max(...heartbeat.map(p => p.count))} events`
            )}
          </span>
        </div>

        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="h-1 w-24 bg-violet-900/40 rounded-full overflow-hidden">
              <div className="h-full w-3/5 bg-violet-500 rounded-full animate-pulse" />
            </div>
          </div>
        ) : (
          <HeartbeatChart points={heartbeat} height={80} />
        )}
      </div>

      {/* ── Agent Registry Table ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <p className="text-xs font-medium text-white">Agent Registry</p>
          <span className="text-[10px] font-mono text-zinc-600">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-600">
            No agents registered yet. Run the migration to seed Sentinel-01.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {agents.map((agent) => {
              const s = STATUS_STYLES[agent.status];
              return (
                <div
                  key={agent.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center px-5 py-4
                             hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Left: name + capability */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.dot}`} />
                      <span className="text-xs font-semibold text-white truncate">
                        {agent.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 truncate pl-3.5">
                      {agent.capability}
                    </p>
                  </div>

                  {/* Right: status + stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Success rate */}
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[10px] text-zinc-700 uppercase tracking-widest">
                        Success
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        {formatPercent(agent.success_rate)}
                      </span>
                    </div>

                    {/* Last run */}
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[10px] text-zinc-700 uppercase tracking-widest">
                        Last Run
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {relativeTime(agent.last_run)}
                      </span>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${s.badge}`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Suspicious Entity Alerts ─────────────────────────────────────── */}
      {(threats.length > 0 || loading) && (
        <div className="rounded-2xl border border-red-500/10 bg-[#0b0b0f] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-red-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" />
            <p className="text-xs font-medium text-red-400">Suspicious Entities Detected</p>
            <span className="text-[10px] font-mono text-zinc-600 ml-auto">
              Last 24 h · {threats.length} flag{threats.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="divide-y divide-white/[0.03] max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-5 space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-10 rounded bg-white/[0.02] animate-pulse" />
                ))}
              </div>
            ) : (
              threats.map((t) => {
                const payload = t.payload as {
                  flagged_endpoint?: string;
                  unique_ip_count?: number;
                  detection_window?: string;
                  flagged_by?: string;
                };
                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-5 py-3 items-start"
                  >
                    <div>
                      <p className="text-xs text-white font-medium truncate">
                        {payload.flagged_endpoint ?? t.event_type}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {payload.unique_ip_count} unique IPs · {payload.detection_window ?? "24h"} window · by {payload.flagged_by ?? "Sentinel"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                        HIGH
                      </span>
                      <span className="text-[10px] font-mono text-zinc-700">
                        {relativeTime(t.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Empty threats state */}
      {!loading && threats.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] px-5 py-4">
          <span className="text-emerald-500 text-base">✓</span>
          <div>
            <p className="text-xs font-medium text-emerald-400">System Clean</p>
            <p className="text-[10px] text-zinc-600">No suspicious entities detected in the last 24 hours.</p>
          </div>
        </div>
      )}

      {/* ── Firewall Blacklist ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-orange-500/10 bg-[#0b0b0f] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-orange-500/10">
          <span className="text-base">🔴</span>
          <p className="text-xs font-medium text-orange-400">Firewall Blacklist</p>
          <span className="text-[10px] font-mono text-zinc-600 ml-auto">
            {blacklist.filter(b => b.is_active).length} active block{blacklist.filter(b => b.is_active).length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Manual Override controls ──────────────────────────── */}
        <div className="px-5 py-4 border-b border-white/[0.03] bg-white/[0.01]">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Manual Override</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="sentinel-override-ip"
              type="text"
              placeholder="IP Address (e.g. 192.168.1.1)"
              value={overrideIp}
              onChange={(e) => setOverrideIp(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2
                         text-xs text-white placeholder-zinc-600 focus:outline-none
                         focus:border-orange-500/50 focus:bg-white/[0.06] transition-colors"
            />
            <input
              id="sentinel-override-reason"
              type="text"
              placeholder="Reason (for Force Block)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2
                         text-xs text-white placeholder-zinc-600 focus:outline-none
                         focus:border-orange-500/50 focus:bg-white/[0.06] transition-colors"
            />
            <div className="flex gap-2">
              <button
                id="sentinel-force-block-btn"
                disabled={!overrideIp || overrideLoading !== null}
                onClick={() => void handleOverride("block", overrideIp, overrideReason)}
                className="px-4 py-2 rounded-xl text-[11px] font-semibold
                           bg-red-500/10 border border-red-500/30 text-red-400
                           hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors whitespace-nowrap"
              >
                🔴 Force Block
              </button>
              <button
                id="sentinel-unblock-btn"
                disabled={!overrideIp || overrideLoading !== null}
                onClick={() => void handleOverride("unblock", overrideIp, "")}
                className="px-4 py-2 rounded-xl text-[11px] font-semibold
                           bg-emerald-500/10 border border-emerald-500/30 text-emerald-400
                           hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors whitespace-nowrap"
              >
                ✓ Unblock
              </button>
            </div>
          </div>
          {overrideMsg && (
            <p className={`text-[10px] mt-2 ${
              overrideMsg.type === "ok" ? "text-emerald-400" : "text-red-400"
            }`}>
              {overrideMsg.text}
            </p>
          )}
        </div>

        {/* ── Blacklist table ───────────────────────────────────── */}
        <div className="divide-y divide-white/[0.03] max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : blacklist.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-600">
              No blocks on record.
            </div>
          ) : (
            blacklist.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-5 py-3 items-center
                           hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      entry.is_active
                        ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                        : "bg-zinc-600"
                    }`} />
                    <span className="text-xs font-mono text-white">{entry.ip_address}</span>
                    {entry.risk_score !== null && (
                      <span className="text-[10px] font-mono text-orange-400">
                        risk: {entry.risk_score.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 pl-3.5 truncate mt-0.5">{entry.reason}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-zinc-700">
                      {entry.is_active ? `expires ${relativeTime(entry.expires_at)}` : "expired"}
                    </p>
                    <p className="text-[10px] text-zinc-700">{relativeTime(entry.created_at)}</p>
                  </div>
                  {entry.is_active && (
                    <button
                      id={`sentinel-unblock-${entry.ip_address.replace(/\./g, "-")}`}
                      disabled={overrideLoading === entry.ip_address}
                      onClick={() => void handleOverride("unblock", entry.ip_address, "")}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold
                                 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400
                                 hover:bg-emerald-500/20 disabled:opacity-40
                                 transition-colors whitespace-nowrap"
                    >
                      {overrideLoading === entry.ip_address ? "…" : "Unblock"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );

  // ── Manual Override handler ────────────────────────────────────────────────
  async function handleOverride(
    action:    "block" | "unblock",
    ip:        string,
    reason:    string
  ): Promise<void> {
    if (!ip.trim()) return;
    setOverrideLoading(ip);
    setOverrideMsg(null);
    try {
      const res = await fetch(`/api/sentinel/override/${action}`, {
        method:  "POST",
        headers: {
          "Content-Type":   "application/json",
          "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify({ ip_address: ip, reason }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setOverrideMsg({ type: "ok", text: `✓ ${ip} ${action === "block" ? "blocked" : "unblocked"} successfully.` });
        setOverrideIp("");
        setOverrideReason("");
        // Refresh blacklist immediately
        await fetchAll();
      } else {
        setOverrideMsg({ type: "err", text: data.error ?? "Override failed." });
      }
    } catch {
      setOverrideMsg({ type: "err", text: "Network error — override request failed." });
    } finally {
      setOverrideLoading(null);
    }
  }
}
