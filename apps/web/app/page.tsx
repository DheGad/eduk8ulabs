"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrustLogos } from "../components/TrustLogos";
import { EnterpriseFAQ } from "../components/EnterpriseFAQ";
import { PricingGrid } from "../components/PricingGrid";
import { FloatingChatbot } from "../components/FloatingChatbot";

// ================================================================
// ENTERPRISE AI GATEWAY DEMO (Formerly Glass Box)
// ================================================================

const DEMO_SCHEMA = ["resume_score", "verdict", "confidence", "red_flags"];

const DEMO_STAGES = [
  { label: "Policy Routing", desc: "Verifying compliance rules...", icon: "🛡️", color: "text-zinc-400" },
  { label: "Data Sanitization", desc: "Masking sensitive PII...", icon: "🔒", color: "text-zinc-400" },
  { label: "AI Execution", desc: "Generating insights...", icon: "🧠", color: "text-zinc-200" },
  { label: "Cleared", desc: "Zero Data Leakage.", icon: "✅", color: "text-emerald-400" },
];

const DEMO_OUTPUT = {
  resume_score: 87,
  verdict: "Strong candidate — interview recommended",
  confidence: 0.94,
  red_flags: ["Employment gap 2021–2022"],
};

function EnterpriseGatewayDemo() {
  const [stage, setStage] = useState(-1);
  const [running, setRunning] = useState(false);
  const [schemaKeys, setSchemaKeys] = useState<string[]>([]);

  const runDemo = async () => {
    if (running) return;
    setRunning(true);
    setStage(-1);
    setSchemaKeys([]);

    for (let i = 0; i < DEMO_STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, i === 2 ? 1100 : 700));
    }

    // Reveal schema keys one by one
    for (let i = 0; i < DEMO_SCHEMA.length; i++) {
      await new Promise((r) => setTimeout(r, 150));
      setSchemaKeys((prev) => [...prev, DEMO_SCHEMA[i]!]);
    }

    setRunning(false);
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-zinc-950/80 backdrop-blur-2xl shadow-[0_0_80px_rgba(16,185,129,0.05)] overflow-hidden transition-all duration-500">
      {/* Sleek Header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </div>
          <span className="text-xs font-semibold text-zinc-300 tracking-wide">Enterprise Proxy: Active</span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
          Latency: 14ms
        </div>
      </div>

      <div className="p-8 flex flex-col gap-8">
        {/* Input prompt */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">Employee Input</p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 text-[15px] text-zinc-200 leading-relaxed shadow-inner">
            "Score this resume and provide a hiring verdict with confidence level."
          </div>
        </div>

        {/* Stage pipeline */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DEMO_STAGES.map((s, i) => (
            <div key={s.label} className="flex flex-col gap-2">
              <div className={`text-xl transition-all duration-500 ${stage >= i ? "opacity-100 scale-100" : "opacity-40 scale-95 grayscale"}`}>
                <span className={stage === i && running ? "animate-pulse" : ""}>{s.icon}</span>
              </div>
              <div>
                <p className={`text-xs font-semibold ${stage >= i ? s.color : "text-zinc-600"} transition-colors duration-300`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Output */}
        <div className={`transition-all duration-700 h-[140px] ${stage === 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">Sanitized Output</p>
          <pre className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4 text-sm font-mono text-emerald-400 overflow-auto leading-relaxed shadow-[0_0_30px_rgba(16,185,129,0.05)_inset]">
            {JSON.stringify(DEMO_OUTPUT, null, 2)}
          </pre>
        </div>

        {/* CTA */}
        <button
          onClick={runDemo}
          disabled={running}
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-white px-6 py-4 text-sm font-bold text-black transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg"
        >
          {running ? "Processing Request..." : stage === 3 ? "Process Another Request" : "Simulate Employee Request"}
        </button>
      </div>
    </div>
  );
}

// ================================================================
// STATS TICKER
// ================================================================

const STATS = [
  { value: "0%", label: "Data Retained by AI" },
  { value: "SOC2", label: "Enterprise Compliance" },
  { value: "100%", label: "Tamper-Proof Audit" },
  { value: "< 50ms", label: "Latency Impact" },
];

// ================================================================
// LANDING PAGE
// ================================================================

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-emerald-500/30">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          {/* Logo - Text Only, Highly Attractive */}
          <Link href="/" className="group flex items-center gap-1.5 transition-transform hover:scale-[1.02]">
            <span className="text-2xl font-black tracking-tighter text-white">
              StreetMP
            </span>
            <span className="text-2xl font-medium tracking-tighter text-emerald-400">
              OS
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="#why-it-matters" className="hover:text-white transition-colors">Why It Matters</Link>
            <Link href="#architecture"   className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/stp"            className="hover:text-white transition-colors">STP Protocol</Link>
            <Link href="/developers"     className="hover:text-white transition-colors font-semibold text-violet-400 hover:text-violet-300">Developer SDK</Link>
            {/* Pricing pill — right next to Risk Scan for maximum visibility */}
            <Link
              href="#pricing"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/60 hover:text-emerald-200 hover:shadow-[0_0_16px_rgba(16,185,129,0.25)] transition-all font-semibold"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Pricing
            </Link>
            <Link href="/scan" className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-rose-300 hover:bg-rose-500/20 transition-all font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              Free AI Audit
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors px-3 py-2 cursor-pointer">
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

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-32 pb-16 overflow-hidden">
        {/* Subtle mesh background grid */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 h-[600px] w-[1000px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl w-full grid lg:grid-cols-2 gap-16 items-center">
          {/* Left column: copy */}
          <div className={`flex flex-col gap-8 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <h1 className="text-5xl sm:text-7xl lg:text-[84px] font-bold leading-[1.05] tracking-tighter">
              AI Power. <br/>
              <span className="text-emerald-400 inline-block mt-2">Zero Risk.</span>
            </h1>

            <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-[560px] font-medium">
              Empower your employees to use the world's most intelligent AI models without exposing your company’s private data. We build a cryptographic shield around your business so you can innovate fearlessly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-zinc-200 hover:scale-[1.02] shadow-xl"
              >
                Talk to an Expert
              </Link>
              <Link
                href="#demo"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/[0.08]"
              >
                See How It Works
              </Link>
            </div>

            {/* Trust Strip */}
            <div className="mt-8 flex flex-col gap-4 pt-8 border-t border-white/10">
              <p className="text-sm font-semibold text-zinc-500 tracking-wide">
                TRUSTED BY THE WORLD'S MOST SECURE ORGANIZATIONS
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 items-center flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Healthcare
                </span>
                <span className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 items-center flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Finance & Banking
                </span>
                <span className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 items-center flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Enterprise SaaS
                </span>
              </div>
            </div>
          </div>

          {/* Right column: Sleek Demo */}
          <div id="demo" className={`transition-all duration-1000 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <EnterpriseGatewayDemo />
          </div>
        </div>
      </section>

      {/* ── Trust Logo Bar ───────────────────────────────────────── */}
      <TrustLogos />

      {/* ── Enterprise Compliance Banner (V52 Polish) ─────────────── */}
      <div className="w-full border-t border-b border-white/[0.04] bg-white/[0.02] py-8 overflow-hidden flex flex-col items-center relative z-20">
        <div className="mx-auto max-w-7xl px-6 w-full flex flex-col md:flex-row items-center justify-center lg:justify-between gap-6">
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] whitespace-nowrap">
            Independently Verified
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-12">
            {[
              "SOC2 Type II Ready", 
              "HIPAA Compliant", 
              "ISO 27001 Certified Environment", 
              "FIPS 140-3 Encryption"
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                <span className="text-sm font-semibold text-white tracking-wide whitespace-nowrap">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Why The World Needs This ────────────────────────────── */}
      <section id="why-it-matters" className="relative py-20 lg:py-32 px-6 bg-[#080808]">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full" />
              <div className="relative rounded-3xl border border-white/[0.08] bg-zinc-950/80 p-10 shadow-2xl">
                <div className="flex flex-col gap-6">
                   <div className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                     <span className="text-2xl mt-1">❌</span>
                     <div>
                       <h3 className="text-white font-bold mb-1">The Old Way</h3>
                       <p className="text-zinc-400 text-sm leading-relaxed">Employees paste sensitive company data into public AI chat windows. Data leaves your corporate boundary forever, training future competitor models.</p>
                     </div>
                   </div>
                   <div className="flex flex-col items-center justify-center my-2">
                     <div className="w-px h-8 bg-white/10"></div>
                     <span className="text-zinc-600 text-xs font-bold uppercase tracking-widest my-2">SOLUTION</span>
                     <div className="w-px h-8 bg-white/10"></div>
                   </div>
                   <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                     <span className="text-2xl mt-1">✅</span>
                     <div>
                       <h3 className="text-white font-bold mb-1">The StreetMP OS Way</h3>
                       <p className="text-emerald-100 text-sm leading-relaxed">Traffic routes through a secure mathematical vault. Sensitive data is tokenized. You retain 100% intellectual property ownership.</p>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-6 leading-tight">
                The biggest barrier to AI adoption is <span className="text-emerald-400">Trust.</span>
              </h2>
              <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed mb-8">
                Your proprietary data is your most valuable asset. But sending it to public AI models exposes you to data leaks, compliance violations, and intellectual property theft.
              </p>
              
              <div className="flex flex-col gap-6">
                {[
                  { title: "Defend your Intellectual Property", desc: "We guarantee that your data is never used to train global AI models." },
                  { title: "Empower your Workforce", desc: "Give your team the power of ChatGPT without compromising security or writing custom software." },
                  { title: "Mathematical Certainty", desc: "We don't just ask AI not to peek. We mathematically prevent it using Post-Quantum cryptography and Zero-Knowledge proofs." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <span className="text-emerald-500 font-bold">✓</span>
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg mb-1">{item.title}</h4>
                      <p className="text-zinc-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture (How It Works) ─────────────────────────── */}
      <section id="architecture" className="relative py-20 lg:py-32 px-6 border-t border-white/[0.04] bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16 lg:mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              How the Shield Works
            </h2>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
              A transparent, zero-trust pipeline that protects your data at every millisecond of execution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Intercept & Protect",
                desc: "We intercept employee AI requests and wrap them in a hardware-level cryptographic enclave.",
                color: "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                num: "text-zinc-500",
              },
              {
                step: "02",
                title: "Enforce Policy",
                desc: "Our engine checks your company rules: e.g., 'No financial data allowed' or 'Route patient data to healthcare-safe servers only'.",
                color: "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                num: "text-zinc-500",
              },
              {
                step: "03",
                title: "Cognitive Firewall",
                desc: "AI outputs are scanned in real-time to prevent hallucinations, malicious code, or accidental internal data leaks.",
                color: "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                num: "text-zinc-500",
              },
              {
                step: "04",
                title: "Auditable Proof",
                desc: "We generate a cryptographic receipt proving exact compliance. Perfect for your compliance and legal teams.",
                color: "border-emerald-500/20 bg-emerald-500/10 ring-1 ring-emerald-500/30",
                num: "text-emerald-500",
              },
            ].map((item, i) => (
              <div key={item.step} className={`rounded-3xl border ${item.color} p-8 relative transition-all duration-300`}>
                <div className={`text-sm font-black tracking-widest ${item.num} mb-6`}>
                  STEP {item.step}
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-zinc-500 z-10 w-8 h-8 bg-[#0A0A0A] rounded-full flex items-center justify-center border border-white/10">→</div>
                )}
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-zinc-400 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
          
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-20 mt-10 border-t border-white/10">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-2 items-center text-center">
                <p className="text-4xl sm:text-5xl font-bold text-white tracking-tighter">{s.value}</p>
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why StreetMP? — 4 Pillars ─────────────────────────── */}
      <section className="relative py-20 lg:py-32 px-6 border-t border-white/[0.04] bg-[#070707]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16 lg:mb-20">
            <p className="text-xs font-bold text-emerald-500 tracking-[0.3em] uppercase mb-4">The Foundation</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">Why StreetMP?</h2>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">Four engineering pillars that no other AI platform can match.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "🛡️",
                title: "PII Shield",
                desc: "Real-time redaction of 50+ data types including names, IDs, financials, and medical records — before a single token leaves your boundary.",
                glow: "rgba(16,185,129,0.12)",
                border: "border-emerald-500/20",
              },
              {
                icon: "🔏",
                title: "Trust Engine",
                desc: "Cryptographic verification of every AI interaction. Every prompt, every response — signed, timestamped, and tamper-evident.",
                glow: "rgba(99,102,241,0.12)",
                border: "border-indigo-500/20",
              },
              {
                icon: "📋",
                title: "Compliance Vault",
                desc: "Downloadable PDF & JSON audit reports with Merkle-chain proofs. Satisfies GDPR, PDPA, HIPAA, and SOC2 auditors in minutes.",
                glow: "rgba(245,158,11,0.08)",
                border: "border-amber-500/20",
              },
              {
                icon: "⚡",
                title: "Sovereign Proxy",
                desc: "Your data never touches public LLM training pipelines. Runs in your private cloud or our isolated sovereign enclave.",
                glow: "rgba(16,185,129,0.08)",
                border: "border-emerald-500/15",
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className={`group relative rounded-3xl border ${pillar.border} bg-zinc-950/60 backdrop-blur-xl p-8 flex flex-col gap-5 hover:scale-[1.02] transition-all duration-300`}
                style={{ boxShadow: `0 0 60px ${pillar.glow}` }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-2xl">
                  {pillar.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{pillar.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <PricingGrid />

      {/* ── Enterprise FAQ ───────────────────────────────────────── */}
      <EnterpriseFAQ />

      {/* ── Massive Attractive CTA ──────────────────────────────── */}
      <section className="py-20 lg:py-32 px-6 border-t border-white/[0.04] bg-[#0A0A0A] relative overflow-hidden">
        {/* Massive ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-emerald-600/10 blur-[150px] rounded-full point-events-none" />
        
        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 mb-2">
            <span className="text-emerald-400 text-2xl">🛡️</span>
          </div>
          <h2 className="text-4xl md:text-7xl font-bold tracking-tighter text-white leading-tight">
            Secure your Enterprise AI today.
          </h2>
          <p className="text-xl text-zinc-400 font-medium max-w-2xl">
            Join the world's most secure organizations. Deploy cognitive governance and zero-trust routing across your entire enterprise in under 15 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center mt-6 w-full sm:w-auto">
            <Link
              href="/register"
              className="group relative overflow-hidden rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] w-full sm:w-auto"
            >
              <span className="relative z-10">Contact Enterprise Sales →</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-5 text-lg font-bold text-white hover:bg-white/[0.06] transition-all w-full sm:w-auto"
            >
              Read the Whitepaper
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#080808]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tighter text-white">
              StreetMP <span className="text-emerald-400">OS</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="#architecture"   className="hover:text-white transition-colors">Platform</Link>
            <Link href="#why-it-matters" className="hover:text-white transition-colors">Philosophy</Link>
            <Link href="/sdk"            className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">SDK Docs</Link>
            <Link href="/stp"            className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Open Standard</Link>
            <Link href="/verify"         className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Verify Certificate</Link>
            <Link href="/architecture"   className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Architecture &amp; Agentless Proof</Link>
            <Link href="/legal"          className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Legal &amp; Liability Shield</Link>
            <Link href="/neutrality"     className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Vendor Neutrality</Link>
            <Link href="/deploy-fast"    className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">5-Min Deployment</Link>
            <Link href="/scan"           className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Live Risk Scan</Link>
            <Link href="/login"          className="hover:text-white transition-colors">Console Login</Link>
            <Link href="/register"       className="hover:text-white transition-colors">Contact Sales</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>

      <FloatingChatbot />
    </div>
  );
}
