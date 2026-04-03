"use client";

/**
 * @file page.tsx
 * @route /dashboard/jobs/new
 * @description Phase 5 — Secure Job Handshake.
 *
 * Extracts engineerId from URL search params (pre-populated from the
 * Marketplace "Start Escrow Job →" button).
 *
 * Flow:
 *   1. Client fills the job form (description, schema requirements, amount).
 *   2. POST /api/v1/escrow/create → receive Stripe client_secret.
 *   3. Stripe.confirmCardPayment() holds funds (manual capture mode).
 *   4. Redirect to /dashboard/jobs on success.
 */

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { createEscrowJob } from "@/lib/apiClient";

// ================================================================
// STRIPE SETUP
// ================================================================

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

// ================================================================
// CARD ELEMENT STYLING to match the Glass Box aesthetic
// ================================================================

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#ffffff",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: "14px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#52525b" },
      iconColor: "#7c3aed",
    },
    invalid: {
      color: "#f87171",
      iconColor: "#f87171",
    },
  },
};

// ================================================================
// DEFAULT SCHEMA TEMPLATE  
// Shown as a starting point in the requirements textarea
// ================================================================

const DEFAULT_SCHEMA_TEMPLATE = JSON.stringify(
  {
    required_keys: ["summary", "verdict", "confidence_score"],
  },
  null,
  2
);

// ================================================================
// THE INNER FORM (must be inside <Elements> provider)
// ================================================================

function EscrowForm({ engineerId }: { engineerId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [jobDescription, setJobDescription] = useState("");
  const [requirementsJson, setRequirementsJson] = useState(DEFAULT_SCHEMA_TEMPLATE);
  const [amountDollars, setAmountDollars] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [step, setStep] = useState<"form" | "funding" | "processing" | "done">("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [escrowId, setEscrowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100);
  const isAmountValid = amountCents >= 50;  // Stripe minimum

  // Validate JSON as user types
  const handleRequirementsChange = (val: string) => {
    setRequirementsJson(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON — check your schema structure.");
    }
  };

  // ── Step 1: Create escrow (get client_secret) ──────────────────
  const handleCreateEscrow = useCallback(async () => {
    if (!engineerId || !isAmountValid || jsonError) return;

    let requirements: Record<string, unknown>;
    try {
      requirements = JSON.parse(requirementsJson) as Record<string, unknown>;
    } catch {
      setJsonError("Invalid JSON in requirements schema.");
      return;
    }

    setError(null);
    setStep("funding");

    try {
      const result = await createEscrowJob({
        engineerId,
        amount: amountCents,
        requirements,
      });
      setClientSecret(result.client_secret);
      setEscrowId(result.escrow_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create escrow contract.");
      setStep("form");
    }
  }, [engineerId, amountCents, requirementsJson, isAmountValid, jsonError]);

  // ── Step 2: Confirm card payment (holds funds, not charged yet) ─
  const handleConfirmPayment = useCallback(async () => {
    if (!stripe || !elements || !clientSecret) return;

    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;

    setError(null);
    setStep("processing");

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: { card: cardEl },
      }
    );

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed.");
      setStep("funding");
      return;
    }

    if (paymentIntent?.status === "requires_capture") {
      // Funds are held — job is live
      setStep("done");
      setTimeout(() => router.push("/dashboard/jobs"), 2000);
    } else {
      setError(`Unexpected payment status: ${paymentIntent?.status}`);
      setStep("funding");
    }
  }, [stripe, elements, clientSecret, router]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-3 text-xs">
        {(["form", "funding", "processing", "done"] as const).map((s, i) => {
          const labels = ["Job Details", "Fund Escrow", "Processing", "Done"];
          const current = ["form", "funding", "processing", "done"].indexOf(step);
          const active = i === current;
          const done = i < current;
          return (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 ${done || active ? "text-white" : "text-zinc-600"}`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${done ? "bg-emerald-500 text-black" : active ? "bg-violet-600 text-white" : "bg-white/[0.05] text-zinc-600"}`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={active ? "text-white font-medium" : ""}>{labels[i]}</span>
              </div>
              {i < 3 && <div className={`h-px w-8 ${done ? "bg-emerald-500/40" : "bg-white/10"}`} />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Job Details Form ──────────────────────────────── */}
      {step === "form" && (
        <div className="flex flex-col gap-5">
          {/* Engineer badge */}
          <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="h-8 w-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-sm">
              🤝
            </div>
            <div>
              <p className="text-xs text-zinc-500">Hiring engineer</p>
              <p className="text-sm font-mono text-violet-300">{engineerId.slice(0, 12)}…</p>
            </div>
          </div>

          {/* Job Description */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Describe the task: what AI should produce, the context, and expected quality…"
              rows={4}
              className="resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-violet-500/40 focus:bg-white/[0.06]"
            />
          </div>

          {/* JSON Schema Requirements */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Output Requirements (JSON Schema)
            </label>
            <p className="text-xs text-zinc-600">
              The AI must return a valid JSON object containing all listed keys. The Enforcer will verify this before releasing funds.
            </p>
            <textarea
              value={requirementsJson}
              onChange={(e) => handleRequirementsChange(e.target.value)}
              rows={5}
              spellCheck={false}
              className={`resize-none rounded-xl border bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-zinc-600 outline-none transition-all focus:bg-white/[0.06]
                ${jsonError ? "border-red-500/40 focus:border-red-500/60" : "border-white/10 focus:border-violet-500/40"}`}
            />
            {jsonError && (
              <p className="text-xs text-red-400">{jsonError}</p>
            )}
          </div>

          {/* Escrow Amount */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Escrow Amount (USD)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-500 text-sm">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className={`w-full rounded-xl border bg-white/[0.04] py-3 pl-8 pr-4 text-sm text-white outline-none transition-all focus:bg-white/[0.06]
                  ${amountDollars && !isAmountValid ? "border-red-500/40" : "border-white/10 focus:border-violet-500/40"}`}
              />
            </div>
            {amountDollars && !isAmountValid && (
              <p className="text-xs text-red-400">Minimum amount is $0.50 (Stripe limit).</p>
            )}
            <p className="text-xs text-zinc-600">
              Funds are held in escrow and only released when the AI output is verified by the StreetMP Enforcer.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateEscrow}
            disabled={!engineerId || !jobDescription.trim() || !isAmountValid || !!jsonError}
            className="mt-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Fund Escrow →
          </button>
        </div>
      )}

      {/* ── STEP 2: Card Payment ──────────────────────────────────── */}
      {(step === "funding" || step === "processing") && (
        <div className="flex flex-col gap-5">
          {/* Amount summary */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/60 px-5 py-4">
            <div>
              <p className="text-xs text-zinc-500">Escrow amount</p>
              <p className="text-2xl font-mono font-light text-white">
                ${parseFloat(amountDollars).toFixed(2)} <span className="text-zinc-500 text-sm">USD</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-600">Escrow ID</p>
              <p className="text-xs font-mono text-zinc-500">{escrowId?.slice(0, 12)}…</p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80">
            💡 Funds will be <strong>held</strong>, not charged. They&apos;re released only after StreetMP verifies the AI output matches your schema.
          </div>

          {/* Stripe Card Element */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Card Details
            </label>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 transition-all focus-within:border-violet-500/40">
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("form")}
              disabled={step === "processing"}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm text-zinc-400 hover:text-white transition-all disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={!stripe || step === "processing"}
              className="flex-1 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === "processing" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing…
                </span>
              ) : (
                `Authorize $${parseFloat(amountDollars).toFixed(2)} Escrow →`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ─────────────────────────────────────────── */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
            ✓
          </div>
          <div>
            <h3 className="text-lg font-medium text-white mb-1">Escrow Funded</h3>
            <p className="text-sm text-zinc-400">
              ${parseFloat(amountDollars).toFixed(2)} is held in escrow. Redirecting to your jobs…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// INNER PAGE (useSearchParams must live inside Suspense boundary)
// ================================================================

function NewJobInner() {
  const searchParams = useSearchParams();
  const engineerId = searchParams.get("engineerId") ?? "";

  const [stripeKeyMissing, setStripeKeyMissing] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      setStripeKeyMissing(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 border-b border-white/[0.05] pb-6">
        <h1 className="text-3xl font-light tracking-tight text-white mb-2">
          Create Escrow Job
        </h1>
        <p className="text-sm text-zinc-400">
          Funds are held by Stripe and released only after AI output is verified by the StreetMP Enforcer.
        </p>
      </div>

      {stripeKeyMissing ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-400">
          ⚠️ <strong>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</strong> is not set. Stripe Elements cannot initialize.
        </div>
      ) : !engineerId ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-400">
          ⚠️ No engineer selected. Please return to the{" "}
          <a href="/marketplace" className="underline">Marketplace</a>{" "}
          and click &quot;Start Escrow Job&quot; on a profile.
        </div>
      ) : (
        <Elements stripe={stripePromise}>
          <EscrowForm engineerId={engineerId} />
        </Elements>
      )}
    </div>
  );
}

// ================================================================
// PAGE WRAPPER — Suspense boundary for useSearchParams (Next.js 15)
// ================================================================

export default function NewJobPage() {
  return (
    <div className="min-h-screen bg-[#050507] p-8 text-white">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        </div>
      }>
        <NewJobInner />
      </Suspense>
    </div>
  );
}
