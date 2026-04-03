"use client";

/**
 * @file page.tsx
 * @route /dashboard/admin/system-health
 * @command COMMAND_095 — SELF-HEALING OS MONITOR
 * @version V95.0.0
 *
 * ================================================================
 * REAL-TIME SYSTEM HEALTH DASHBOARD
 * ================================================================
 *
 * Polls GET /api/v1/admin/system-health every 15 seconds.
 * No WebSocket required — SSR-safe polling with local state.
 *
 * Panels:
 *   • SLA uptime ticker (animated to 99.97%)
 *   • Per-service status cards (green/amber/red with pulse dot)
 *   • Live incident log with resolution status
 *   • Latency sparkline for each service
 *
 * ================================================================
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus   = "HEALTHY" | "DEGRADED" | "CRITICAL" | "RESTARTING";
type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface HealthCheckResult {
  serviceId:    string;
  timestamp:    string;
  healthy:      boolean;
  latencyMs:    number;
  statusCode?:  number;
  errorMessage?: string;
}

interface ServiceSnapshot {
  serviceId:        string;
  displayName:      string;
  status:           ServiceStatus;
  consecutiveFails: number;
  lastCheckAt:      string | null;
  lastLatencyMs:    number;
  restartsToday:    number;
  history:          HealthCheckResult[];
}

interface Incident {
  id:           string;
  serviceId:    string;
  serviceName:  string;
  severity:     IncidentSeverity;
  startedAt:    string;
  resolvedAt?:  string;
  resolved:     boolean;
  triggerCount: number;
  actionTaken:  string;
  lastError:    string;
}

interface HealthData {
  overallStatus:    ServiceStatus;
  uptimePercent:    number;
  monitorStartedAt: string;
  generatedAt:      string;
  services:         Record<string, ServiceSnapshot>;
  openIncidents:    Incident[];
  recentIncidents:  Incident[];
  totalSecondsDown: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
  HEALTHY:     { label: "Healthy",    color: "#00E599", bg: "rgba(0,229,153,0.08)",  dot: "#00E599", icon: "✓" },
  DEGRADED:    { label: "Degraded",   color: "#FFA500", bg: "rgba(255,165,0,0.08)",  dot: "#FFA500", icon: "⚠" },
  CRITICAL:    { label: "Critical",   color: "#FF4444", bg: "rgba(255,68,68,0.08)",  dot: "#FF4444", icon: "✕" },
  RESTARTING:  { label: "Restarting", color: "#7C3AED", bg: "rgba(124,58,237,0.08)", dot: "#7C3AED", icon: "↻" },
};

const SEVERITY_CONFIG: Record<IncidentSeverity, { color: string; bg: string }> = {
  LOW:      { color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  MEDIUM:   { color: "#FFA500", bg: "rgba(255,165,0,0.1)"   },
  HIGH:     { color: "#FF6B35", bg: "rgba(255,107,53,0.1)"  },
  CRITICAL: { color: "#FF4444", bg: "rgba(255,68,68,0.1)"   },
};

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000)  return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  return `${Math.round(delta / 3_600_000)}h ago`;
}

function formatUptime(pct: number): string {
  return pct.toFixed(4);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ history, color }: { history: HealthCheckResult[]; color: string }) {
  if (history.length < 2) return null;
  const latencies  = history.slice().reverse().map((h) => h.latencyMs);
  const max        = Math.max(...latencies, 1);
  const w          = 80;
  const h          = 28;
  const pts        = latencies.map((v, i) => {
    const x = (i / (latencies.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Pulse ring */}
      {(status === "CRITICAL" || status === "RESTARTING") && (
        <span style={{
          position:  "absolute",
          width:     "12px",
          height:    "12px",
          borderRadius: "50%",
          background: cfg.dot,
          opacity:   0.3,
          animation: "pulse-ring 1.5s ease-out infinite",
        }} />
      )}
      <span style={{
        width:        "8px",
        height:       "8px",
        borderRadius: "50%",
        background:   cfg.dot,
        boxShadow:    `0 0 6px ${cfg.dot}88`,
        display:      "inline-block",
        flexShrink:   0,
      }} />
    </span>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: ServiceSnapshot }) {
  const cfg    = STATUS_CONFIG[svc.status];
  const health = svc.history.filter((h) => h.healthy).length;
  const total  = svc.history.length;
  const pct    = total ? Math.round((health / total) * 100) : 100;

  return (
    <div style={{
      background:   cfg.bg,
      border:       `1px solid ${cfg.color}30`,
      borderRadius: "14px",
      padding:      "18px 20px",
      display:      "flex",
      flexDirection: "column",
      gap:          "12px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <StatusDot status={svc.status} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#FFFFFF" }}>
              {svc.displayName}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>
              {svc.lastCheckAt ? `Last check ${relativeTime(svc.lastCheckAt)}` : "Pending first check…"}
            </div>
          </div>
        </div>
        <span style={{
          fontSize:  "11px",
          fontWeight: "700",
          color:     cfg.color,
          background: "rgba(0,0,0,0.3)",
          padding:   "3px 10px",
          borderRadius: "20px",
          border:    `1px solid ${cfg.color}40`,
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Metrics row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>LATENCY</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: svc.lastLatencyMs > 1000 ? "#FFA500" : "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>
              {svc.lastLatencyMs}<span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginLeft: "2px" }}>ms</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>SUCC RATE</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: pct < 80 ? "#FF4444" : pct < 95 ? "#FFA500" : "#00E599", fontVariantNumeric: "tabular-nums" }}>
              {pct}<span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginLeft: "1px" }}>%</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>RESTARTS</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: svc.restartsToday > 0 ? "#FFA500" : "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>
              {svc.restartsToday}
            </div>
          </div>
        </div>
        {/* Sparkline */}
        <div style={{ opacity: 0.8 }}>
          <Sparkline history={svc.history} color={cfg.color} />
        </div>
      </div>

      {/* Consecutive fails warning */}
      {svc.consecutiveFails > 0 && (
        <div style={{
          background:   "rgba(255,68,68,0.08)",
          border:       "1px solid rgba(255,68,68,0.2)",
          borderRadius: "8px",
          padding:      "7px 12px",
          fontSize:     "11px",
          color:        "#FF8888",
        }}>
          ⚠️ {svc.consecutiveFails} consecutive failure{svc.consecutiveFails > 1 ? "s" : ""} — {
            svc.consecutiveFails >= 3 ? "auto-restart triggered" : `${3 - svc.consecutiveFails} until auto-restart`
          }
        </div>
      )}
    </div>
  );
}

// ─── Incident Row ─────────────────────────────────────────────────────────────

function IncidentRow({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[incident.severity];

  return (
    <div>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display:       "flex",
          alignItems:    "center",
          gap:           "12px",
          padding:       "12px 16px",
          borderBottom:  "1px solid rgba(255,255,255,0.04)",
          cursor:        "pointer",
          transition:    "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
      >
        {/* Severity badge */}
        <span style={{
          fontSize:   "9px",
          fontWeight: "700",
          letterSpacing: "0.06em",
          color:      cfg.color,
          background: cfg.bg,
          padding:    "2px 7px",
          borderRadius: "4px",
          flexShrink: 0,
          minWidth:   "64px",
          textAlign:  "center",
        }}>
          {incident.severity}
        </span>

        {/* Service + error */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#FFFFFF" }}>
            {incident.serviceName}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {incident.lastError}
          </div>
        </div>

        {/* Resolution status */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize:   "10px",
            fontWeight: "700",
            color:      incident.resolved ? "#00E599" : "#FFA500",
          }}>
            {incident.resolved ? "✓ Resolved" : "● Open"}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "1px" }}>
            {relativeTime(incident.startedAt)}
          </div>
        </div>

        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{
          background:   "rgba(255,255,255,0.015)",
          padding:      "12px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          fontSize:     "11px",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            {[
              ["Incident ID",    incident.id],
              ["Action Taken",   incident.actionTaken],
              ["Started",        incident.startedAt],
              ["Resolved",       incident.resolvedAt ?? "—"],
              ["Failure Count",  String(incident.triggerCount)],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: "3px 12px 3px 0", color: "rgba(255,255,255,0.35)", width: "120px" }}>{k}</td>
                <td style={{ padding: "3px 0", color: "rgba(255,255,255,0.8)", fontFamily: v.length > 30 ? "monospace" : "inherit" }}>{v}</td>
              </tr>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [data,      setData]      = useState<HealthData | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [ticker,    setTicker]    = useState(0);   // Forces re-render for relative timestamps
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const KERNEL_URL    = process.env.NEXT_PUBLIC_KERNEL_URL        ?? "http://localhost:4000";
  const ADMIN_SECRET  = process.env.NEXT_PUBLIC_STREETMP_ADMIN_SECRET ?? "";

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${KERNEL_URL}/api/v1/admin/system-health`, {
        headers: { "x-admin-secret": ADMIN_SECRET },
        cache:   "no-store",
      });
      if (!res.ok) {
        setError(`Kernel returned HTTP ${res.status}. Is the monitor running?`);
        return;
      }
      const json = await res.json() as { success: boolean; data: HealthData };
      if (json.success) {
        setData(json.data);
        setError(null);
        setLastFetch(new Date().toISOString());
      }
    } catch {
      setError("Cannot reach the OS Kernel. Ensure the router-service and monitor are running.");
    } finally {
      setLoading(false);
    }
  }, [KERNEL_URL, ADMIN_SECRET]);

  useEffect(() => {
    void fetchHealth();
    intervalRef.current = setInterval(() => void fetchHealth(), 15_000);
    // Tick every second to update relative timestamps
    tickerRef.current   = setInterval(() => setTicker((t) => t + 1), 1_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickerRef.current)   clearInterval(tickerRef.current);
    };
  }, [fetchHealth]);

  void ticker;   // Suppress unused warning — used to force re-render

  const overallCfg = data ? STATUS_CONFIG[data.overallStatus] : STATUS_CONFIG.HEALTHY;
  const services   = data ? Object.values(data.services) : [];
  const incidents  = data ? [...data.openIncidents, ...data.recentIncidents.filter((i) => i.resolved)].slice(0, 30) : [];

  return (
    <div style={{ minHeight: "100vh", padding: "28px 32px", background: "#0A0A0A", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(0,229,153,0.1)", border: "1px solid rgba(0,229,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
              🛰️
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                System Health Monitor
              </h1>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>
                V95 Self-Healing OS · Auto-refreshes every 15s
              </p>
            </div>
          </div>

          {/* Overall status */}
          {data && (
            <div style={{
              display:       "flex",
              alignItems:    "center",
              gap:           "8px",
              background:    overallCfg.bg,
              border:        `1px solid ${overallCfg.color}30`,
              borderRadius:  "10px",
              padding:       "8px 16px",
            }}>
              <StatusDot status={data.overallStatus} />
              <span style={{ fontSize: "13px", fontWeight: "700", color: overallCfg.color }}>
                System {overallCfg.label}
              </span>
            </div>
          )}
        </div>

        {lastFetch && (
          <p style={{ margin: "8px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
            Last fetched {relativeTime(lastFetch)}
          </p>
        )}
      </div>

      {/* ── SLA Metrics Row ───────────────────────────────────────────────── */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {[
            {
              label: "System Uptime (SLA)",
              value: `${formatUptime(data.uptimePercent)}%`,
              sub:   data.uptimePercent >= 99.9 ? "Meeting SLA target ✓" : "Below 99.9% target ⚠",
              color: data.uptimePercent >= 99.9 ? "#00E599" : "#FFA500",
            },
            {
              label: "Open Incidents",
              value: String(data.openIncidents.length),
              sub:   data.openIncidents.length === 0 ? "All systems nominal" : "Requires attention",
              color: data.openIncidents.length === 0 ? "#00E599" : "#FF4444",
            },
            {
              label: "Monitor Running",
              value: data.monitorStartedAt ? relativeTime(data.monitorStartedAt) : "—",
              sub:   "Self-healer active",
              color: "#00E599",
            },
            {
              label: "Services Monitored",
              value: String(services.length),
              sub:   "Next.js · Router · Redis",
              color: "#7C3AED",
            },
          ].map((m) => (
            <div key={m.label} style={{
              background:   "rgba(255,255,255,0.03)",
              border:       "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding:      "16px 18px",
            }}>
              <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: "6px" }}>
                {m.label}
              </div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: m.color, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                {m.value}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>
                {m.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading / Error States ────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#00E599" }}>
          <div style={{ fontSize: "32px", animation: "spin 1s linear infinite", display: "inline-block" }}>↻</div>
          <p style={{ marginTop: "12px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Contacting health monitor…</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: "12px", padding: "16px 20px", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#FF8888" }}>Monitor Unreachable</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{error}</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "8px" }}>
              Start the monitor: <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: "4px" }}>cd apps/os-kernel/services/monitor && npm run dev</code>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Cards Grid ───────────────────────────────────────────── */}
      {services.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Services ({services.length})
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
            {services.map((svc) => (
              <ServiceCard key={svc.serviceId} svc={svc} />
            ))}
          </div>
        </div>
      )}

      {/* ── Incident Log ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h2 style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Incident Log
            {data && data.openIncidents.length > 0 && (
              <span style={{ marginLeft: "8px", background: "rgba(255,68,68,0.15)", color: "#FF4444", fontSize: "10px", padding: "2px 7px", borderRadius: "10px", border: "1px solid rgba(255,68,68,0.3)" }}>
                {data.openIncidents.length} open
              </span>
            )}
          </h2>
          <button
            id="system-health-refresh"
            onClick={() => void fetchHealth()}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "rgba(255,255,255,0.5)", fontSize: "11px", padding: "5px 12px", cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", overflow: "hidden" }}>
          {incidents.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", margin: "0 0 8px" }}>✅</p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", margin: 0 }}>No incidents recorded yet</p>
            </div>
          ) : (
            incidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
