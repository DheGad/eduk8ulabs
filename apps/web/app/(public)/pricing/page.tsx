"use client";

/**
 * @file app/(public)/pricing/page.tsx
 * @phase Phase 5.5 — Razorpay India Integration
 * @description
 *   Unified pricing page with dual-gateway checkout:
 *     • INR currency → "Pay with Razorpay" (Checkout.js, Standard flow)
 *     • All other currencies → "Pay with Stripe" (Checkout.com redirect)
 *
 *   Indian compliance:
 *     • GSTIN field shown when INR is selected (optional for B2C, mandatory for B2B)
 *     • GST breakdown (18%) shown in order summary before payment
 *     • Prices shown in paise-rounded INR
 *
 *   Razorpay Checkout.js is loaded lazily (only when needed).
 */

import React, { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Currency = "USD" | "MYR" | "SGD" | "INR" | "EUR" | "GBP";
type Gateway  = "stripe" | "razorpay";

// ── Currency config ───────────────────────────────────────────────────────────

const CURRENCIES: { code: Currency; symbol: string; rate: number; gateway: Gateway }[] = [
  { code: "USD", symbol: "$",   rate: 1,     gateway: "stripe"   },
  { code: "EUR", symbol: "€",   rate: 0.92,  gateway: "stripe"   },
  { code: "GBP", symbol: "£",   rate: 0.79,  gateway: "stripe"   },
  { code: "SGD", symbol: "S$",  rate: 1.35,  gateway: "stripe"   },
  { code: "MYR", symbol: "RM",  rate: 4.75,  gateway: "stripe"   },
  { code: "INR", symbol: "₹",   rate: 83.5,  gateway: "razorpay" },
];

// ── Plan catalog ──────────────────────────────────────────────────────────────

const TIERS = [
  {
    key:       "free",
    name:      "Starter",
    desc:      "For solo developers and small prototypes.",
    basePrice: 0,
    features:  [
      "500 Executions / Month",
      "Standard Models (GPT-3.5, Haiku)",
      "Global GDPR Compliance",
      "Community Support",
    ],
  },
  {
    key:       "pro",
    name:      "Growth",
    desc:      "For production scaling and small teams.",
    basePrice: 49,
    highlight: true,
    inrTotal:  4000,   // ₹4,000 incl. 18% GST
    inrBase:   3390,   // ₹3,390 pre-GST (rounded)
    inrGst:    610,    // ₹610 GST
    features:  [
      "50,000 Executions / Month",
      "Premium Models (GPT-4o, Opus)",
      "V67 Edge DLP Tokenisation",
      "Sentinel Security Layer",
      "Webhook Dispatch Engine",
      "Standard Email Support",
    ],
  },
  {
    key:       "enterprise",
    name:      "Scale",
    desc:      "Custom limits and dedicated infrastructure.",
    basePrice: 299,
    inrTotal:  24900,
    inrBase:   21102,
    inrGst:    3798,
    features:  [
      "Unlimited Executions",
      "Dedicated Enclave Infrastructure",
      "V35 Cryptographic Ledger",
      "SOC2 Type II Ready",
      "BYOC Kubernetes",
      "24/7 Dedicated Account Manager",
    ],
  },
];

// ── Razorpay Checkout.js lazy loader ─────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src     = "https://checkout.razorpay.com/v1/checkout.js";
    script.async   = true;
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RazorpayLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M16 2L4 28h8l2-5h8l2 5h8L16 2zm0 7l3 8h-6l3-8z" />
    </svg>
  );
}

function StripeLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M15 12c-2 0-3 .8-3 2 0 3.5 9 2 9 8 0 3.5-3 5-7 5-2.5 0-5-.5-7-1.5v-4.5c2 1.2 4.5 2 7 2s3.5-.8 3.5-2c0-3.5-9-2-9-8C8 10 11 8 15 8c2.3 0 4.5.5 6.5 1.5V14c-1.8-1.2-4-2-6.5-2z"/>
    </svg>
  );
}

// ── GSTIN Modal ──────────────────────────────────────────────────────────────

interface GstinModalProps {
  planName:  string;
  inrTotal:  number;
  inrBase:   number;
  inrGst:    number;
  onConfirm: (gstin: string | null) => void;
  onClose:   () => void;
}

function GstinModal({ planName, inrTotal, inrBase, inrGst, onConfirm, onClose }: GstinModalProps) {
  const [gstin, setGstin]   = useState("");
  const [error, setError]   = useState("");

  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  function handleConfirm(includeGstin: boolean) {
    if (includeGstin) {
      if (!GSTIN_RE.test(gstin.trim().toUpperCase())) {
        setError("Invalid GSTIN format. Example: 22AAAAA0000A1Z5");
        return;
      }
      onConfirm(gstin.trim().toUpperCase());
    } else {
      onConfirm(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gstin-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#0e0e14] p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center shrink-0">
            <span className="text-lg">🇮🇳</span>
          </div>
          <div>
            <h2 id="gstin-modal-title" className="text-sm font-semibold text-white">Indian Payment — Razorpay</h2>
            <p className="text-[11px] text-zinc-600">{planName} Plan · INR billing</p>
          </div>
        </div>

        {/* GST Breakdown */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 mb-6">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-3">Order Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Base amount</span>
              <span>₹{inrBase.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>GST (18% — Digital Services)</span>
              <span>₹{inrGst.toLocaleString("en-IN")}</span>
            </div>
            <div className="border-t border-white/[0.05] pt-2 flex justify-between text-sm font-semibold text-white">
              <span>Total</span>
              <span>₹{inrTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* GSTIN field */}
        <div className="mb-6">
          <label htmlFor="gstin-input" className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
            GSTIN <span className="text-zinc-700 normal-case">(optional — required for B2B tax invoice)</span>
          </label>
          <input
            id="gstin-input"
            type="text"
            maxLength={15}
            placeholder="22AAAAA0000A1Z5"
            value={gstin}
            onChange={(e) => { setGstin(e.target.value.toUpperCase()); setError(""); }}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3
                       text-xs font-mono text-white placeholder-zinc-700 tracking-widest
                       focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          {error && <p className="text-[10px] text-red-400 mt-1.5">{error}</p>}
          <p className="text-[10px] text-zinc-700 mt-1.5">
            Your GSTIN will appear on the tax invoice sent to your registered email.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            id="rzp-pay-with-gstin-btn"
            onClick={() => handleConfirm(true)}
            disabled={!gstin.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold
                       bg-blue-600 text-white hover:bg-blue-500 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pay with GSTIN
          </button>
          <button
            id="rzp-pay-without-gstin-btn"
            onClick={() => handleConfirm(false)}
            className="w-full py-2.5 rounded-xl text-xs font-medium
                       bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Skip — Continue as individual / B2C
          </button>
          <button
            onClick={onClose}
            className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [currency,     setCurrency]     = useState<Currency>("USD");
  const [loadingTier,  setLoadingTier]  = useState<string | null>(null);
  const [gstinModal,   setGstinModal]   = useState<typeof TIERS[number] | null>(null);
  const [globalError,  setGlobalError]  = useState<string | null>(null);

  const activeCurrency = CURRENCIES.find((c) => c.code === currency)!;
  const isIndia        = currency === "INR";

  // ── Stripe checkout ─────────────────────────────────────────────────────────
  async function handleStripeCheckout(planKey: string) {
    setLoadingTier(planKey);
    setGlobalError(null);
    try {
      const res  = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: planKey }),
      });
      const data = await res.json() as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setGlobalError(data.error ?? "Stripe checkout failed. Please try again.");
      }
    } catch {
      setGlobalError("Network error. Please check your connection.");
    } finally {
      setLoadingTier(null);
    }
  }

  // ── Razorpay checkout (called after GSTIN modal resolves) ──────────────────
  async function handleRazorpayCheckout(planKey: string, gstin: string | null) {
    setLoadingTier(planKey);
    setGlobalError(null);
    try {
      // 1. Create Razorpay order on our backend
      const orderRes = await fetch("/api/billing/razorpay/order", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: planKey, ...(gstin ? { gstin } : {}) }),
      });
      const orderData = await orderRes.json() as {
        success:             boolean;
        razorpay_order_id?:  string;
        amount?:             number;
        key_id?:             string;
        plan_display?:       string;
        error?:              string;
      };

      if (!orderData.success || !orderData.razorpay_order_id) {
        setGlobalError(orderData.error ?? "Failed to create Razorpay order.");
        return;
      }

      // 2. Load Razorpay Checkout.js
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setGlobalError("Razorpay Checkout.js failed to load. Check your connection.");
        return;
      }

      // 3. Open Razorpay Standard Checkout
      const rzp = new window.Razorpay({
        key:         orderData.key_id,
        amount:      orderData.amount,
        currency:    "INR",
        name:        "StreetMP OS",
        description: `${orderData.plan_display ?? planKey} Plan — Monthly`,
        image:       "/logo-icon.png",
        order_id:    orderData.razorpay_order_id,
        // Prefill from session storage if available
        prefill: {
          email: typeof window !== "undefined"
            ? sessionStorage.getItem("user_email") ?? ""
            : "",
        },
        notes: { plan: planKey, ...(gstin ? { gstin } : {}) },
        theme: { color: "#7c3aed" },
        modal: {
          ondismiss: () => setLoadingTier(null),
        },
        handler: async function(response: Record<string, unknown>) {
          // 4. Verify signature server-side
          try {
            const verifyRes = await fetch("/api/billing/razorpay/verify", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                razorpay_order_id:   orderData.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json() as { success: boolean; error?: string };

            if (verifyData.success) {
              window.location.href = `/billing/success?gateway=razorpay&plan=${planKey}`;
            } else {
              setGlobalError(verifyData.error ?? "Payment verification failed. Contact support.");
            }
          } catch {
            setGlobalError("Verification network error. Your payment may have succeeded — contact support.");
          } finally {
            setLoadingTier(null);
          }
        },
      });

      rzp.on("payment.failed", function(response: Record<string, unknown>) {
        const err = response.error as Record<string, string> | undefined;
        setGlobalError(`Payment failed: ${err?.description ?? "Unknown error"}. Please try again.`);
        setLoadingTier(null);
      });

      rzp.open();
    } catch (err) {
      setGlobalError((err as Error).message ?? "Razorpay error");
      setLoadingTier(null);
    }
  }

  // ── Dispatch checkout based on currency / gateway ──────────────────────────
  function handleCheckout(tier: typeof TIERS[number]) {
    if (tier.basePrice === 0) {
      window.location.href = "/register";
      return;
    }

    if (isIndia && tier.inrTotal) {
      // Show GSTIN modal → then Razorpay
      setGstinModal(tier);
    } else {
      void handleStripeCheckout(tier.key);
    }
  }

  function onGstinConfirm(gstin: string | null) {
    if (!gstinModal) return;
    setGstinModal(null);
    void handleRazorpayCheckout(gstinModal.key, gstin);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden pt-36 pb-32">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/pricing"      className="text-white font-semibold">Pricing</Link>
            <Link href="/stp"          className="hover:text-white transition-colors">Protocol</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"    className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono text-emerald-400 text-[10px] tracking-widest uppercase mb-6">
          Phase 5.5 · Dual-Gateway Billing
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-6">
          Sovereign AI.{" "}
          <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200">
            Transparent Pricing.
          </span>
        </h1>
        <p className="text-lg text-white/50 leading-relaxed mb-10">
          Global payments via Stripe. Indian domestic payments natively via Razorpay —
          {" "}RBI compliant, UPI-enabled, GST-ready.
        </p>

        {/* Currency selector */}
        <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] p-1.5 rounded-xl flex-wrap justify-center">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              id={`currency-btn-${c.code.toLowerCase()}`}
              onClick={() => setCurrency(c.code)}
              className={`relative px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                currency === c.code
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                  : "text-white/40 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {c.code}
              {c.gateway === "razorpay" && (
                <span className="absolute -top-1.5 -right-1 text-[7px] font-black bg-blue-600 text-white px-1 rounded-full leading-3 py-0.5">
                  RZP
                </span>
              )}
            </button>
          ))}
        </div>

        {/* India notice */}
        {isIndia && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl
                          bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            <span>🇮🇳</span>
            <span>Indian billing via <strong>Razorpay</strong> — UPI, Netbanking, Cards &amp; EMI accepted. GST 18% inclusive.</span>
          </div>
        )}
      </div>

      {/* ── Global error ────────────────────────────────────────────────────── */}
      {globalError && (
        <div className="max-w-2xl mx-auto px-6 mb-8">
          <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-red-400">
            {globalError}
          </div>
        </div>
      )}

      {/* ── Pricing grid ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIERS.map((tier) => {
            const price = tier.basePrice === 0 ? 0
              : isIndia && tier.inrTotal
              ? tier.inrTotal
              : Math.round(tier.basePrice * activeCurrency.rate);

            const isLoading = loadingTier === tier.key;

            return (
              <div
                key={tier.key}
                className={`relative rounded-3xl p-8 flex flex-col transition-all duration-300
                            hover:-translate-y-1 hover:shadow-xl ${
                  tier.highlight
                    ? "bg-emerald-950/20 border border-emerald-500/30 shadow-2xl shadow-emerald-900/20"
                    : "bg-white/[0.02] border border-white/[0.05]"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500
                                  text-black text-[10px] uppercase font-black tracking-widest rounded-full
                                  shadow-lg shadow-emerald-500/20 z-10 whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <h3 className={`text-xl font-bold mb-2 ${tier.highlight ? "text-emerald-400" : "text-white"}`}>
                  {tier.name}
                </h3>
                <p className="text-sm text-white/40 mb-6 h-10">{tier.desc}</p>

                {/* Price + GST breakdown for INR */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black tracking-tight">
                      {price === 0 ? "Free" : `${activeCurrency.symbol}${price.toLocaleString("en-IN")}`}
                    </span>
                    {price !== 0 && (
                      <span className="text-sm font-medium text-white/30">/mo</span>
                    )}
                  </div>
                  {isIndia && tier.inrTotal && tier.inrGst && (
                    <p className="text-[10px] text-zinc-600">
                      ₹{tier.inrBase?.toLocaleString("en-IN")} + ₹{tier.inrGst.toLocaleString("en-IN")} GST (18%)
                    </p>
                  )}
                </div>

                {/* CTA Button(s) */}
                {tier.basePrice === 0 ? (
                  <Link
                    href="/register"
                    id={`plan-free-cta`}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex justify-center items-center
                               bg-white/[0.05] text-white hover:bg-white/10 transition-all"
                  >
                    Start Building
                  </Link>
                ) : isIndia && tier.inrTotal ? (
                  /* India → Razorpay button */
                  <button
                    id={`plan-${tier.key}-razorpay-btn`}
                    onClick={() => handleCheckout(tier)}
                    disabled={isLoading}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2
                                transition-all disabled:opacity-50 disabled:cursor-wait ${
                      tier.highlight
                        ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                        : "bg-blue-600/80 text-white hover:bg-blue-600"
                    }`}
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <RazorpayLogo />
                        Pay with Razorpay
                      </>
                    )}
                  </button>
                ) : (
                  /* Global → Stripe button */
                  <button
                    id={`plan-${tier.key}-stripe-btn`}
                    onClick={() => handleCheckout(tier)}
                    disabled={isLoading}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2
                                transition-all disabled:opacity-50 disabled:cursor-wait ${
                      tier.highlight
                        ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                        : "bg-white/[0.05] text-white hover:bg-white/10"
                    }`}
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <StripeLogo />
                        Get Started
                      </>
                    )}
                  </button>
                )}

                {/* Payment method hints */}
                {tier.basePrice !== 0 && (
                  <p className="text-[10px] text-zinc-700 text-center mt-2">
                    {isIndia
                      ? "UPI · Netbanking · Cards · EMI"
                      : "Visa · Mastercard · AMEX · Apple Pay"}
                  </p>
                )}

                {/* Features */}
                <div className="mt-8 pt-8 border-t border-white/[0.05] flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">Includes:</p>
                  <ul className="space-y-3">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start text-sm text-white/70">
                        <CheckIcon />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-zinc-700">
          {[
            "🔒 TLS 1.3 Encrypted",
            "🇮🇳 RBI Compliant",
            "🏦 PCI-DSS via Razorpay",
            "📜 18% GST Inclusive",
            "🌍 Global via Stripe",
            "🔄 Cancel Anytime",
          ].map((item) => (
            <span key={item} className="text-xs font-medium">{item}</span>
          ))}
        </div>
      </div>

      {/* ── GSTIN Modal ─────────────────────────────────────────────────────── */}
      {gstinModal && gstinModal.inrTotal && gstinModal.inrBase && gstinModal.inrGst && (
        <GstinModal
          planName={gstinModal.name}
          inrTotal={gstinModal.inrTotal}
          inrBase={gstinModal.inrBase}
          inrGst={gstinModal.inrGst}
          onConfirm={onGstinConfirm}
          onClose={() => setGstinModal(null)}
        />
      )}
    </div>
  );
}
