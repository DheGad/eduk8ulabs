"use client";

/**
 * @file app/(auth)/login/page.tsx
 * @description Phase 2 — Fortune 500 Login UI
 *
 * Design: #0A0A0A background · Inter font · Sentence case
 * Auth: Google OAuth primary · Credentials fallback · Specific error codes
 * No brutalist styles. No yellow. Enterprise-grade.
 */

import { useState, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Error code map — specific messages for every NextAuth error type
// ─────────────────────────────────────────────────────────────────────────────
const AUTH_ERROR_MAP: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method. Please use the original method you signed up with.",
  OAuthSignin:
    "Could not initiate Google sign-in. Please check your connection and try again.",
  OAuthCallback:
    "Google sign-in was cancelled or failed. Please try again.",
  CredentialsSignin:
    "Incorrect email or password. Please check your credentials and try again.",
  EmailSignin:
    "Could not send the sign-in link. Please check your email address.",
  SessionRequired:
    "Your session has expired. Please sign in again.",
  Default:
    "An unexpected error occurred. Please try again or contact support.",
};

function getErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return AUTH_ERROR_MAP[code] ?? AUTH_ERROR_MAP.Default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3"
    >
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-red-300 leading-relaxed">{message}</p>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[11px] text-zinc-600 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main login form
// ─────────────────────────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const errorCode    = searchParams?.get("error") ?? null;
  const callbackUrl  = searchParams?.get("callbackUrl") ?? "/dashboard";

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [loading,    setLoading]    = useState<"google" | "github" | "credentials" | null>(null);
  const [error,      setError]      = useState<string | null>(getErrorMessage(errorCode));

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setLoading("google");
    setError(null);
    await signIn("google", { callbackUrl });
  }

  // ── GitHub OAuth ──────────────────────────────────────────────────────────
  async function handleGitHub() {
    setLoading("github");
    setError(null);
    await signIn("github", { callbackUrl });
  }

  // ── Email / Password ──────────────────────────────────────────────────────
  async function handleCredentials(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading("credentials");
    setError(null);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email:    email.trim(),
        password,
      });

      if (res?.error) {
        setError(getErrorMessage(res.error) ?? AUTH_ERROR_MAP.Default);
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError(AUTH_ERROR_MAP.Default);
    } finally {
      setLoading(null);
    }
  }

  // ── Developer bypass ───────────────────────────────────────────────────────
  function handleDevBypass() {
    window.location.href = "/dashboard";
  }

  const isLoading = loading !== null;

  return (
    <div className="w-full max-w-sm space-y-6">

      {/* Logo mark */}
      <div className="flex flex-col items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.05) 100%)",
            border: "1px solid rgba(16,185,129,0.3)",
            boxShadow: "0 0 30px rgba(16,185,129,0.1)",
          }}
        >
          <span className="text-emerald-400 font-black text-sm tracking-tighter">S</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Sign in to your account
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            StreetMP OS · Enterprise AI Platform
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} />}

      {/* ── Google Sign-In (primary CTA) ─────────────────────────────────── */}
      <button
        id="google-signin-btn"
        type="button"
        onClick={handleGoogle}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === "google" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          /* Official Google G logo */
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )}
        Continue with Google
      </button>

      {/* ── GitHub ──────────────────────────────────────────────────────── */}
      <button
        id="github-signin-btn"
        type="button"
        onClick={handleGitHub}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === "github" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.382 1.236-3.222-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.625-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        )}
        Continue with GitHub
      </button>

      <Divider label="or sign in with email" />

      {/* ── Email / Password form ───────────────────────────────────────── */}
      <form onSubmit={handleCredentials} className="space-y-4" noValidate>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" className="text-xs font-medium text-zinc-400">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-xs font-medium text-zinc-400">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-4 py-3 pr-11 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          id="credentials-signin-btn"
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.7) 0%, rgba(5,150,105,0.9) 100%)",
            border: "1px solid rgba(16,185,129,0.4)",
          }}
        >
          {loading === "credentials" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
          ) : "Sign in"}
        </button>
      </form>

      {/* ── Developer bypass (visible but subtle) ──────────────────────── */}
      {process.env.NODE_ENV === "development" && (
        <button
          id="dev-bypass-btn"
          type="button"
          onClick={handleDevBypass}
          className="w-full py-2 text-[11px] font-medium text-zinc-600 hover:text-zinc-400 border border-dashed border-white/[0.04] rounded-xl transition-colors"
        >
          🔨 Dev bypass — skip auth
        </button>
      )}

      {/* ── Register link ─────────────────────────────────────────────── */}
      <p className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
          Get started free →
        </Link>
      </p>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — centred fullscreen layout
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 transition-colors duration-300"
      style={{ background: "var(--bg-canvas)", color: "var(--text-primary)" }}
    >
      {/* Subtle ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)" }}
        />
      </div>

      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
