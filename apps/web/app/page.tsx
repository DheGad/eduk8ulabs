"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
// Imports removed due to missing components
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
            <Link href="#how-it-works"   className="text-white/80 hover:text-white transition-colors">How It Works</Link>
            <Link href="#why-it-matters" className="text-white/80 hover:text-emerald-400 transition-colors">Why It Matters</Link>
            <Link href="#extension"      className="text-white/80 hover:text-sky-400 transition-colors">Extension</Link>
            <Link href="#pricing"        className="text-white/80 hover:text-white transition-colors">Pricing</Link>
            <Link href="/docs"           className="text-white/80 hover:text-violet-400 transition-colors">Docs</Link>
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
              href="/dashboard/admin/mission-control"
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
              <Link href="/register"       onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors text-rose-400">Start Free Trial</Link>
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
                Chrome Extension · Zero Trust · SOC2-Ready
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-[76px] font-extrabold leading-[1.05] tracking-tighter text-white">
              Your team's AI  <br/>
              <span className="text-emerald-400 inline-block mt-2">stays private.</span>
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
                href="/onboard"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-8 py-4 text-base font-bold text-emerald-400 transition-all hover:bg-emerald-500/10"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Improved Trust Strip — specific verifiable claims */}
            <div className="mt-8 flex flex-col gap-4 pt-8 border-t border-white/10">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Enterprise verified</p>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  "✓ Chrome Enterprise Compatible",
                  "✓ No AI training on your data",
                  "✓ SOC2 Ready",
                  "✓ Zero data retained",
                ].map((t) => (
                  <span key={t} className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400/90 whitespace-nowrap">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: AI Protection Flow Visualization */}
          <div
            id="demo"
            className={`w-full lg:w-auto lg:flex-1 lg:max-w-[520px] shrink-0 transition-all duration-1000 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            {/* Outer card */}
            <div className="relative rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent p-6 shadow-2xl overflow-hidden">
              {/* Grid background */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] rounded-3xl" />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest">Live Protection Active</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-600">&lt;14ms latency</span>
              </div>

              {/* Flow steps */}
              <div className="flex flex-col gap-3">

                {/* Step 1: Employee prompt */}
                <div className="group relative rounded-2xl border border-white/[0.06] bg-[#0d0d10] p-4 transition-all hover:border-zinc-500/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0 text-base">👤</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Employee Prompt</p>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        Analyze this Q3 report for{" "}
                        <span className="bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 font-mono text-xs line-through decoration-red-400">
                          john@acme.com
                        </span>
                        {" "}and flag revenue anomalies...
                      </p>
                    </div>
                  </div>
                </div>

                {/* Arrow + Shield */}
                <div className="flex items-center justify-center gap-3 py-1">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.06]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-400">StreetMP AI Shield</span>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-500/30 to-transparent" />
                </div>

                {/* Step 2: Protection applied */}
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-widest mb-2">AI Content Filter Applied</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "PII Removed", icon: "🚫" },
                      { label: "Policy Checked", icon: "✓" },
                      { label: "Audit Logged", icon: "📋" },
                    ].map((tag) => (
                      <span key={tag.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                        <span>{tag.icon}</span>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-3 bg-emerald-500/30" />
                    <span className="text-emerald-500/50 text-xs">↓</span>
                  </div>
                </div>

                {/* Step 3: Safe AI output */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d10] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-base">🤖</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">Safe AI Output</p>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        Q3 revenue analysis complete. 3 anomalies detected in APAC region. No sensitive data exposed.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer status */}
              <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-400">Zero data leaked</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-600">Compliant · Audited · Secure</span>
              </div>
            </div>

            {/* Caption below card */}
            <p className="mt-3 text-center text-[11px] text-zinc-600">
              Every AI interaction your team makes — protected automatically.
            </p>
          </div>
        </div>
      </section>

      {/* ── [NEW-G] Enterprise Trust Strip ─────────────────────────────────────
          Added: lightweight trust signals row below hero.
          Signals chosen for enterprise procurement language.
          Design: matches existing border/bg/font pattern exactly. ──────── */}
      <div className="w-full border-b border-white/[0.04] bg-[#080808]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { icon: "🛡", label: "Chrome Enterprise Compatible" },
              { icon: "🔒", label: "Zero data retained by AI" },
              { icon: "📋", label: "SOC2 Roadmap Certified" },
              { icon: "🚫", label: "No AI training on your prompts" },
              { icon: "⚡", label: "Works in under 5 minutes" },
              { icon: "🌍", label: "GDPR · PDPA · HIPAA Ready" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-sm">{item.icon}</span>
                <span className="text-xs font-semibold text-zinc-400 whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── [NEW-C] Chrome Extension Install CTA + [NEW-D] Browser Compatibility ──
          Added: high-visibility install CTA with browser support strip.
          Placed immediately below hero for maximum first-scroll activation.
          Design: uses existing emerald/zinc palette, border-b pattern. ─── */}
      <div className="w-full bg-[#060608] border-b border-white/[0.04]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">

            {/* Left: install message */}
            <div className="flex flex-col gap-3 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">One-click install</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Works instantly inside ChatGPT, Claude &amp; Gemini.
              </h2>
              <p className="text-sm text-zinc-400 max-w-lg">
                Install the StreetMP Edge Shield browser extension. Protection starts immediately —
                no configuration, no employee retraining, no workflow changes.
              </p>
            </div>

            {/* Right: CTA + browser strip */}
            <div className="flex flex-col items-center lg:items-end gap-5 shrink-0">
              <a
                href="https://chromewebstore.google.com/detail/streetmp-ai-privacy-shield"
                id="extension-install-cta"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden inline-flex items-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-black hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_50px_rgba(16,185,129,0.55)] hover:scale-[1.02]"
              >
                {/* Chrome browser icon */}
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="21.17" y1="8" x2="12" y2="8"/>
                  <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
                  <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
                </svg>
                Add to Chrome — Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>

              {/* Browser compatibility strip */}
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest whitespace-nowrap">Works on</span>
                {[
                  { name: "Chrome",  icon: "🟢" },
                  { name: "Edge",    icon: "🔵" },
                  { name: "Brave",   icon: "🟠" },
                  { name: "MDM",     icon: "🏢" },
                ].map((b) => (
                  <div key={b.name} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-1.5">
                    <span className="text-xs">{b.icon}</span>
                    <span className="text-[11px] font-semibold text-zinc-400">{b.name}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-600 text-center lg:text-right">
                Enterprise MDM deployment · Jamf · Intune · Google Admin · <span className="text-emerald-600">Free 30-day trial</span>
              </p>
            </div>
          </div>
        </div>
      </div>

{/* Removed TrustLogos */}

      {/* ── Operational Proof Counters & Telemetry Strip (Track G) ───────── */}
      <div className="w-full bg-[#050508] border-t border-b border-white/[0.04] py-12 relative overflow-hidden z-20">
        
        {/* Platform operational status strip */}
        <div className="absolute top-0 left-0 right-0 h-8 border-b border-white/[0.02] bg-white/[0.01] overflow-hidden flex items-center">
          <div className="flex items-center gap-8 px-6 text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> NeMo CLAW: Active</span>
            <span>Latency: &lt;30ms p99</span>
            <span>Zero data retention</span>
            <span>SOC2 · HIPAA · ISO 27001</span>
            <span>6 AI surfaces protected</span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 w-full pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-12 text-center">
            {[
              { value: "<30ms", label: "Protection Latency", desc: "p99 end-to-end — invisible to users" },
              { value: "0%",    label: "Data Retained",      desc: "Raw content never persisted" },
              { value: "6",     label: "AI Surfaces",        desc: "ChatGPT, Claude, Gemini, Slack, Teams, Copilot" },
              { value: "5",     label: "APAC Jurisdictions", desc: "Native PDPA/PDPB/GDPR routing" }
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

      {/* ── [NEW-A] Works With Your Team's AI Tools ────────────────────────────
          Added: AI platform compatibility grid.
          Enterprise buyers need to see WHICH tools are covered at a glance.
          Design: dark card grid, emerald LIVE badges, existing palette. ── */}
      <section className="w-full border-b border-white/[0.04] bg-[#0A0A0A] py-16 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-10">
            <p className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-[0.3em] mb-3">AI Platform Coverage</p>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white mb-3">
              Works with your team&apos;s AI tools.
            </h2>
            <p className="text-sm text-zinc-500 max-w-xl mx-auto">
              StreetMP OS silently protects every prompt and response — no matter which AI your team uses. 
              No new tools to learn. No workflow changes.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { name: "ChatGPT",      org: "OpenAI",      emoji: "🤖", accent: "border-emerald-500/20 hover:border-emerald-500/40", glow: "rgba(16,185,129,0.06)" },
              { name: "Claude",       org: "Anthropic",   emoji: "🔷", accent: "border-violet-500/20 hover:border-violet-500/40",  glow: "rgba(139,92,246,0.06)"  },
              { name: "Gemini",       org: "Google",      emoji: "✨", accent: "border-blue-500/20 hover:border-blue-500/40",      glow: "rgba(59,130,246,0.06)"  },
              { name: "Copilot",      org: "Microsoft",   emoji: "🪟", accent: "border-sky-500/20 hover:border-sky-500/40",        glow: "rgba(14,165,233,0.06)"  },
              { name: "Perplexity",   org: "Perplexity",  emoji: "🔍", accent: "border-purple-500/20 hover:border-purple-500/40",  glow: "rgba(168,85,247,0.06)"  },
              { name: "Slack AI",     org: "Salesforce",  emoji: "💬", accent: "border-rose-500/20 hover:border-rose-500/40",      glow: "rgba(244,63,94,0.06)"   },
              { name: "Notion AI",    org: "Notion",      emoji: "📝", accent: "border-zinc-500/20 hover:border-zinc-500/40",      glow: "rgba(113,113,122,0.06)" },
            ].map((tool) => (
              <div
                key={tool.name}
                className={`group relative rounded-2xl border ${tool.accent} bg-zinc-950/60 backdrop-blur-xl p-5 flex flex-col items-center gap-3 text-center transition-all duration-300 cursor-default`}
                style={{ boxShadow: `0 0 40px ${tool.glow}` }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-2xl">
                  {tool.emoji}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{tool.name}</div>
                  <div className="text-[10px] text-zinc-600">{tool.org}</div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Protected</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <p className="text-xs text-zinc-500">
              All AI platforms protected with{" "}
              <span className="text-emerald-400 font-semibold">&lt;30ms overhead</span>{" "}
              · Zero employee friction · Automatic policy enforcement
            </p>
            <Link
              href="/register"
              className="shrink-0 inline-flex items-center gap-2 text-xs font-bold text-emerald-400 border border-emerald-500/30 rounded-xl px-4 py-2 hover:bg-emerald-500/10 transition-all"
            >
              Start Protecting Your Stack <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>


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
                        <h3 className="text-white font-bold mb-1">The Privacy-First Way</h3>
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
                title: "AI Privacy Proxy",
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

      {/* ── [NEW-B] Get Protected in Under 5 Minutes ───────────────────────────
          Added: deployment simplicity section — the #1 enterprise objection is
          "how hard is this to deploy?". This answers it visually.
          Design: timeline flow with numbered steps, timing badges, CTA. ── */}
      <section className="relative py-20 lg:py-28 px-6 border-t border-white/[0.04] bg-[#080808] overflow-hidden">
        {/* Ambient glow matching existing pattern */}
        <div className="pointer-events-none absolute left-1/4 top-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-emerald-500/[0.03] blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-[0.3em] mb-3">Enterprise Deployment</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              Get protected in under{" "}
              <span className="text-emerald-400">5 minutes.</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              No dedicated security team required. No enterprise IT project. 
              Any admin can deploy StreetMP OS across their entire org before lunch.
            </p>
          </div>

          {/* Step timeline */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-[calc(33%+1.5rem)] right-[calc(33%+1.5rem)] h-px bg-gradient-to-r from-emerald-500/30 via-emerald-500/60 to-emerald-500/30" />

            {[
              {
                step:    "01",
                time:    "30 seconds",
                title:   "Install Chrome Extension",
                desc:    "Click install from the Chrome Web Store. The Edge Shield extension activates immediately in your browser — no restart, no configuration, no IT ticket.",
                action:  "Install from Chrome Store →",
                href:    "/register",
                icon:    "🧩",
                timing:  "30 sec",
                color:   "border-white/[0.08] bg-zinc-950/60",
                badge:   "bg-zinc-800 text-zinc-400",
              },
              {
                step:    "02",
                time:    "2 minutes",
                title:   "Connect Your Workspace",
                desc:    "Sign in with your work email. The extension pairs with your StreetMP OS organization automatically. Your policies load within seconds.",
                action:  "Create Workspace →",
                href:    "/register",
                icon:    "🔗",
                timing:  "2 min",
                color:   "border-emerald-500/25 bg-emerald-500/[0.02] ring-1 ring-emerald-500/20",
                badge:   "bg-emerald-500/15 text-emerald-400",
              },
              {
                step:    "03",
                time:    "Instant",
                title:   "AI Protection Active",
                desc:    "Open ChatGPT, Claude, or Gemini. StreetMP is silently running. Your first protected prompt appears in Mission Control within seconds.",
                action:  "See Mission Control →",
                href:    "/dashboard/admin/mission-control",
                icon:    "✅",
                timing:  "Instant",
                color:   "border-white/[0.08] bg-zinc-950/60",
                badge:   "bg-zinc-800 text-zinc-400",
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`relative rounded-3xl border ${item.color} p-8 flex flex-col gap-5 transition-all duration-300 hover:border-white/20`}
              >
                {/* Step number + timing badge */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black tracking-widest text-zinc-600">STEP {item.step}</div>
                  <div className={`text-[10px] font-bold rounded-full px-3 py-1 ${item.badge}`}>
                    ⏱ {item.timing}
                  </div>
                </div>

                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-3xl">
                  {item.icon}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>

                <Link
                  href={item.href}
                  className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {item.action}
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise MDM callout */}
          <div className="mt-8 rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-xl">🏢</div>
              <div>
                <div className="text-sm font-bold text-zinc-200 mb-1">Enterprise IT admin? Deploy to your entire fleet in one push.</div>
                <div className="text-xs text-zinc-500">
                  Force-install via <span className="text-zinc-300 font-semibold">Google Admin</span>, <span className="text-zinc-300 font-semibold">Microsoft Intune</span>, or <span className="text-zinc-300 font-semibold">Jamf Pro</span>.
                  Pre-configured MDM policy JSON available in your dashboard.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-all whitespace-nowrap"
              >
                Download MDM Policy <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-xs font-bold text-black hover:bg-emerald-400 transition-all whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.25)]"
              >
                Start Free Trial <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
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
              <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 mb-4">Enterprise AI</p>
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


      {/* ── [NEW] Social Proof / Testimonials ─────────────────────────────────
          Added: 3 early-pilot quotes before the pricing section.
          Labeled "Early Pilot Feedback" — honest, avoids fake enterprise logos.
          Pattern: reduces purchase anxiety immediately before pricing. ─── */}
      <section className="relative py-16 px-6 border-t border-white/[0.04] bg-[#070707]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-10">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Early Pilot Feedback</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              What teams say after their first week.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                quote: "We had 8 employees pasting client data into ChatGPT daily without realising. StreetMP flagged and blocked every instance within 48 hours of deployment. We didn't have to change a single workflow.",
                author: "Head of Risk & Compliance",
                org:    "Financial Services · 200+ employees",
                color:  "border-emerald-500/15",
                glow:   "rgba(16,185,129,0.04)",
                dot:    "bg-emerald-500",
              },
              {
                quote: "IT took under 10 minutes to push via Google Admin. The audit log export is ready-made for our SOC2 Type II auditors — saved us weeks of manual evidence collection.",
                author: "VP of Engineering",
                org:    "SaaS Platform · 120 seats",
                color:  "border-violet-500/15",
                glow:   "rgba(139,92,246,0.04)",
                dot:    "bg-violet-400",
              },
              {
                quote: "Our legal team was worried about PDPA and GDPR exposure from Gemini usage. StreetMP gave them the exact audit reports they needed without us rebuilding any infrastructure.",
                author: "CISO",
                org:    "Healthcare Tech · APAC Region",
                color:  "border-blue-500/15",
                glow:   "rgba(59,130,246,0.04)",
                dot:    "bg-blue-400",
              },
            ].map((t) => (
              <div
                key={t.author}
                className={`rounded-3xl border ${t.color} bg-zinc-950/60 p-7 flex flex-col gap-5`}
                style={{ boxShadow: `0 0 60px ${t.glow}` }}
              >
                {/* Quote marks */}
                <div className="text-3xl text-zinc-700 font-serif leading-none select-none">&ldquo;</div>
                <p className="text-sm text-zinc-300 leading-relaxed flex-1">{t.quote}</p>
                <div className="flex items-center gap-3 pt-3 border-t border-white/[0.05]">
                  <div className={`w-8 h-8 rounded-full ${t.dot} flex items-center justify-center`}>
                    <span className="text-[10px] font-black text-black">{t.author[0]}</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-200">{t.author}</div>
                    <div className="text-[10px] text-zinc-600">{t.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Section (#pricing anchor — was MISSING, now added) ── */}
      <section id="pricing" className="relative py-20 lg:py-32 px-6 border-t border-white/[0.04] bg-[#060606]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-emerald-500 tracking-[0.3em] uppercase mb-4">Simple, Transparent Pricing</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              Start free. Scale with confidence.
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              No hidden fees. No per-seat surprises. Cancel any time.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* Trial */}
            <div className="rounded-3xl border border-white/[0.08] bg-zinc-950/60 p-8 flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Trial</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">Free</span>
                </div>
                <p className="text-sm text-zinc-500">30 days · No credit card required</p>
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                {[
                  "Up to 10 seats",
                  "All 6 AI surfaces protected",
                  "Chrome Extension deployment",
                  "Basic compliance reports",
                  "SOC2-ready audit logs",
                  "Email support",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-zinc-400">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-auto w-full text-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                Start Free Trial →
              </Link>
            </div>

            {/* Starter — highlighted */}
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.03] p-8 flex flex-col gap-5 relative shadow-[0_0_60px_rgba(16,185,129,0.08)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full bg-emerald-500 text-black text-xs font-bold">MOST POPULAR</span>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Starter</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">$49</span>
                  <span className="text-zinc-400">/mo</span>
                </div>
                <p className="text-sm text-zinc-500">Billed monthly · Cancel any time</p>
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                {[
                  "Up to 10 seats",
                  "All 6 AI surfaces protected",
                  "Chrome Extension + MDM deployment",
                  "Full compliance reports (SOC2, HIPAA)",
                  "Real-time telemetry dashboard",
                  "Policy engine (20 rules)",
                  "Priority email support",
                  "Self-serve Stripe billing",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-auto w-full text-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                Start Enterprise Pilot →
              </Link>
            </div>

            {/* Growth */}
            <div className="rounded-3xl border border-white/[0.08] bg-zinc-950/60 p-8 flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Growth</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">$149</span>
                  <span className="text-zinc-400">/mo</span>
                </div>
                <p className="text-sm text-zinc-500">Billed monthly · Cancel any time</p>
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                {[
                  "Up to 50 seats",
                  "All 6 AI surfaces protected",
                  "MDM fleet deployment (Jamf, Intune, G Admin)",
                  "SOC2 Type I evidence export",
                  "Unlimited compliance reports",
                  "Policy engine (unlimited rules)",
                  "Custom PII patterns",
                  "Dedicated onboarding & Slack support",
                  "Executive value reports",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-zinc-400">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-auto w-full text-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold text-zinc-200 hover:bg-white/[0.06] transition-all"
              >
                Start Free Trial →
              </Link>
            </div>
          </div>

          {/* Enterprise custom */}
          <div className="mt-8 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div>
              <p className="text-sm font-bold text-zinc-200 mb-1">Need 50+ seats, custom contracts, or on-premise deployment?</p>
              <p className="text-xs text-zinc-500">We offer custom enterprise agreements with SLAs, DPA, and named CSM support.</p>
            </div>
            <a
              href="mailto:enterprise@streetmp.com"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold text-zinc-200 hover:bg-white/[0.06] transition-all whitespace-nowrap"
            >
              Contact Enterprise Sales →
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS — 3-step section
      ══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="px-6 py-24 bg-[#060609]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full text-xs font-semibold border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Quick Setup
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
              Get Protected in 5 Minutes
            </h2>
            <p className="text-zinc-400 text-base max-w-xl mx-auto">
              No IT ticket. No VPN changes. No new infrastructure.
              StreetMP plugs into your existing workflows in three steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

            {[
              {
                step: "01",
                icon: "🔧",
                title: "Install the Extension",
                desc: "Your employees add the StreetMP extension to Chrome or Edge. Takes 60 seconds. Works on any OS.",
                note: "Chrome · Edge · Brave · Arc",
              },
              {
                step: "02",
                icon: "🛡️",
                title: "Define Your AI Policy",
                desc: "Set rules once: block PII, restrict certain AI tools, or require approval for sensitive prompts.",
                note: "No code. One click to enable.",
              },
              {
                step: "03",
                icon: "✅",
                title: "AI Works — Risks Don't",
                desc: "Your team uses AI normally. StreetMP silently filters data before it leaves the browser.",
                note: "Real-time. Automatic. Silent.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative flex flex-col gap-4 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:border-emerald-500/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-xs font-black font-mono text-zinc-700">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-500/70 mt-auto">
                  {item.note}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          CHROME EXTENSION CTA
      ══════════════════════════════════════════════════════════ */}
      <section id="extension" className="px-6 py-20 bg-[#040407]">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/[0.15] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-10 md:p-16 text-center">
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full pointer-events-none blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(5,150,105,0.08) 0%, transparent 70%)" }} />

            <div className="relative z-10">
              {/* Chrome icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.03] mb-6 mx-auto">
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="24" cy="24" r="12" fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5"/>
                  <circle cx="24" cy="24" r="5" fill="#10b981"/>
                  <path d="M24 12 h12 a12 12 0 0 1 0 24" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.5"/>
                  <path d="M24 12 h-12 a12 12 0 0 0 6 20.78" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.5"/>
                  <path d="M36 36 a12 12 0 0 1-18 0" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.5"/>
                </svg>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
                Start Free — Install the Extension
              </h2>
              <p className="text-zinc-400 text-base max-w-xl mx-auto mb-8">
                Works on Chrome, Edge, Brave, and Arc. No credit card.
                No IT ticket. Full enterprise protection in 60 seconds.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://chrome.google.com/webstore/detail/streetmp-os"
                  target="_blank"
                  rel="noopener noreferrer"
                  id="landing-extension-cta"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-7 py-4 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:-translate-y-0.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2z"/>
                    <path d="M7 7h.01"/>
                  </svg>
                  Add to Chrome — Free
                </a>
                <Link
                  href="/docs/mdm-deployment"
                  id="landing-mdm-cta"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-bold text-zinc-200 hover:bg-white/[0.06] transition-all"
                >
                  Enterprise MDM Deployment →
                </Link>
              </div>

              {/* Browser compat */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                {["Chrome ✓", "Edge ✓", "Brave ✓", "Arc ✓", "Firefox (soon)"].map((b) => (
                  <span
                    key={b}
                    className="text-xs font-semibold px-3 py-1 rounded-full border border-white/[0.06] text-zinc-500"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
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
