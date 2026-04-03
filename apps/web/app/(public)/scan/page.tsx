"use client";

/**
 * @file app/(public)/scan/page.tsx
 * @description Command 086 — The Live Risk Scanner (Public Sales Engine)
 *
 * Route:  /scan
 * Access: Fully public — (public) route group, no auth guard.
 *
 * This page is the 24/7 automated sales machine. A prospect pastes
 * their API key, selects their industry, and sees exactly what data
 * their unprotected AI setup is leaking — and exactly how StreetMP
 * OS would have masked it.
 *
 * Security: API key never leaves the browser until the POST — it is
 * processed in-memory by the backend and never stored, logged, or
 * forwarded to any AI provider.
 */

import { useState, useRef } from "react";
import Link from "next/link";

// ─── Types (mirror scannerController.ts) ──────────────────────────────────────

interface PiiFound {
  type:       string;
  label:      string;
  severity:   "CRITICAL" | "HIGH" | "MEDIUM";
  regulation: string;
  count:      number;
}

interface PromptResult {
  prompt_id:        string;
  scenario:         string;
  role:             string;
  raw_text:         string;
  protected_text:   string;
  pii_found:        PiiFound[];
  total_redactions: number;
  risk_score:       number;
}

interface FineEstimate {
  framework:    string;
  jurisdiction: string;
  max_fine:     string;
  per_incident: string;
  basis:        string;
}

interface ScanReport {
  scan_id:             string;
  industry:            string;
  scanned_at:          string;
  key_prefix:          string;
  prompts_scanned:     number;
  total_pii_found:     number;
  risk_score:          number;
  risk_label:          "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  results:             PromptResult[];
  regulatory_exposure: FineEstimate[];
  key_retained:        false;
  key_logged:          false;
  key_forwarded:       false;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTER_URL = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

const RISK_COLORS: Record<ScanReport["risk_label"], string> = {
  CRITICAL: "text-red-400",
  HIGH:     "text-orange-400",
  MEDIUM:   "text-yellow-400",
  LOW:      "text-emerald-400",
};

const RISK_BG: Record<ScanReport["risk_label"], string> = {
  CRITICAL: "border-red-500/30 bg-red-500/[0.06] shadow-[0_0_40px_rgba(239,68,68,0.08)]",
  HIGH:     "border-orange-500/30 bg-orange-500/[0.06]",
  MEDIUM:   "border-yellow-500/30 bg-yellow-500/[0.06]",
  LOW:      "border-emerald-500/30 bg-emerald-500/[0.06]",
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-400",
  HIGH:     "border-orange-500/30 bg-orange-500/10 text-orange-400",
  MEDIUM:   "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highlightRedactions(text: string): React.ReactNode[] {
  const parts = text.split(/(\[REDACTED_[A-Z_]+\])/g);
  return parts.map((part, i) =>
    /^\[REDACTED_/.test(part) ? (
      <span
        key={i}
        className="mx-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-black font-mono text-emerald-400"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function highlightPii(text: string): React.ReactNode[] {
  // Highlight patterns that look like PII in the raw text
  const piiPatterns = [
    // NRIC/FIN
    { re: /\b[STFG]\d{7}[A-Z]\b/g,              cls: "bg-red-500/20 text-red-300 rounded px-0.5" },
    // MyKad
    { re: /\b\d{6}-\d{2}-\d{4}\b/g,             cls: "bg-red-500/20 text-red-300 rounded px-0.5" },
    // Credit card
    { re: /\b(?:4\d{3}|5[1-5]\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, cls: "bg-red-500/20 text-red-300 rounded px-0.5" },
    // SSN
    { re: /\b\d{3}-\d{2}-\d{4}\b/g,             cls: "bg-red-500/20 text-red-300 rounded px-0.5" },
    // Email
    { re: /\b[\w._%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, cls: "bg-orange-500/20 text-orange-300 rounded px-0.5" },
    // IBAN
    { re: /\b[A-Z]{2}\d{2}[A-Z0-9]+\b/g,        cls: "bg-red-500/20 text-red-300 rounded px-0.5" },
    // MRN
    { re: /\bMRN[\s:]*\d{6,10}\b/gi,             cls: "bg-red-500/20 text-red-300 rounded px-0.5" },
  ];

  let result: React.ReactNode[] = [text];
  for (const { re, cls } of piiPatterns) {
    const next: React.ReactNode[] = [];
    for (const node of result) {
      if (typeof node !== "string") { next.push(node); continue; }
      const parts = node.split(re);
      const matches = node.match(re) ?? [];
      parts.forEach((part, i) => {
        next.push(<span key={`${i}-t`}>{part}</span>);
        if (matches[i]) next.push(<mark key={`${i}-m`} className={cls}>{matches[i]}</mark>);
      });
    }
    result = next;
  }
  return result;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ScanLoadingState() {
  const STAGES = [
    { label: "Validating API key format…",           ms: 400  },
    { label: "Loading industry PII patterns…",        ms: 900  },
    { label: "Simulating employee prompts…",          ms: 1600 },
    { label: "Running V67 DLP engine…",               ms: 2200 },
    { label: "Computing regulatory exposure…",        ms: 2700 },
    { label: "Generating scan report…",               ms: 3100 },
  ];

  const [stageIdx, setStageIdx] = useState(0);

  useState(() => {
    STAGES.forEach(({ ms }, i) => {
      setTimeout(() => setStageIdx(i), ms);
    });
  });

  return (
    <div className="flex flex-col items-center gap-8 py-20">
      {/* Scanning animation */}
      <div className="relative">
        <div className="h-24 w-24 rounded-full border-2 border-red-500/30 animate-ping absolute inset-0" />
        <div className="h-24 w-24 rounded-full border-2 border-red-500/50 flex items-center justify-center relative">
          <span className="text-4xl animate-pulse">🔍</span>
        </div>
      </div>

      <div className="text-center flex flex-col items-center gap-2">
        <p className="text-xl font-bold text-white">Scanning your AI exposure…</p>
        <p className="text-sm text-zinc-500">Running 5 simulated employee prompts through DLP analysis</p>
      </div>

      {/* Stage progress */}
      <div className="flex flex-col gap-2.5 w-full max-w-sm">
        {STAGES.map((stage, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full shrink-0 transition-all duration-500 ${
              i < stageIdx  ? "bg-emerald-500" :
              i === stageIdx ? "bg-yellow-400 animate-pulse" :
              "bg-zinc-700"
            }`} />
            <span className={`text-xs transition-colors duration-300 ${
              i < stageIdx  ? "text-emerald-400 font-semibold" :
              i === stageIdx ? "text-white font-semibold" :
              "text-zinc-600"
            }`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptResultCard({ result, index }: { result: PromptResult; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
        title={expanded ? "Collapse prompt details" : "Expand prompt details"}
      >
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
            result.risk_score >= 70 ? "text-red-400 border-red-500/30 bg-red-500/10" :
            result.risk_score >= 40 ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
            "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
          }`}>
            Score {result.risk_score}
          </span>
          <div>
            <span className="text-sm font-bold text-white">{result.scenario}</span>
            <span className="text-xs text-zinc-500 ml-2">({result.role})</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-red-400 font-semibold">{result.total_redactions} PII fields</span>
          <span className={`text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-5 border-t border-white/[0.05]">
          {/* PII tags */}
          {result.pii_found.length > 0 && (
            <div className="pt-4 flex flex-wrap gap-2">
              {result.pii_found.map((pii) => (
                <span
                  key={pii.type}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${SEV_COLOR[pii.severity] ?? ""}`}
                >
                  {pii.label} ×{pii.count}
                </span>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Unprotected */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-500/15 bg-red-500/[0.05]">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                  Unprotected — What OpenAI Receives Today
                </span>
              </div>
              <div className="px-4 py-4 text-xs leading-relaxed text-zinc-300 font-mono">
                {highlightPii(result.raw_text)}
              </div>
            </div>

            {/* Protected */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-500/15 bg-emerald-500/[0.05]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  StreetMP Protected — What AI Receives
                </span>
              </div>
              <div className="px-4 py-4 text-xs leading-relaxed text-zinc-300 font-mono">
                {highlightRedactions(result.protected_text)}
              </div>
            </div>
          </div>

          {/* Regulation tags */}
          {result.pii_found.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...new Set(result.pii_found.map((p) => p.regulation))].map((reg) => (
                <span key={reg} className="text-[10px] text-zinc-500 font-mono border border-zinc-800 rounded px-2 py-0.5">
                  {reg}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScanResults({ report }: { report: ScanReport }) {
  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* ── Risk Header ─────────────────────────────────────────────── */}
      <div className={`rounded-3xl border ${RISK_BG[report.risk_label]} p-8`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Scan ID: {report.scan_id}
              </span>
              <span className="text-[10px] font-bold text-zinc-600">·</span>
              <span className="text-[10px] font-bold uppercase tracking-widest border border-white/10 rounded-full px-2 py-0.5 text-zinc-400">
                Key: {report.key_prefix}*** · Not stored · Not forwarded
              </span>
            </div>
            <h2 className={`text-5xl font-black tracking-tighter ${RISK_COLORS[report.risk_label]}`}>
              {report.risk_label} RISK
            </h2>
            <p className="text-sm text-zinc-400 max-w-md">
              We found <strong className="text-white">{report.total_pii_found} sensitive data fields</strong> across{" "}
              <strong className="text-white">{report.prompts_scanned} simulated employee prompts</strong> that would have
              been sent to OpenAI without any protection.
            </p>
          </div>

          {/* Risk meter */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="rotate-[-90deg] h-24 w-24">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2937" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={report.risk_label === "CRITICAL" ? "#ef4444" : report.risk_label === "HIGH" ? "#f97316" : "#eab308"}
                  strokeWidth="10"
                  strokeDasharray={`${(report.risk_score / 100) * 251.3} 251.3`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black ${RISK_COLORS[report.risk_label]}`}>{report.risk_score}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Risk Score</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/[0.06]">
          {[
            { label: "PII Fields Exposed",  value: report.total_pii_found.toString(), color: "text-red-400" },
            { label: "Prompts Analysed",    value: report.prompts_scanned.toString(), color: "text-white" },
            { label: "Regulations Breached", value: report.regulatory_exposure.length.toString(), color: "text-orange-400" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Prompt Results ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-white">Prompt-by-Prompt Exposure Report</h3>
        {report.results.map((result, i) => (
          <PromptResultCard key={result.prompt_id} result={result} index={i} />
        ))}
      </div>

      {/* ── Regulatory Exposure ──────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Regulatory Fine Exposure</h3>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <div className="grid grid-cols-4 bg-white/[0.03] border-b border-white/[0.07] text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-0">
            {["Framework", "Jurisdiction", "Max Penalty", "Basis"].map((h) => (
              <div key={h} className="px-5 py-4">{h}</div>
            ))}
          </div>
          {report.regulatory_exposure.map((fine, i) => (
            <div
              key={fine.framework}
              className={`grid grid-cols-4 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors ${
                i === report.regulatory_exposure.length - 1 ? "border-b-0" : ""
              }`}
            >
              <div className="px-5 py-4 text-sm font-bold text-white">{fine.framework}</div>
              <div className="px-5 py-4 text-xs text-zinc-400">{fine.jurisdiction}</div>
              <div className="px-5 py-4 text-sm font-bold text-red-400">{fine.max_fine}</div>
              <div className="px-5 py-4 text-xs text-zinc-500 leading-snug">{fine.basis}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-3 font-mono">
          * Fine estimates are illustrative and based on publicly available maximum regulatory penalties. Not legal advice.
        </p>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.05] overflow-hidden p-8 text-center flex flex-col items-center gap-6">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="text-4xl">🛡️</div>
          <h3 className="text-3xl font-bold text-white tracking-tight">
            Stop this. In <span className="text-emerald-400">5 minutes.</span>
          </h3>
          <p className="text-zinc-400 max-w-xl">
            Replace your AI endpoint with StreetMP OS. Every one of those{" "}
            <strong className="text-white">{report.total_pii_found} exposed fields</strong> would have been
            automatically masked before reaching any AI provider.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/deployment"
              className="group relative overflow-hidden inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-black transition-all hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)]"
            >
              <span className="relative z-10">Secure Your Traffic in 5 Minutes →</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Link>
            <Link
              href="/architecture"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/[0.07]"
            >
              View Architecture
            </Link>
          </div>
          {/* Security attestation */}
          <div className="flex items-center gap-2 text-xs text-zinc-600 mt-2">
            <span>✓</span>
            <span>key_retained: {String(report.key_retained)}</span>
            <span>·</span>
            <span>key_logged: {String(report.key_logged)}</span>
            <span>·</span>
            <span>key_forwarded: {String(report.key_forwarded)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const [apiKey,      setApiKey]      = useState("");
  const [industry,    setIndustry]    = useState<"finance" | "healthcare">("finance");
  const [scanning,    setScanning]    = useState(false);
  const [report,      setReport]      = useState<ScanReport | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [keyVisible,  setKeyVisible]  = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleScan = async () => {
    if (!apiKey.trim() || scanning) return;
    setScanning(true);
    setReport(null);
    setError(null);

    try {
      const res = await fetch(`${ROUTER_URL}/api/v1/public/scan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ apiKey: apiKey.trim(), industry }),
      });
      const json = await res.json() as { success: boolean; data?: ScanReport; error?: { message: string } };

      if (!json.success || !json.data) {
        setError(json.error?.message ?? "Scan failed. Please check your API key format.");
        return;
      }
      setReport(json.data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      setError("Cannot reach the scan engine. Please try again in a moment.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-rose-500/20">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-1.5 transition-transform hover:scale-[1.02]">
            <span className="text-2xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-2xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/deployment"   className="hover:text-white transition-colors">5-Min Deploy</Link>
            <Link href="/scan"         className="text-rose-400 font-semibold">Live Risk Scan</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login"    className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors px-3 py-2">Sign In</Link>
            <Link href="/register" className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              Get Protected
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero + Scanner Form ──────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-16 overflow-hidden">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/3 top-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-rose-600/[0.04] blur-[140px]" />
          <div className="absolute right-1/3 top-1/3 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl w-full flex flex-col items-center gap-8">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-2">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="text-xs font-bold text-rose-300 uppercase tracking-widest">
              Live Risk Scanner — Command 086
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter text-center leading-[1.04]">
            Are your employees{" "}
            <span className="text-rose-400">leaking company data</span>{" "}
            to AI?
          </h1>

          <p className="text-xl text-zinc-400 text-center leading-relaxed max-w-xl">
            Paste your OpenAI API key. We&apos;ll run 5 simulated employee prompts and show you
            exactly what sensitive data your unprotected setup is exposing —
            and how StreetMP OS would have blocked it.
          </p>

          {/* Trust badge */}
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-5 py-3">
            <span className="text-lg">🔒</span>
            <span className="text-sm font-semibold text-emerald-300">
              Keys are processed in memory and <strong>never stored, logged, or forwarded.</strong>
            </span>
          </div>

          {/* ── SCANNER FORM ──────────────────────────────────────────── */}
          <div className="w-full rounded-3xl border border-white/[0.08] bg-zinc-950/80 backdrop-blur-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                StreetMP OS — Risk Diagnostic Engine
              </span>
              <div />
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* API Key Input */}
              <div className="flex flex-col gap-2">
                <label htmlFor="apikey-input" className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  OpenAI API Key
                </label>
                <div className="relative">
                  <input
                    id="apikey-input"
                    type={keyVisible ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleScan(); }}
                    placeholder="sk-••••••••••••••••••••••••••••••••••••••••••••••"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pr-24 text-sm text-white placeholder-white/20 font-mono transition-all focus:outline-none focus:border-rose-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-rose-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setKeyVisible(!keyVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
                    aria-label={keyVisible ? "Hide API key" : "Show API key"}
                  >
                    {keyVisible ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Only sk-* format validated. Key is erased from memory after format check.
                </p>
              </div>

              {/* Industry Selector */}
              <div className="flex flex-col gap-2">
                <label htmlFor="industry-select" className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  Your Industry
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["finance", "healthcare"] as const).map((ind) => (
                    <button
                      key={ind}
                      id={`industry-${ind}`}
                      onClick={() => setIndustry(ind)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                        industry === ind
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      }`}
                    >
                      {ind === "finance" ? "🏦 Finance & Banking" : "🏥 Healthcare"}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Scan button */}
              <button
                id="run-scan-button"
                onClick={() => void handleScan()}
                disabled={scanning || !apiKey.trim()}
                className="w-full relative overflow-hidden rounded-2xl bg-rose-500 px-6 py-4 text-base font-bold text-white transition-all hover:bg-rose-400 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-[0_0_30px_rgba(244,63,94,0.2)] hover:shadow-[0_0_50px_rgba(244,63,94,0.4)]"
              >
                {scanning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Scanning…
                  </span>
                ) : (
                  "Expose My Data Leaks →"
                )}
              </button>

              {/* Security proof */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {["🔒 Key never stored", "🚫 No OpenAI call made", "🧹 Memory-only processing"].map((s) => (
                  <div key={s} className="text-center text-[10px] text-zinc-600 font-medium leading-tight">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What we test */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "💳", label: "Credit cards & SSNs",         detail: "PAN, CVV patterns exposed in prompts" },
              { icon: "🪪", label: "NRIC / MyKad / National IDs", detail: "APAC jurisdiction-specific patterns" },
              { icon: "📧", label: "Emails & Medical Records",    detail: "GDPR Art.4 & HIPAA §164.514 categories" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 flex flex-col gap-1.5">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm font-semibold text-zinc-300">{item.label}</p>
                <p className="text-xs text-zinc-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scan Results ────────────────────────────────────────────── */}
      {(scanning || report) && (
        <section ref={resultsRef} className="py-16 px-6 bg-[#080808] border-t border-white/[0.04]">
          <div className="mx-auto max-w-5xl">
            {scanning && !report ? (
              <ScanLoadingState />
            ) : report ? (
              <ScanResults report={report} />
            ) : null}
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">
            StreetMP <span className="text-emerald-400">OS</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/#architecture"  className="hover:text-white transition-colors">Platform</Link>
            <Link href="/architecture"   className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Architecture</Link>
            <Link href="/neutrality"     className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Vendor Neutrality</Link>
            <Link href="/deployment"     className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">5-Min Deployment</Link>
            <Link href="/scan"           className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Live Risk Scan</Link>
            <Link href="/login"          className="hover:text-white transition-colors">Console Login</Link>
            <Link href="/register"       className="hover:text-white transition-colors">Contact Sales</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
