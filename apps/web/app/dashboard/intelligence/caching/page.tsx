"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/intelligence/caching
 * @version V60
 * @description Semantic Caching & Optimization Dashboard
 *
 * Live hit/miss chart, cost savings counter, side-by-side latency
 * comparison terminal, and cache density matrix.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

// ================================================================
// TYPES
// ================================================================

type RequestType = "HIT" | "MISS";

interface RequestEvent {
  id:         number;
  ts:         string;
  type:       RequestType;
  prompt:     string;
  similarity: number;
  latencyMs:  number;
  costSaved:  number;
}

interface BarDatum {
  label: string;
  hits:  number;
  misses: number;
}

// ================================================================
// CONSTANTS
// ================================================================

const PROMPTS_HIT = [
  "What is the capital of Malaysia?",
  "Explain Byzantine fault tolerance",
  "How does Redis distributed locking work?",
  "What is AES-256-GCM encryption?",
  "Summarise the GDPR Article 44 rules",
  "What is gRPC vs REST difference?",
];

const PROMPTS_MISS = [
  "Draft a Python data pipeline script",
  "Analyse the NASDAQ earnings report",
  "Write a sonnet about distributed systems",
  "What are the admission requirements for MIT?",
];

function nowTime() { return new Date().toISOString().slice(11, 23); }
function fmtMs(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`; }
function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

const INIT_HITS   = 46712;
const INIT_MISSES = 54010;
const COST_PER    = 0.03;

// Init bar chart buckets (last 8 intervals)
function makeInitBars(): BarDatum[] {
  return Array.from({ length: 8 }, (_, i) => ({
    label: `T-${(7 - i) * 5}m`,
    hits:  Math.floor(80 + Math.random() * 60),
    misses: Math.floor(40 + Math.random() * 40),
  }));
}

// ================================================================
// CHART — simple bar chart built with divs
// ================================================================
function BarChart({ data }: { data: BarDatum[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.hits, d.misses]), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex items-end gap-0.5" style={{ height: "7rem" }}>
            <div
              className="flex-1 rounded-t bg-emerald-500/70 transition-all duration-500"
              style={{ height: `${(d.hits / maxVal) * 100}%` }}
            />
            <div
              className="flex-1 rounded-t bg-zinc-700/60 transition-all duration-500"
              style={{ height: `${(d.misses / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[7px] text-zinc-700 font-mono whitespace-nowrap">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ================================================================
// LATENCY COMPARISON TERMINAL
// ================================================================
function LatencyTerminal({ lastHit, lastMiss }: { lastHit: RequestEvent | null; lastMiss: RequestEvent | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* LLM Origin */}
      <div className="rounded-xl border border-zinc-800 bg-black p-4 font-mono text-[9px]">
        <p className="text-zinc-500 mb-2 flex items-center gap-1.5">
          <span className="text-base">🐢</span> LLM Origin
        </p>
        <p className="text-zinc-600">$ curl /api/proxy</p>
        <p className="text-zinc-600 mt-1">→ V48 BFT Consensus…</p>
        <p className="text-zinc-600">→ V50 IAM check…</p>
        <p className="text-zinc-600">→ calling gpt-4o…</p>
        <div className="mt-2 pt-2 border-t border-zinc-900">
          <p className="text-amber-400">latency: <span className="font-black">{lastMiss ? fmtMs(lastMiss.latencyMs) : "1.4s"}</span></p>
          <p className="text-red-400">cost:    <span className="font-black">$0.03</span></p>
        </div>
      </div>
      {/* Semantic Cache */}
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4 font-mono text-[9px]">
        <p className="text-emerald-400 mb-2 flex items-center gap-1.5">
          <span className="text-base">⚡</span> Semantic Cache
        </p>
        <p className="text-zinc-600">$ curl /api/proxy</p>
        <p className="text-zinc-600 mt-1">→ checkCache()…</p>
        <p className="text-emerald-600">→ HIT sim:{lastHit ? lastHit.similarity.toFixed(3) : "0.961"}</p>
        <p className="text-emerald-600">→ serving cached…</p>
        <div className="mt-2 pt-2 border-t border-emerald-900/30">
          <p className="text-emerald-400">latency: <span className="font-black">{lastHit ? fmtMs(lastHit.latencyMs) : "8ms"}</span></p>
          <p className="text-emerald-400">cost:    <span className="font-black">$0.00</span></p>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function CachingPage() {
  const [mounted, setMounted]       = useState(false);
  const [totalHits, setTotalHits]   = useState(INIT_HITS);
  const [totalMisses, setTotalMisses] = useState(INIT_MISSES);
  const [savedUsd, setSavedUsd]     = useState(INIT_HITS * COST_PER);
  const [events, setEvents]         = useState<RequestEvent[]>([]);
  const [bars, setBars]             = useState<BarDatum[]>(makeInitBars);
  const [lastHit, setLastHit]       = useState<RequestEvent | null>(null);
  const [lastMiss, setLastMiss]     = useState<RequestEvent | null>(null);
  const eventId = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  const generateEvent = useCallback(() => {
    // 46% hit rate simulation
    const isHit = Math.random() < 0.46;
    const roll  = Math.random();

    eventId.current += 1;
    const evt: RequestEvent = {
      id:         eventId.current,
      ts:         nowTime(),
      type:       isHit ? "HIT" : "MISS",
      prompt:     isHit
        ? PROMPTS_HIT[Math.floor(roll * PROMPTS_HIT.length)]!
        : PROMPTS_MISS[Math.floor(roll * PROMPTS_MISS.length)]!,
      similarity: isHit ? 0.92 + Math.random() * 0.07 : 0.3 + Math.random() * 0.5,
      latencyMs:  isHit ? Math.floor(Math.random() * 10) + 2 : Math.floor(Math.random() * 800) + 900,
      costSaved:  isHit ? COST_PER : 0,
    };

    setEvents(prev => [evt, ...prev].slice(0, 10));

    if (isHit) {
      setTotalHits(n => n + 1);
      setSavedUsd(n => n + COST_PER);
      setLastHit(evt);
    } else {
      setTotalMisses(n => n + 1);
      setLastMiss(evt);
    }

    // Update last bar bucket
    setBars(prev => {
      const next = [...prev];
      const last = next[next.length - 1]!;
      next[next.length - 1] = {
        ...last,
        hits:   last.hits   + (isHit ? 1 : 0),
        misses: last.misses + (isHit ? 0 : 1),
      };
      return next;
    });
  }, []);

  // Spawn events every 1.5s
  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(generateEvent, 1500);
    return () => clearInterval(t);
  }, [mounted, generateEvent]);

  // Rotate a new bar bucket every 30s
  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(() => {
      setBars(prev => [
        ...prev.slice(1),
        { label: "now", hits: 0, misses: 0 },
      ]);
    }, 30_000);
    return () => clearInterval(t);
  }, [mounted]);

  if (!mounted) return null;

  const total      = totalHits + totalMisses;
  const hitRate    = Math.round((totalHits / total) * 100);
  const latRedPct  = 88;
  const density    = 42;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">V60</span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">Semantic Caching Engine</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Semantic Cache <span className="text-emerald-400">& Cost Optimizer</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Vector embeddings detect semantically identical prompts and serve cached responses in ~8ms — bypassing the BFT consensus and LLM API call entirely. Zero cost, zero latency.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "Total API Cost Saved",       value: fmtUsd(savedUsd),   cls: "text-emerald-400" },
              { label: "Avg Latency Reduction",      value: `${latRedPct}%`,    cls: "text-emerald-400" },
              { label: "Cache Density",              value: `${density}%`,      cls: "text-zinc-400" },
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

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Cache Hits",  value: totalHits.toLocaleString(),   sub: "Requests served from cache",  cls: "text-emerald-400" },
            { label: "Cache Misses",value: totalMisses.toLocaleString(), sub: "Sent to LLM (cold path)",     cls: "text-zinc-400" },
            { label: "Hit Rate",    value: `${hitRate}%`,                sub: "> 0.92 cosine threshold",     cls: hitRate >= 40 ? "text-emerald-400" : "text-amber-400" },
          ].map(({ label, value, sub, cls }) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
              <p className={`text-2xl font-black ${cls}`}>{value}</p>
              <p className="text-[9px] text-zinc-600 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Chart + latency terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Hit/Miss chart */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cache Hits vs Misses (5-min intervals)</p>
              <div className="flex items-center gap-3 text-[9px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Hits</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-700" />Misses</span>
              </div>
            </div>
            <BarChart data={bars} />
          </div>

          {/* Latency comparison terminal */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Latency Comparison Terminal</p>
            <LatencyTerminal lastHit={lastHit} lastMiss={lastMiss} />
          </div>
        </div>

        {/* Event stream + cache entries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Live event log */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Live Request Stream</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-500 font-mono">LIVE</span>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {events.length === 0
                ? <p className="px-4 py-6 text-xs text-zinc-700 text-center">Waiting for requests…</p>
                : events.map(ev => (
                  <div key={ev.id} className="px-4 py-2 flex items-start gap-3">
                    <span className={`flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded border mt-0.5 ${
                      ev.type === "HIT"
                        ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/40"
                        : "text-zinc-500 bg-zinc-900/30 border-zinc-800/40"
                    }`}>{ev.type === "HIT" ? "⚡ HIT" : "🐢 MISS"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-zinc-300 truncate">{ev.prompt}</p>
                      <p className="text-[8px] text-zinc-600 font-mono">
                        sim:{ev.similarity.toFixed(3)} · {fmtMs(ev.latencyMs)}
                        {ev.costSaved > 0 && <span className="text-emerald-500"> · ${ev.costSaved.toFixed(2)} saved</span>}
                      </p>
                    </div>
                    <span className="text-[8px] text-zinc-700 font-mono flex-shrink-0">{ev.ts}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Cache density info */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Pipeline Fast Path (V60)</p>

            {/* Path diagram */}
            <div className="space-y-1.5 mb-4">
              {[
                { label: "V55 DR Check",       color: "text-zinc-500",   icon: "→" },
                { label: "V57 bgFingerprint",  color: "text-zinc-500",   icon: "→" },
                { label: "V49 Attestation",    color: "text-zinc-500",   icon: "→" },
                { label: "V60 checkCache()",   color: "text-emerald-400 font-black", icon: "→", highlight: true },
                { label: "⚡ HIT → skip LLM",  color: "text-emerald-400 font-black", icon: "↳", highlight: true },
                { label: "V51 DLP.detokenize", color: "text-zinc-500", icon: "→" },
                { label: "→ Client (8ms)",     color: "text-emerald-500", icon: "" },
              ].map(({ label, color, icon, highlight }) => (
                <div key={label} className={`flex items-center gap-2 text-[9px] font-mono px-2 py-1 rounded ${highlight ? "bg-emerald-950/20 border border-emerald-900/30" : ""}`}>
                  <span className="text-zinc-600">{icon}</span>
                  <span className={color}>{label}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">Similarity Threshold</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: "92%" }} />
                </div>
                <span className="text-[9px] font-mono text-emerald-400 font-black">0.92</span>
              </div>
              <p className="text-[8px] text-zinc-700 mt-1">Cosine similarity cutoff — above this, response is served from cache</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
