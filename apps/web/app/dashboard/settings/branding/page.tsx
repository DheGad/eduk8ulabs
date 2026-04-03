"use client";

import React, { useState, useCallback } from "react";

/**
 * @file page.tsx
 * @route /dashboard/settings/branding
 * @version V62
 * @description Enterprise White-Label Brand Customizer
 *
 * Live theme switcher with Brand Preview Card, smooth CSS transitions,
 * and org name / logo URL form inputs.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

// ================================================================
// TYPES & THEMES
// ================================================================

interface ThemeConfig {
  id:            string;
  name:          string;
  orgName:       string;
  primary:       string;
  light:         string;
  dark:          string;
  glow:          string;
  badgeLabel:    string;
  industry:      string;
}

const THEMES: ThemeConfig[] = [
  {
    id:          "emerald",
    name:        "Standard Emerald",
    orgName:     "StreetMP OS",
    primary:     "#10b981",
    light:       "rgba(16,185,129,0.12)",
    dark:        "rgba(16,185,129,0.3)",
    glow:        "rgba(16,185,129,0.3)",
    badgeLabel:  "Default",
    industry:    "AI Infrastructure",
  },
  {
    id:          "gold",
    name:        "Maybank Gold",
    orgName:     "Maybank AI Gateway",
    primary:     "#FFC107",
    light:       "rgba(255,193,7,0.12)",
    dark:        "rgba(255,193,7,0.3)",
    glow:        "rgba(255,193,7,0.3)",
    badgeLabel:  "Enterprise",
    industry:    "Financial Services",
  },
  {
    id:          "blue",
    name:        "Hospital Blue",
    orgName:     "HealthOS Sovereign AI",
    primary:     "#0EA5E9",
    light:       "rgba(14,165,233,0.12)",
    dark:        "rgba(14,165,233,0.3)",
    glow:        "rgba(14,165,233,0.3)",
    badgeLabel:  "Healthcare",
    industry:    "Healthcare & Compliance",
  },
];

// ================================================================
// BRAND PREVIEW SIDEBAR (mini mock of the real sidebar)
// ================================================================

function BrandPreviewCard({ theme, orgName }: { theme: ThemeConfig; orgName: string }) {
  const navItems = ["Infrastructure", "Security", "Intelligence", "Compliance", "Settings"];

  return (
    <div
      className="rounded-2xl overflow-hidden border transition-all duration-500"
      style={{ borderColor: theme.dark, boxShadow: `0 0 30px ${theme.glow}` }}
    >
      {/* Sidebar preview */}
      <div className="flex h-72">
        {/* Sidebar */}
        <div className="w-44 bg-[#070707] border-r flex flex-col py-3 px-2 flex-shrink-0 transition-all duration-500" style={{ borderColor: theme.dark }}>
          {/* Logo area */}
          <div className="flex items-center gap-2 px-2 pb-3 border-b mb-3 transition-all duration-500" style={{ borderColor: theme.dark }}>
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black flex-shrink-0 transition-all duration-500"
              style={{ background: theme.primary, color: "#000" }}
            >
              {orgName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-[9px] font-black text-white leading-none truncate">{orgName}</p>
              <p className="text-[7px] transition-all duration-500" style={{ color: theme.primary }}>OS v2.0</p>
            </div>
          </div>
          {/* Nav items */}
          <div className="space-y-0.5 flex-1">
            {navItems.map((item, i) => (
              <div key={item}
                className="px-2 py-1.5 rounded text-[8px] font-medium transition-all duration-500 cursor-pointer"
                style={i === 0 ? { background: theme.light, color: theme.primary } : { color: "#555" }}
              >
                {item}
              </div>
            ))}
          </div>
          {/* Status dots */}
          <div className="space-y-1 pt-2 border-t" style={{ borderColor: theme.dark }}>
            {["Sovereign Node", "Nitro Enclave", "Memory"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 px-1">
                <div className="w-1 h-1 rounded-full transition-all duration-500"
                  style={{ background: i === 2 ? "#3b82f6" : theme.primary }} />
                <span className="text-[7px] text-zinc-600">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main content preview */}
        <div className="flex-1 bg-[#080808] p-3">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[7px] font-black px-1.5 py-0.5 rounded border transition-all duration-500"
                style={{ color: theme.primary, borderColor: theme.dark, background: theme.light }}
              >V62</span>
              <span className="text-[7px] text-zinc-600">Brand Preview</span>
            </div>
            <div className="w-3 h-3 rounded-full transition-all duration-500" style={{ background: theme.primary }} />
          </div>
          {/* Fake metric cards */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {["API Calls", "Latency", "Uptime", "Cost Saved"].map((m, i) => (
              <div key={m} className="rounded p-2 border transition-all duration-500"
                style={{ borderColor: theme.dark, background: theme.light }}>
                <p className="text-[7px] text-zinc-500">{m}</p>
                <p className="text-[10px] font-black transition-all duration-500" style={{ color: theme.primary }}>
                  {["12,401", "42ms", "99.9%", "$1,402"][i]}
                </p>
              </div>
            ))}
          </div>
          {/* Fake chart bar */}
          <div className="rounded border p-2 transition-all duration-500" style={{ borderColor: theme.dark }}>
            <div className="flex items-end gap-1 h-8">
              {[40,65,50,80,55,90,70,85].map((h, i) => (
                <div key={i} className="flex-1 rounded-t transition-all duration-500"
                  style={{ height: `${h}%`, background: theme.primary, opacity: 0.5 + (i * 0.07) }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// THEME BUTTON
// ================================================================

function ThemeButton({ theme, active, onClick }: { theme: ThemeConfig; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border transition-all duration-300"
      style={{
        borderColor: active ? theme.primary : "rgba(255,255,255,0.06)",
        background:  active ? theme.light    : "transparent",
        boxShadow:   active ? `0 0 15px ${theme.glow}` : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full flex-shrink-0 transition-all duration-300"
          style={{ background: theme.primary, boxShadow: active ? `0 0 8px ${theme.glow}` : "none" }} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-white">{theme.name}</p>
          <p className="text-[8px] text-zinc-600">{theme.industry}</p>
        </div>
        <span className="text-[8px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 transition-all duration-300"
          style={{ color: theme.primary, borderColor: active ? theme.primary : "rgba(255,255,255,0.08)", background: theme.light }}>
          {theme.badgeLabel}
        </span>
      </div>
    </button>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function BrandingPage() {
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(THEMES[0]!);
  const [orgName, setOrgName]         = useState(THEMES[0]!.orgName);
  const [logoUrl, setLogoUrl]         = useState("");
  const [saved, setSaved]             = useState(false);

  const applyTheme = useCallback((theme: ThemeConfig) => {
    setActiveTheme(theme);
    setOrgName(theme.orgName);
    setSaved(false);

    // Inject CSS variables into the document root for live preview
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", theme.primary);
    root.style.setProperty("--brand-light",   theme.light);
    root.style.setProperty("--brand-dark",    theme.dark);
    root.style.setProperty("--brand-glow",    theme.glow);
  }, []);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    console.info(`[V62:BrandingPage] Theme saved: ${activeTheme.name} | orgName: ${orgName}`);
  }, [activeTheme, orgName]);

  const t = activeTheme;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border transition-all duration-500"
                style={{ color: t.primary, borderColor: t.dark, background: t.light }}>V62</span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">Enterprise Branding</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              White-Label <span className="transition-colors duration-500" style={{ color: t.primary }}>Brand Engine</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Override StreetMP OS's visual identity per-tenant. Changes propagate instantly via CSS custom properties — no rebuild required.
            </p>
          </div>
          <button onClick={handleSave}
            className="px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all duration-300"
            style={{
              background:  saved ? "#10b981" : t.primary,
              color:       "#000",
              boxShadow:   `0 0 20px ${t.glow}`,
            }}
          >
            {saved ? "✓ Saved!" : "Apply Theme"}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* LEFT: Controls */}
          <div className="space-y-6">

            {/* Quick Theme Selector */}
            <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Quick Themes</p>
              <div className="space-y-2">
                {THEMES.map(theme => (
                  <ThemeButton
                    key={theme.id}
                    theme={theme}
                    active={activeTheme.id === theme.id}
                    onClick={() => applyTheme(theme)}
                  />
                ))}
              </div>
            </div>

            {/* Custom inputs */}
            <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5 space-y-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Custom Identity</p>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1.5">
                  Organisation Name
                </label>
                <input
                  value={orgName}
                  onChange={e => { setOrgName(e.target.value); setSaved(false); }}
                  className="w-full bg-black border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-700 outline-none transition-all duration-300 focus:ring-1"
                  placeholder="Your Organisation Name"
                  style={{ borderColor: t.dark }}
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1.5">
                  Logo URL (SVG / PNG)
                </label>
                <input
                  value={logoUrl}
                  onChange={e => { setLogoUrl(e.target.value); setSaved(false); }}
                  className="w-full bg-black border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-700 outline-none transition-all duration-300"
                  placeholder="https://cdn.yourcompany.com/logo.svg"
                  style={{ borderColor: t.dark }}
                />
              </div>

              {/* Colour token preview */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Colour Tokens</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Primary",    color: t.primary, bg: t.primary },
                    { label: "Light BG",   color: "#fff",    bg: t.light },
                    { label: "Dark Border",color: "#fff",    bg: t.dark },
                  ].map(({ label, bg }) => (
                    <div key={label} className="rounded-lg border border-white/5 p-2 text-center">
                      <div className="w-full h-6 rounded mb-1.5 transition-all duration-500" style={{ background: bg }} />
                      <p className="text-[8px] text-zinc-600">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CSS Variables */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Generated CSS Variables</p>
                <pre className="text-[8px] text-zinc-400 bg-black border border-white/5 rounded-lg p-3 font-mono overflow-auto">
{`:root {
  --brand-primary: ${t.primary};
  --brand-light:   ${t.light};
  --brand-dark:    ${t.dark};
  --brand-glow:    ${t.glow};
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Brand Preview */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Live Brand Preview</p>
                <span className="text-[9px] font-mono transition-all duration-500" style={{ color: t.primary }}>
                  {t.name}
                </span>
              </div>
              <BrandPreviewCard theme={t} orgName={orgName} />

              {/* Active theme badge */}
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full transition-all duration-500" style={{ background: t.primary }} />
                <p className="text-[9px] text-zinc-500">
                  Active: <span className="font-bold transition-colors duration-500" style={{ color: t.primary }}>{t.name}</span>
                  {" — "}Primary <span className="font-mono">{t.primary}</span>
                </p>
              </div>
            </div>

            {/* Implementation note */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">How It Works</p>
              <div className="space-y-1.5 text-[9px] text-zinc-600 font-mono">
                <p>1. <span className="text-zinc-400">getThemeConfig(tenantId)</span> resolves theme</p>
                <p>2. <span className="text-zinc-400">buildCSSVariableBlock()</span> generates :root CSS</p>
                <p>3. <span className="text-zinc-400">layout.tsx</span> injects style tag per-request</p>
                <p>4. <span className="text-zinc-400">All components</span> read <span className="text-zinc-400">var(--brand-primary)</span></p>
                <p>5. <span className="text-zinc-400">Zero rebuild</span> — hot CSS variable swap</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
