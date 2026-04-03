"use client";

import Link from "next/link";

export function PricingGrid() {
  const renderFeature = (text: string) => {
    if (text.startsWith("[2.0] ")) {
      return (
        <span className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
            2.0
          </span>
          <span>{text.replace("[2.0] ", "")}</span>
        </span>
      );
    }
    return <span>{text}</span>;
  };

  return (
    <section id="pricing" className="relative py-32 px-6 border-t border-white/[0.04] bg-[#0A0A0A] overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-emerald-500 tracking-[0.3em] uppercase mb-4">Simple Pricing</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">Choose your Security Tier</h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">Enterprise-grade AI protection at every scale. Start free. Upgrade when you need it.</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-24">

          {/* Card 1: Explorer */}
          <div className="rounded-3xl border border-white/[0.08] bg-zinc-950/60 backdrop-blur-xl p-8 flex flex-col gap-6 transition-all duration-300 hover:border-white/20">
            <div>
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-2">Explorer</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-5xl font-black text-white tracking-tighter">$0</span>
                <span className="text-zinc-500 text-sm">/month</span>
              </div>
              <p className="text-sm text-zinc-400">No credit card. Developer friendly.</p>
            </div>
            <div className="w-full h-px bg-white/[0.06]" />
            <ul className="flex flex-col gap-4 flex-1">
              {[
                "100 secure AI calls/mo",
                "[2.0] Universal npm package integration",
                "[2.0] Premium Mobile-first UI",
                "Basic trust score & 7-day logs"
              ].map(f => (
                <li key={f} className="flex items-start gap-3 text-sm text-zinc-300 leading-snug">
                  <span className="text-white/40 shrink-0 mt-0.5">✓</span>
                  {renderFeature(f)}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-2 block w-full rounded-xl border border-white/10 bg-white/[0.04] py-4 text-sm font-bold text-white text-center hover:bg-white/[0.08] transition-all">
              Get Started Free
            </Link>
          </div>

          {/* Card 2: Professional */}
          <div className="relative rounded-3xl border border-emerald-500/40 bg-zinc-950/80 backdrop-blur-xl p-8 flex flex-col gap-6 ring-1 ring-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.12)] hover:scale-[1.03] hover:shadow-[0_0_80px_rgba(16,185,129,0.2)] transition-all duration-300 cursor-pointer">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-black text-black tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.5)] whitespace-nowrap">
                ⭐ MOST POPULAR
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">Professional</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-5xl font-black text-white tracking-tighter">$49</span>
                <span className="text-zinc-500 text-sm">/month</span>
              </div>
              <p className="text-sm text-zinc-400">For consultants and power users.</p>
            </div>
            <div className="w-full h-px bg-emerald-500/20" />
            <ul className="flex flex-col gap-4 flex-1">
              {[
                "10,000 secure AI calls/mo",
                "[2.0] Streaming Responses & File Analysis",
                "All 20+ model routing",
                "PII tokenization & Full audit certs"
              ].map(f => (
                <li key={f} className="flex items-start gap-3 text-sm text-zinc-100 leading-snug">
                  <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                  {renderFeature(f)}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-2 block w-full rounded-xl bg-emerald-500 py-4 text-sm font-black text-black text-center hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              Start 14-Day Free Trial →
            </Link>
          </div>

          {/* Card 3: Business */}
          <div className="rounded-3xl border border-white/[0.08] bg-zinc-950/60 backdrop-blur-xl p-8 flex flex-col gap-6 transition-all duration-300 hover:border-white/20">
            <div>
              <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-2">Business</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-5xl font-black text-white tracking-tighter">$299</span>
                <span className="text-zinc-500 text-sm">/month</span>
              </div>
              <p className="text-sm text-zinc-400">Up to 25 seats. For scaling teams.</p>
            </div>
            <div className="w-full h-px bg-white/[0.06]" />
            <ul className="flex flex-col gap-4 flex-1">
              {[
                "100,000 secure AI calls/mo",
                "[2.0] Live Cost-Savings Router Engine",
                "[2.0] Natural Language Policy Creation",
                "[2.0] AI-Powered Root Cause Analysis",
                "SSO (Okta, Azure AD, Google)",
                "[2.0] NVIDIA NeMo Safety Sidecar (Shared)"
              ].map(f => (
                <li key={f} className="flex items-start gap-3 text-sm text-zinc-300 leading-snug">
                  <span className="text-blue-400 shrink-0 mt-0.5">✓</span>
                  {renderFeature(f)}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-2 block w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-4 text-sm font-bold text-blue-300 text-center hover:bg-blue-500/20 transition-all">
              Start Free Trial →
            </Link>
          </div>

          {/* Card 4: Sovereign */}
          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/80 to-zinc-900/40 backdrop-blur-xl p-8 flex flex-col gap-6 transition-all duration-300 hover:border-white/20">
            <div>
              <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-2">Sovereign</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-4xl font-black text-white tracking-tighter">Custom</span>
              </div>
              <p className="text-sm text-zinc-400">Contact Sales. For regulated industries.</p>
            </div>
            <div className="w-full h-px bg-white/[0.06]" />
            <ul className="flex flex-col gap-4 flex-1">
              {[
                "Unlimited AI calls & On-premise deploy",
                "[2.0] AWS Nitro Enclave Hardware Attestation",
                "[2.0] Polygon Blockchain Log Anchoring",
                "[2.0] OpenFHE Cryptographic Math",
                "MAS TRM / BNM RMiT Compliance Packs",
                "[2.0] Dedicated NVIDIA NeMo Instance"
              ].map(f => (
                <li key={f} className="flex items-start gap-3 text-sm text-zinc-300 leading-snug">
                  <span className="text-violet-400 shrink-0 mt-0.5">✓</span>
                  {renderFeature(f)}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-2 block w-full rounded-xl border border-violet-500/30 bg-violet-500/10 py-4 text-sm font-bold text-violet-300 text-center hover:bg-violet-500/20 transition-all">
              Book a Demo →
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
