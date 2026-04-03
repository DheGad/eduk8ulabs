"use client";

/**
 * @file app/(public)/deploy-fast/page.tsx
 * @description Command 084 — 5-Minute Deployment Timer
 *
 * Route:  /deploy-fast
 * Access: Fully public — no auth required.
 *
 * Objective: Prove StreetMP OS can be integrated into an existing
 * enterprise architecture in under 5 minutes, directly attacking
 * legacy security deployment timelines.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Play, Pause, Copy, Check, Clock, Zap, Terminal, Eye } from "lucide-react";

// ─── Mock Trace Event Log ─────────────────────────────────────────────────────

const TRACE_EVENTS = [
  { id: "V70-001", label: "POLICY_ROUTING",      time: "+0ms",   status: "ok",    detail: "Tenant resolved: jpmc-global" },
  { id: "V70-002", label: "PII_SCAN",             time: "+3ms",   status: "ok",    detail: "0 sensitive tokens flagged" },
  { id: "V70-003", label: "FIREWALL_PASS",        time: "+5ms",   status: "ok",    detail: "Prompt safety score: 98/100" },
  { id: "V70-004", label: "AI_EXECUTION",         time: "+14ms",  status: "ok",    detail: "Provider: openai / gpt-4o" },
  { id: "V70-005", label: "RESPONSE_SCAN",        time: "+28ms",  status: "ok",    detail: "Output scrubbed — 0 leaks" },
  { id: "V70-006", label: "MERKLE_ANCHORED",      time: "+29ms",  status: "ok",    detail: "Leaf hash committed to vault" },
  { id: "V70-007", label: "CERT_ISSUED",          time: "+30ms",  status: "final", detail: "STP Certificate: exec_a3f8c2…" },
];

// ─── Code Snippet ─────────────────────────────────────────────────────────────

const CODE_BEFORE = `const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});`;

const CODE_AFTER = `const openai = new OpenAI({
  apiKey: process.env.STREETMP_API_KEY,
  baseURL: "https://api.streetmp.com/v1",
});`;

// ─── Sub-Components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all"
      title="Copy"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function TraceTimeline({ active }: { active: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (active) {
      setVisibleCount(0);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setVisibleCount(i);
        if (i >= TRACE_EVENTS.length) clearInterval(interval);
      }, 280);
      return () => clearInterval(interval);
    } else {
      setVisibleCount(0);
    }
  }, [active]);

  return (
    <div className="flex flex-col gap-2 p-4 bg-black/80 rounded-xl border border-white/5 min-h-[240px] font-mono text-xs overflow-hidden">
      <div className="text-zinc-600 mb-2 uppercase tracking-widest text-[10px]">V70 Trace Stream — Live</div>
      {TRACE_EVENTS.slice(0, visibleCount).map((ev, i) => (
        <div
          key={ev.id}
          className={`flex items-center gap-3 transition-all duration-300 ${
            ev.status === "final" ? "text-emerald-400" : "text-zinc-300"
          }`}
          style={{ animationDelay: `${i * 280}ms` }}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              ev.status === "final"
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                : "bg-emerald-500/60"
            }`}
          />
          <span className="text-zinc-600 w-16 shrink-0">{ev.time}</span>
          <span className={`font-bold w-28 shrink-0 ${ev.status === "final" ? "text-emerald-400" : "text-emerald-300"}`}>
            {ev.label}
          </span>
          <span className="text-zinc-500 truncate">{ev.detail}</span>
        </div>
      ))}
      {visibleCount < TRACE_EVENTS.length && active && (
        <div className="flex items-center gap-2 text-zinc-600 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
          <span>waiting...</span>
        </div>
      )}
      {visibleCount === 0 && !active && (
        <div className="flex-1 flex items-center justify-center text-zinc-700">
          Run a request to see the trace stream →
        </div>
      )}
    </div>
  );
}

function VideoPlayerMock() {
  const [playing, setPlaying] = useState(false);
  const [tracePlaying, setTracePlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(270); // 4:30 in seconds
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      setTracePlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setPlaying(true);
      setTracePlaying(true);
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setPlaying(false);
            setTracePlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 270;
          }
          return t - 1;
        });
      }, 1000);
    }
  };

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="space-y-4">
      {/* Mock Video Window */}
      <div
        className={`relative rounded-3xl overflow-hidden border-2 cursor-pointer transition-all duration-300 ${
          playing
            ? "border-emerald-500/50 shadow-[0_0_80px_rgba(16,185,129,0.2)]"
            : "border-white/10 hover:border-white/20"
        } bg-[#030303] aspect-video flex items-center justify-center`}
        onClick={togglePlay}
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Screen content mock */}
        <div className="absolute inset-0 flex flex-col p-6">
          {/* Mock toolbar */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            <div className="flex-1 bg-white/5 h-5 rounded-lg ml-2" />
          </div>
          {/* Mock blurred screen content */}
          <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col gap-3">
            <div className="h-3 w-2/3 bg-emerald-500/10 rounded-full" />
            <div className="h-3 w-1/2 bg-white/5 rounded-full" />
            <div className="h-3 w-3/4 bg-white/5 rounded-full" />
            <div className="h-3 w-1/3 bg-white/5 rounded-full" />
          </div>
        </div>

        {/* Central overlay */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          {/* Giant timer */}
          <div className="text-center">
            <div className={`text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter tabular-nums transition-colors ${
              playing ? "text-emerald-400" : "text-white/80"
            }`}>
              {minutes}:{seconds}
            </div>
            <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest mt-1">
              Time to deploy
            </p>
          </div>

          {/* Play button */}
          <button
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-200 ${
              playing
                ? "bg-zinc-800 text-white hover:bg-zinc-700"
                : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.35)] hover:scale-105"
            }`}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          >
            {playing ? (
              <><Pause className="w-5 h-5" /> Pause Demo</>
            ) : (
              <><Play className="w-5 h-5 ml-0.5" /> Play Deployment Demo</>
            )}
          </button>
        </div>
      </div>

      {/* Live trace beneath video */}
      <TraceTimeline active={tracePlaying} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeployFastPage() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/neutrality"   className="hover:text-white transition-colors">Vendor Neutrality</Link>
            <Link href="/verify"       className="hover:text-white transition-colors">Verify Certificate</Link>
            <Link href="/deploy-fast"  className="text-white font-semibold">5-Min Deploy</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 font-semibold">Risk Scanner</Link>
          </div>
          <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">
            Get API Access
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-16 px-6 overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-6">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-2">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
              Command 084 — Deployment Speed Challenge
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-none text-white">
            Deploy Enterprise AI Security<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500">
              in&nbsp;5&nbsp;Minutes.
            </span>
          </h1>

          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl font-medium">
            No agents. No hardware. No 18-month IT rollouts.<br />
            <span className="text-white font-semibold">Change one API URL and your entire network is compliant.</span>
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              30-second integration
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Zero infrastructure changes
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              Full audit trail from minute one
            </div>
          </div>
        </div>
      </section>

      {/* ── Video / Timer Section ────────────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <VideoPlayerMock />
        </div>
      </section>

      {/* ── 3-Step Integration Guide ─────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-[#060606] border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
              Three steps. Under five minutes.
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              StreetMP OS is a drop-in proxy — not a complete infrastructure overhaul.
            </p>
          </div>

          {/* Step tabs */}
          <div className="flex gap-2 justify-center mb-12">
            {([1, 2, 3] as const).map((step) => (
              <button
                key={step}
                onClick={() => setActiveStep(step)}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeStep === step
                    ? "bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                    : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                Step {step}
              </button>
            ))}
          </div>

          {/* Step 1: Generate API Key */}
          {activeStep === 1 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 overflow-hidden animate-in fade-in duration-300">
              {/* Mock browser bar */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] bg-white/[0.015]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex-1 bg-white/[0.04] px-4 py-1.5 rounded-lg text-xs text-zinc-500 font-mono">
                  https://console.streetmp.com/admin/api-keys
                </div>
              </div>

              <div className="p-8 md:p-12">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-8">Step 1 — Generate API Key</p>

                {/* Mocked API Key Panel */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-6 rounded-2xl border border-white/10 bg-white/[0.02] mb-6">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Production Key — jpmc-global</p>
                    <p className="text-xs text-zinc-500">sk-svm-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</p>
                  </div>
                  <button className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 transition-all shadow-lg">
                    + Generate New Key
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    { key: "sk-svm-a3f8c2d1-e94b-7056-fe3a-812c490d67b2", label: "Production Key", created: "Today, 03:41 AM", perms: "execute:llm, audit:read" },
                    { key: "sk-svm-b7c1d9e2-f05a-8167-gf4b-923d501e78c3", label: "Staging Key",    created: "Mar 28, 2026",    perms: "execute:llm" },
                  ].map((k) => (
                    <div key={k.key} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.04] transition-colors">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{k.label}</p>
                        <p className="text-xs font-mono text-zinc-600 truncate">{k.key}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">Permissions: {k.perms}</p>
                      </div>
                      <span className="text-[11px] text-zinc-600 shrink-0">{k.created}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Change Endpoint */}
          {activeStep === 2 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 overflow-hidden animate-in fade-in duration-300">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] bg-white/[0.015]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-xs font-mono text-zinc-600">src/services/openaiClient.ts</span>
              </div>
              <div className="p-8 md:p-12 flex flex-col gap-6">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Step 2 — Change One URL</p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Before */}
                  <div>
                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500/20 inline-flex items-center justify-center text-red-400">–</span>
                      Before
                    </p>
                    <div className="relative rounded-xl bg-red-500/[0.04] border border-red-500/20 p-4">
                      <pre className="text-sm font-mono text-red-300/70 whitespace-pre-wrap leading-relaxed">{CODE_BEFORE}</pre>
                    </div>
                  </div>

                  {/* After */}
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 inline-flex items-center justify-center text-emerald-400">+</span>
                      After — Secure
                    </p>
                    <div className="relative rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-4">
                      <CopyButton text={CODE_AFTER} />
                      <pre className="text-sm font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed pr-10">{CODE_AFTER}</pre>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-blue-500/[0.05] border border-blue-500/20 text-sm text-blue-300 leading-relaxed">
                  <strong className="text-blue-200">That's it.</strong> Every existing OpenAI API call in your codebase is now routed through the StreetMP Zero-Knowledge proxy. No code changes beyond the <code className="font-mono text-blue-400 text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">baseURL</code> override.
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Watch the Logs */}
          {activeStep === 3 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 overflow-hidden animate-in fade-in duration-300">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] bg-white/[0.015]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-xs font-mono text-zinc-600">console.streetmp.com/trace — V70 Timeline</span>
              </div>
              <div className="p-8 md:p-12 flex flex-col gap-6">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Step 3 — Watch the Audit Trail Light Up Green</p>

                {/* Live trace demo */}
                <TraceTimeline active={true} key={`trace-step3-${Date.now()}`} />

                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: "Total Latency", value: "30ms",  color: "text-emerald-400" },
                    { label: "ZK Compliance", value: "100%",  color: "text-emerald-400" },
                    { label: "Data Retained", value: "0 bytes", color: "text-emerald-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
                      <p className={`text-2xl font-black ${stat.color} tracking-tighter`}>{stat.value}</p>
                      <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-white/[0.04] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.06] blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-3xl text-center flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
            <Clock className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
            Your 5-minute clock starts now.
          </h2>
          <p className="text-lg text-zinc-400 max-w-xl">
            Join enterprise teams who stopped waiting for legacy security teams and deployed in an afternoon.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/register">
              <button className="rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                Start Free — Deploy in 5 Min →
              </button>
            </Link>
            <Link href="/verify">
              <button className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-5 text-lg font-bold text-white hover:bg-white/[0.06] transition-all">
                Verify a Certificate
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#080808]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">StreetMP <span className="text-emerald-400">OS</span></span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/stp"         className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Specification</Link>
            <Link href="/verify"      className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Verify Certificate</Link>
            <Link href="/neutrality"  className="hover:text-white transition-colors">Vendor Neutrality</Link>
            <Link href="/deploy-fast" className="text-white font-semibold">5-Min Deploy</Link>
            <Link href="/scan"        className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Risk Scanner</Link>
            <Link href="/login"       className="hover:text-white transition-colors">Console Login</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
