"use client";

/**
 * @file app/(public)/legal/page.tsx
 * @description Command 089 — Legal & Liability Shield Landing Page
 *
 * Route:  /legal
 * Access: Fully public — static server component, no auth.
 *
 * Design: High-trust, professional. Aimed at lawyers, compliance officers,
 * and regulators looking for structural proof of AI governance.
 */

import Link from "next/link";
import React from "react";

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-950 p-8 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 text-7xl opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        {icon}
      </div>
      <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl border border-emerald-500/20 bg-emerald-500/10 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed font-medium">{desc}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegalPortalPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-emerald-500/20 overflow-x-hidden">
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/stp"          className="hover:text-white transition-colors">STP Protocol</Link>
            <Link href="/legal"        className="text-white font-semibold">Legal Shield</Link>
            <Link href="/verify"       className="hover:text-white transition-colors">Verify Certificate</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors px-3 py-2">Sign In</Link>
            <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">
              Deploy Audit Vault
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 px-6">
        <div className="pointer-events-none absolute inset-0 z-0">
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808009_1px,transparent_1px),linear-gradient(to_bottom,#80808009_1px,transparent_1px)] bg-[size:48px_48px]" />
           <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-emerald-500/[0.03] blur-[150px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-8">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Sovereign Infrastructure
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[1.02] text-white">
            Mathematical Proof for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              AI Liability.
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-zinc-400 max-w-2xl leading-relaxed font-medium">
            The StreetMP OS Audit Vault provides non-repudiable, cryptographic evidence for every AI decision. 
            No more manual logs. <span className="text-white">Just absolute mathematical certainty.</span>
          </p>

          <div className="flex flex-wrap gap-4 justify-center mt-4">
            <Link
              href="/verify"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-bold text-white hover:bg-white/[0.07] transition-all"
            >
              Verify an Affidavit →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-black/40 border-y border-white/[0.04]">
        <div className="mx-auto max-w-6xl grid md:grid-cols-3 gap-6">
          <FeatureCard 
            icon="🌲"
            title="Immutable Ledger" 
            desc="Every inference payload is cryptographically hashed and anchored into a daily SHA-256 Merkle Root, guaranteeing that logs can never be altered or deleted post-execution."
          />
          <FeatureCard 
            icon="⚖️"
            title="Court-Admissible" 
            desc="Download certified Legal Exhibits (Affidavits of Execution) for any transaction hash. These documents contain complete cryptographic binding to hardware enclave signatures."
          />
          <FeatureCard 
            icon="🔐"
            title="Zero-Knowledge Verification" 
            desc="Our validators provide structural proof of pipeline compliance (DLP scanning, region locking, guardrail passage) without ever revealing or storing the raw prompt text."
          />
        </div>
      </section>

      {/* ── Affidavit Example / CTA ────────────────────────────────────────── */}
      <section className="px-6 py-32">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/[0.08] bg-zinc-950 overflow-hidden flex flex-col md:flex-row">
            
            {/* The "Paper" Representation */}
            <div className="bg-[#fdfaf6] p-10 flex-1 border-b md:border-b-0 md:border-r border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
              <div className="font-serif text-black/90 max-w-xs space-y-4">
                <div className="w-16 h-16 rounded-full border-4 border-double border-black/80 flex items-center justify-center text-[8px] font-bold text-center tracking-widest uppercase opacity-80 mb-6">
                  StreetMP<br/>OS
                </div>
                <h3 className="text-xl font-bold uppercase tracking-widest border-b-2 border-black/20 pb-2">
                  Affidavit of Execution
                </h3>
                <p className="text-[10px] leading-relaxed text-black/70 italic">
                  "This document serves as an immutable, cryptographically verifiable record of an artificial intelligence operation processed by the StreetMP OS Sovereign Infrastructure..."
                </p>
                <div className="space-y-2 mt-4">
                  <div className="h-px bg-black/10 w-full" />
                  <div className="h-px bg-black/10 w-3/4" />
                  <div className="h-px bg-black/10 w-5/6" />
                </div>
              </div>
            </div>

            {/* The Text / Action */}
            <div className="p-10 md:p-12 flex-1 flex flex-col justify-center gap-6">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Public Verification
                </span>
                <h2 className="text-3xl font-bold text-white tracking-tight mt-2">
                  Generate an Exhibit
                </h2>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                If you are an auditor, legal counsel, or compliance officer investigating an execution, you can generate the official printable <strong>Affidavit of Execution</strong> directly from the Verification portal using the execution hash provided by your client.
              </p>
              <div>
                <Link
                  href="/verify"
                  className="inline-flex rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  Go to Verification Portal →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">StreetMP <span className="text-emerald-400">OS</span></span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/stp"          className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Open Standard</Link>
            <Link href="/verify"       className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Verify Certificate</Link>
            <Link href="/legal"        className="text-white hover:text-white transition-colors font-semibold">Legal & Liability Shield</Link>
            <Link href="/developers"   className="hover:text-white transition-colors">Developer Portal</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Risk Scanner</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
