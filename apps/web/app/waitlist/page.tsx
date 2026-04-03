"use client";

/**
 * @file page.tsx
 * @route /waitlist
 * @description High-converting waitlist landing page.
 *
 * Design goals:
 *   - Dark mode, enterprise-grade, zero fluff
 *   - 3 value cards: Privacy, Escrow, Security
 *   - Single-field email form, role selector, optional company
 *   - Inline success / error states — no page redirect
 *   - Connected to POST /api/waitlist
 */

import { useState, useId } from "react";
import Link from "next/link";

// ================================================================
// VALUE CARD DATA
// ================================================================
const VALUE_CARDS = [
  {
    icon: "🔏",
    title: "Privacy Shield",
    color: "from-cyan-500/10 to-cyan-500/0",
    border: "border-cyan-500/20",
    accent: "text-cyan-400",
    points: [
      "PII scrubbed before any LLM sees it",
      "HIPAA Safe Harbor by architecture",
      "GDPR Art. 25 — Privacy by Design",
      "6 data types: SSN, email, phone, CC, names, IP",
    ],
  },
  {
    icon: "🔐",
    title: "Mathematical Escrow",
    color: "from-violet-500/10 to-violet-500/0",
    border: "border-violet-500/20",
    accent: "text-violet-400",
    points: [
      "Pay only for schema-valid AI output",
      "Funds held by Stripe — not released on failure",
      "Cryptographic Proof of Execution on every task",
      "HMAC-SHA256 receipts auditors can verify",
    ],
  },
  {
    icon: "🏛",
    title: "Enterprise Security",
    color: "from-emerald-500/10 to-emerald-500/0",
    border: "border-emerald-500/20",
    accent: "text-emerald-400",
    points: [
      "BYOK Vault — your keys, AES-256 encrypted",
      "Zero database ports exposed to internet",
      "TLS 1.3 via Caddy — auto Let's Encrypt",
      "Policy Engine: model allow-lists + spend caps",
    ],
  },
];

const ROLES = [
  { value: "enterprise", label: "Enterprise Buyer" },
  { value: "engineer",   label: "AI Engineer" },
  { value: "cto",        label: "CTO / CISO" },
  { value: "investor",   label: "Investor" },
  { value: "other",      label: "Other" },
];

// ================================================================
// STAT BAR
// ================================================================
const STATS = [
  { value: "10",  label: "Microservices" },
  { value: "13/13", label: "Build Pass Rate" },
  { value: "0",   label: "DB Ports Exposed" },
  { value: "∞",   label: "Proof Receipts/day" },
];

// ================================================================
// PAGE
// ================================================================
export default function WaitlistPage() {
  const emailId  = useId();
  const roleId   = useId();
  const companyId = useId();

  const [email,   setEmail]   = useState("");
  const [role,    setRole]    = useState("enterprise");
  const [company, setCompany] = useState("");

  type Phase = "idle" | "loading" | "success" | "error";
  const [phase,  setPhase]  = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setPhase("loading");
    setErrMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, company: company.trim() || undefined }),
      });
      const json = await res.json() as { success?: boolean; message?: string; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Our servers hit an issue. We have been notified. Please try again in 30 seconds.");
      setPhase("success");
    } catch (err) {
      setErrMsg((err as Error).message);
      setPhase("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden">
      {/* ── Ambient glow ─────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(20,184,166,0.05) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-28">

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between mb-20">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors">
            <span className="font-mono font-bold tracking-widest">STREETMP</span>
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold text-indigo-300 uppercase tracking-widest">OS</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-zinc-500 font-mono">PRIVATE BETA</span>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-widest">
              Accepting Design Partners — 5 Spots
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extralight tracking-tight text-white leading-tight mb-6">
            The Sovereign AI Layer
            <br />
            <span className="font-light text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #818cf8, #22d3ee, #34d399)" }}>
              for the Enterprise
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light">
            Cryptographic proof on every AI task. PII scrubbed before it ever reaches an LLM.
            Funds held in escrow until the output is mathematically verified.
            <br className="hidden sm:block" />
            <span className="text-white/60"> Not a platform. An operating system.</span>
          </p>
        </div>

        {/* ── Stats bar ────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-px mb-16 rounded-2xl overflow-hidden border border-white/[0.06]">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white/[0.02] px-4 py-4 text-center">
              <span className="font-mono text-xl font-bold text-white block">{s.value}</span>
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Value Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          {VALUE_CARDS.map((c) => (
            <div key={c.title}
              className={`rounded-2xl border ${c.border} bg-gradient-to-b ${c.color} p-5 flex flex-col gap-3`}>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{c.icon}</span>
                <h3 className={`text-sm font-semibold ${c.accent}`}>{c.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
                    <span className={`shrink-0 mt-0.5 ${c.accent}`}>✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Waitlist Form ─────────────────────────────────────── */}
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8">
            {phase === "success" ? (
              /* ── Success state ─────────────────────────────── */
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-light text-white mb-1">You&apos;re on the list.</h2>
                  <p className="text-sm text-zinc-500">We&apos;ll reach out with private access details within 48 hours.</p>
                </div>
                <div className="flex gap-3 mt-2 text-xs">
                  <Link href="/" className="text-zinc-600 hover:text-zinc-400 transition-colors">← Back home</Link>
                  <span className="text-zinc-800">·</span>
                  <a href="https://twitter.com/streetmp" target="_blank" rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 transition-colors">Follow @streetmp →</a>
                </div>
              </div>
            ) : (
              /* ── Form ─────────────────────────────────────── */
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-light text-white mb-1">Request Early Access</h2>
                  <p className="text-xs text-zinc-600">5 Design Partner spots. No deck. No sales team. Just the OS running live.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Email */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={emailId} className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                      Work Email *
                    </label>
                    <input
                      id={emailId}
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="cto@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-all focus:border-indigo-500/40 focus:bg-white/[0.06]"
                    />
                  </div>

                  {/* Role */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={roleId} className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                      I am a…
                    </label>
                    <select
                      id={roleId}
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#0a0a0f] px-4 py-3 text-sm text-white outline-none transition-all focus:border-indigo-500/40"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Company (optional) */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={companyId} className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                      Company <span className="text-zinc-700">(optional)</span>
                    </label>
                    <input
                      id={companyId}
                      type="text"
                      placeholder="Acme Corp"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-all focus:border-indigo-500/40 focus:bg-white/[0.06]"
                    />
                  </div>

                  {/* Error */}
                  {phase === "error" && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-400">
                      {errMsg}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={phase === "loading" || !email.trim()}
                    className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: phase === "loading"
                        ? "rgba(99,102,241,0.3)"
                        : "linear-gradient(135deg, rgba(99,102,241,0.9), rgba(20,184,166,0.8))",
                    }}
                  >
                    {phase === "loading" ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Securing your spot…
                      </span>
                    ) : (
                      "Request Private Access →"
                    )}
                  </button>

                  <p className="text-[10px] text-zinc-700 text-center">
                    No spam. No newsletters. Only direct access from the builder.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="mt-20 text-center space-y-3">
          <div className="flex items-center justify-center gap-6 text-[10px] text-zinc-700">
            <a href="https://twitter.com/streetmp" target="_blank" rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors">@streetmp on X</a>
            <span>·</span>
            <Link href="/verify/demo" className="hover:text-zinc-400 transition-colors">Verify a Proof</Link>
            <span>·</span>
            <a href="mailto:contact@streetmp.com" className="hover:text-zinc-400 transition-colors">contact@streetmp.com</a>
          </div>
          <p className="text-[9px] text-zinc-800">
            StreetMP OS v2 · Cryptographically-governed AI execution · March 2026
          </p>
        </div>

      </div>
    </div>
  );
}
