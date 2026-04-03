"use client";

/**
 * @file page.tsx
 * @route /dashboard/admin/traces
 * @version V70
 * @description Correlation Trace Engine — Search & Timeline Viewer
 *
 * Obsidian/Glass design system. 60-second auto-refresh on active trace.
 * Every V-series event is rendered as a vertical timeline node.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

interface TraceEvent {
  t:      number;        // ms since request received
  label:  string;
  meta?:  Record<string, unknown>;
}

interface TraceData {
  traceId:      string;
  meta:         Record<string, string>;
  timeline:     TraceEvent[];
  total_events: number;
}

// ----------------------------------------------------------------
// EVENT METADATA — icon/colour mapping
// ----------------------------------------------------------------

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  REQUEST_RECEIVED:      { icon: "📡", color: "#6366f1", label: "Request Received"      },
  DLP_SCRUBBED:          { icon: "🛡️", color: "#10b981", label: "DLP Scrubbed"          },
  CACHE_HIT:             { icon: "⚡", color: "#f59e0b", label: "Semantic Cache HIT"    },
  CACHE_MISS:            { icon: "🔍", color: "#64748b", label: "Semantic Cache MISS"   },
  LLM_SUCCESS:           { icon: "🧠", color: "#22d3ee", label: "LLM Execution"         },
  RESPONSE_SENT:         { icon: "✅", color: "#4ade80", label: "Response Dispatched"   },
  SOVEREIGNTY_VIOLATION: { icon: "🚫", color: "#f43f5e", label: "Sovereignty Blocked"  },
  LLM_CIRCUIT_BREAK:     { icon: "⚠️", color: "#fb923c", label: "Circuit Breaker Fired" },
  COGNITIVE_VIOLATION:   { icon: "🚨", color: "#ef4444", label: "Cognitive Block"       },
};

function getEventConfig(label: string) {
  return EVENT_CONFIG[label] ?? { icon: "🔹", color: "#94a3b8", label };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ----------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------

function TimelineNode({ event, isLast }: { event: TraceEvent; isLast: boolean }) {
  const cfg = getEventConfig(event.label);
  const [expanded, setExpanded] = useState(false);
  const hasMeta = event.meta && Object.keys(event.meta).length > 0;

  return (
    <div className="flex gap-4">
      {/* Spine */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-lg"
          style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}55` }}
        >
          {cfg.icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ background: `${cfg.color}22`, minHeight: "24px" }} />
        )}
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono font-bold" style={{ color: cfg.color }}>
            [{formatMs(event.t)}]
          </span>
          <span className="text-sm font-medium text-zinc-200">{cfg.label}</span>
          {hasMeta && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? "▲ hide" : "▼ meta"}
            </button>
          )}
        </div>
        {expanded && hasMeta && (
          <pre className="mt-2 text-[10px] text-zinc-400 font-mono bg-white/[0.02] border border-white/5 rounded p-3 overflow-x-auto">
            {JSON.stringify(event.meta, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 rounded bg-white/[0.03] border border-white/5 text-center">
      <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">{label}</p>
      <p className="text-xs text-zinc-300 font-mono mt-0.5 truncate max-w-[140px]">{value || "—"}</p>
    </div>
  );
}

// ----------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------

export default function TracesPage() {
  const [inputId, setInputId]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [data, setData]           = useState<TraceData | null>(null);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const ADMIN_SECRET = process.env.NEXT_PUBLIC_STREETMP_ADMIN_SECRET ?? "";
  const KERNEL_URL   = process.env.NEXT_PUBLIC_KERNEL_URL ?? "http://localhost:4000";

  const fetchTrace = useCallback(async (tid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${KERNEL_URL}/api/v1/admin/trace/${encodeURIComponent(tid)}`, {
        headers: {
          "x-admin-secret": ADMIN_SECRET,
          "Content-Type":   "application/json",
        },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? json.error ?? "Trace not found.");
        setData(null);
      } else {
        setData(json as TraceData);
      }
    } catch {
      setError("Cannot reach the OS Kernel. Is the router-service running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [KERNEL_URL, ADMIN_SECRET]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const tid = inputId.trim();
    if (!tid) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    void fetchTrace(tid);
    // Auto-refresh every 60s while trace is being viewed
    intervalRef.current = setInterval(() => void fetchTrace(tid), 60_000);
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const totalMs = data?.timeline?.length
    ? (data.timeline[data.timeline.length - 1]?.t ?? 0)
    : 0;

  return (
    <div
      className="min-h-screen p-8"
      style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#0A0A0A" }}
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <span className="text-sm">🔍</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Correlation Trace Engine</h1>
            <p className="text-xs text-zinc-500">V70 · Full-stack request timeline · Auto-refreshes every 60s</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span className="text-zinc-500 text-sm">🆔</span>
            </div>
            <input
              id="trace-search-input"
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="Enter x-streetmp-trace-id  (e.g. 550e8400-e29b-41d4-a716-446655440000)"
              className="w-full pl-9 pr-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all font-mono"
            />
          </div>
          <button
            id="trace-search-btn"
            type="submit"
            disabled={loading || !inputId.trim()}
            className="px-5 py-3 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Searching…" : "Lookup"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Request Meta Cards */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-300">Request Context</h2>
              <span className="text-[10px] font-mono text-zinc-600">{data.traceId}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.meta)
                .filter(([k]) => k !== "traceId")
                .map(([k, v]) => (
                  <MetaBadge key={k} label={k} value={v} />
                ))}
              <MetaBadge label="Total Duration" value={formatMs(totalMs)} />
              <MetaBadge label="Events Captured" value={String(data.total_events)} />
            </div>
          </div>

          {/* Timeline */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5">
            <h2 className="text-sm font-semibold text-zinc-300 mb-5">
              Execution Timeline
              <span className="ml-2 text-[10px] text-zinc-600 font-normal">
                {data.total_events} events · {formatMs(totalMs)} total
              </span>
            </h2>
            <div>
              {data.timeline.map((event, i) => (
                <TimelineNode
                  key={`${event.label}-${event.t}-${i}`}
                  event={event}
                  isLast={i === data.timeline.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty */}
      {!data && !error && !loading && (
        <div className="mt-16 text-center space-y-3">
          <p className="text-4xl">🔮</p>
          <p className="text-sm text-zinc-500">Paste a trace ID from any API response header</p>
          <p className="text-xs text-zinc-700 font-mono">x-streetmp-trace-id: &lt;UUID&gt;</p>
        </div>
      )}
    </div>
  );
}
