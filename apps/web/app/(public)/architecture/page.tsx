/**
 * @file app/(public)/architecture/page.tsx
 * @description Command 082 — "The Agentless Guarantee" public marketing page.
 *
 * Route:  /architecture
 * Access: Public (no auth guard — sits inside the (public) route group).
 *         The middleware explicitly allows all non-/dashboard routes through.
 *
 * Design system: inherits globals.css + tailwind.config.js from the web app.
 *   - Palette: #0A0A0A bg, emerald-500 accent, zinc-* text hierarchy.
 *   - Font:    Inter (loaded globally).
 *   - Classes: .card, .btn-primary, .page-grid from globals.css.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

// ── SEO ─────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "100% Agentless AI Governance — Architecture | StreetMP OS",
  description:
    "Deploy enterprise-grade AI compliance across your entire network in 5 minutes by changing one API endpoint. No heavy agents. No device updates. Zero endpoint installs.",
  openGraph: {
    title: "100% Agentless AI Governance | StreetMP OS",
    description:
      "Zero endpoint installs. One API change. Full enterprise AI governance.",
    url: "https://os.streetmp.com/architecture",
    siteName: "StreetMP OS",
  },
};

// ── Data ─────────────────────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  {
    metric: "Deployment Time",
    streetmp: "5 Minutes",
    legacy: "6–12 Months",
    streetmpIcon: "⚡",
    legacyIcon: "🐢",
    win: true,
  },
  {
    metric: "Endpoint Install Required",
    streetmp: "None — Network Proxy",
    legacy: "Agent on Every Device",
    streetmpIcon: "✅",
    legacyIcon: "❌",
    win: true,
  },
  {
    metric: "Device Performance Impact",
    streetmp: "Zero (Out-of-Band)",
    legacy: "High (CPU / RAM Drain)",
    streetmpIcon: "✅",
    legacyIcon: "❌",
    win: true,
  },
  {
    metric: "Vendor Lock-in",
    streetmp: "None (BYOK + Model Agnostic)",
    legacy: "High (Hardware / Ecosystem)",
    streetmpIcon: "🔓",
    legacyIcon: "🔒",
    win: true,
  },
  {
    metric: "AI Model Coverage",
    streetmp: "Any Provider (OpenAI, Anthropic, Google…)",
    legacy: "Vendor-defined only",
    streetmpIcon: "🌐",
    legacyIcon: "⛓️",
    win: true,
  },
  {
    metric: "Cryptographic Audit Trail",
    streetmp: "V13 Merkle Ledger — Tamper-Proof",
    legacy: "Log files (mutable)",
    streetmpIcon: "🛡️",
    legacyIcon: "📁",
    win: true,
  },
  {
    metric: "PII Protection",
    streetmp: "ZK-Enclave tokenisation (never sent to AI)",
    legacy: "Policy-based (LLM still sees data)",
    streetmpIcon: "🔐",
    legacyIcon: "⚠️",
    win: true,
  },
];

const PIPELINE_STEPS = [
  {
    id: "01",
    label: "User App",
    detail: "Your existing app or employee tool. Change one endpoint — nothing else.",
    color: "border-zinc-700 bg-zinc-900/60",
    textColor: "text-zinc-300",
    glow: "",
    icon: "💻",
  },
  {
    id: "02",
    label: "StreetMP Proxy",
    detail: "V71 Firewall + NeMo Guardrails evaluate every prompt in < 5 ms.",
    color: "border-emerald-500/40 bg-emerald-950/40 ring-1 ring-emerald-500/20",
    textColor: "text-emerald-300",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    icon: "🛡️",
  },
  {
    id: "03",
    label: "V13 Audit Log",
    detail: "Every execution becomes an immutable Merkle leaf — one root hash for your CISO.",
    color: "border-emerald-500/30 bg-emerald-950/30",
    textColor: "text-emerald-400",
    glow: "",
    icon: "📋",
  },
  {
    id: "04",
    label: "AI Provider",
    detail: "Sanitised, policy-cleared prompt reaches OpenAI, Anthropic, or Google. Never raw data.",
    color: "border-zinc-700 bg-zinc-900/60",
    textColor: "text-zinc-300",
    glow: "",
    icon: "🧠",
  },
];

const TRUST_STATS = [
  { value: "< 5 min", label: "To Full Deployment" },
  { value: "0", label: "Endpoints to Install" },
  { value: "100%", label: "Tamper-Proof Audit" },
  { value: "< 50ms", label: "Latency Addition" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-emerald-500/30">

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-1.5 transition-transform hover:scale-[1.02]">
            <span className="text-2xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-2xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/#why-it-matters" className="hover:text-white transition-colors">Why It Matters</Link>
            <Link href="/architecture" className="text-white">Architecture</Link>
            <Link href="/deployment" className="hover:text-white transition-colors">5-Min Deploy</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 pt-32 pb-20 overflow-hidden">
        {/* Background grid + glow */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[900px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-6 animate-fade-in">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
              Command 082 — Agentless Guarantee
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05]">
            100% Agentless AI Governance.{" "}
            <span className="text-emerald-400">Zero Endpoint Installs.</span>
          </h1>

          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl font-medium">
            Deploy enterprise-grade compliance across your entire network in{" "}
            <strong className="text-white">5 minutes</strong> by changing one
            API endpoint. No heavy agents. No device updates. No CrowdStrike-style
            kernel drivers that take down your fleet.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            >
              Deploy in 5 Minutes →
            </Link>
            <a
              href="#comparison"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/[0.08]"
            >
              See the Proof
            </a>
          </div>
        </div>
      </section>

      {/* ── Trust Stats Bar ───────────────────────────────────────────── */}
      <div className="w-full border-t border-b border-white/[0.04] bg-white/[0.02] py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {TRUST_STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-2">
                <p className="text-4xl sm:text-5xl font-bold text-white tracking-tighter">{s.value}</p>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pipeline Flow Diagram ─────────────────────────────────────── */}
      <section className="relative py-28 px-6 bg-[#080808]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              One Proxy. Total Governance.
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              No kernel drivers. No agent installs. Your traffic routes through a
              cryptographic proxy at the network layer — invisible to end users,
              impenetrable to attackers.
            </p>
          </div>

          {/* Generated flow diagram */}
          <div className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-zinc-950/80 mb-12 shadow-2xl">
            <Image
              src="/architecture-flow.png"
              alt="StreetMP OS agentless pipeline: User App → StreetMP Proxy (V71 + NeMo) → PII Vault → V13 Audit Log → AI Provider"
              width={1200}
              height={500}
              className="w-full object-cover"
              priority
            />
          </div>

          {/* Step cards */}
          <div className="grid md:grid-cols-4 gap-5">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`relative rounded-2xl border ${step.color} ${step.glow} p-7 transition-all duration-300 hover:scale-[1.02]`}
              >
                {/* Connector arrow */}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#080808] text-emerald-500 text-sm font-bold">
                    →
                  </div>
                )}
                <div className="text-3xl mb-4">{step.icon}</div>
                <div className="text-[10px] font-black tracking-widest text-zinc-600 mb-2">
                  STEP {step.id}
                </div>
                <h3 className={`text-lg font-bold mb-2 ${step.textColor}`}>{step.label}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Matrix ─────────────────────────────────────────── */}
      <section id="comparison" className="relative py-28 px-6 bg-[#0A0A0A] border-t border-white/[0.04]">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.03] blur-[150px] rounded-full pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">
              Competitive Analysis
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              Agentless vs. Legacy Endpoint Security
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Every legacy endpoint agent is a kernel driver waiting to fail. StreetMP OS
              operates entirely out-of-band — no footprint on your devices.
            </p>
          </div>

          {/* Table header */}
          <div className="rounded-t-2xl border border-white/[0.08] overflow-hidden">
            <div className="grid grid-cols-3 bg-white/[0.03] border-b border-white/[0.08]">
              <div className="px-6 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Metric
              </div>
              <div className="px-6 py-5 text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                StreetMP OS
              </div>
              <div className="px-6 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500/70" />
                Legacy Endpoint Agents
              </div>
            </div>

            {/* Table rows */}
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row.metric}
                className={`grid grid-cols-3 border-b border-white/[0.05] transition-colors hover:bg-white/[0.02] ${
                  i === COMPARISON_ROWS.length - 1 ? "border-b-0" : ""
                }`}
              >
                <div className="px-6 py-5 flex items-center">
                  <span className="text-sm font-semibold text-zinc-300">{row.metric}</span>
                </div>
                <div className="px-6 py-5 flex items-center gap-3">
                  <span className="text-lg leading-none">{row.streetmpIcon}</span>
                  <span className="text-sm font-medium text-emerald-300">{row.streetmp}</span>
                </div>
                <div className="px-6 py-5 flex items-center gap-3">
                  <span className="text-lg leading-none">{row.legacyIcon}</span>
                  <span className="text-sm font-medium text-zinc-500">{row.legacy}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom caption */}
          <p className="text-center text-xs text-zinc-600 mt-6 font-mono">
            * Legacy agent comparison based on publicly documented CrowdStrike Falcon & similar endpoint security deployment requirements.
          </p>
        </div>
      </section>

      {/* ── Security Stack Deep Dive ──────────────────────────────────── */}
      <section className="py-28 px-6 bg-[#080808] border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">
              What Runs Inside the Proxy
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
              A Full Security Stack — No Agent Required
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "V71 Prompt Firewall",
                badge: "< 5ms",
                badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                desc: "Heuristic scoring engine with pre-compiled RegExp signatures. Detects and blocks adversarial injection, jailbreak attempts, and prompt-override attacks before they reach the LLM.",
                icon: "🔥",
                border: "border-emerald-500/20 hover:border-emerald-500/40",
              },
              {
                title: "NeMo Guardrails (V81)",
                badge: "Fail-Open",
                badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
                desc: "NVIDIA NeMo Guardrails as a secondary deep evaluation layer. Fail-open by design — if the sidecar is unreachable, the V71 Firewall continues protecting the pipeline.",
                icon: "🧬",
                border: "border-violet-500/20 hover:border-violet-500/40",
              },
              {
                title: "V13 Merkle Audit Ledger",
                badge: "Tamper-Proof",
                badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                desc: "Every execution produces a SHA-256 leaf in a per-tenant Merkle tree. CISOs receive a single daily root hash they can anchor to a blockchain or publish out-of-band for audit.",
                icon: "📊",
                border: "border-emerald-500/20 hover:border-emerald-500/40",
              },
              {
                title: "ZK-SNARK Execution Proof",
                badge: "V14",
                badgeColor: "bg-zinc-800 text-zinc-400 border-zinc-700",
                desc: "Each request generates a Groth16-compatible zero-knowledge proof binding the execution to the Merkle leaf and policy result — mathematical proof without revealing any content.",
                icon: "🔐",
                border: "border-zinc-800 hover:border-zinc-600",
              },
              {
                title: "PII Enclave Tokenisation",
                badge: "Nitro Enclave",
                badgeColor: "bg-zinc-800 text-zinc-400 border-zinc-700",
                desc: "PII never leaves your trust boundary. A Rust-based Nitro Enclave tokenises sensitive fields before dispatch to the LLM. The AI provider never sees real data.",
                icon: "🏛️",
                border: "border-zinc-800 hover:border-zinc-600",
              },
              {
                title: "Byzantine Consensus",
                badge: "V15",
                badgeColor: "bg-zinc-800 text-zinc-400 border-zinc-700",
                desc: "A multi-node enclave pool must reach 2/3 quorum agreement on the output hash before any response is trusted. A single compromised node cannot alter results.",
                icon: "⚖️",
                border: "border-zinc-800 hover:border-zinc-600",
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`rounded-2xl border ${item.border} bg-white/[0.02] p-7 transition-all duration-300 hover:bg-white/[0.04]`}
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-white/[0.04] bg-[#0A0A0A] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <span className="text-emerald-400 text-2xl">🛡️</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-white leading-tight">
            Deploy in 5 minutes.{" "}
            <span className="text-emerald-400">No agents.</span>
          </h2>
          <p className="text-xl text-zinc-400 font-medium max-w-2xl">
            Change one API endpoint. Get enterprise-grade AI governance, cryptographic audit
            trails, and zero-trust prompt firewalling — instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center w-full sm:w-auto">
            <Link
              href="/register"
              className="group relative overflow-hidden rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] w-full sm:w-auto"
            >
              <span className="relative z-10">Talk to an Architect →</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-5 text-lg font-bold text-white hover:bg-white/[0.06] transition-all w-full sm:w-auto"
            >
              Back to Platform Overview
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#080808]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tighter text-white">
              StreetMP <span className="text-emerald-400">OS</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/#architecture"    className="hover:text-white transition-colors">Platform</Link>
            <Link href="/#why-it-matters"  className="hover:text-white transition-colors">Philosophy</Link>
            <Link href="/architecture"     className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Architecture &amp; Agentless Proof</Link>
            <Link href="/neutrality"       className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Vendor Neutrality</Link>
            <Link href="/deployment"       className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">5-Min Deployment</Link>
            <Link href="/login"            className="hover:text-white transition-colors">Console Login</Link>
            <Link href="/register"         className="hover:text-white transition-colors">Contact Sales</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
