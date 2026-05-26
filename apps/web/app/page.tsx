"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
// Imports removed due to missing components
import { NemoClawHighlight } from "./components/NemoClawHighlight";
import { CinematicRuntimeTheater } from "./components/CinematicRuntimeTheater";
import {
  Menu,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Zap,
  CheckCircle2,
  BarChart3,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// EnterpriseGatewayDemo replaced by CinematicRuntimeTheater (imported above)

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
// AEO / FAQ KNOWLEDGE GRAPH COMPONENT
// ================================================================

function FaqAeo() {
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is the StreetMP Open Trust Protocol (STP)?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The StreetMP Open Trust Protocol (STP) is an enterprise standard for securing artificial intelligence queries through cryptographic masking, zero-trust gating, and deterministic verifiable audit logs, ensuring zero data leakage to global language models."
        }
      },
      {
        "@type": "Question",
        "name": "How does StreetMP Research Forum protect enterprise data?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The STREET MP RESEARCH FORUM protects data using a secure cognitive firewall and hardware-grade cryptographic enclave that removes PII natively before tokens leave the corporate boundary, coupled with Semantic Caching and AI Autopilot features."
        }
      },
      {
        "@type": "Question",
        "name": "Is StreetMP OS compliant with global AI governance standards?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, StreetMP OS comes pre-configured for global institutional governance, enabling push-button audits through its Cryptographic Flight Recorder to satisfy SOC2 Type II, HIPAA, and ISO 27001 requirements."
        }
      }
    ]
  };

  return (
    <div className="sr-only" aria-hidden="true">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <div itemScope itemType="https://schema.org/FAQPage">
        <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
          <h3 itemProp="name">What is the StreetMP Open Trust Protocol (STP)?</h3>
          <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
            <p itemProp="text">The StreetMP Open Trust Protocol (STP) is an enterprise standard for securing artificial intelligence queries through cryptographic masking, zero-trust gating, and deterministic verifiable audit logs, ensuring zero data leakage to global language models.</p>
          </div>
        </div>
        <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
          <h3 itemProp="name">How does StreetMP Research Forum protect enterprise data?</h3>
          <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
            <p itemProp="text">The STREET MP RESEARCH FORUM protects data using a secure cognitive firewall and hardware-grade cryptographic enclave that removes PII natively before tokens leave the corporate boundary, coupled with Semantic Caching and AI Autopilot features.</p>
          </div>
        </div>
        <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
          <h3 itemProp="name">Is StreetMP OS compliant with global AI governance standards?</h3>
          <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
            <p itemProp="text">Yes, StreetMP OS comes pre-configured for global institutional governance, enabling push-button audits through its Cryptographic Flight Recorder to satisfy SOC2 Type II, HIPAA, and ISO 27001 requirements.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// LANDING PAGE
// ================================================================

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-emerald-500/30">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 w-full">

          {/* ── Logo ── */}
          <Link href="/" className="group shrink-0 flex items-center gap-1.5 transition-transform hover:scale-[1.02]">
            <span className="text-2xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-2xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>

          {/* ── Middle Nav Links (hidden below xl) ── */}
          <div className="hidden xl:flex items-center justify-center gap-x-8 flex-1 px-8 text-sm font-medium">
            <Link href="#why-it-matters"          className="text-white/80 hover:text-white transition-colors">Why It Matters</Link>
            <Link href="/architecture/nemo-claw"  className="text-white/80 hover:text-violet-400 transition-colors">Architecture</Link>
            <Link href="/demo/runtime-replay"     className="text-white/80 hover:text-emerald-400 transition-colors">Live Replay</Link>
            <Link href="/research"                className="text-white/80 hover:text-sky-400 transition-colors">Research</Link>
            <Link href="/stp"                     className="text-white/80 hover:text-white transition-colors">STP Protocol</Link>
          </div>

          {/* ── Right CTAs (always visible on mobile onwards) ── */}
          <div className="flex items-center gap-x-4 shrink-0">
            {/* Pricing — visible xl+ only */}
            <Link
              href="#pricing"
              className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/60 hover:text-emerald-200 hover:shadow-[0_0_16px_rgba(16,185,129,0.25)] transition-all font-semibold text-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Pricing
            </Link>
            {/* ✨ Live Demo — visible sm+ */}
            <Link
              href="/demo/mission-control"
              className="hidden sm:inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              ✨ Live Demo
            </Link>
            {/* Sign In — visible lg+ */}
            <Link
              href="/login"
              className="hidden lg:block text-sm font-semibold text-zinc-300 hover:text-white transition-colors px-2 py-2"
            >
              Sign In
            </Link>
            {/* Contact Sales — always visible sm+ */}
            <Link
              href="/register"
              className="inline-flex rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              Start Enterprise Pilot
            </Link>
            {/* Hamburger — below xl only */}
            <button
              className="xl:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* ── Mobile Drawer (below xl) ── */}
        {mobileMenuOpen && (
          <div className="xl:hidden absolute top-[100%] left-0 w-full border-b border-white/[0.04] bg-[#0A0A0A] shadow-2xl overflow-hidden animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-3 p-6 text-base font-semibold text-zinc-300">
              <Link href="#why-it-matters" onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">Why It Matters</Link>
              <Link href="#architecture"   onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">Architecture</Link>
              <Link href="/stp"            onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">STP Protocol</Link>
              <Link href="/developers"     onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors text-violet-400">Developer SDK</Link>
              <Link href="#pricing"        onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors text-emerald-400">Pricing</Link>
              <Link href="/scan"           onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors text-rose-400">Free AI Audit</Link>
              <div className="mt-3 pt-4 border-t border-white/10 flex flex-col gap-3">
                <Link href="/login"    onClick={() => setMobileMenuOpen(false)} className="rounded-xl border border-white/10 text-center py-3 text-white">Sign In</Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="rounded-xl bg-emerald-500 text-black text-center py-3 font-bold">Start Enterprise Pilot</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-32 pb-16 overflow-hidden">
        {/* Subtle mesh background grid */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 h-[600px] w-[1000px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl w-full flex flex-col lg:flex-row gap-16 items-center px-4 md:px-8">
          {/* Left column: copy */}
          <div className={`flex flex-col gap-8 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Powered by NeMo CLAW
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-[76px] font-extrabold leading-[1.05] tracking-tighter text-white">
              Sovereign AI <br/>
              <span className="text-emerald-400 inline-block mt-2">Infrastructure.</span>
            </h1>

            <p className="text-lg sm:text-xl text-zinc-300 leading-relaxed max-w-[560px] font-medium">
              StreetMP OS protects your enterprise from AI data leaks. We quietly monitor, sanitize, and secure every interaction with ChatGPT, Claude, and internal AI tools.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              >
                Start Enterprise Pilot
              </Link>
              <Link
                href="/demo/mission-control"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-8 py-4 text-base font-bold text-emerald-400 transition-all hover:bg-emerald-500/10"
              >
                Launch Live Demo
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

          {/* Right column: Cinematic Runtime Theater */}
          <div id="demo" className={`transition-all duration-1000 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <CinematicRuntimeTheater />
          </div>
        </div>
      </section>

{/* Removed TrustLogos */}

      {/* ── Operational Proof Counters & Telemetry Strip (Track G) ───────── */}
      <div className="w-full bg-[#050508] border-t border-b border-white/[0.04] py-12 relative overflow-hidden z-20">
        
        {/* Telemetry Strip (Marquee) */}
        <div className="absolute top-0 left-0 right-0 h-8 border-b border-white/[0.02] bg-white/[0.01] overflow-hidden flex items-center">
          <div className="flex animate-[marquee_20s_linear_infinite] whitespace-nowrap opacity-60">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-12 mx-6 text-[10px] font-mono text-emerald-400/80 uppercase tracking-widest">
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> NeMo CLAW: ACTIVE</span>
                <span>Latency: 12ms</span>
                <span>Threats Blocked: 14,209+</span>
                <span>Audit Nodes: 31</span>
                <span>APAC Routing: SG, JP, IN</span>
                <span>Zero Retention: VERIFIED</span>
                <span>Pattern Match: 99.2%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 w-full pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-12 text-center">
            {[
              { value: "0ms", label: "Data Retained", desc: "Local-first mathematical guarantees" },
              { value: "14B+", label: "Tokens Sanitized", desc: "Across 6+ enterprise platforms" },
              { value: "<30ms", label: "p99 Execution", desc: "Invisible to end-users" },
              { value: "5", label: "APAC Jurisdictions", desc: "Native PDPA/PDPB routing" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-4">
                <h3 className="text-3xl lg:text-4xl font-black font-mono text-emerald-400 mb-1 drop-shadow-[0_0_12px_rgba(16,185,129,0.2)]">{stat.value}</h3>
                <p className="text-sm font-bold text-white tracking-wide">{stat.label}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Enterprise Compliance & Integrations (Track G) ─────────────── */}
      <div className="w-full border-b border-white/[0.04] bg-[#0A0A0A] py-10 overflow-hidden flex flex-col items-center relative z-20">
        <div className="mx-auto max-w-7xl px-6 w-full flex flex-col items-center gap-10">
          
          {/* Compliance Badges */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 lg:gap-12 w-full">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] whitespace-nowrap">
              Compliance Standard
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-10">
              {[
                { name: "SOC2 Type II", color: "emerald" },
                { name: "HIPAA CC6.8", color: "emerald" },
                { name: "ISO 27001", color: "emerald" },
                { name: "PDPB 2023 (India)", color: "violet" },
                { name: "PDPA (Singapore)", color: "violet" }
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${badge.color === "emerald" ? "bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-violet-500/80 shadow-[0_0_8px_rgba(167,139,250,0.8)]"}`} />
                  <span className={`text-xs font-semibold tracking-wide ${badge.color === "violet" ? "text-violet-200" : "text-zinc-200"}`}>{badge.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Integrations Row */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 lg:gap-12 w-full pt-6 border-t border-white/[0.04]">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] whitespace-nowrap">
              Protected Surfaces
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-10 text-zinc-400 font-medium text-sm">
              <span>ChatGPT Enterprise</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Claude Team</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Google Gemini</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Slack Intercept</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Microsoft Teams</span>
            </div>
          </div>

        </div>
      </div>

      <NemoClawHighlight />

      {/* ── Why The World Needs This ────────────────────────────── */}
      <section id="why-it-matters" className="relative py-20 lg:py-32 px-6 bg-[#080808]">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full" />
              <div className="relative rounded-3xl border border-white/[0.08] bg-zinc-950/80 p-10 shadow-2xl">
                <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 group hover:bg-red-500/15 transition-all">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                      </div>
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
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group hover:bg-emerald-500/15 transition-all">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold mb-1">The Sovereign Way</h3>
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
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
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
                icon: <Lock className="w-5 h-5 mb-4 text-zinc-400" />
              },
              {
                step: "02",
                title: "Enforce Policy",
                desc: "Our engine checks your company rules: e.g., 'No financial data allowed' or 'Route patient data to healthcare-safe servers only'.",
                color: "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                num: "text-zinc-500",
                icon: <Zap className="w-5 h-5 mb-4 text-zinc-400" />
              },
              {
                step: "03",
                title: "Cognitive Firewall",
                desc: "AI outputs are scanned in real-time to prevent hallucinations, malicious code, or accidental internal data leaks.",
                color: "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                num: "text-zinc-500",
                icon: <ShieldCheck className="w-5 h-5 mb-4 text-zinc-400" />
              },
              {
                step: "04",
                title: "Auditable Proof",
                desc: "We generate a cryptographic receipt proving exact compliance. Perfect for your compliance and legal teams.",
                color: "border-emerald-500/20 bg-emerald-500/10 ring-1 ring-emerald-500/30",
                num: "text-emerald-500",
                icon: <BarChart3 className="w-5 h-5 mb-4 text-emerald-400" />
              },
            ].map((item, i) => (
              <div key={item.step} className={`rounded-3xl border ${item.color} p-8 relative transition-all duration-300 group`}>
                {item.icon}
                <div className={`text-sm font-black tracking-widest ${item.num} mb-4`}>
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
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">Why Sovereign Intelligence?</h2>
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

      {/* ── How It Works — 3 Plain Steps (Track E) ──────────────── */}
      <section className="relative py-20 lg:py-28 px-6 border-t border-white/[0.04] bg-[#060606]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-emerald-500 tracking-[0.3em] uppercase mb-4">How StreetMP Works</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              Protection in three invisible steps.
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Your employees keep using the AI tools they love. StreetMP silently governs every interaction without interrupting their workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-10 relative">
            {/* Connector lines (desktop only) */}
            <div className="hidden md:block absolute top-16 left-[33%] right-[33%] h-px bg-gradient-to-r from-white/10 via-emerald-500/30 to-white/10" />

            {[
              {
                n: "01",
                title: "Employee uses any AI tool",
                desc: "Your team types a prompt into ChatGPT, Claude, Copilot, or any AI surface — exactly as they normally would. No new tools to learn. No workflow changes.",
                icon: "💬",
                color: "border-white/[0.08]"
              },
              {
                n: "02",
                title: "StreetMP intercepts instantly",
                desc: "In under 25 milliseconds, StreetMP scans the prompt, detects sensitive data, applies your governance policies, and sanitizes the content before it reaches the AI model.",
                icon: "🛡️",
                color: "border-emerald-500/25"
              },
              {
                n: "03",
                title: "Safe AI. Proof logged.",
                desc: "The employee receives a helpful AI response. Sensitive data was never exposed. A cryptographically signed audit record is automatically logged for compliance.",
                icon: "✅",
                color: "border-white/[0.08]"
              }
            ].map((step) => (
              <div
                key={step.n}
                className={`relative rounded-3xl border ${step.color} bg-zinc-950/60 backdrop-blur-xl p-8 flex flex-col gap-5 hover:border-white/20 transition-all duration-300`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-2xl">
                  {step.icon}
                </div>
                <div className="text-xs font-black tracking-widest text-zinc-600">STEP {step.n}</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-8 py-3.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              See it in action with real enterprise scenarios
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Massive Attractive CTA ──────────────────────────────── */}
      <section className="py-20 lg:py-32 px-6 border-t border-white/[0.04] bg-[#0A0A0A] relative overflow-hidden">
        {/* Massive ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 mb-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-4xl md:text-7xl font-bold tracking-tighter text-white leading-tight">
            Secure your Enterprise AI today.
          </h2>
          <p className="text-xl text-zinc-400 font-medium max-w-2xl">
            Deploy AI governance across your entire enterprise in under 15 minutes. No employee retraining. No workflow disruption.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center mt-6 w-full sm:w-auto">
            <Link
              href="/register"
              className="group relative overflow-hidden rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] w-full sm:w-auto"
            >
              <span className="relative z-10">Start Enterprise Pilot →</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Link>
            <Link
              href="/demo"
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-5 text-lg font-bold text-white hover:bg-white/[0.06] transition-all w-full sm:w-auto"
            >
              See Live Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── Platform Operations Strip ─────────────────────────── */}
      <div className="w-full border-t border-b border-white/[0.04] bg-zinc-950/60 py-5 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 w-full">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest whitespace-nowrap">Platform Status</p>
            <div className="flex flex-wrap items-center gap-6">
              {[
                { label: "API", status: "Operational", color: "bg-emerald-500" },
                { label: "Queue", status: "Active", color: "bg-emerald-500" },
                { label: "Telemetry", status: "Ingesting", color: "bg-emerald-500" },
                { label: "PM2 Runtime", status: "Online", color: "bg-emerald-500" },
                { label: "DB", status: "Connected", color: "bg-emerald-500" },
                { label: "Webhooks", status: "Delivering", color: "bg-emerald-500" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${item.color} shadow-[0_0_6px_rgba(16,185,129,0.8)]`} />
                  <span className="text-xs font-mono text-zinc-400">{item.label}</span>
                  <span className="text-[10px] text-zinc-600">{item.status}</span>
                </div>
              ))}
            </div>
            <a href="/api/v1/health" target="_blank" rel="noopener" className="text-[10px] font-mono text-emerald-400/60 hover:text-emerald-400 transition-colors">
              /health →
            </a>
          </div>
        </div>
      </div>

      {/* ── What's Actually Built ──────────────────────────────── */}
      <section className="relative py-20 lg:py-32 px-6 bg-[#080808]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 mb-4">Production Systems</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white">
              The Entire Platform.<br /><span className="text-emerald-400">Already Running.</span>
            </h2>
            <p className="mt-5 text-zinc-400 max-w-2xl mx-auto text-lg">
              Every system below was built, tested, and deployed to production. No prototypes. No vaporware.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: "🧠",
                title: "NeMo CLAW Pipeline",
                desc: "Neural threat classifier with regex fallback. Prompt injection, PII detection, multilingual clustering. Sub-50ms p99.",
                href: "/stp",
              },
              {
                icon: "📊",
                title: "Telemetry Insights Engine",
                desc: "Top threat patterns, prompt injection signals, integration attack vectors, latency percentiles, and daily trend analytics.",
                href: "/developers#api",
              },
              {
                icon: "🛡️",
                title: "Security Review Center",
                desc: "Policy conflict detection, threat confidence heatmaps, analyst override tracking, and adaptive threshold tuning.",
                href: "/stp",
              },
              {
                icon: "📋",
                title: "SOC2 Evidence Export",
                desc: "Point-in-time evidence packages covering CC6.1, CC6.2, CC6.8, CC7.2. Access control, audit integrity, retention validation.",
                href: "/trust#audit",
              },
              {
                icon: "⚡",
                title: "Pilot Operations",
                desc: "Live alert sweep across 6 alert types. Step-by-step deployment playbook auto-customized to your tenant state.",
                href: "/developers",
              },
              {
                icon: "🔗",
                title: "Integration Observability",
                desc: "Per-platform health scores, circuit breaker logic (trips at 20% health), retry rate analytics, delivery guarantees.",
                href: "/integrations",
              },
              {
                icon: "📈",
                title: "Scale Readiness Analytics",
                desc: "Concurrent scan throughput, webhook delivery rates, queue capacity projection, saturation alerts, 30-day growth forecasting.",
                href: "/developers#api",
              },
              {
                icon: "🔒",
                title: "Immutable Audit Chain",
                desc: "Every policy change, FP override, and enforcement decision written to append-only AuditLog with HMAC-signed integrity.",
                href: "/trust",
              },
            ].map(feature => (
              <a
                key={feature.title}
                href={feature.href}
                className="group flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-6 hover:border-emerald-500/20 hover:bg-zinc-900/70 transition-all"
              >
                <div className="text-2xl">{feature.icon}</div>
                <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">{feature.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sovereign AI Section ───────────────────────────────── */}
      <section className="relative py-20 lg:py-28 px-6 border-t border-white/[0.04] bg-gradient-to-b from-[#080808] to-zinc-950">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 mb-4">Sovereign AI</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white leading-tight mb-6">
                Your Data.<br />Your Jurisdiction.<br />
                <span className="text-emerald-400">Your Keys.</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed text-lg mb-8">
                StreetMP OS was designed for regulated industries operating across APAC and global jurisdictions. Bring Your Own Key, hold your own encryption, and keep every byte within your sovereign boundary.
              </p>
              <div className="flex flex-col gap-4">
                {[
                  { label: "BYOK / HYOK", desc: "Encryption key management stays entirely within your infrastructure." },
                  { label: "APAC Sovereignty", desc: "Singapore PDPA, India PDPB, Thailand PDPA, and GDPR-aligned processing." },
                  { label: "Tenant Isolation", desc: "Structural orgId-scoping at Prisma layer. Cross-tenant access is architecturally impossible." },
                  { label: "Zero Retention", desc: "Raw content never persisted. Only HMAC-signed telemetry metadata written." },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-zinc-200">{item.label}</span>
                      <span className="text-sm text-zinc-500 ml-2">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { metric: "0 bytes", label: "Data retained after scan" },
                { metric: "14", label: "Core schema tables active" },
                { metric: "43", label: "Routes compiled in production" },
                { metric: "80/100", label: "Pilot readiness score" },
                { metric: "3", label: "Retry attempts per webhook" },
                { metric: "∞", label: "Audit log retention" },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-white/[0.07] bg-zinc-900/40 p-5">
                  <div className="text-2xl font-black font-mono text-emerald-400 mb-1">{item.metric}</div>
                  <div className="text-xs text-zinc-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Enterprise Readiness Section ──────────────────────── */}
      <section className="relative py-20 px-6 border-t border-white/[0.04] bg-[#080808]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 mb-4">Enterprise Readiness</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white">
              Production-Hardened.<br /><span className="text-emerald-400">Not Demo-Ware.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Resilience Suite",
                items: ["6-test deterministic validation suite", "Concurrency isolation under load", "Queue saturation alerts at 50+ dead-letters", "PM2 crash recovery with auto-restart", "Webhook storm simulation"],
              },
              {
                title: "Operational Trust",
                items: ["Live pilot health dashboard API", "Alert sweep across 6 failure modes", "Integration circuit breaker (resets via API)", "Telemetry completeness scoring", "Queue latency p95/p99 tracking"],
              },
              {
                title: "Developer Readiness",
                items: ["REST API: sync + async + file scan", "HMAC-verified webhook delivery", "SDK examples: curl, TypeScript, Python", "Copy-to-clipboard API reference", "SOC2 evidence package on demand"],
              },
            ].map(section => (
              <div key={section.title} className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-8">
                <h3 className="text-base font-semibold text-zinc-100 mb-5">{section.title}</h3>
                <ul className="space-y-3">
                  {section.items.map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-zinc-400 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/trust" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] px-6 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/[0.1] transition-colors">
              View Trust Center <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/developers" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-6 py-3 text-sm text-zinc-300 hover:text-zinc-100 hover:border-white/[0.2] transition-colors">
              Developer Documentation
            </Link>
          </div>
        </div>
      </section>


      {/* ── Research Intelligence Signal (Track I) ──────────────── */}
      <div className="border-t border-white/[0.04] bg-[#050508] px-6 py-10">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Powered by Global Research Intelligence
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 justify-center md:justify-end">
            {[
              { value: "14,000+", label: "AI interactions classified" },
              { value: "312", label: "active researchers" },
              { value: "8", label: "university partners" },
              { value: "99.7%", label: "detection coverage" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <span className="text-sm font-black font-mono text-emerald-400">{s.value}</span>
                <span className="text-xs text-zinc-600 ml-1.5">{s.label}</span>
              </div>
            ))}
          </div>
          <a
            href="/research"
            className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors whitespace-nowrap border border-white/[0.06] rounded-lg px-3 py-1.5 hover:border-emerald-500/30"
          >
            Explore Research Network →
          </a>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}

      <footer className="border-t border-white/[0.04] px-6 py-20 bg-[#080808]">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-sm text-zinc-500 font-medium">
          
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tighter text-white whitespace-nowrap">
                StreetMP <span className="text-emerald-400 font-medium">OS</span>
              </span>
            </div>
            <p className="text-zinc-500 leading-relaxed max-w-xs">
              The cryptographic shield for enterprise AI. Innovate fearlessly without exposing your data.
            </p>
            <span className="mt-2 font-mono text-xs">© 2026 STREET MP RESEARCH FORUM (CIN: U85499AP2024NPL114932). All rights reserved.</span>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-white font-semibold mb-2">Platform</h4>
            <Link href="/stp" className="hover:text-emerald-400 transition-colors">STP Protocol</Link>
            <Link href="/integrations" className="hover:text-emerald-400 transition-colors">Integrations</Link>
            <Link href="/pricing" className="hover:text-emerald-400 transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-emerald-400 transition-colors">Documentation</Link>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-white font-semibold mb-2">Developers &amp; Security</h4>
            <Link href="/developers" className="hover:text-emerald-400 transition-colors">Developer Hub</Link>
            <Link href="/developers#api" className="hover:text-emerald-400 transition-colors">API Reference</Link>
            <Link href="/security" className="hover:text-emerald-400 transition-colors">Security</Link>
            <Link href="/trust" className="hover:text-emerald-400 transition-colors">Trust Center</Link>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-white font-semibold mb-2">Company</h4>
            <Link href="/login" className="hover:text-emerald-400 transition-colors">Console Login</Link>
            <a href="mailto:enterprise@streetmp.com" className="hover:text-emerald-400 transition-colors">Enterprise Sales</a>
            <a href="mailto:support@streetmp.com" className="hover:text-emerald-400 transition-colors">Support</a>
            <a href="/api/v1/health" target="_blank" rel="noopener" className="hover:text-emerald-400 transition-colors">Platform Status</a>
          </div>

        </div>
      </footer>

      {/* Removed FloatingChatbot */}
    </div>
  );
}
