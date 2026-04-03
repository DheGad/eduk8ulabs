"use client";

/**
 * @component ErrorCard
 * @description Branded Emerald/Obsidian error surface.
 *   Replaces all generic "Something went wrong" messages with a
 *   premium, high-contrast error card that matches the StreetMP
 *   Obsidian/Emerald design system.
 *
 *   Phase 2 — Professional UI States
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface ErrorCardProps {
  /** Short error code e.g. "NETWORK_ERROR", "AUTH_REQUIRED" */
  code?: string;
  /** Human-readable error description */
  message: string;
  /** Optional: full technical detail shown in a collapsible block */
  detail?: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** If true, auto-reports this error to Sentry */
  reportToSentry?: boolean;
  /** Raw Error object (used by Sentry capture) */
  error?: Error | unknown;
}

export function ErrorCard({
  code,
  message,
  detail,
  onRetry,
  size = "md",
  reportToSentry = false,
  error,
}: ErrorCardProps) {
  // Auto-report to Sentry if flag is set
  useEffect(() => {
    if (reportToSentry && error) {
      Sentry.captureException(error, {
        tags: { component: "ErrorCard", errorCode: code ?? "UNKNOWN" },
        extra: { message, detail },
      });
    }
  }, [reportToSentry, error, code, message, detail]);

  const padY = size === "sm" ? "py-4 px-5" : size === "lg" ? "py-10 px-8" : "py-6 px-6";
  const iconSize = size === "lg" ? "w-14 h-14" : "w-10 h-10";
  const headingSize = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-red-500/20 bg-[#0d0d10] shadow-2xl ${padY}`}
      role="alert"
      aria-live="assertive"
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rose-600/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-red-500/8 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div
          className={`shrink-0 ${iconSize} rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center`}
        >
          <svg
            className={`${size === "lg" ? "w-7 h-7" : "w-5 h-5"} text-red-400`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            {code && (
              <span className="inline-block text-[10px] font-mono font-semibold tracking-widest text-red-400/70 bg-red-500/10 border border-red-500/15 rounded px-2 py-0.5 uppercase">
                {code}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] font-medium text-red-400/60 uppercase tracking-wider">
                System Alert
              </span>
            </div>
          </div>

          <p className={`font-semibold text-white leading-snug ${headingSize}`}>
            {message}
          </p>

          {/* Detail block (collapsible) */}
          {detail && (
            <details className="mt-3 group">
              <summary className="text-[11px] text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1.5 transition-colors">
                <svg
                  className="w-3 h-3 transition-transform group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Technical details
              </summary>
              <pre className="mt-2 text-[11px] font-mono text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 overflow-auto max-h-36 leading-relaxed">
                {detail}
              </pre>
            </details>
          )}

          {/* Actions */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all duration-150 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Bottom trace line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
