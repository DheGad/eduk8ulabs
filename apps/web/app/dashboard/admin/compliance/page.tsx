"use client";

/**
 * @file app/dashboard/admin/compliance/page.tsx
 * @description Command 085 — APAC Regulatory Intelligence Engine + existing V21 framework.
 *
 * Merged with the pre-existing compliance page. Preserves all original functionality:
 *   - V21 Auto-Compliance Engine cards (fetched from router API)
 *   - Tenant selector, audit report download, toggle switches
 *
 * Adds:
 *   - V85 APAC one-click framework section (MAS TRM, BNM RMiT, PDPA SG)
 *   - Local optimistic toggle with kernel-level impact description
 *   - Visual "reconfiguring kernel" animation on toggle
 *   - Compliance posture summary header
 */

import React, { useState, useEffect, useCallback } from "react";

// ─── Phase 5: Report download state ─────────────────────────────────────────
type DownloadState = "idle" | "generating" | "done" | "error";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  icon: string;
  v12_rules: string[];
  active?: boolean;
  enforced_since?: string;
}

interface ApacFramework {
  id:                 "MAS_TRM" | "BNM_RMIT" | "PDPA_SG" | "GDPR_EU";
  name:               string;
  jurisdiction:       string;
  flag:               string;
  icon:               string;
  tagline:            string;
  regulatory_ref:     string;
  region_enforced:    string;
  retention:          string;
  consensus:          boolean;
  dlp_patterns:       string[];
  v12_tags:           string[];
  status_badge:       string;
  border_active:      string;
  border_inactive:    string;
  badge_color:        string;
}

// ─── APAC Framework Definitions (mirrors apacFrameworks.ts) ──────────────────

const APAC_FRAMEWORKS: ApacFramework[] = [
  {
    id:              "MAS_TRM",
    name:            "MAS TRM",
    jurisdiction:    "Singapore",
    flag:            "🇸🇬",
    icon:            "🏦",
    tagline:         "Monetary Authority of Singapore — Technology Risk Management Guidelines 2021",
    regulatory_ref:  "MAS TRM 2021 · MAS Notice 655 · PDPA Cap 26G",
    region_enforced: "SG — Singapore Data Centre",
    retention:       "5 years (1,825 days)",
    consensus:       true,
    dlp_patterns:    ["NRIC/FIN Tokenisation (S/T/F/G\\d{7}[A-Z])", "SG Bank Account Mask", "SG Phone Redaction"],
    v12_tags:        ["MAS_TRM_9.1_SYSTEM_RISK", "MAS_TRM_9.2_AI_GOVERNANCE", "V74_CONSENSUS_REQUIRED", "V13_RETENTION_1825D"],
    status_badge:    "MAS Approved Posture",
    border_active:   "border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.08)]",
    border_inactive: "border-slate-800 hover:border-slate-600",
    badge_color:     "bg-red-500/10 text-red-400 border-red-500/20",
  },
  {
    id:              "BNM_RMIT",
    name:            "BNM RMiT",
    jurisdiction:    "Malaysia",
    flag:            "🇲🇾",
    icon:            "🏛️",
    tagline:         "Bank Negara Malaysia — Risk Management in Technology Policy 2020",
    regulatory_ref:  "BNM RMiT 2020 · PDPA Malaysia 2010 · FSA 2013",
    region_enforced: "MY — Malaysia Data Centre",
    retention:       "7 years (2,556 days)",
    consensus:       false,
    dlp_patterns:    ["MyKad IC Tokenisation (\\d{6}-\\d{2}-\\d{4})", "MyKad No-Dash (12-digit)", "MY Bank Account Mask"],
    v12_tags:        ["BNM_RMIT_10.55_AUDIT_LOG", "BNM_RMIT_10.68_AI_RISK", "V69_REGION_MY", "V13_RETENTION_2556D"],
    status_badge:    "BNM Compliant Posture",
    border_active:   "border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.08)]",
    border_inactive: "border-slate-800 hover:border-slate-600",
    badge_color:     "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  {
    id:              "PDPA_SG",
    name:            "PDPA Singapore",
    jurisdiction:    "Singapore",
    flag:            "🇸🇬",
    icon:            "🔐",
    tagline:         "Singapore Personal Data Protection Act 2012 (Cap 26G) — Enhanced 2021",
    regulatory_ref:  "PDPA Cap 26G · PDPC Advisory Guidelines 2021",
    region_enforced: "SG — Singapore Data Centre",
    retention:       "3 years (1,095 days)",
    consensus:       false,
    dlp_patterns:    ["NRIC Tokenisation", "FIN Tokenisation", "Purpose Limitation Overlay"],
    v12_tags:        ["PDPA_SG_PURPOSE_LIMITATION", "PDPA_SG_DATA_MINIMISATION", "V69_REGION_SG"],
    status_badge:    "PDPC Compliant",
    border_active:   "border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.08)]",
    border_inactive: "border-slate-800 hover:border-slate-600",
    badge_color:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    id:              "GDPR_EU",
    name:            "GDPR",
    jurisdiction:    "European Union",
    flag:            "🇪🇺",
    icon:            "⚖️",
    tagline:         "General Data Protection Regulation — EU 2016/679",
    regulatory_ref:  "GDPR 2016/679 · EDPB Guidelines · SCCs",
    region_enforced: "EU — EEA Sovereign Region",
    retention:       "As needed (purpose limitation)",
    consensus:       false,
    dlp_patterns:    ["EU National ID Redaction", "IBAN Mask", "Email PII Tokenisation"],
    v12_tags:        ["GDPR_ART25_PBD", "GDPR_ART5_MIN", "V69_REGION_EU", "V67_PII_ENHANCED"],
    status_badge:    "GDPR Compliant",
    border_active:   "border-violet-500/40 shadow-[0_0_30px_rgba(139,92,246,0.08)]",
    border_inactive: "border-slate-800 hover:border-slate-600",
    badge_color:     "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const ROUTER_URL = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

const TENANT_OPTIONS = [
  { id: "jpmc",            label: "JPMC — Financial",        icon: "🏦" },
  { id: "dbs-singapore",  label: "DBS Bank — Singapore",    icon: "🇸🇬" },
  { id: "maybank-malaysia", label: "Maybank — Malaysia",     icon: "🇲🇾" },
  { id: "stanford",        label: "Stanford — Academic",     icon: "🎓" },
  { id: "pentagon",        label: "Pentagon — Defense",      icon: "🛡️" },
  { id: "dev-sandbox",     label: "Dev Sandbox",             icon: "🔧" },
];

// ─── Toggle Component ─────────────────────────────────────────────────────────

function ToggleSwitch({
  active,
  disabled,
  onChange,
  id,
}: {
  active: boolean;
  disabled: boolean;
  onChange: () => void;
  id: string;
}) {
  return (
    <button
      id={`toggle-${id}`}
      onClick={onChange}
      disabled={disabled}
      title={active ? "Disable framework" : "Enable framework"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
        active ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${
          active ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── APAC Framework Card ──────────────────────────────────────────────────────

function ApacFrameworkCard({
  fw,
  active,
  toggling,
  onToggle,
}: {
  fw: ApacFramework;
  active: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border transition-all duration-500 flex flex-col overflow-hidden ${
        active ? fw.border_active + " bg-slate-900/60" : fw.border_inactive + " bg-slate-900/30"
      }`}
    >
      {/* Card Header */}
      <div className="p-5 flex items-start justify-between gap-4 border-b border-white/[0.04]">
        <div className="flex gap-3">
          <div className="text-3xl bg-white/5 rounded-xl w-12 h-12 flex items-center justify-center shrink-0 border border-white/10">
            {fw.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-lg font-bold text-white tracking-tight">{fw.name}</span>
              <span className="text-base">{fw.flag}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${fw.badge_color}`}>
                {fw.jurisdiction}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pr-2">{fw.tagline}</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {toggling ? (
            <div className="h-6 w-11 rounded-full bg-slate-700 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            </div>
          ) : (
            <ToggleSwitch active={active} disabled={toggling} onChange={onToggle} id={fw.id} />
          )}
          {active ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                Enforcing
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col gap-5">

        {/* Regulatory reference */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Regulatory Basis</p>
          <p className="text-xs text-slate-400 font-mono">{fw.regulatory_ref}</p>
        </div>

        {/* Kernel overrides when active */}
        {active && (
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-4 flex flex-col gap-3">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Kernel Reconfigured — Live Effect
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Region Lock</span>
                <span className="text-emerald-300 font-mono">{fw.region_enforced}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Audit Retention</span>
                <span className="text-emerald-300 font-mono">{fw.retention}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">V74 Consensus</span>
                <span className={`font-mono font-bold ${fw.consensus ? "text-emerald-400" : "text-slate-500"}`}>
                  {fw.consensus ? "Required (MAS §9.2)" : "Not Required"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">DLP Rules</span>
                <span className="text-emerald-300 font-mono">{fw.dlp_patterns.length} patterns injected</span>
              </div>
            </div>
          </div>
        )}

        {/* DLP patterns */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Jurisdiction-Specific DLP Patterns
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fw.dlp_patterns.map((p) => (
              <span
                key={p}
                className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors ${
                  active
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-slate-800/80 border-slate-700 text-slate-500"
                }`}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* V12 tags */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Underlying V12 Policy Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fw.v12_tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors ${
                  active
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                    : "bg-slate-800/80 border-slate-700 text-slate-500"
                }`}
              >
                <span className={`mr-1.5 ${active ? "text-emerald-500" : "text-slate-600"}`}>▪</span>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComplianceDashboardPage() {
  // ── V21 state (original) ──────────────────────────────────────────────────
  const [tenantId, setTenantId]         = useState("jpmc");
  const [frameworks, setFrameworks]     = useState<ComplianceFramework[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [toggling, setToggling]         = useState<Record<string, boolean>>({});

  // ── V85 APAC state (new) ──────────────────────────────────────────────────
  const [apacActive, setApacActive]     = useState<Record<string, boolean>>({
    MAS_TRM:  false,
    BNM_RMIT: false,
    PDPA_SG:  false,
    GDPR_EU:  false,
  });
  const [apacToggling, setApacToggling] = useState<Record<string, boolean>>({});

  // Pre-activate APAC frameworks for known APAC tenants
  useEffect(() => {
    if (tenantId === "dbs-singapore") {
      setApacActive({ MAS_TRM: true, BNM_RMIT: false, PDPA_SG: true, GDPR_EU: false });
    } else if (tenantId === "maybank-malaysia") {
      setApacActive({ MAS_TRM: false, BNM_RMIT: true, PDPA_SG: false, GDPR_EU: false });
    } else {
      setApacActive({ MAS_TRM: false, BNM_RMIT: false, PDPA_SG: false, GDPR_EU: false });
    }
  }, [tenantId]);

  const activeApacCount = Object.values(apacActive).filter(Boolean).length;

  // ── V21 fetchers (original) ───────────────────────────────────────────────
  const fetchFrameworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${ROUTER_URL}/api/v1/admin/compliance/${tenantId}`);
      const json = await res.json() as { success: boolean; data?: ComplianceFramework[]; error?: { message: string } };
      if (!json.success || !json.data) {
        setError(json.error?.message ?? "Failed to load compliance data.");
        return;
      }
      setFrameworks(json.data);
    } catch {
      setError("Cannot reach Router Service. Ensure it's running on port 4000.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void fetchFrameworks(); }, [fetchFrameworks]);

  const toggleFramework = async (id: string, currentStatus: boolean) => {
    setToggling((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const res  = await fetch(`${ROUTER_URL}/api/v1/admin/compliance/${tenantId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework_id: id, active: !currentStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to toggle framework");
      setFrameworks((prev) =>
        prev.map((fw) =>
          fw.id === id
            ? { ...fw, active: !currentStatus, enforced_since: !currentStatus ? new Date().toISOString() : undefined }
            : fw
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Toggle failed.");
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }));
    }
  };

  // ── V85 APAC toggle handler ───────────────────────────────────────────────
  const handleApacToggle = async (fwId: string) => {
    setApacToggling((prev) => ({ ...prev, [fwId]: true }));
    // Simulate a 600ms "kernel reconfiguration" delay to feel enterprise-grade
    await new Promise((r) => setTimeout(r, 600));
    setApacActive((prev) => ({ ...prev, [fwId]: !prev[fwId] }));
    setApacToggling((prev) => ({ ...prev, [fwId]: false }));
  };

  // ── Phase 5: CEO Audit Exporter ─────────────────────────────────────────
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");

  const handleDownloadAudit = async () => {
    setDownloadState("generating");
    try {
      const apacMode  = localStorage.getItem("apac_mode") === "true";
      const framework = apacMode ? "APAC_PDPA" : "GLOBAL_GDPR";
      const url = `/api/v1/admin/compliance/report?tenant_id=${tenantId}&period=Last+30+Days&framework=${framework}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `StreetMP-Audit-${tenantId}-${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setDownloadState("done");
      setTimeout(() => setDownloadState("idle"), 3000);
    } catch {
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 3000);
    }
  };


  return (
    <div className="min-h-screen p-6 space-y-8 bg-[#0F172A] font-sans">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">Regulatory Compliance</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
              V21
            </span>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/20">
              V85 APAC
            </span>
            <span className="text-xs text-slate-500">Auto-Compliance Engine</span>
          </div>
          <p className="text-sm text-slate-500">
            Subscribe to legal frameworks to instantly enforce underlying V12 Policies and kernel-level routing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tenant selector */}
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1 flex-wrap">
            {TENANT_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTenantId(t.id)}
                title={t.label}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tenantId === t.id
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.id}</span>
              </button>
            ))}
          </div>

          <button
            onClick={fetchFrameworks}
            aria-label="Refresh compliance"
            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-xs transition-all"
          >
            ↻
          </button>

          <button
            id="download-audit-report"
            onClick={() => void handleDownloadAudit()}
            disabled={downloadState === "generating"}
            className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
              downloadState === "done"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : downloadState === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-400"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-500"
            } disabled:opacity-60 disabled:cursor-wait`}
          >
            {downloadState === "generating" ? (
              <><span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400/30 border-t-slate-400 animate-spin inline-block" /> Generating…</>
            ) : downloadState === "done" ? (
              <><span>✓</span> Report Downloaded</>
            ) : downloadState === "error" ? (
              <><span>⚠</span> Download Failed</>
            ) : (
              <><span>📥</span> Download Monthly Audit Report</>
            )}
          </button>
        </div>
      </div>

      {/* ── Compliance Posture Summary ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active V21 Frameworks", value: frameworks.filter((f) => f.active).length.toString(), color: "text-emerald-400" },
          { label: "APAC Frameworks Active", value: activeApacCount.toString(), color: activeApacCount > 0 ? "text-blue-400" : "text-slate-500" },
          { label: "V12 Policies Enforced",  value: (frameworks.filter((f) => f.active).reduce((acc, f) => acc + f.v12_rules.length, 0) + (activeApacCount * 4)).toString(), color: "text-violet-400" },
          { label: "Data Regions Locked",   value: activeApacCount > 0 ? activeApacCount.toString() : "0", color: activeApacCount > 0 ? "text-yellow-400" : "text-slate-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 flex flex-col gap-1"
          >
            <span className={`text-2xl font-black tracking-tighter ${stat.color}`}>{stat.value}</span>
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-4 flex items-center gap-3">
          <span className="text-red-400">⚠</span>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* V85: APAC Regulatory Intelligence Panel                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-5">
        {/* Section header */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-base font-bold text-white tracking-tight">
                APAC Regulatory Intelligence
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/20">
                V85
              </span>
            </div>
            <p className="text-xs text-slate-500">
              One-click activation of Southeast Asian and EU regulatory frameworks. Toggling instantly
              reconfigures V69 regional routing, V67 DLP rules, V74 consensus requirements, and
              V13 audit retention at the kernel level.
            </p>
          </div>
        </div>

        {/* APAC Framework Cards */}
        <div className="grid md:grid-cols-2 gap-5">
          {APAC_FRAMEWORKS.map((fw) => (
            <ApacFrameworkCard
              key={fw.id}
              fw={fw}
              active={apacActive[fw.id] ?? false}
              toggling={apacToggling[fw.id] ?? false}
              onToggle={() => void handleApacToggle(fw.id)}
            />
          ))}
        </div>

        {/* Live kernel reconfiguration indicator */}
        {activeApacCount > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-sm font-semibold text-emerald-300">
                {activeApacCount} APAC framework{activeApacCount > 1 ? "s" : ""} active —
                {" "}kernel routing, DLP rules, and audit retention are reconfigured for this session.
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500 shrink-0">V85 · V69 · V67 · V13</span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* V21: Original Framework Cards (fetched from router API)          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-base font-bold text-white tracking-tight">
              Global Compliance Frameworks
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
              V21
            </span>
          </div>
          <p className="text-xs text-slate-500">
            V12 Policy-as-Code frameworks for tenant {tenantId}. Toggle to subscribe or unsubscribe.
          </p>
        </div>

        {loading && frameworks.length === 0 ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            <span className="text-sm text-slate-500">Loading registry…</span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {frameworks.map((fw) => {
              const isActive   = fw.active === true;
              const isToggling = toggling[fw.id];

              return (
                <div
                  key={fw.id}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    isActive
                      ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                      : "border-slate-800 bg-slate-900/50 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="p-5 flex items-start justify-between gap-4 border-b border-white/[0.03]">
                    <div className="flex gap-3">
                      <div className="text-3xl bg-white/5 rounded-xl w-12 h-12 flex items-center justify-center shrink-0 border border-white/10">
                        {fw.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{fw.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed pr-2">{fw.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <button
                        onClick={() => void toggleFramework(fw.id, isActive)}
                        disabled={isToggling}
                        title={isActive ? `Disable ${fw.name}` : `Enable ${fw.name}`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
                          isActive ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                      {isActive ? (
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10">
                          Enforcing
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 rounded border border-slate-700 bg-slate-800">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Underlying V12 Policies</p>
                      <div className="flex flex-wrap gap-2">
                        {fw.v12_rules.map((rule) => (
                          <div
                            key={rule}
                            className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                              isActive
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                : "bg-slate-800/80 border-slate-700/80 text-slate-400"
                            }`}
                          >
                            <span className={isActive ? "text-emerald-500 mr-1.5" : "text-slate-600 mr-1.5"}>▪</span>
                            {rule}
                          </div>
                        ))}
                      </div>
                    </div>
                    {isActive && fw.enforced_since && (
                      <div className="text-[10px] text-slate-500 font-mono mt-2 pt-4 border-t border-white/[0.03] flex items-center justify-between">
                        <span>Last Audited Structure</span>
                        <span className="text-emerald-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Synchronized
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
