"use client";

/**
 * @page dashboard/error.tsx
 * @description Dashboard-level error boundary. Replaces any runtime crash
 *   within /dashboard/* routes with a clean, enterprise-standard
 *   "Secure Module Loading..." surface. No Sentry dependency — zero crash risk.
 */

import { useEffect } from "react";
import { ShieldAlert, RotateCcw, ArrowLeft } from "lucide-react";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Log to console in all envs so devs can still see it
    console.error("[StreetMP:DashboardError]", error);
  }, [error]);

  const isDevMode = process.env.NODE_ENV === "development";

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] p-8 bg-[#0A0A0A]">
      <div className="w-full max-w-md">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 mx-auto shadow-[0_0_40px_rgba(220,38,38,0.12)]">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold text-white text-center mb-2 tracking-tight">
          Secure module loading...
        </h1>
        <p className="text-sm text-zinc-500 text-center leading-relaxed mb-8">
          A module in this area encountered an issue. Your data and session
          are protected. Click retry to reload the component.
        </p>

        {/* Dev-only error detail */}
        {isDevMode && error?.message && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-[10px] font-mono text-red-400/70 uppercase tracking-widest mb-1">
              Dev mode — error detail
            </p>
            <p className="text-xs font-mono text-red-300/60 leading-relaxed break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-[10px] text-zinc-600 mt-2 font-mono">
                digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            id="dashboard-error-retry"
            onClick={reset}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>

          <a
            href="/dashboard"
            id="dashboard-error-home"
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-zinc-400 text-sm font-medium hover:bg-white/[0.04] hover:text-zinc-200 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to dashboard
          </a>
        </div>

      </div>
    </div>
  );
}
