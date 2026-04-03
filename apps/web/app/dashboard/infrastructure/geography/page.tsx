"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/infrastructure/geography
 * @version V59
 * @description Data Residency & Geography — Global Geo-Routing Dashboard
 *
 * SVG world map with 3 sovereignty fences, live traffic animations,
 * RESIDENCY_VIOLATION alert log, and compliance metrics.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

// ================================================================
// TYPES
// ================================================================

type GeoRegion = "APAC" | "EU" | "US_EAST";

interface GeoNode {
  id:        GeoRegion;
  label:     string;
  location:  string;
  cx:        number;   // SVG x-coordinate (0-1000)
  cy:        number;   // SVG y-coordinate (0-500)
  status:    "ACTIVE" | "STANDBY";
  requests:  number;
  blocked:   number;
}

interface TrafficPacket {
  id:          number;
  originId:    GeoRegion;
  targetId:    GeoRegion;
  blocked:     boolean;
  progress:    number;  // 0→1
}

interface ViolationLog {
  id:        number;
  ts:        string;
  origin:    GeoRegion;
  target:    GeoRegion;
  traceId:   string;
  regulation:string;
}

// ================================================================
// CONSTANTS
// ================================================================

const NODES: Record<GeoRegion, GeoNode> = {
  APAC: {
    id: "APAC", label: "APAC Sovereignty Fence",
    location: "KL / Singapore (ap-southeast-1)",
    cx: 760, cy: 280, status: "ACTIVE", requests: 0, blocked: 0,
  },
  EU: {
    id: "EU", label: "EU Sovereignty Fence",
    location: "Frankfurt (eu-central-1)",
    cx: 480, cy: 145, status: "ACTIVE", requests: 0, blocked: 0,
  },
  US_EAST: {
    id: "US_EAST", label: "US Sovereignty Fence",
    location: "N. Virginia (us-east-1)",
    cx: 210, cy: 195, status: "ACTIVE", requests: 0, blocked: 0,
  },
};

// Which cross-region routes are VIOLATIONS (APAC→US, EU→US, etc.)
const VIOLATIONS: Array<[GeoRegion, GeoRegion]> = [
  ["APAC", "US_EAST"],
  ["EU",   "US_EAST"],
  ["EU",   "APAC"],
  ["US_EAST", "APAC"],
  ["US_EAST", "EU"],
  ["APAC", "EU"],
];

function isViolation(from: GeoRegion, to: GeoRegion): boolean {
  return VIOLATIONS.some(([a, b]) => a === from && b === to);
}

function randomHex(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
}

const REGULATION: Record<GeoRegion, string> = {
  APAC:    "PDPA / PIPL",
  EU:      "GDPR Art. 44",
  US_EAST: "CCPA / HIPAA",
};

function nowTime() { return new Date().toISOString().slice(11, 23); }

// ================================================================
// SVG MAP — simplified continents for visual clarity
// ================================================================

function WorldMapSVG({ nodes, packets }: { nodes: typeof NODES; packets: TrafficPacket[] }) {
  return (
    <svg viewBox="0 0 1000 500" className="w-full h-full" style={{ background: "transparent" }}>
      {/* Simplified continent fills */}
      <defs>
        <radialGradient id="apac-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="eu-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="us-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Continent outlines (simplified polygons) ── */}
      {/* North America */}
      <path d="M80,120 L280,110 L300,160 L280,240 L200,280 L130,260 L80,200 Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
      {/* South America */}
      <path d="M170,310 L240,300 L270,360 L250,450 L200,460 L160,410 Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
      {/* Europe */}
      <path d="M420,90 L560,80 L590,130 L560,170 L490,185 L440,170 L410,140 Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
      {/* Africa */}
      <path d="M440,200 L560,195 L580,290 L540,390 L460,395 L420,300 Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
      {/* Asia */}
      <path d="M580,80 L900,75 L920,200 L880,250 L820,230 L700,260 L650,220 L600,180 Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
      {/* Australia */}
      <path d="M760,330 L880,325 L900,390 L830,420 L760,400 Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />

      {/* Grid lines */}
      {[0,200,400,600,800,1000].map(x => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={500} stroke="#1a1a1a" strokeWidth="0.5" />
      ))}
      {[0,100,200,300,400,500].map(y => (
        <line key={`h${y}`} x1={0} y1={y} x2={1000} y2={y} stroke="#1a1a1a" strokeWidth="0.5" />
      ))}

      {/* ── Sovereignty fence glows ── */}
      {Object.values(nodes).map(n => (
        <ellipse key={`glow-${n.id}`} cx={n.cx} cy={n.cy} rx={90} ry={60}
          fill={`url(#${n.id.toLowerCase().replace("_","-")}-glow)`} />
      ))}

      {/* ── Traffic packet beams ── */}
      {packets.map(pkt => {
        const from = nodes[pkt.originId];
        const to   = nodes[pkt.targetId];
        const x    = from.cx + (to.cx - from.cx) * pkt.progress;
        const y    = from.cy + (to.cy - from.cy) * pkt.progress
                   - Math.sin(pkt.progress * Math.PI) * 60; // arc
        return (
          <g key={pkt.id}>
            <circle cx={x} cy={y} r={pkt.blocked ? 4 : 3}
              fill={pkt.blocked ? "#ef4444" : "#10b981"}
              opacity={1 - pkt.progress * 0.3}
            />
            {pkt.blocked && pkt.progress > 0.5 && (
              <text x={x + 6} y={y - 4} fontSize={8} fill="#ef4444" fontFamily="monospace">
                BLOCKED
              </text>
            )}
          </g>
        );
      })}

      {/* ── Fence lines (permitted routes dashed) ── */}
      {/* APAC ↔ APAC only (no cross-border lines needed in the "allowed" state) */}

      {/* ── Node circles ── */}
      {Object.values(nodes).map(n => (
        <g key={n.id}>
          {/* Outer ring pulse */}
          <circle cx={n.cx} cy={n.cy} r={28} fill="none" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.4" />
          <circle cx={n.cx} cy={n.cy} r={20} fill="#0a180f" stroke="#10b981" strokeWidth="1.5" />
          <circle cx={n.cx} cy={n.cy} r={6} fill="#10b981" />
          {/* Label */}
          <text x={n.cx} y={n.cy + 40} textAnchor="middle" fontSize={9}
            fill="#10b981" fontFamily="monospace" fontWeight="bold">
            {n.id}
          </text>
          <text x={n.cx} y={n.cy + 52} textAnchor="middle" fontSize={7}
            fill="#555" fontFamily="monospace">
            {n.id === "APAC" ? "KL/SG" : n.id === "EU" ? "FRA" : "IAD"}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function GeographyPage() {
  const [mounted, setMounted]           = useState(false);
  const [nodes, setNodes]               = useState<typeof NODES>(NODES);
  const [packets, setPackets]           = useState<TrafficPacket[]>([]);
  const [violations, setViolations]     = useState<ViolationLog[]>([]);
  const [blockedTotal, setBlockedTotal] = useState(12); // seed from spec
  const [totalReqs, setTotalReqs]       = useState(148);
  const packetId                        = useRef(0);
  const violationId                     = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Animate packets
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setPackets(prev => {
        const next = prev
          .map(p => ({ ...p, progress: p.progress + 0.04 }))
          .filter(p => p.progress < 1);
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [mounted]);

  // Spawn traffic events
  const spawnTraffic = useCallback(() => {
    const origins: GeoRegion[]  = ["APAC", "EU", "US_EAST"];
    const targets: GeoRegion[]  = ["APAC", "EU", "US_EAST"];
    const origin = origins[Math.floor(Math.random() * origins.length)]!;

    // 80% chance of same-region (legal), 20% cross-region (violation)
    const roll = Math.random();
    const target = roll > 0.8
      ? targets.filter(t => t !== origin)[Math.floor(Math.random() * 2)]!
      : origin;

    const blocked = isViolation(origin, target);

    packetId.current += 1;
    setPackets(prev => [...prev, {
      id: packetId.current, originId: origin, targetId: target, blocked, progress: 0,
    }]);

    setTotalReqs(n => n + 1);
    setNodes(prev => ({
      ...prev,
      [origin]: { ...prev[origin], requests: prev[origin].requests + 1 },
    }));

    if (blocked) {
      setBlockedTotal(n => n + 1);
      setNodes(prev => ({
        ...prev,
        [origin]: { ...prev[origin], blocked: prev[origin].blocked + 1 },
      }));
      violationId.current += 1;
      const vId = violationId.current;
      setViolations(prev => [{
        id: vId, ts: nowTime(),
        origin, target,
        traceId: randomHex(8),
        regulation: REGULATION[origin],
      }, ...prev].slice(0, 6));
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(spawnTraffic, 1200);
    return () => clearInterval(t);
  }, [mounted, spawnTraffic]);

  const compliance = Math.round(((totalReqs - blockedTotal) / totalReqs) * 100);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">V59</span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">Data Residency Enforcement</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Global Geo-Routing <span className="text-emerald-400">& Residency Map</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Every request is geo-fenced by jurisdiction. APAC data stays in APAC, EU data stays in EU under GDPR Art. 44. Cross-border routing attempts are hard-blocked.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "Residency Compliance",   value: `${compliance}%`,        cls: compliance === 100 ? "text-emerald-400" : "text-amber-400" },
              { label: "Active Geo-Fences",      value: "3",                     cls: "text-emerald-400" },
              { label: "Blocked Border Crossings", value: String(blockedTotal),  cls: blockedTotal > 0 ? "text-red-400" : "text-emerald-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black tracking-wide ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-8 space-y-6">

        {/* World map + node cards grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Map */}
          <div className="xl:col-span-2 rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Live Traffic Flow — Sovereignty Fences Active</p>
              <div className="flex items-center gap-3 text-[9px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Compliant</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Violation</span>
              </div>
            </div>
            <div className="h-72 p-2">
              <WorldMapSVG nodes={nodes} packets={packets} />
            </div>
          </div>

          {/* Node stats */}
          <div className="space-y-3">
            {(["APAC","EU","US_EAST"] as GeoRegion[]).map(id => {
              const n = nodes[id];
              return (
                <div key={id} className="rounded-2xl p-4 border border-emerald-500/20 bg-emerald-950/10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{n.label}</p>
                      <p className="text-[8px] text-zinc-600 font-mono">{n.location}</p>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-black">
                      {n.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center py-2 rounded bg-white/3 border border-white/5">
                      <p className="text-sm font-black text-white">{n.requests}</p>
                      <p className="text-[7px] text-zinc-600 uppercase">Requests</p>
                    </div>
                    <div className="text-center py-2 rounded bg-red-950/20 border border-red-900/20">
                      <p className={`text-sm font-black ${n.blocked > 0 ? "text-red-400" : "text-zinc-600"}`}>{n.blocked}</p>
                      <p className="text-[7px] text-zinc-600 uppercase">Blocked</p>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-700 mt-2 font-mono">{
                    id === "APAC" ? "PDPA / PIPL" : id === "EU" ? "GDPR Art. 44–49" : "CCPA / HIPAA"
                  }</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Violation log + policy table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Violation alert log */}
          <div className="rounded-2xl border border-red-900/30 bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-red-900/30 flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-widest text-red-500">🚨 VIOLATION ALERT LOG</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[9px] text-red-500 font-mono">LIVE</span>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {violations.length === 0 ? (
                <p className="px-4 py-6 text-xs text-zinc-700 text-center">Monitoring for violations…</p>
              ) : violations.map(v => (
                <div key={v.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-950/30 border border-red-800/40 text-red-400">
                      RESIDENCY_VIOLATION
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">{v.ts}</span>
                  </div>
                  <p className="text-[9px] text-zinc-400">
                    <span className="text-amber-400 font-mono">{v.origin}</span>
                    <span className="text-zinc-600"> → </span>
                    <span className="text-red-400 font-mono">{v.target}</span>
                    <span className="text-zinc-600"> | BLOCKED | {v.regulation}</span>
                  </p>
                  <p className="text-[8px] font-mono text-zinc-700">trace: {v.traceId}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Residency policy table */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Residency Policy Matrix</p>
            </div>
            <div className="p-4 space-y-3">
              {([
                { region: "APAC",    allowed: ["APAC"],                  law: "PDPA / PIPL",       color: "text-emerald-400" },
                { region: "EU",      allowed: ["EU"],                    law: "GDPR Art. 44",       color: "text-blue-400" },
                { region: "US_EAST", allowed: ["US_EAST", "US_WEST"],   law: "CCPA / HIPAA",       color: "text-violet-400" },
              ] as const).map(p => (
                <div key={p.region} className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
                  <span className={`text-[9px] font-black font-mono w-14 flex-shrink-0 ${p.color}`}>{p.region}</span>
                  <div className="flex-1">
                    <p className="text-[8px] text-zinc-500 mb-1">{p.law}</p>
                    <div className="flex gap-1 flex-wrap">
                      {(["APAC","EU","US_EAST"] as const).map(t => {
                        const ok = (p.allowed as readonly string[]).includes(t);
                        return (
                          <span key={t} className={`text-[7px] px-1.5 py-0.5 rounded font-mono ${ok ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" : "bg-red-950/30 text-red-500 border border-red-900/30"}`}>
                            {ok ? "✓" : "✗"} {t}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
