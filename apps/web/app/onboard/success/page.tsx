"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function OnboardSuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Animated check */}
        <div className="w-20 h-20 rounded-full border-2 border-emerald-500/40 bg-emerald-950/40 flex items-center justify-center mx-auto mb-8 animate-pulse">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#00E599" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-3">
          ✓ Payment Confirmed · Provisioning{dots}
        </div>
        <h1 className="text-3xl font-black mb-4 leading-tight">
          You're on the<br />
          <span style={{ background: "linear-gradient(135deg, #00E599, #00B377)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Sovereign AI Grid.
          </span>
        </h1>
        <p className="text-white/40 text-sm mb-8 leading-relaxed">
          Your account is being provisioned. A welcome email with your StreetMP API key and one-line integration snippet is on its way now.
        </p>

        <div className="bg-white/4 border border-white/8 rounded-2xl p-6 text-left mb-8">
          <p className="text-xs font-mono text-white/30 uppercase tracking-widest mb-4">What's happening right now</p>
          <div className="space-y-3">
            {[
              { label: "V18 API Key Service", status: "Generating your StreetMP key" },
              { label: "V35 Audit Vault", status: "Initializing your immutable ledger" },
              { label: "V65 RBAC Engine", status: "Configuring your permissions" },
              { label: "Email Engine", status: "Dispatching welcome email" },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div>
                  <span className="text-xs font-mono text-emerald-400">{label}</span>
                  <span className="text-white/30 text-xs"> — {status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {sessionId && (
          <p className="text-white/20 font-mono text-xs mb-6">
            Session: {sessionId.slice(0, 20)}...
          </p>
        )}

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-black transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #00E599, #00B377)" }}
        >
          Open Your Dashboard →
        </Link>
      </div>
    </>
  );
}

export default function OnboardSuccessPage() {
  return (
    <div
      className="min-h-screen bg-[#020202] text-white flex items-center justify-center px-6"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(0,229,153,0.08) 0%, transparent 60%)",
        }}
      />
      <Suspense fallback={
        <div className="text-emerald-500 font-mono text-sm animate-pulse">
          Loading Checkout Validation...
        </div>
      }>
        <OnboardSuccessContent />
      </Suspense>
    </div>
  );
}
