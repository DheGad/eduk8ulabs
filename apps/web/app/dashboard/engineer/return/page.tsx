"use client";

/**
 * @file return/page.tsx
 * @route /dashboard/engineer/return
 * @description Stripe Connect Express return landing — VERIFIED reconciliation.
 *
 * Unlike a simple countdown, this page actively polls the backend
 * to confirm that Stripe has flipped `payouts_enabled` to `true`
 * before ever redirecting the user. This prevents false-positive UI
 * where the user sees "Bank Verified" before the webhook has processed.
 *
 * Flow:
 *   1. Show "Verifying Bank Handshake…" spinner
 *   2. Poll GET /engineer/dashboard (busting the 3s cache) every 2 seconds
 *   3. If `payouts_enabled === true` → show success state → redirect dashboard
 *   4. If not confirmed within 30 seconds → show manual retry button
 *   5. ?refresh=true (Stripe link expiry) → immediately re-initiate onboarding
 */

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getEngineerDashboard, createStripeOnboardingLink } from "@/lib/apiClient";

// ================================================================
// CONSTANTS
// ================================================================
const POLL_INTERVAL_MS  = 2_000;
const MAX_POLLS         = 15;   // 15 × 2s = 30 second timeout
const REDIRECT_DELAY_MS = 1_500; // brief pause after success before redirect

// ================================================================
// STATUS TYPES
// ================================================================
type VerifyPhase =
  | "polling"    // Actively checking backend
  | "confirmed"  // payouts_enabled === true — ready to redirect
  | "timeout"    // Max polls hit, not confirmed yet
  | "error"      // API error
  | "refreshing" // Re-initiating expired Stripe link

// ================================================================
// INNER (uses useSearchParams — wrapped in Suspense)
// ================================================================
function ReturnInner() {
  const router  = useRouter();
  const params  = useSearchParams();
  const isRefresh = params.get("refresh") === "true";

  const [phase, setPhase]       = useState<VerifyPhase>(isRefresh ? "refreshing" : "polling");
  const [pollCount, setPollCount] = useState(0);
  const [errMsg, setErrMsg]     = useState<string | null>(null);

  // ── Handle Stripe "refresh" redirect (link expired mid-flow) ──
  useEffect(() => {
    if (!isRefresh) return;
    createStripeOnboardingLink()
      .then(({ onboarding_url }) => { window.location.href = onboarding_url; })
      .catch(() => setPhase("error"));
  }, [isRefresh]);

  // ── Poll backend for payouts_enabled ─────────────────────────
  const poll = useCallback(async () => {
    try {
      // bust=true forces a fresh DB read, bypassing the 3s API cache
      const data = await getEngineerDashboard(true);
      if (data.hcq_profile.payouts_enabled) {
        setPhase("confirmed");
        setTimeout(() => router.push("/dashboard/engineer"), REDIRECT_DELAY_MS);
        return;
      }
    } catch (e) {
      setErrMsg((e as Error).message ?? "Unable to reach the server.");
      setPhase("error");
      return;
    }

    setPollCount((c) => {
      const next = c + 1;
      if (next >= MAX_POLLS) {
        setPhase("timeout");
      }
      return next;
    });
  }, [router]);

  useEffect(() => {
    if (isRefresh || phase !== "polling") return;
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isRefresh, phase, poll]);

  // ── Progress indicator (0–100%) ───────────────────────────────
  const progress = Math.min((pollCount / MAX_POLLS) * 100, 100);

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full blur-3xl transition-all duration-1000"
          style={{
            background:
              phase === "confirmed"
                ? "radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)"
                : phase === "timeout" || phase === "error"
                ? "radial-gradient(ellipse, rgba(239,68,68,0.06) 0%, transparent 70%)"
                : "radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center max-w-sm w-full">

        {/* ── State Icon ─────────────────────────────────────── */}
        <div className="relative h-24 w-24">
          {phase === "polling" && (
            <>
              <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-violet-500/20 animate-ping" style={{ animationDelay: "0.4s" }} />
            </>
          )}
          <div
            className="relative h-24 w-24 rounded-full flex items-center justify-center border-2 transition-all duration-700"
            style={{
              background:
                phase === "confirmed"
                  ? "rgba(16,185,129,0.1)"
                  : phase === "timeout" || phase === "error"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(139,92,246,0.1)",
              borderColor:
                phase === "confirmed"
                  ? "rgba(52,211,153,0.4)"
                  : phase === "timeout" || phase === "error"
                  ? "rgba(248,113,113,0.4)"
                  : "rgba(139,92,246,0.4)",
            }}
          >
            {phase === "polling" || phase === "refreshing" ? (
              <svg className="h-9 w-9 text-violet-400 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : phase === "confirmed" ? (
              <svg className="h-9 w-9 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-9 w-9 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
          </div>
        </div>

        {/* ── Text ───────────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="text-xl font-light text-white">
            {phase === "polling"    && "Verifying Bank Handshake…"}
            {phase === "refreshing" && "Refreshing your session…"}
            {phase === "confirmed"  && "Bank Account Verified ✓"}
            {phase === "timeout"    && "Verification Pending"}
            {phase === "error"      && "Verification Error"}
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            {phase === "polling" && "Confirming with Stripe that your account is fully activated."}
            {phase === "refreshing" && "Your Stripe session expired. Generating a fresh link…"}
            {phase === "confirmed" && "Payouts are enabled. Redirecting to your dashboard…"}
            {phase === "timeout" && "Stripe is still processing your account. This can take a few minutes."}
            {phase === "error" && (errMsg ?? "Unable to verify your account status.")}
          </p>
        </div>

        {/* ── Progress bar (polling only) ─────────────────────── */}
        {phase === "polling" && (
          <div className="w-full max-w-xs space-y-2">
            <div className="h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, rgba(139,92,246,0.8), rgba(167,139,250,0.9))",
                }}
              />
            </div>
            <p className="text-[10px] text-zinc-700">
              Check {pollCount + 1}/{MAX_POLLS} — polling every {POLL_INTERVAL_MS / 1000}s
            </p>
          </div>
        )}

        {/* ── Timeout actions ─────────────────────────────────── */}
        {phase === "timeout" && (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.05] px-4 py-3 text-xs text-yellow-300 leading-relaxed">
              Stripe webhooks can take up to 2 minutes after onboarding. You can safely return to your dashboard now — the status will update automatically.
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/engineer")}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-sm font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              type="button"
              onClick={() => { setPhase("polling"); setPollCount(0); }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Error action ────────────────────────────────────── */}
        {phase === "error" && (
          <button
            type="button"
            onClick={() => router.push("/dashboard/engineer")}
            className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            Return to Dashboard
          </button>
        )}

        {/* ── Stripe attribution ─────────────────────────────── */}
        <div className="flex items-center gap-2 opacity-25 mt-2">
          <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
          </svg>
          <span className="text-[10px] text-zinc-500">Verified by Stripe Connect</span>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// EXPORT (Suspense boundary for useSearchParams in Next.js 15)
// ================================================================
export default function EngineerStripeReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    }>
      <ReturnInner />
    </Suspense>
  );
}
