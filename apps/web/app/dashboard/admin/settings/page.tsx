"use client";

import React, { useState, useEffect } from "react";
import { getToken } from "@/lib/apiClient";

/**
 * @file app/dashboard/admin/settings/page.tsx
 * @description Workspace Settings — Phase 4 (APAC Compliance Toggle)
 *
 * Regional Governance section:
 *   - Toggle: APAC (PDPA/DPDP) vs Global (GDPR)
 *   - When APAC: writes apac_mode=true to localStorage
 *     and sends PATCH /api/v1/user/settings to router-service.
 *   - The setting is read by the workspace execute calls to inject
 *     x-compliance-framework: APAC_PDPA header.
 *
 * APAC frameworks active:
 *   MAS TRM (Singapore), BNM RMiT (Malaysia), PDPA SG, DPDP India
 */

const APAC_FRAMEWORKS = [
  {
    id: "MAS_TRM",
    label: "MAS TRM",
    desc: "Monetary Authority of Singapore — Technology Risk Management Guidelines 2021",
    region: "🇸🇬 Singapore",
  },
  {
    id: "BNM_RMIT",
    label: "BNM RMiT",
    desc: "Bank Negara Malaysia — Risk Management in Technology Policy 2020",
    region: "🇲🇾 Malaysia",
  },
  {
    id: "PDPA_SG",
    label: "PDPA Singapore",
    desc: "Personal Data Protection Act 2012 (Cap 26G) — enhanced 2021",
    region: "🇸🇬 Singapore",
  },
  {
    id: "DPDP_IN",
    label: "DPDP India",
    desc: "Digital Personal Data Protection Act 2023 — Aadhaar and PAN masking",
    region: "🇮🇳 India",
  },
];

const SETTINGS_KEY = "apac_mode";

function ToggleSwitch({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
  label: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
        checked ? "bg-emerald-500 border-emerald-400/50" : "bg-zinc-700 border-zinc-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function WorkspaceSettingsPage() {
  const [apacMode, setApacMode]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [savedAt, setSavedAt]           = useState<string | null>(null);

  // ── Hydrate from localStorage ────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored === "true") setApacMode(true);
  }, []);

  // ── Persist setting ──────────────────────────────────────────
  const handleApacToggle = async (value: boolean) => {
    setApacMode(value);
    setSaving(true);

    // 1. localStorage — instant for next workspace request
    localStorage.setItem(SETTINGS_KEY, String(value));

    // 2. Router-service persistence (best-effort)
    try {
      const token = getToken();
      await fetch(`${process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000"}/api/v1/user/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          regional_governance: value ? "APAC" : "GLOBAL",
          active_frameworks: value ? ["MAS_TRM", "BNM_RMIT", "PDPA_SG", "DPDP_IN"] : [],
        }),
      });
    } catch {
      // Non-fatal — localStorage is the source of truth for the client
    } finally {
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString());
    }
  };

  return (
    <div
      className="min-h-screen p-6 space-y-8"
      style={{ background: "#0F172A", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-white tracking-tight">Workspace Settings</h1>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/20">
            V85
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Configure regional governance, data sovereignty, and compliance framework inheritance.
        </p>
      </div>

      {/* ── Regional Governance ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Regional Governance
              </span>
            </div>
            {savedAt && (
              <span className="text-[10px] text-emerald-400/60 font-mono">
                Saved at {savedAt}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Toggle Row */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-white">APAC Mode</p>
                {apacMode && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 tracking-widest uppercase">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                Activates APAC regional compliance frameworks. When enabled, the V67 DLP engine
                prioritizes regional identifiers (NRIC, MyKad, Aadhaar, PAN) and routes execution
                to APAC-sovereign inference endpoints. Disabling reverts to Global (GDPR) mode.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ToggleSwitch
                id="apac-mode-toggle"
                checked={apacMode}
                onChange={(v) => void handleApacToggle(v)}
                label="Toggle APAC compliance mode"
              />
              <span className="text-[10px] text-slate-500">
                {saving ? "Saving…" : apacMode ? "APAC" : "Global (GDPR)"}
              </span>
            </div>
          </div>

          {/* Mode indicator */}
          <div
            className={`rounded-xl border p-4 transition-all duration-300 ${
              apacMode
                ? "border-emerald-500/20 bg-emerald-950/20"
                : "border-slate-700/40 bg-slate-800/20"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
                  apacMode ? "bg-emerald-500/15" : "bg-slate-700/40"
                }`}
              >
                {apacMode ? "🌏" : "🌍"}
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {apacMode ? "APAC Compliance Mode" : "Global Compliance Mode"}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {apacMode ? "PDPA / DPDP / MAS TRM / BNM RMiT" : "GDPR · SOC 2 Type II"}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {apacMode
                ? "All AI executions will be routed through APAC-sovereign inference endpoints. Regional identifiers (NRIC, MyKad, Aadhaar, PAN) are scrubbed with highest priority by the V67 DLP engine before any model call."
                : "Global GDPR mode is active. Standard PII detection (email, phone, SSN) applies globally. Switch to APAC mode to enable region-specific identifier masking."}
            </p>
          </div>

          {/* Active APAC frameworks */}
          {apacMode && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                Active APAC Frameworks
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {APAC_FRAMEWORKS.map((fw) => (
                  <div
                    key={fw.id}
                    className="rounded-xl border border-emerald-500/15 bg-emerald-950/15 p-3 flex items-start gap-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-emerald-300">{fw.label}</span>
                        <span className="text-[9px] text-slate-500">{fw.region}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{fw.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DLP Identifier Reference ───────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            V67 DLP Identifier Priority (APAC Mode)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { id: "SG_NRIC", pattern: "[STFG]\\d{7}[A-Z]",  jurisdiction: "Singapore", example: "S1234567A" },
            { id: "MY_MYKAD", pattern: "\\d{6}-\\d{2}-\\d{4}", jurisdiction: "Malaysia",  example: "800101-14-5678" },
            { id: "IN_AADHAAR", pattern: "\\d{4}\\s\\d{4}\\s\\d{4}", jurisdiction: "India", example: "1234 5678 9012" },
            { id: "IN_PAN",  pattern: "[A-Z]{5}\\d{4}[A-Z]",  jurisdiction: "India",     example: "ABCDE1234F" },
          ].map(({ id, pattern, jurisdiction, example }) => (
            <div key={id} className="rounded-xl border border-slate-800 bg-slate-800/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-violet-300">{id}</span>
                <span className="text-[9px] text-slate-500">{jurisdiction}</span>
              </div>
              <code className="text-[10px] text-slate-400 font-mono block">{pattern}</code>
              <p className="text-[10px] text-slate-600 mt-1">e.g. {example}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          In APAC mode these patterns are injected before global patterns in the V67 DLP pipeline,
          ensuring jurisdiction-specific identifiers are scrubbed with highest priority before any
          model call. Raw patterns live in{" "}
          <code className="text-slate-500">compliance/apacFrameworks.ts</code>.
        </p>
      </div>
    </div>
  );
}
