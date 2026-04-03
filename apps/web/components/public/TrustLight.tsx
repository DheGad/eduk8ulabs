"use client";

import { useState, useEffect, useRef } from "react";

/**
 * @component TrustLight
 * @version V40
 * @description Ultra-lightweight embeddable Trust Light badge.
 *
 * Drop into any React app:
 *   <TrustLight signal="GREEN" executionId="exec_..." trustScore={98} />
 *
 * Default: animated glowing pill — "StreetMP Verified"
 * Click:   popover with execution hash, policy, latency, model
 */

export type TrustSignalColor = "GREEN" | "YELLOW" | "RED";

export interface TrustLightProps {
  signal:          TrustSignalColor;
  trustScore:      number;
  executionId?:    string;
  fingerprint?:    string;
  activePolicy?:   string;
  model?:          string;
  latencyMs?:      number;
  dataExposure?:   string;
  complianceFlags?: string[];
  /** If true, show as a compact dot only (no text label) */
  compact?:        boolean;
}

const SIGNAL_CONFIG: Record<TrustSignalColor, {
  dot:       string;
  glow:      string;
  border:    string;
  bg:        string;
  text:      string;
  label:     string;
  ping:      string;
  popBorder: string;
}> = {
  GREEN: {
    dot:       "bg-emerald-400",
    glow:      "shadow-[0_0_12px_rgba(52,211,153,0.6)]",
    border:    "border-emerald-500/30",
    bg:        "bg-emerald-950/40",
    text:      "text-emerald-300",
    label:     "Secure",
    ping:      "bg-emerald-400",
    popBorder: "border-emerald-500/20",
  },
  YELLOW: {
    dot:       "bg-amber-400",
    glow:      "shadow-[0_0_12px_rgba(251,191,36,0.5)]",
    border:    "border-amber-500/30",
    bg:        "bg-amber-950/40",
    text:      "text-amber-300",
    label:     "Advisory",
    ping:      "bg-amber-400",
    popBorder: "border-amber-500/20",
  },
  RED: {
    dot:       "bg-red-400",
    glow:      "shadow-[0_0_12px_rgba(248,113,113,0.6)]",
    border:    "border-red-500/30",
    bg:        "bg-red-950/40",
    text:      "text-red-300",
    label:     "Blocked",
    ping:      "bg-red-400",
    popBorder: "border-red-500/20",
  },
};

export function TrustLight({
  signal,
  trustScore,
  executionId  = "exec_—",
  fingerprint  = "——————",
  activePolicy = "DEFAULT_SAFE_MODE",
  model        = "streetmp-auto",
  latencyMs    = 0,
  dataExposure = "0% — Fragmented",
  complianceFlags = [],
  compact      = false,
}: TrustLightProps) {
  const [open, setOpen]     = useState(false);
  const [pulse, setPulse]   = useState(true);
  const popRef              = useRef<HTMLDivElement>(null);
  const cfg                 = SIGNAL_CONFIG[signal];

  // Stop auto-ping after 3 cycles
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={popRef}>
      {/* ── Badge ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer select-none
          ${cfg.bg} ${cfg.border} ${cfg.glow}`}
        aria-label={`StreetMP Trust Light: ${cfg.label}`}
      >
        {/* Animated dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${cfg.ping}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
        </span>

        {!compact && (
          <>
            <span className={`text-[11px] font-bold tracking-wide ${cfg.text}`}>StreetMP Verified</span>
            <span className={`text-[9px] font-medium opacity-60 ${cfg.text}`}>·</span>
            <span className={`text-[9px] font-semibold tracking-widest uppercase ${cfg.text}`}>{cfg.label}</span>
          </>
        )}
      </button>

      {/* ── Popover ────────────────────────────────────────────────── */}
      {open && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border bg-[#0d1117] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 ${cfg.popBorder}`}
        >
          {/* Popover header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${cfg.popBorder}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-bold ${cfg.text}`}>
                {signal === "GREEN" ? "Fully Secure" : signal === "YELLOW" ? "Advisory Active" : "Execution Blocked"}
              </span>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} ${cfg.bg}`}>
              {trustScore}/100
            </span>
          </div>

          {/* Fields */}
          <div className="px-4 py-3 space-y-2.5 text-[11px] font-mono">
            {[
              { label: "Execution Hash",     val: fingerprint },
              { label: "Data Exposure Risk", val: dataExposure },
              { label: "Active Policy",      val: activePolicy },
              { label: "Model Used",         val: model },
              { label: "Latency",            val: `${latencyMs}ms` },
              { label: "Compliance Flags",   val: complianceFlags.length ? complianceFlags.join(", ") : "None" },
            ].map(f => (
              <div key={f.label} className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-2 last:border-0">
                <span className="text-slate-500 shrink-0">{f.label}</span>
                <span className="text-slate-200 text-right break-all">{f.val}</span>
              </div>
            ))}
          </div>

          {/* Footer verify link */}
          <div className={`px-4 py-2.5 border-t ${cfg.popBorder}`}>
            <a
              href={`/verify/${executionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text} hover:underline`}
            >
              Verify Certificate →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
