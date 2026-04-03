"use client";

import { useState } from "react";

/**
 * @component TrustBadge
 * @version V36
 * @description StreetMP Verified embeddable badge.
 *
 * Renders a compact "StreetMP Verified" badge. When clicked, opens a modal
 * showing the full execution certificate (execution_id, trust_score,
 * compliance_flags, and ZK fingerprint).
 *
 * Usage:
 *   <TrustBadge
 *     executionId="exec_abc..."
 *     trustScore={97}
 *     fingerprint="3FA9B0C12D4E"
 *     trustBand="PLATINUM"
 *     complianceFlags={[]}
 *   />
 */

interface TrustBadgeProps {
  executionId:      string;
  trustScore:       number;
  fingerprint:      string;
  trustBand:        "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "CRITICAL";
  complianceFlags?: string[];
  model?:           string;
  region?:          string;
  issuedAt?:        string;
}

const BAND_STYLES: Record<TrustBadgeProps["trustBand"], { bg: string; border: string; text: string; glow: string }> = {
  PLATINUM: { bg: "bg-blue-950/60",   border: "border-blue-400/40",   text: "text-blue-200",    glow: "shadow-[0_0_18px_rgba(59,130,246,0.35)]" },
  GOLD:     { bg: "bg-amber-950/60",  border: "border-amber-400/40",  text: "text-amber-200",   glow: "shadow-[0_0_18px_rgba(245,158,11,0.30)]" },
  SILVER:   { bg: "bg-slate-800/60",  border: "border-slate-400/40",  text: "text-slate-200",   glow: "" },
  BRONZE:   { bg: "bg-orange-950/60", border: "border-orange-400/40", text: "text-orange-300",  glow: "" },
  CRITICAL: { bg: "bg-red-950/60",    border: "border-red-500/50",    text: "text-red-300",     glow: "shadow-[0_0_18px_rgba(239,68,68,0.40)]" },
};

export function TrustBadge({
  executionId,
  trustScore,
  fingerprint,
  trustBand,
  complianceFlags = [],
  model = "streetmp-auto",
  region = "eu-west-1",
  issuedAt,
}: TrustBadgeProps) {
  const [open, setOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"SECURE" | "TAMPERED" | null>(null);

  const style = BAND_STYLES[trustBand];

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/v1/verify/${executionId}`);
      const data = await res.json();
      setVerifyStatus(data.status === "SECURE" ? "SECURE" : "TAMPERED");
    } catch {
      setVerifyStatus("TAMPERED");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      {/* ── Badge ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wide transition-all hover:scale-105 active:scale-95 cursor-pointer ${style.bg} ${style.border} ${style.text} ${style.glow}`}
        title={`StreetMP Verified · Trust Score ${trustScore}/100 · Click to inspect`}
      >
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10.5 3.5H14V7L16 8L14 9V12.5H10.5L8 15L5.5 12.5H2V9L0 8L2 7V3.5H5.5L8 1Z"
            fill="currentColor" opacity="0.8"/>
          <path d="M5.5 8L7.5 10L10.5 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>StreetMP Verified</span>
        <span className="opacity-60 font-mono text-[9px]">{fingerprint}</span>
      </button>

      {/* ── Modal ─────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0d1117] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${trustBand === "CRITICAL" ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                <h2 className="text-sm font-bold text-white">Execution Certificate Viewer</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Trust Score Spotlight */}
            <div className={`flex items-center justify-between px-6 py-5 border-b border-slate-800 ${style.bg}`}>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">V25 Trust Score</p>
                <p className={`text-5xl font-black ${style.text}`}>{trustScore}<span className="text-2xl opacity-60">/100</span></p>
              </div>
              <div className={`px-3 py-1.5 rounded-full border text-xs font-bold tracking-widest ${style.border} ${style.text} ${style.bg}`}>
                {trustBand}
              </div>
            </div>

            {/* Certificate Fields */}
            <div className="px-6 py-5 space-y-3 text-xs font-mono">
              {[
                { label: "Execution ID",       val: executionId },
                { label: "ZK Fingerprint",     val: fingerprint },
                { label: "Model",              val: model },
                { label: "Region",             val: region },
                { label: "Issued At",          val: issuedAt ? new Date(issuedAt).toLocaleString() : new Date().toLocaleString() },
                { label: "Compliance Flags",   val: complianceFlags.length ? complianceFlags.join(", ") : "None" },
              ].map(f => (
                <div key={f.label} className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-2 last:border-0">
                  <span className="text-slate-500 shrink-0 w-32">{f.label}</span>
                  <span className="text-slate-200 text-right break-all">{f.val}</span>
                </div>
              ))}
            </div>

            {/* Verify Button */}
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying
                  ? <><span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />Verifying...</>
                  : "Verify Cryptographic Integrity"}
              </button>

              {verifyStatus && (
                <div className={`px-4 py-2.5 rounded-xl border text-xs font-bold tracking-widest flex items-center gap-2
                  ${verifyStatus === "SECURE"
                    ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                    : "bg-red-950/60 border-red-500/30 text-red-300 animate-pulse"}`}>
                  {verifyStatus === "SECURE" ? "✓ SECURE" : "⚠ TAMPERED"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
