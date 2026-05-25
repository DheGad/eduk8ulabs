"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, CheckCircle2, Shield, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Suspense } from "react";

/**
 * ActivateExtensionPage — Enterprise-grade extension pairing.
 *
 * Security model:
 *  - Token is generated server-side (/api/v1/extension/pair) and stored in
 *    Redis with a 5-minute TTL.
 *  - This page polls /api/v1/extension/pair?token=TOKEN every 3 seconds.
 *  - When the extension submits the token via popup.js, the server verifies
 *    and marks it as claimed.
 *  - The page advances to "Paired" only on confirmed server response.
 *  - If ?token= query param is present (auto-launch from extension), it
 *    pre-fills and immediately begins polling.
 */

const POLL_INTERVAL_MS = 3000;
const TOKEN_TTL_MS     = 5 * 60 * 1000; // 5 minutes

type PairStatus = "loading" | "waiting" | "paired" | "expired" | "error";

function ActivateForm() {
  const router       = useRouter();
  const params       = useSearchParams();
  const tokenParam   = params.get("token");

  const [token,  setToken]  = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<PairStatus>("loading");
  const [error,  setError]  = useState<string>("");

  const pollRef    = useRef<NodeJS.Timeout | null>(null);
  const expireRef  = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch a real server-side pairing token ─────────────────────────────────
  useEffect(() => {
    const initToken = tokenParam || null;
    if (initToken) {
      // Extension launched us with an existing token — start polling immediately
      setToken(initToken);
      setStatus("waiting");
      return;
    }

    // Request a new pairing token from the server
    fetch("/api/v1/extension/pair", { method: "POST" })
      .then(r => r.json())
      .then((d: { token?: string; error?: string }) => {
        if (!d.token) throw new Error(d.error ?? "No token returned");
        setToken(d.token);
        setStatus("waiting");
      })
      .catch((e) => {
        setError(e.message ?? "Failed to generate pairing token. Please try again.");
        setStatus("error");
      });
  }, [tokenParam]);

  // ── Poll for pairing confirmation ──────────────────────────────────────────
  useEffect(() => {
    if (status !== "waiting" || !token) return;

    // Set TTL expiry timer
    expireRef.current = setTimeout(() => {
      setStatus("expired");
      clearInterval(pollRef.current!);
    }, TOKEN_TTL_MS);

    // Poll every 3 seconds
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/extension/pair?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (d.claimed) {
          setStatus("paired");
          clearInterval(pollRef.current!);
          clearTimeout(expireRef.current!);
        }
      } catch {
        // Network errors are silent — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollRef.current!);
      clearTimeout(expireRef.current!);
    };
  }, [status, token]);

  const handleCopy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    setStatus("loading");
    setToken(null);
    setError("");
    // Re-trigger token fetch via reload
    fetch("/api/v1/extension/pair", { method: "POST" })
      .then(r => r.json())
      .then((d: { token?: string; error?: string }) => {
        if (!d.token) throw new Error(d.error ?? "No token");
        setToken(d.token);
        setStatus("waiting");
      })
      .catch((e) => {
        setError(e.message ?? "Failed to generate pairing token.");
        setStatus("error");
      });
  };

  // ── Render token segments ─────────────────────────────────────────────────
  const segments = token ? token.split("-") : ["SMP", "····", "····", "····"];

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
        <Shield size={32} className="text-emerald-400" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4 text-center">
        Pair Your Device
      </h1>
      <p className="text-base text-zinc-400 text-center max-w-lg mb-10 leading-relaxed">
        Click the StreetMP extension icon in your browser toolbar and enter the activation code below to bind this device to your organization.
      </p>

      <div className="w-full rounded-2xl border border-white/[0.06] bg-[#08080e] p-6 sm:p-8 shadow-2xl text-center">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
          Device Activation Code · {status === "waiting" ? "Valid for 5 minutes" : status === "expired" ? "Expired" : "\u00a0"}
        </p>

        {/* Token display */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <div
            onClick={status === "waiting" ? handleCopy : undefined}
            className={`group relative font-mono text-3xl sm:text-4xl font-black tracking-widest bg-[#08080e] border rounded-xl px-8 py-5 transition-all overflow-hidden ${
              status === "waiting"
                ? "cursor-pointer text-emerald-400 border-white/[0.08] hover:border-emerald-500/50"
                : "cursor-default text-zinc-600 border-white/[0.04]"
            }`}
          >
            <div className="absolute inset-0 bg-emerald-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex items-center gap-3">
              <span className="text-white">{segments[0] ?? "SMP"}</span>
              <span className="text-zinc-600">-</span>
              <span>{segments[1] ?? "····"}</span>
              <span className="text-zinc-600">-</span>
              <span>{segments[2] ?? "····"}</span>
              <span className="text-zinc-600">-</span>
              <span>{segments[3] ?? "····"}</span>
            </div>
            {copied && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-500 text-black text-sm tracking-normal rounded-xl animate-in fade-in duration-200">
                <CheckCircle2 size={18} className="mr-2" /> Copied to clipboard
              </div>
            )}
          </div>

          {status === "waiting" && (
            <button
              onClick={handleCopy}
              className="w-full sm:w-16 h-12 sm:h-20 flex sm:flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              title="Copy to clipboard"
            >
              {copied ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Copy size={20} />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </div>

        {/* Status panel */}
        {status === "paired" && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <CheckCircle2 size={28} className="text-emerald-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Device Paired Successfully</h3>
            <p className="text-sm text-zinc-400 mb-6">Your browser is now protected by StreetMP OS.</p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <button
                onClick={() => router.push("/extension/first-run")}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)]"
              >
                See Protection in Action <ArrowRight size={16} />
              </button>
              <button
                onClick={() => router.push("/extension/status")}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] transition-colors"
              >
                View Status
              </button>
            </div>
          </div>
        )}

        {(status === "waiting" || status === "loading") && (
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 flex flex-col items-center">
            {status === "loading"
              ? <Loader2 size={24} className="text-zinc-500 animate-spin mb-3" />
              : <Loader2 size={24} className="text-emerald-400 animate-spin mb-3" />
            }
            <h3 className="text-sm font-bold text-white mb-1">
              {status === "loading" ? "Generating secure code…" : "Waiting for extension…"}
            </h3>
            <p className="text-xs text-zinc-500">
              {status === "loading"
                ? "Requesting a server-issued pairing token."
                : "Keep this page open while you enter the code in the extension popup."
              }
            </p>
          </div>
        )}

        {status === "expired" && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 flex flex-col items-center">
            <AlertCircle size={24} className="text-amber-400 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Code Expired</h3>
            <p className="text-xs text-zinc-400 mb-4">Activation codes expire after 5 minutes for security. Generate a new one below.</p>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 transition-all"
            >
              Generate New Code
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 flex flex-col items-center">
            <AlertCircle size={24} className="text-red-400 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Unable to Generate Code</h3>
            <p className="text-xs text-zinc-400 mb-4">{error || "An error occurred. Please ensure you are signed in and try again."}</p>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2 text-sm font-bold text-white hover:bg-white/[0.08] transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Skip for now — lets enterprise buyers explore dashboard before installing extension */}
      {(status === "waiting" || status === "loading") && (
        <p className="mt-6 text-center text-xs text-zinc-600">
          Want to explore first?{" "}
          <a
            href="/dashboard/admin/mission-control"
            className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
          >
            Skip for now — set up later
          </a>
        </p>
      )}
    </div>
  );
}

export default function ActivateExtensionPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 size={32} className="text-emerald-400 animate-spin" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Loading activation…</span>
      </div>
    }>
      <ActivateForm />
    </Suspense>
  );
}
