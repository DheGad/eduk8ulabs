"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser, ApiError } from "@/lib/apiClient";

// ================================================================
// TYPES
// ================================================================
type AccountRole = "client" | "engineer";

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
      <label htmlFor={id} className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
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
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 transition-all duration-150 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50"
      />
      {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
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

// ================================================================
// ROLE SELECTOR
// ================================================================
function RoleSelector({ role, onChange }: { role: AccountRole; onChange: (r: AccountRole) => void }) {
  const roles: { id: AccountRole; icon: string; title: string; desc: string }[] = [
    { id: "client",   icon: "🏢", title: "I'm a Client",   desc: "Hire verified engineers and run AI pipelines" },
    { id: "engineer", icon: "⚡", title: "I'm an Engineer", desc: "Get paid to solve AI tasks and build your HCQ Score" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Account Type</span>
      <div className="grid grid-cols-2 gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className="flex flex-col gap-1 rounded-xl border px-3 py-3 text-left transition-all duration-150 focus:outline-none"
            style={{
              borderColor: role === r.id ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.06)",
              background:  role === r.id ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
            }}
          >
            <span className="text-base">{r.icon}</span>
            <span className="text-xs font-semibold text-zinc-200">{r.title}</span>
            <span className="text-[9px] text-zinc-500 leading-tight">{r.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ================================================================
// PAGE
// ================================================================

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole]         = useState<AccountRole>("client");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && email.includes("@") && password.length >= 8;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      await registerUser(email.trim(), password, name.trim(), role);
      // Redirect to dashboard — registerUser also logs the user in
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("An account with this email already exists. Try logging in.");
        } else if (err.status === 400 && err.details) {
          const firstField = Object.values(err.details)[0];
          setError(firstField?.[0] ?? "Validation failed.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Unable to reach the auth service. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 space-y-6 shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest">New Member</span>
        </div>
        <h1 className="text-2xl font-extralight text-white tracking-tight">
          Join the OS
        </h1>
        <p className="text-sm text-zinc-500">
          Create your <span className="text-violet-400">StreetMP OS</span> account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <RoleSelector role={role} onChange={setRole} />
        
        <div className="space-y-4">
          <InputField
            id="name"
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={setName}
            autoComplete="name"
            disabled={loading}
          />
          <InputField
            id="email"
            label="Work Email"
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            disabled={loading}
          />
          <InputField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="Must be at least 8 characters"
            disabled={loading}
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black"></span>
              Creating Account...
            </span>
          ) : (
            <>
              Initialize OS Account
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Sign in →
        </Link>
      </p>
    </div>
  );
}
