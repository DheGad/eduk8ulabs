"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/infrastructure/versioning
 * @version V63
 * @description API Versioning & Canary Deployment Dashboard
 *
 * Interactive traffic splitter with live dot-flow animation,
 * version descriptor cards, and real-time canary metrics.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

// ================================================================
// TYPES
// ================================================================

interface Dot {
  id:       number;
  x:        number;     // 0–1 normalized progress along the path
  channel:  "STABLE" | "CANARY";
  speed:    number;     // units per frame
  opacity:  number;
}

// ================================================================
// CONSTANTS
// ================================================================

const STABLE_VERSION = { tag: "v2.4.1",       buildId: "a3f8c12", channel: "STABLE" as const };
const CANARY_VERSION = { tag: "v2.5.0-beta",  buildId: "b9d2e47", channel: "CANARY" as const };

const STABLE_FEATURES = [
  "V62 White-Label Brand Engine",
  "V61 Dark Web Threat Intel",
  "V60 Semantic Cache Fast Path",
  "V59 Data Residency Enforcement",
  "V58 Automated Key Rotation",
];

const CANARY_FEATURES = [
  "V63 Canary Deployment Engine",
  "Experimental: Streaming SSE responses",
  "Experimental: Adaptive rate-limit backoff",
  "WIP: V64 ML Anomaly Detection",
];

const DOT_COUNT = 60;

function makeInitDots(canaryPct: number): Dot[] {
  return Array.from({ length: DOT_COUNT }, (_, i) => {
    const isCanary = (i / DOT_COUNT) * 100 < canaryPct;
    return {
      id:      i,
      x:       Math.random(),
      channel: isCanary ? "CANARY" : "STABLE",
      speed:   0.003 + Math.random() * 0.002,
      opacity: 0.6 + Math.random() * 0.4,
    };
  });
}

// ================================================================
// TRAFFIC DOT ANIMATION (SVG-based, two paths)
// ================================================================

function TrafficFlow({ canaryPct }: { canaryPct: number }) {
  const [dots, setDots] = useState<Dot[]>(() => makeInitDots(canaryPct));
  const rafRef = useRef<number>(0);

  // Update dot channels when split changes
  useEffect(() => {
    setDots(prev =>
      prev.map((d, i) => ({
        ...d,
        channel: (i / DOT_COUNT) * 100 < canaryPct ? "CANARY" : "STABLE",
      }))
    );
  }, [canaryPct]);

  // Animate — advance each dot along its path
  useEffect(() => {
    const frame = () => {
      setDots(prev =>
        prev.map(d => ({
          ...d,
          x: d.x >= 1 ? 0 : d.x + d.speed,
        }))
      );
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // SVG layout constants
  const W = 600; const H = 200;
  const srcX = 60;  const srcY = H / 2;
  const forkX = 200;
  const stableY = 70; const canaryY = 130;
  const endX = 540;

  function dotPosition(d: Dot): [number, number] {
    if (d.channel === "STABLE") {
      if (d.x < 0.4) {
        // Move from source to fork
        const t = d.x / 0.4;
        return [srcX + (forkX - srcX) * t, srcY + (stableY - srcY) * t];
      }
      const t = (d.x - 0.4) / 0.6;
      return [forkX + (endX - forkX) * t, stableY];
    } else {
      if (d.x < 0.4) {
        const t = d.x / 0.4;
        return [srcX + (forkX - srcX) * t, srcY + (canaryY - srcY) * t];
      }
      const t = (d.x - 0.4) / 0.6;
      return [forkX + (endX - forkX) * t, canaryY];
    }
  }

  const stableCount = dots.filter(d => d.channel === "STABLE").length;
  const canaryCount = dots.filter(d => d.channel === "CANARY").length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        {/* Paths */}
        {/* Source → Stable */}
        <path d={`M ${srcX} ${srcY} Q ${forkX - 20} ${srcY} ${forkX} ${stableY} L ${endX} ${stableY}`}
          stroke="#10b981" strokeWidth="1" fill="none" opacity="0.15" />
        {/* Source → Canary */}
        <path d={`M ${srcX} ${srcY} Q ${forkX - 20} ${srcY} ${forkX} ${canaryY} L ${endX} ${canaryY}`}
          stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.15" />

        {/* Nodes */}
        {/* Source */}
        <circle cx={srcX} cy={srcY} r={14} fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1" strokeOpacity="0.4" />
        <text x={srcX} y={srcY + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#10b981" fontWeight="bold">REQ</text>

        {/* Stable node */}
        <rect x={endX - 2} y={stableY - 16} width={60} height={32} rx={6} fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1" strokeOpacity="0.4" />
        <text x={endX + 28} y={stableY - 4} textAnchor="middle" fontSize="7" fill="#10b981" fontWeight="bold">STABLE</text>
        <text x={endX + 28} y={stableY + 6} textAnchor="middle" fontSize="7" fill="#10b981" opacity="0.7">{stableCount} req/s</text>

        {/* Canary node */}
        <rect x={endX - 2} y={canaryY - 16} width={60} height={32} rx={6} fill="#f59e0b" fillOpacity="0.12" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.4" />
        <text x={endX + 28} y={canaryY - 4} textAnchor="middle" fontSize="7" fill="#f59e0b" fontWeight="bold">CANARY</text>
        <text x={endX + 28} y={canaryY + 6} textAnchor="middle" fontSize="7" fill="#f59e0b" opacity="0.7">{canaryCount} req/s</text>

        {/* Fork label */}
        <text x={forkX} y={H / 2 + 2} textAnchor="middle" fontSize="6" fill="#555" dominantBaseline="middle">SPLIT</text>

        {/* Animated dots */}
        {dots.map(d => {
          const [cx, cy] = dotPosition(d);
          return (
            <circle
              key={d.id}
              cx={cx}
              cy={cy}
              r={3}
              fill={d.channel === "STABLE" ? "#10b981" : "#f59e0b"}
              opacity={d.opacity}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] text-zinc-400">Stable ({stableCount} dots = {100 - Math.round(canaryPct)}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-[9px] text-zinc-400">Canary ({canaryCount} dots = {Math.round(canaryPct)}%)</span>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// VERSION CARD
// ================================================================

function VersionCard({ tag, buildId, channel, features, requestPct }: {
  tag: string; buildId: string; channel: "STABLE" | "CANARY"; features: string[]; requestPct: number;
}) {
  const isCanary = channel === "CANARY";
  const color = isCanary ? "#f59e0b" : "#10b981";
  const colorClass = isCanary ? "text-amber-400" : "text-emerald-400";
  const bgClass = isCanary ? "bg-amber-950/10" : "bg-emerald-950/10";
  const borderStyle = { borderColor: isCanary ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)" };

  return (
    <div className={`rounded-xl border p-4 ${bgClass} transition-all duration-300`} style={borderStyle}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${colorClass}`}
            style={{ borderColor: color + "44", background: color + "18" }}>
            {channel}
          </span>
          <span className={`text-sm font-black font-mono ${colorClass}`}>{tag}</span>
        </div>
        <span className="text-[8px] text-zinc-600 font-mono">{buildId}</span>
      </div>
      {/* Traffic share bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] text-zinc-600">Traffic Share</span>
          <span className={`text-[9px] font-black font-mono ${colorClass}`}>{requestPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${requestPct}%`, background: color }} />
        </div>
      </div>
      {/* Features */}
      <ul className="space-y-1">
        {features.map(f => (
          <li key={f} className="flex items-center gap-1.5 text-[8px] text-zinc-500">
            <span style={{ color }}>▸</span>{f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function VersioningPage() {
  const [mounted, setMounted]     = useState(false);
  const [canaryPct, setCanaryPct] = useState(5);
  const stablePct = 100 - canaryPct;

  // Simulate live active canary users tracking canary traffic
  const [activeCanaryUsers, setActiveCanaryUsers] = useState(42);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const base = Math.round(canaryPct * 8.4);
    setActiveCanaryUsers(base + Math.floor(Math.random() * 5));
  }, [canaryPct, mounted]);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCanaryPct(Number(e.target.value));
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">V63</span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">Canary Deployment Engine</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              API Versioning <span className="text-emerald-400">& Canary Control</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Split production traffic between stable and canary kernel versions.
              Deterministic per-user routing via MD5 hash buckets — no session flapping.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "Stable Version",      value: STABLE_VERSION.tag,   cls: "text-emerald-400" },
              { label: "Canary Version",      value: CANARY_VERSION.tag,   cls: "text-amber-400" },
              { label: "Active Canary Users", value: activeCanaryUsers.toString(), cls: "text-amber-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black tracking-wide font-mono ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-8 space-y-6">

        {/* Traffic Splitter Control */}
        <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Traffic Splitter Control</p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400 font-black">{stablePct}% Stable</span>
              <span className="text-zinc-700">/</span>
              <span className="text-amber-400 font-black">{canaryPct}% Canary</span>
            </div>
          </div>

          {/* Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-[8px] font-mono text-zinc-600 mb-2">
              <span>0% Canary</span><span>50% Canary</span><span>100% Canary</span>
            </div>
            <div className="relative">
              <div className="h-3 rounded-full overflow-hidden flex">
                <div className="rounded-l-full transition-all duration-200 bg-emerald-500/70" style={{ width: `${stablePct}%` }} />
                <div className="rounded-r-full transition-all duration-200 bg-amber-500/70" style={{ width: `${canaryPct}%` }} />
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={canaryPct}
                onChange={handleSlider}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
                style={{ WebkitAppearance: "none" }}
              />
            </div>
            <div className="flex items-center justify-end mt-2">
              {canaryPct >= 10 && (
                <span className="text-[8px] text-amber-500 font-black">⚠ High Canary Traffic — Monitor Error Rate</span>
              )}
            </div>
          </div>

          {/* Traffic flow diagram */}
          <TrafficFlow canaryPct={canaryPct} />
        </div>

        {/* Version cards + metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Stable version card */}
          <VersionCard
            tag={STABLE_VERSION.tag}
            buildId={STABLE_VERSION.buildId}
            channel="STABLE"
            features={STABLE_FEATURES}
            requestPct={stablePct}
          />

          {/* Canary version card */}
          <VersionCard
            tag={CANARY_VERSION.tag}
            buildId={CANARY_VERSION.buildId}
            channel="CANARY"
            features={CANARY_FEATURES}
            requestPct={canaryPct}
          />

          {/* Live metrics */}
          <div className="rounded-xl border border-white/8 bg-[#0a0a0a] p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Live Canary Health</p>
            <div className="space-y-3">
              {[
                { label: "Canary Error Rate",  value: `${(canaryPct * 0.16).toFixed(1)}%`,  warn: canaryPct > 20, cls: "text-amber-400" },
                { label: "Stable Error Rate",  value: "0.1%",                               warn: false,          cls: "text-emerald-400" },
                { label: "P99 Latency Canary", value: `${Math.round(88 + canaryPct * 0.12)}ms`, warn: false,      cls: "text-amber-400" },
                { label: "P99 Latency Stable", value: "88ms",                               warn: false,          cls: "text-emerald-400" },
                { label: "Active Canary Users",value: activeCanaryUsers.toString(),         warn: false,          cls: "text-amber-400" },
              ].map(({ label, value, warn, cls }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[9px] text-zinc-600">{label}</span>
                  <span className={`text-[9px] font-black font-mono ${warn ? "text-red-400" : cls}`}>
                    {warn ? "⚠ " : ""}{value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-2">Pipeline Header</p>
              <code className="text-[8px] text-emerald-400 font-mono break-all">
                x-streetmp-version:<br />
                {canaryPct > 0 ? `v2.5.0-beta-canary` : `v2.4.1-stable`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
