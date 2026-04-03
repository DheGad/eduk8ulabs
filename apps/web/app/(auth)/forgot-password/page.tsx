"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { forgotPassword, ApiError } from "@/lib/apiClient";

// ================================================================
// MICRO-COMPONENTS
// ================================================================

function InputField({
  id, label, type, placeholder, value, onChange, autoComplete, disabled, hint,
}: {
  id: string; label: string; type: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  autoComplete?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-emerald-100/50 uppercase tracking-widest">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        className="w-full rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-50 placeholder-emerald-900/50 transition-all duration-150 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
      />
      {hint && <p className="text-[10px] text-emerald-700">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
      <svg className="h-4 w-4 shrink-0 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
      </svg>
      <span className="text-xs text-red-300 leading-relaxed">{message}</span>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
      <svg className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      <span className="text-xs text-emerald-300 leading-relaxed">{message}</span>
    </div>
  );
}

// ================================================================
// PAGE
// ================================================================

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await forgotPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      console.error("[StreetMP:forgotPassword] Error:", err);
      if (err instanceof ApiError) {
        if (err.status === 400 && err.details) {
          const firstField = Object.values(err.details)[0];
          setError(firstField?.[0] ?? "Validation failed.");
        } else {
          setError(err.message ?? "An unexpected error occurred.");
        }
      } else {
        setError("Network error: Cannot reach the authentication service.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-black/60 backdrop-blur-md p-8 space-y-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)] relative overflow-hidden">
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 rounded-full bg-emerald-600/10 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative space-y-1.5 z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest">Account Recovery</span>
        </div>
        <h1 className="text-2xl font-extralight text-emerald-50 tracking-tight">
          Forgot Password
        </h1>
        <p className="text-sm text-emerald-100/60">
          Enter your email address and we will send you a link to reset your password.
        </p>
      </div>

      {/* States */}
      <div className="relative z-10">
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message="If an account with that email exists, we have sent a password reset link." />}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="relative space-y-4 z-10" noValidate>
        {!success && (
          <InputField
            id="email"
            label="Email Address"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            disabled={loading}
          />
        )}

        <div className="pt-2 space-y-3">
          {!success && (
            <button
              type="submit"
              disabled={loading || !email}
              className="group relative w-full overflow-hidden rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.8) 0%, rgba(5,150,105,0.95) 100%)",
                border: "1px solid rgba(16,185,129,0.4)",
              }}
            >
              {/* Hover shimmer */}
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.3) 0%, rgba(16,185,129,0.1) 100%)" }} />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Sending link…
                  </>
                ) : "Send Reset Link →"}
              </span>
            </button>
          )}

          <Link href="/login" className="block w-full">
            <button
              type="button"
              className="w-full rounded-xl py-2.5 text-xs font-semibold text-emerald-100/60 border border-emerald-900/30 bg-emerald-950/20 hover:bg-emerald-900/40 hover:text-emerald-50 hover:border-emerald-500/30 transition-all focus:outline-none"
            >
              Back to Sign In
            </button>
          </Link>
        </div>
      </form>
    </div>
  );
}
