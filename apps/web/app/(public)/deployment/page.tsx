/**
 * @file app/(public)/deployment/page.tsx
 * @description Command 084 — "5-Minute Deployment Challenge" public page.
 *
 * Route:  /deployment
 * Access: Fully public — (public) route group, no auth guard.
 *
 * Architecture note: This is a React Server Component that imports
 * DeploymentDemo as a "use client" child for the interactive code blocks.
 * This preserves full Next.js metadata/SEO support while enabling clipboard API.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { DeploymentDemo } from "./_components/DeploymentDemo";

// ── SEO ─────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "5-Minute AI Security Deployment | StreetMP OS",
  description:
    "Change one line of code. Get enterprise-grade AI governance instantly. No 18-month hardware rollouts. No agents. No procurement cycles.",
  openGraph: {
    title: "Deploy Enterprise AI Security in 5 Minutes | StreetMP OS",
    description:
      "One API endpoint change. Full cryptographic AI governance. No waiting.",
    url: "https://os.streetmp.com/deployment",
    siteName: "StreetMP OS",
  },
};

// ── Timeline data ─────────────────────────────────────────────────────────────

const LEGACY_PHASES = [
  { label: "Procurement\n& RFP",  duration: "3 months",  icon: "📋", color: "border-red-500/30 bg-red-500/[0.05]",  textColor: "text-red-400" },
  { label: "Hardware\nShipping",  duration: "2 months",  icon: "🚢", color: "border-red-500/30 bg-red-500/[0.05]",  textColor: "text-red-400" },
  { label: "Data Centre\nInstall", duration: "3 months", icon: "🔧", color: "border-red-500/30 bg-red-500/[0.05]",  textColor: "text-red-400" },
  { label: "Agent\nRollout",      duration: "6 months",  icon: "💻", color: "border-red-500/30 bg-red-500/[0.05]",  textColor: "text-red-400" },
  { label: "Training\n& Tuning",  duration: "4 months",  icon: "📚", color: "border-red-500/30 bg-red-500/[0.05]",  textColor: "text-red-400" },
  { label: "Active",              duration: "Finally.",   icon: "⚠️", color: "border-orange-500/30 bg-orange-500/[0.05]", textColor: "text-orange-400" },
];

const STREETMP_PHASES = [
  { label: "Generate\nAPI Key",    duration: "1 min",     icon: "🔑", color: "border-emerald-500/30 bg-emerald-500/[0.08]", textColor: "text-emerald-400" },
  { label: "Update\nBase URL",    duration: "30 sec",    icon: "✏️", color: "border-emerald-500/30 bg-emerald-500/[0.08]", textColor: "text-emerald-400" },
  { label: "Add Tenant\nHeader",  duration: "30 sec",    icon: "🏷️", color: "border-emerald-500/30 bg-emerald-500/[0.08]", textColor: "text-emerald-400" },
  { label: "Active",              duration: "Instantly.", icon: "✅", color: "border-emerald-500/40 bg-emerald-500/15 ring-1 ring-emerald-500/30", textColor: "text-emerald-300" },
];

const STEPS = [
  {
    step: "01",
    icon: "🔑",
    title: "Generate Your Tenant Key",
    detail: "Log in to the StreetMP OS dashboard. Under API Keys, click Generate. Your key is scoped to your tenant with full RBAC policy enforcement — ready in under 60 seconds.",
    timeEstimate: "~60 seconds",
    color: "text-emerald-400",
  },
  {
    step: "02",
    icon: "✏️",
    title: "Replace Your Base URL",
    detail: "In your existing OpenAI, Anthropic, or Google SDK client, change a single string: your base URL from `api.openai.com/v1` to `api.streetmp.com/v1/proxy`. Your code stays identical.",
    timeEstimate: "~30 seconds",
    color: "text-emerald-400",
  },
  {
    step: "03",
    icon: "🏷️",
    title: "Add Your Tenant Header",
    detail: "Pass your `x-streetmp-key` in the request headers. This binds every request to your V12 Policy-as-Code rules, DLP engine, and V13 Merkle audit trail.",
    timeEstimate: "~30 seconds",
    color: "text-emerald-400",
  },
  {
    step: "04",
    icon: "🛡️",
    title: "Instantly Protected",
    detail: "Every prompt now passes through: V71 Prompt Firewall → NeMo Guard (V81) → PII Enclave Tokenisation → V13 Merkle Audit. Your CISO gets a tamper-proof root hash on day one.",
    timeEstimate: "Immediate",
    color: "text-emerald-300",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DeploymentPage() {
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
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/neutrality"   className="hover:text-white transition-colors">Neutrality</Link>
            <Link href="/deployment"   className="text-white">5-Min Deploy</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login"    className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors px-3 py-2">Sign In</Link>
            <Link href="/register" className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 pt-32 pb-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[1000px] rounded-full bg-emerald-500/[0.04] blur-[130px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-6 animate-fade-in">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
              Command 084 — The 5-Minute Deployment Challenge
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-[76px] font-bold tracking-tighter leading-[1.04]">
            From Vulnerable to{" "}
            <span className="text-emerald-400">Verifiable</span>{" "}
            in 5 Minutes.
          </h1>

          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl font-medium">
            Don't wait 18 months for a hardware rollout. Route your AI traffic through the
            StreetMP OS proxy by changing{" "}
            <strong className="text-white">a single line of code.</strong>
          </p>

          {/* Mini stats */}
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            {[
              { label: "Lines Changed",        value: "1" },
              { label: "Deployment Time",       value: "~5 min" },
              { label: "Endpoint Installs",     value: "Zero" },
              { label: "Compliance Frameworks", value: "SOC2 · HIPAA · ISO 27001" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-4">
                <span className="text-2xl font-black text-white tracking-tighter">{s.value}</span>
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <a href="#integration"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              See the Code Change →
            </a>
            <Link href="/register"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/[0.08]">
              Start Free — Get Your Key
            </Link>
          </div>
        </div>
      </section>

      {/* ── Timeline Comparison ───────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#080808] border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">
              The Real Cost of Waiting
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              18 months vs. 5 minutes.
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Every day your AI traffic runs unguarded is a compliance liability. Legacy
              hardware vendors bill you for the privilege of waiting.
            </p>
          </div>

          {/* Legacy timeline */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-widest">
                Legacy Endpoint Security — Total: ~18 Months
              </span>
            </div>
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute top-[38px] left-0 right-0 h-0.5 bg-red-500/20 z-0 hidden md:block" />
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 relative z-10">
                {LEGACY_PHASES.map((phase, i) => (
                  <div key={i} className={`rounded-xl border ${phase.color} p-4 flex flex-col items-center gap-2 text-center`}>
                    <span className="text-2xl">{phase.icon}</span>
                    <p className={`text-[11px] font-bold uppercase tracking-wide whitespace-pre-line ${phase.textColor}`}>
                      {phase.label}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900/60 rounded-full px-2 py-0.5">
                      {phase.duration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* StreetMP timeline */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                StreetMP OS — Total: 5 Minutes
              </span>
            </div>
            <div className="relative">
              <div className="absolute top-[38px] left-0 right-0 h-0.5 bg-emerald-500/20 z-0 hidden md:block" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                {STREETMP_PHASES.map((phase, i) => (
                  <div key={i} className={`rounded-xl border ${phase.color} p-4 flex flex-col items-center gap-2 text-center transition-all duration-300 hover:scale-[1.03]`}>
                    <span className="text-2xl">{phase.icon}</span>
                    <p className={`text-[11px] font-bold uppercase tracking-wide whitespace-pre-line ${phase.textColor}`}>
                      {phase.label}
                    </p>
                    <span className={`text-[10px] font-mono rounded-full px-2 py-0.5 ${
                      i === STREETMP_PHASES.length - 1
                        ? "text-emerald-300 bg-emerald-500/20"
                        : "text-zinc-400 bg-zinc-900/60"
                    }`}>
                      {phase.duration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Delta callout */}
          <div className="mt-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-white tracking-tighter">
                You save{" "}
                <span className="text-emerald-400">~17 months, 29 days, and 22+ hours</span>{" "}
                of deployment time.
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                That&apos;s 17 months of unguarded AI traffic your competitors don&apos;t have to worry about.
              </p>
            </div>
            <Link href="/register"
              className="shrink-0 rounded-2xl bg-emerald-500 px-7 py-4 text-sm font-bold text-black hover:bg-emerald-400 transition-all whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              Start Now →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Integration Demo ──────────────────────────────────────────── */}
      <section id="integration" className="py-24 px-6 bg-[#0A0A0A] border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">
              The Integration
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              One line of code. Full enterprise governance.
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Pick your language. Copy the snippet. You&apos;re protected.
            </p>
          </div>

          {/* Interactive client component */}
          <DeploymentDemo />
        </div>
      </section>

      {/* ── Step-by-Step Guide ────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#080808] border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">
              Step by Step
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
              The full 5-minute walkthrough
            </h2>
          </div>

          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[27px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent hidden md:block" />

            <div className="flex flex-col gap-6">
              {STEPS.map((s, i) => (
                <div
                  key={s.step}
                  className={`relative flex gap-6 rounded-2xl border p-7 transition-all duration-300 hover:scale-[1.005] ${
                    i === STEPS.length - 1
                      ? "border-emerald-500/30 bg-emerald-500/[0.06] shadow-[0_0_30px_rgba(16,185,129,0.08)]"
                      : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Step number */}
                  <div className="shrink-0 relative z-10">
                    <div className={`h-14 w-14 rounded-2xl border flex items-center justify-center text-xl ${
                      i === STEPS.length - 1
                        ? "border-emerald-500/40 bg-emerald-500/15"
                        : "border-white/[0.08] bg-white/[0.03]"
                    }`}>
                      {s.icon}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                        Step {s.step}
                      </span>
                      <span className={`inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.color}`}>
                        {s.timeEstimate}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What You Get Instantly ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#0A0A0A] border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">
              What You Get
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              Day one. Not Month 18.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "🔥", title: "V71 Prompt Firewall",        badge: "< 5ms",          desc: "Blocks jailbreaks and injection attempts before they reach any AI model."            },
              { icon: "🧬", title: "NeMo Guardrails",            badge: "V81 · Fail-Open", desc: "NVIDIA NeMo secondary deep evaluation. Fail-open so no downtime." },
              { icon: "📋", title: "V13 Merkle Audit Ledger",    badge: "Tamper-Proof",    desc: "Every request generates a cryptographic leaf. One root hash for your CISO."         },
              { icon: "🔐", title: "PII Enclave Tokenisation",   badge: "Nitro Enclave",   desc: "Your raw data never reaches the AI provider. Tokenised before dispatch."             },
              { icon: "📊", title: "ZK-SNARK Execution Proof",   badge: "V14",             desc: "Mathematical proof of policy compliance attached to every response."                 },
              { icon: "🌐", title: "Model & Cloud Agnostic",     badge: "Any Provider",    desc: "OpenAI, Anthropic, Google, Mistral, or your own local LLM — zero lock-in."          },
            ].map((item) => (
              <div key={item.title} className="card rounded-2xl border border-white/[0.07] hover:border-white/[0.12] bg-white/[0.02] p-6 flex flex-col gap-4 transition-all duration-300 hover:bg-white/[0.04]">
                <div className="text-3xl">{item.icon}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">{item.title}</h3>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    {item.badge}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-white/[0.04] bg-[#080808] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-emerald-600/[0.07] blur-[140px] rounded-full pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <span className="text-emerald-400 text-2xl">⚡</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-white leading-tight">
            5 minutes to protected.{" "}
            <span className="text-emerald-400">Zero excuses.</span>
          </h2>
          <p className="text-xl text-zinc-400 font-medium max-w-2xl">
            Your API key is ready the moment you sign up. No sales call required to start.
            Full enterprise contracts available for SOC2-regulated environments.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center w-full sm:w-auto">
            <Link
              href="/register"
              className="group relative overflow-hidden rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] w-full sm:w-auto"
            >
              <span className="relative z-10">Generate Your Key — Free →</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Link>
            <Link
              href="/architecture"
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-5 text-lg font-bold text-white hover:bg-white/[0.06] transition-all w-full sm:w-auto"
            >
              View Agentless Architecture
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">
            StreetMP <span className="text-emerald-400">OS</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/#architecture"  className="hover:text-white transition-colors">Platform</Link>
            <Link href="/architecture"   className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Architecture & Agentless Proof</Link>
            <Link href="/neutrality"     className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Vendor Neutrality</Link>
            <Link href="/deployment"     className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">5-Min Deployment</Link>
            <Link href="/login"          className="hover:text-white transition-colors">Console Login</Link>
            <Link href="/register"       className="hover:text-white transition-colors">Contact Sales</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
