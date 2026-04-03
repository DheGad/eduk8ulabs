"use client";

import React from "react";

export default function PrivacyGuardPage() {
  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "#0F172A", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Privacy Guard</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
              Sanitizer
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Real-time PII Anonymization & Data Sovereignty
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-4 text-3xl">
          🛡️
        </div>
        <h2 className="text-lg font-bold text-slate-300 mb-2">Under Construction</h2>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
          The Privacy Guard and Data Sanitization dashboard is currently being built. Check back soon for the full PII anonymization interface.
        </p>
      </div>
    </div>
  );
}
