"use client";

import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global boundary caught error:", error);
  }, [error]);

  return (
    <div className="bg-[#0A0A0A] text-white h-screen flex flex-col items-center justify-center font-sans px-4">
      <div className="max-w-md w-full p-8 border border-white/10 bg-black/50 rounded-2xl shadow-2xl backdrop-blur-xl text-center">
        <div className="w-16 h-16 mx-auto bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center rounded-full mb-6 relative">
            <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 rounded-full" />
            <ShieldAlert className="w-8 h-8 text-red-500 relative z-10" />
        </div>
        <h2 className="text-xl font-bold mb-3 tracking-tight">System Exception Blocked</h2>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
          The global error boundary trapped a fatal rendering exception to prevent application exposure. Session state has been safely suspended.
        </p>
        <div className="flex gap-4 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 bg-white hover:bg-zinc-200 text-black py-3 rounded-xl font-semibold transition-all shadow-md active:scale-95"
          >
            Reboot App
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-semibold transition-all border border-white/5 active:scale-95"
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
}
