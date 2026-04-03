"use client";

/**
 * @file app/dashboard/developer/white-label/page.tsx
 * @description Command 088 — White-Label Configuration Dashboard
 *
 * Route:  /dashboard/developer/white-label
 * Access: Authenticated — sits inside the standard dashboard layout.
 *
 * Lets ISV partners configure their white-label branding:
 *   - Custom logo URL (replaces StreetMP logo on /verify certificates)
 *   - Custom policy presets (V12 rules applied to end-users)
 *   - Endpoint alias configuration (api.yourstartup.com → StreetMP)
 *   - Partner ID overview with copy button
 */

import { useState } from "react";
import Link from "next/link";

// ─── V12 Policy Preset options ────────────────────────────────────────────────

interface PolicyRule {
  id:          string;
  label:       string;
  description: string;
  category:    "DLP" | "Firewall" | "Consensus" | "Region" | "Audit";
  severity:    "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
}

const POLICY_RULES: PolicyRule[] = [
  { id: "V67_PII_SCRUB",        label: "V67 PII Scrubber",            category: "DLP",       severity: "REQUIRED",    description: "Redact email, SSN, NRIC, MyKad, IBAN, CC numbers before any LLM dispatch." },
  { id: "V71_PROMPT_FIREWALL",  label: "V71 Prompt Firewall",         category: "Firewall",  severity: "REQUIRED",    description: "Heuristic jailbreak detection (<5ms). Blocks adversarial prompt injection." },
  { id: "V74_CONSENSUS",        label: "V74 Dual-Model Consensus",    category: "Consensus", severity: "RECOMMENDED", description: "Run a backup model and verify semantic agreement before returning output." },
  { id: "V69_REGION_SG",        label: "V69 Region Lock — Singapore", category: "Region",    severity: "OPTIONAL",    description: "Restrict all inference to Singapore endpoints (MAS TRM compliance)." },
  { id: "V69_REGION_MY",        label: "V69 Region Lock — Malaysia",  category: "Region",    severity: "OPTIONAL",    description: "Restrict all inference to Malaysia endpoints (BNM RMiT compliance)." },
  { id: "V69_REGION_EU",        label: "V69 Region Lock — EU",        category: "Region",    severity: "OPTIONAL",    description: "Restrict all inference to EU/EEA endpoints (GDPR Art.25)." },
  { id: "V13_MERKLE_LOG",       label: "V13 Merkle Audit Logging",    category: "Audit",     severity: "REQUIRED",    description: "Anchor every certificate to a per-tenant SHA-256 Merkle tree." },
  { id: "V81_NEMO_GUARDRAILS",  label: "V81 NeMo Guardrails",         category: "Firewall",  severity: "RECOMMENDED", description: "NVIDIA NeMo secondary safety check post-LLM-execution." },
  { id: "MAS_TRM_PACK",         label: "APAC: MAS TRM Pack",          category: "Region",    severity: "OPTIONAL",    description: "Full MAS TRM 2021 enforcement bundle: region lock, 5yr retention, consensus." },
  { id: "BNM_RMIT_PACK",        label: "APAC: BNM RMiT Pack",        category: "Region",    severity: "OPTIONAL",    description: "Full BNM RMiT 2020 enforcement bundle: region lock, 7yr retention, MyKad DLP." },
];

const SEV_STYLES: Record<PolicyRule["severity"], string> = {
  REQUIRED:    "border-red-500/30 bg-red-500/[0.06] text-red-400",
  RECOMMENDED: "border-yellow-500/30 bg-yellow-500/[0.06] text-yellow-400",
  OPTIONAL:    "border-zinc-700 bg-zinc-900/60 text-zinc-500",
};

const CAT_COLORS: Record<PolicyRule["category"], string> = {
  DLP:       "text-purple-400",
  Firewall:  "text-orange-400",
  Consensus: "text-blue-400",
  Region:    "text-cyan-400",
  Audit:     "text-emerald-400",
};

// ─── Simulated partner state ──────────────────────────────────────────────────

const MOCK_PARTNER = {
  partner_id:   "partner_sg_fintech_01",
  partner_name: "AcmePay",
  api_key:      "smp_partner_live_sk_a3f8c2d1e94b7056fe3a",
  plan:         "Growth",
  tokens_this_month: 8_420_000,
  revenue_this_month: 58_940,
  active_tenants: 12,
};

// ─── Component: Copy pill ─────────────────────────────────────────────────────

function CopyPill({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-zinc-950 px-4 py-3">
        <code className="flex-1 text-xs font-mono text-zinc-400 truncate">{value}</code>
        <button
          onClick={handleCopy}
          className="shrink-0 text-[11px] font-bold text-zinc-500 hover:text-emerald-400 transition-colors"
          aria-label="Copy to clipboard"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WhiteLabelDashboard() {
  const [logoUrl,          setLogoUrl]          = useState("https://os.streetmp.com/logo.svg");
  const [partnerName,      setPartnerName]      = useState(MOCK_PARTNER.partner_name);
  const [accentColor,      setAccentColor]      = useState("#10b981");
  const [cnameAlias,       setCnameAlias]       = useState("api.acmepay.com");
  const [enabledPolicies,  setEnabledPolicies]  = useState<Set<string>>(
    new Set(["V67_PII_SCRUB", "V71_PROMPT_FIREWALL", "V13_MERKLE_LOG"])
  );
  const [saved, setSaved] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  const togglePolicy = (id: string, rule: PolicyRule) => {
    if (rule.severity === "REQUIRED") return; // can't disable required policies
    setEnabledPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const enabledCount = enabledPolicies.size;
  const requiredCount = POLICY_RULES.filter((r) => r.severity === "REQUIRED").length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* ── Breadcrumb Header ──────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span className="text-zinc-700">/</span>
            <Link href="/dashboard/developer" className="hover:text-white transition-colors">Developer</Link>
            <span className="text-zinc-700">/</span>
            <span className="text-white font-semibold">White-Label Config</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Plan: {MOCK_PARTNER.plan}</span>
            <Link href="/developers" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              View Partner Portal →
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-8 py-10 space-y-10">

        {/* ── Partner Overview Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Partner ID",           value: MOCK_PARTNER.partner_id,              mono: true,  suffix: "" },
            { label: "Active Sub-Tenants",   value: MOCK_PARTNER.active_tenants.toString(), mono: false, suffix: "" },
            { label: "Tokens This Month",    value: `${(MOCK_PARTNER.tokens_this_month / 1_000_000).toFixed(1)}M`, mono: false, suffix: "" },
            { label: "Compliance Revenue",   value: `$${MOCK_PARTNER.revenue_this_month.toLocaleString()}`, mono: false, suffix: "/mo" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-5">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-2xl font-black text-white tracking-tighter ${stat.mono ? "text-sm font-mono text-emerald-400 truncate" : ""}`}>
                {stat.value}<span className="text-sm font-normal text-zinc-600">{stat.suffix}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">

          {/* ── Left column: Branding ────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Partner identity */}
            <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-7 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Brand Identity</h2>
                <p className="text-xs text-zinc-500">Customize how your brand appears on public STP verification pages.</p>
              </div>

              <div className="space-y-4">
                {/* Partner name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="partner-name" className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    Partner Display Name
                  </label>
                  <input
                    id="partner-name"
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white font-semibold transition-all focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  />
                  {partnerName && (
                    <p className="text-[11px] text-zinc-600 font-mono">
                      Certificate will display: "Verified by <strong className="text-zinc-400">{partnerName}</strong> via STP"
                    </p>
                  )}
                </div>

                {/* Logo URL */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="logo-url" className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    Logo URL (SVG or PNG, ≤ 256px)
                  </label>
                  <div className="flex gap-3 items-start">
                    <input
                      id="logo-url"
                      type="url"
                      value={logoUrl}
                      onChange={(e) => { setLogoUrl(e.target.value); setLogoPreviewError(false); }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300 font-mono transition-all focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                      placeholder="https://your-cdn.com/logo.svg"
                    />
                    {/* Logo preview */}
                    <div className="h-11 w-11 rounded-xl border border-white/[0.08] bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0">
                      {logoPreviewError ? (
                        <span className="text-zinc-700 text-xs">?</span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt="Logo preview"
                          className="h-8 w-8 object-contain"
                          onError={() => setLogoPreviewError(true)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Accent color */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="accent-color" className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    Brand Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="accent-color"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-12 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                    />
                    <code className="text-sm font-mono text-zinc-400">{accentColor}</code>
                    <span className="text-xs text-zinc-600">— used on certificate headers and verify page</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Endpoint aliasing */}
            <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-7 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Endpoint Alias (CNAME)</h2>
                <p className="text-xs text-zinc-500">
                  Point your domain to the StreetMP proxy. Your end-users never see StreetMP in the API URL.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cname-alias" className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  Your API Endpoint
                </label>
                <input
                  id="cname-alias"
                  type="text"
                  value={cnameAlias}
                  onChange={(e) => setCnameAlias(e.target.value)}
                  placeholder="api.yourstartup.com"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300 font-mono transition-all focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              {/* CNAME record snippet */}
              <div className="rounded-xl border border-white/[0.06] bg-black/60 p-4 font-mono text-xs text-zinc-400 space-y-2">
                <p className="text-zinc-600"># Add this DNS CNAME record:</p>
                <p>
                  <span className="text-emerald-400">{cnameAlias || "api.yourstartup.com"}</span>{" "}
                  <span className="text-zinc-600">CNAME</span>{" "}
                  <span className="text-violet-400">proxy.streetmp.com</span>
                </p>
                <p className="text-zinc-600 mt-2"># Your SDK config (no changes after this):</p>
                <p>
                  <span className="text-zinc-500">baseUrl:</span>{" "}
                  <span className="text-emerald-400">
                    "https://{cnameAlias || "api.yourstartup.com"}/v1"
                  </span>
                </p>
              </div>

              {/* Credentials */}
              <div className="space-y-3 pt-1">
                <CopyPill value={MOCK_PARTNER.partner_id}  label="Partner ID" />
                <CopyPill value={`${MOCK_PARTNER.api_key.slice(0, 24)}${"•".repeat(16)}`} label="Live API Key (masked)" />
              </div>
            </div>
          </div>

          {/* ── Right column: Policy Presets ─────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Custom Policy Presets (V12)</h2>
                <p className="text-xs text-zinc-500">
                  Choose which zero-trust rules apply to <em>all</em> of your end-user sub-tenants.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-emerald-400">{enabledCount}</p>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">rules active</p>
              </div>
            </div>

            {/* Policy list */}
            <div className="space-y-2">
              {POLICY_RULES.map((rule) => {
                const isOn = enabledPolicies.has(rule.id);
                const isRequired = rule.severity === "REQUIRED";
                return (
                  <button
                    key={rule.id}
                    onClick={() => togglePolicy(rule.id, rule)}
                    disabled={isRequired}
                    className={`w-full text-left rounded-xl border px-4 py-4 transition-all ${
                      isOn
                        ? SEV_STYLES[rule.severity]
                        : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60"
                    } ${isRequired ? "cursor-default" : "cursor-pointer"}`}
                    title={isRequired ? "This rule is required and cannot be disabled." : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {/* Toggle indicator */}
                      <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        isOn ? "border-current bg-current/20" : "border-zinc-600"
                      }`}>
                        {isOn && <span className="text-[8px] font-black leading-none">✓</span>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{rule.label}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${CAT_COLORS[rule.category]}`}>
                            {rule.category}
                          </span>
                          {isRequired && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Required</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{rule.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Policy summary */}
            <div className="pt-4 border-t border-white/[0.06] flex items-center gap-4 text-xs text-zinc-600">
              <span>{requiredCount} required · {enabledCount - requiredCount} optional enabled</span>
              <span className="ml-auto font-mono">V12 PaC gate active</span>
            </div>
          </div>
        </div>

        {/* ── Save bar ──────────────────────────────────────────────────────── */}
        <div className="sticky bottom-6 left-0 right-0 mx-auto max-w-2xl">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between gap-4 shadow-2xl">
            <div className="text-sm text-zinc-400">
              {saved ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  Configuration saved and active
                </span>
              ) : (
                "Unsaved changes — click save to apply to all sub-tenants"
              )}
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => {
                  setLogoUrl("https://os.streetmp.com/logo.svg");
                  setPartnerName(MOCK_PARTNER.partner_name);
                  setAccentColor("#10b981");
                  setCnameAlias("api.acmepay.com");
                  setEnabledPolicies(new Set(["V67_PII_SCRUB", "V71_PROMPT_FIREWALL", "V13_MERKLE_LOG"]));
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                {saved ? "✓ Saved" : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
