"use client";

/**
 * @file app/(public)/verify/page.tsx
 * @description Command 087 — STP Certificate Verifier (Public)
 *
 * Route:  /verify
 * Access: Fully public — no auth required by design.
 *
 * Accepts:
 *   - 64-char lowercase hex Merkle leaf hash
 *   - exec_* execution ID (V36 cert ledger lookup)
 *
 * The result is either a full "Verified Certificate" card or a 404.
 * This page is the public proof surface for the StreetMP Trust Protocol.
 */

import { useState, useRef } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type LookupMode = "merkle_leaf_hash" | "execution_id";

interface MerkleReceipt {
  leaf_hash:        string;
  leaf_index:       number;
  merkle_root:      string;
  date:             string;
  issued_at:        string | null;
  trust_score:      number | null;
  inference_region: string | null;
}

interface Certificate {
  execution_id:     string;
  fingerprint:      string;
  issued_at:        string;
  trust_score:      number;
  trust_band:       "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "CRITICAL";
  model:            string;
  provider:         string;
  region:           string;
  compliance_flags: string[];
  zk_signature:     string;
}

interface Attestation {
  verified_by:      string;
  algorithm:        string;
  verify_timestamp: string;
  stp_spec:         string;
}

interface VerifyResponse {
  success:          boolean;
  verified:         boolean;
  protocol:         string;
  lookup_mode:      LookupMode;
  status?:          "SECURE" | "TAMPERED";
  certificate?:     Certificate;
  receipt?:         MerkleReceipt;
  attestation?:     Attestation;
  prompt_retained:  boolean;
  response_retained: boolean;
  error?: { code: string; message: string };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROUTER_URL = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

const TRUST_BAND_STYLES: Record<string, { ring: string; badge: string; glow: string }> = {
  PLATINUM: { ring: "border-violet-500/40",  badge: "bg-violet-500/15 text-violet-300 border-violet-500/30", glow: "shadow-[0_0_40px_rgba(139,92,246,0.12)]" },
  GOLD:     { ring: "border-yellow-500/40",  badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", glow: "shadow-[0_0_40px_rgba(234,179,8,0.10)]"  },
  SILVER:   { ring: "border-zinc-400/40",    badge: "bg-zinc-400/10 text-zinc-300 border-zinc-400/30",      glow: "" },
  BRONZE:   { ring: "border-orange-500/40",  badge: "bg-orange-500/15 text-orange-300 border-orange-500/30", glow: "" },
  CRITICAL: { ring: "border-red-500/40",     badge: "bg-red-500/15 text-red-300 border-red-500/30",          glow: "shadow-[0_0_40px_rgba(239,68,68,0.10)]" },
};

// ─── Certificate Card ─────────────────────────────────────────────────────────

function VerifiedCertCard({ data }: { data: VerifyResponse }) {
  const isSecure   = data.verified && data.status !== "TAMPERED";
  const cert       = data.certificate;
  const receipt    = data.receipt;
  const attest     = data.attestation;
  const trust_band = cert?.trust_band ?? "SILVER";
  const styles     = TRUST_BAND_STYLES[trust_band] ?? TRUST_BAND_STYLES["SILVER"];

  return (
    <div className={`rounded-3xl border-2 bg-[#0D0D0D] overflow-hidden transition-all ${
      isSecure ? `${styles.ring} ${styles.glow}` : "border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.10)]"
    }`}>
      {/* Certificate header */}
      <div className={`px-8 py-6 border-b border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isSecure ? "bg-emerald-500/[0.04]" : "bg-red-500/[0.04]"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-3xl border ${
            isSecure ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"
          }`}>
            {isSecure ? "✅" : "⚠️"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                isSecure
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : "text-red-400 bg-red-500/10 border-red-500/30"
              }`}>
                {isSecure ? "VERIFIED — SECURE" : "TAMPERED — INVALID"}
              </span>
              <span className="text-[10px] font-mono text-zinc-600">{data.protocol}</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isSecure ? "STP Execution Certificate" : "Certificate Integrity Failure"}
            </h2>
            {cert && (
              <p className="text-xs font-mono text-zinc-500 mt-1">
                ID: {cert.execution_id} · FP: {cert.fingerprint}
              </p>
            )}
            {receipt && (
              <p className="text-xs font-mono text-zinc-500 mt-1">
                Merkle Leaf #{receipt.leaf_index} · Date: {receipt.date}
              </p>
            )}
          </div>
        </div>

        {/* Trust band badge */}
        {cert && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-lg font-black px-4 py-2 rounded-xl border ${styles.badge}`}>
              {cert.trust_band}
            </span>
            <span className="text-2xl font-black text-white">{cert.trust_score}<span className="text-sm text-zinc-500 font-normal"> / 100</span></span>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Trust Score</span>
          </div>
        )}
        {receipt?.trust_score != null && !cert && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-2xl font-black text-white">{receipt.trust_score}<span className="text-sm text-zinc-500 font-normal"> / 100</span></span>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Trust Score</span>
          </div>
        )}
      </div>

      {/* Certificate body */}
      <div className="p-8 grid sm:grid-cols-2 gap-6">

        {/* Execution metadata */}
        {cert && (
          <>
            <MetaCell label="Model"          value={cert.model}     mono />
            <MetaCell label="Provider"       value={cert.provider}  mono />
            <MetaCell label="Inference Region" value={cert.region}  mono />
            <MetaCell label="Issued At"      value={new Date(cert.issued_at).toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "long" })} />
          </>
        )}

        {/* Merkle receipt metadata */}
        {receipt && (
          <>
            {receipt.inference_region && <MetaCell label="Inference Region" value={receipt.inference_region} mono />}
            {receipt.issued_at && <MetaCell label="Issued At" value={new Date(receipt.issued_at).toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "long" })} />}
            <MetaCell label="Merkle Leaf Index"  value={`#${receipt.leaf_index}`} mono />
            <MetaCell label="Audit Date (UTC)"   value={receipt.date} mono />
          </>
        )}

        {/* Compliance flags */}
        {cert?.compliance_flags && cert.compliance_flags.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Active Compliance Frameworks (V85)</p>
            <div className="flex flex-wrap gap-2">
              {cert.compliance_flags.map((flag) => (
                <span key={flag} className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                  <span className="text-emerald-600 mr-1.5">▪</span>{flag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ZK Signature */}
        {cert && (
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">HMAC-SHA256 ZK Signature</p>
            <div className="rounded-xl border border-white/[0.07] bg-zinc-950/80 px-4 py-3 font-mono text-xs text-violet-400 break-all">
              {cert.zk_signature}
            </div>
          </div>
        )}

        {/* Merkle root */}
        {receipt && (
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Merkle Tree Root (Day: {receipt.date})</p>
            <div className="rounded-xl border border-white/[0.07] bg-zinc-950/80 px-4 py-3 font-mono text-xs text-violet-400 break-all">
              {receipt.merkle_root}
            </div>
          </div>
        )}

        {/* Attestation block */}
        {attest && (
          <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Verification Attestation</p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <MetaCell label="Verified By"    value={attest.verified_by} />
              <MetaCell label="Algorithm"      value={attest.algorithm} mono />
              <MetaCell label="Verify Time"    value={new Date(attest.verify_timestamp).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} />
              <MetaCell label="Specification"  value={attest.stp_spec} mono />
            </div>
          </div>
        )}

        {/* Privacy attestation */}
        <div className="sm:col-span-2 flex items-center gap-6 text-xs text-zinc-600 border-t border-white/[0.04] pt-4">
          <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> prompt_retained: {String(data.prompt_retained)}</span>
          <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> response_retained: {String(data.response_retained)}</span>
          <Link href="/stp" className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors font-mono">stp spec →</Link>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className={`text-sm text-zinc-300 ${mono ? "font-mono break-all" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EXAMPLE_IDS = [
  { label: "Exec ID format",  value: "exec_a3f8c2d1e94b7056fe3a" },
  { label: "Merkle hash format", value: "a3f8c2d1e94b7056fe3a812c490d67b2e15f9308a9c4d823f07b5e1649830f72" },
];

export default function VerifyPage() {
  const [hash,      setHash]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<VerifyResponse | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleVerify = async () => {
    const input = hash.trim();
    if (!input || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setRateLimited(false);

    try {
      const res = await fetch(`${ROUTER_URL}/api/v1/public/verify/${encodeURIComponent(input)}`);

      if (res.status === 429) {
        setRateLimited(true);
        setLoading(false);
        return;
      }

      const json = await res.json() as VerifyResponse;

      if (!json.success) {
        setError(json.error?.message ?? "Certificate not found. Verify the hash is correct.");
      } else {
        setResult(json);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setError("Cannot reach the verification engine. Please check the router service is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/stp"          className="hover:text-white transition-colors">STP Spec</Link>
            <Link href="/verify"       className="text-white font-semibold">Verify Certificate</Link>
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 font-semibold">Risk Scanner</Link>
          </div>
          <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">
            Get API Access
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        {/* Background grid */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl flex flex-col items-center gap-8">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
              STP Certificate Verifier
            </span>
          </div>

          <div className="text-center flex flex-col gap-4">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter leading-[1.04]">
              Verify Any{" "}
              <span className="text-emerald-400">STP Certificate</span>
            </h1>
            <p className="text-xl text-zinc-400 leading-relaxed max-w-xl mx-auto">
              Paste a StreetMP execution ID or Merkle leaf hash.
              Any auditor, regulator, or legal team can verify a certificate here — no account required.
            </p>
            <p className="text-sm text-zinc-500 max-w-lg mx-auto">
              This is the{" "}
              <Link href="/stp" className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold underline underline-offset-2">
                Official Reference Implementation of the STP Standard
              </Link>{" "}
              — a free, open specification for cryptographically verifiable AI execution certificates.
            </p>
          </div>

          {/* ── Verifier Form ─────────────────────────────────────────── */}
          <div className="w-full rounded-3xl border border-white/[0.08] bg-zinc-950/80 backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/[0.05] bg-white/[0.02]">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                GET /api/v1/public/verify/{"{hash}"}
              </span>
              <div />
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* Hash input */}
              <div className="flex flex-col gap-2">
                <label htmlFor="hash-input" className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  Execution ID or Merkle Leaf Hash
                </label>
                <input
                  id="hash-input"
                  type="text"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleVerify(); }}
                  placeholder="exec_a3f8c2d1… or a3f8c2d1e94b7056…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder-white/15 font-mono transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/30"
                />
                <div className="flex gap-2 flex-wrap">
                  {EXAMPLE_IDS.map((ex) => (
                    <button
                      key={ex.label}
                      onClick={() => setHash(ex.value)}
                      className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors border border-zinc-800 hover:border-zinc-600 rounded-lg px-2.5 py-1 font-mono"
                    >
                      Use {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-red-400 mb-1">Certificate Not Found</p>
                    <p className="text-xs text-red-300/70">{error}</p>
                  </div>
                </div>
              )}

              {rateLimited && (
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-4 py-3 text-sm text-orange-400">
                  Rate limited — 30 lookups per minute. Please wait 60 seconds.
                </div>
              )}

              {/* Verify button */}
              <button
                id="verify-button"
                onClick={() => void handleVerify()}
                disabled={loading || !hash.trim()}
                className="w-full relative overflow-hidden rounded-2xl bg-emerald-500 px-6 py-4 text-base font-bold text-black transition-all hover:bg-emerald-400 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    Verifying against Merkle ledger…
                  </span>
                ) : (
                  "Verify Certificate →"
                )}
              </button>

              {/* Rate limit notice */}
              <p className="text-center text-[11px] text-zinc-600">
                30 verifications / minute · No account required · Read-only access to public Merkle ledger
              </p>
            </div>
          </div>

          {/* Trust callouts */}
          <div className="grid grid-cols-3 gap-4 w-full">
            {[
              { icon: "🔐", label: "Zero-Knowledge",  detail: "No prompt or response text is ever in a certificate" },
              { icon: "🌲", label: "Merkle Anchored",  detail: "Per-tenant daily SHA-256 Merkle tree audit trail" },
              { icon: "⚖️", label: "Auditor-Ready",    detail: "Verifiable by any third party without an account" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-4 text-center flex flex-col gap-2 items-center">
                <span className="text-2xl">{c.icon}</span>
                <p className="text-xs font-bold text-zinc-300">{c.label}</p>
                <p className="text-[11px] text-zinc-600 leading-snug">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────── */}
      {result && (
        <section ref={resultsRef} className="px-6 py-16 bg-[#060606] border-t border-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-6 font-mono">
              Verification result · {new Date().toUTCString()}
            </p>
            <VerifiedCertCard data={result} />

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`${ROUTER_URL}/api/v1/public/legal/exhibit/${result.certificate?.zk_signature ?? result.receipt?.leaf_hash ?? ""}?date=${result.receipt?.date ?? new Date().toISOString().slice(0, 10)}&tenant_id=dev-sandbox`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/[0.05] px-6 py-3 text-sm font-bold text-white hover:bg-blue-500/[0.1] transition-all"
              >
                Download Certified Exhibit
              </a>
              <Link
                href="/stp"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white hover:bg-white/[0.07] transition-all"
              >
                Read STP Specification
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black hover:bg-emerald-400 transition-all"
              >
                Issue Your Own Certificates →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">StreetMP <span className="text-emerald-400">OS</span></span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/stp"          className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Specification</Link>
            <Link href="/verify"       className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Verify Certificate</Link>
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/neutrality"   className="hover:text-white transition-colors">Vendor Neutrality</Link>
            <Link href="/deployment"   className="hover:text-white transition-colors">5-Min Deploy</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Risk Scanner</Link>
            <Link href="/login"        className="hover:text-white transition-colors">Console Login</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
