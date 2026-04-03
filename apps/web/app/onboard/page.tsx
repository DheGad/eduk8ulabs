"use client";

import React, { useState, useRef, useEffect } from "react";

// ────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────

type Industry = "healthcare" | "finance" | "education" | "legaltech" | "other";
type Plan = "starter" | "growth" | "enterprise";

interface RiskScanResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  approved: boolean;
  risks: string[];
  passes: string[];
  provider: string;
  scannedAt: string;
}

interface OnboardState {
  // Step 1
  email: string;
  companyName: string;
  industry: Industry | "";
  // Step 2
  aiProvider: "openai" | "anthropic" | "gemini" | "";
  aiKey: string;
  riskResult: RiskScanResult | null;
  riskLoading: boolean;
  // Step 3
  plan: Plan | "";
  // Step 4 — handled by redirect to Stripe
  checkoutLoading: boolean;
}

// ────────────────────────────────────────────────────────────────
// DATA
// ────────────────────────────────────────────────────────────────

const INDUSTRIES: { id: Industry; label: string; icon: string }[] = [
  { id: "finance", label: "Finance & Banking", icon: "🏦" },
  { id: "healthcare", label: "Healthcare & Life Sciences", icon: "⚕️" },
  { id: "education", label: "Education & Research", icon: "🎓" },
  { id: "legaltech", label: "Legal & Compliance", icon: "⚖️" },
  { id: "other", label: "Other / General Enterprise", icon: "🌐" },
];

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  period: string;
  features: string[];
  badge?: string;
  gradient: string;
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$500",
    period: "/month",
    gradient: "from-slate-800 to-slate-900",
    features: [
      "5M tokens / month",
      "GPT-4o + Claude 3.5 access",
      "V71 Prompt Firewall",
      "V35 Immutable Audit Log",
      "99.9% uptime SLA",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$2,000",
    period: "/month",
    badge: "MOST POPULAR",
    gradient: "from-emerald-950 to-slate-900",
    features: [
      "25M tokens / month",
      "All Starter features",
      "V65 RBAC & Team Seats",
      "V47 Encrypted Vault",
      "V86 AI Risk Scanner",
      "Compliance Dashboard (SOC 2, HIPAA)",
      "Slack + priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    gradient: "from-violet-950 to-slate-900",
    features: [
      "Unlimited tokens",
      "All Growth features",
      "Dedicated VPS node",
      "BFT Cognitive Quorum",
      "Custom compliance frameworks",
      "SSO / SAML integration",
      "24/7 dedicated SRE",
    ],
  },
];

const AI_PROVIDERS = [
  { id: "openai" as const, label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic" as const, label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "gemini" as const, label: "Google Gemini", placeholder: "AIza..." },
];

// ────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ────────────────────────────────────────────────────────────────

function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
          done
            ? "bg-emerald-500 text-black"
            : active
            ? "bg-white text-black ring-4 ring-emerald-500/30"
            : "bg-white/10 text-white/30"
        }`}
      >
        {done ? "✓" : step}
      </div>
      <span className={`text-[10px] tracking-widest uppercase font-semibold transition-colors ${active ? "text-emerald-400" : done ? "text-emerald-600" : "text-white/20"}`}>
        {label}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────

export default function OnboardPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardState>({
    email: "",
    companyName: "",
    industry: "",
    aiProvider: "",
    aiKey: "",
    riskResult: null,
    riskLoading: false,
    plan: "",
    checkoutLoading: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardState, string>>>({});
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  const set = (patch: Partial<OnboardState>) => setState((s) => ({ ...s, ...patch }));

  // ── Step 1 Validation ────────────────────────────────────────
  const validateStep1 = () => {
    const e: typeof errors = {};
    if (!state.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Valid corporate email required";
    if (!state.industry) e.industry = "Please select your industry vertical";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 2: Risk Scan ────────────────────────────────────────
  const handleRiskScan = async () => {
    if (!state.aiProvider || !state.aiKey.trim()) {
      setErrors({ aiKey: "Select a provider and paste your API key." });
      return;
    }
    set({ riskLoading: true, riskResult: null });
    setErrors({});
    try {
      const res = await fetch("/api/onboard/risk-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: state.aiKey, provider: state.aiProvider }),
      });
      const data = await res.json();
      set({ riskResult: data, riskLoading: false });
    } catch {
      set({ riskLoading: false });
      setErrors({ aiKey: "Scan failed. Check your connection." });
    }
  };

  // ── Step 4: Stripe Checkout ───────────────────────────────────
  const handleCheckout = async () => {
    if (state.plan === "enterprise") {
      window.location.href = "mailto:sales@streetmp.com?subject=Enterprise Inquiry";
      return;
    }
    set({ checkoutLoading: true });
    try {
      const res = await fetch("/api/onboard/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.email,
          companyName: state.companyName,
          industry: state.industry,
          plan: state.plan,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        set({ checkoutLoading: false });
        setErrors({ checkoutLoading: data.error || "Checkout failed. Try again." } as never);
      }
    } catch {
      set({ checkoutLoading: false });
    }
  };

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  return (
    <div
      ref={topRef}
      className="min-h-screen bg-[#020202] text-white"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(0,229,153,0.04) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(99,102,241,0.04) 0%, transparent 40%),
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: "auto, auto, 48px 48px, 48px 48px",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-emerald-400 tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Zero-Touch Enterprise Onboarding
          </div>
          <h1 className="text-4xl font-black tracking-tight leading-none mb-4"
            style={{ background: "linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Join the Sovereign<br />AI Grid
          </h1>
          <p className="text-white/40 text-sm max-w-md mx-auto">
            From company email to governed AI requests in under 5 minutes. No sales call required.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[
            { n: 1, label: "Identity" },
            { n: 2, label: "Risk Scan" },
            { n: 3, label: "Plan" },
            { n: 4, label: "Payment" },
          ].map(({ n, label }, idx) => (
            <React.Fragment key={n}>
              <StepDot step={n} current={step} label={label} />
              {idx < 3 && (
                <div className={`flex-1 h-px max-w-16 transition-colors duration-500 ${step > n ? "bg-emerald-500/50" : "bg-white/10"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: "rgba(12,12,12,0.9)", backdropFilter: "blur(40px)" }}
        >
          {/* ── STEP 1: Identity ─────────────────────────────── */}
          {step === 1 && (
            <div className="p-8 md:p-10">
              <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-1">Step 01 / 04</p>
              <h2 className="text-2xl font-bold mb-1">Your Organization</h2>
              <p className="text-white/40 text-sm mb-8">Tell us who you are. We'll route your account to the right compliance profile.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Corporate Email</label>
                  <input
                    type="email"
                    id="onboard-email"
                    value={state.email}
                    onChange={(e) => set({ email: e.target.value })}
                    placeholder="cto@yourcompany.com"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 font-mono text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Company Name <span className="text-white/20">(optional)</span></label>
                  <input
                    type="text"
                    id="onboard-company"
                    value={state.companyName}
                    onChange={(e) => set({ companyName: e.target.value })}
                    placeholder="Acme Financial Corp"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Industry Vertical</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        id={`industry-${ind.id}`}
                        onClick={() => set({ industry: ind.id })}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                          state.industry === ind.id
                            ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                            : "bg-white/3 border-white/8 text-white/60 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <span className="text-lg">{ind.icon}</span>
                        <span className="font-medium">{ind.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.industry && <p className="text-red-400 text-xs mt-1.5">{errors.industry}</p>}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  id="onboard-step1-next"
                  onClick={() => { if (validateStep1()) setStep(2); }}
                  className="px-8 py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors tracking-wide"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Risk Scan ─────────────────────────────── */}
          {step === 2 && (
            <div className="p-8 md:p-10">
              <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-1">Step 02 / 04</p>
              <h2 className="text-2xl font-bold mb-1">Live AI Key Risk Scan</h2>
              <p className="text-white/40 text-sm mb-8">Paste your AI provider key. We'll run the V86 scanner and show you what StreetMP OS catches — before you even pay.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AI_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        id={`provider-${p.id}`}
                        onClick={() => set({ aiProvider: p.id, aiKey: "", riskResult: null })}
                        className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          state.aiProvider === p.id
                            ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                            : "bg-white/3 border-white/8 text-white/50 hover:border-white/20"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {state.aiProvider && (
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">API Key</label>
                    <input
                      type="password"
                      id="onboard-ai-key"
                      value={state.aiKey}
                      onChange={(e) => set({ aiKey: e.target.value, riskResult: null })}
                      placeholder={AI_PROVIDERS.find((p) => p.id === state.aiProvider)?.placeholder}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 font-mono text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                    />
                    {errors.aiKey && <p className="text-red-400 text-xs mt-1.5">{errors.aiKey}</p>}
                  </div>
                )}

                {/* Risk Scan Button */}
                <button
                  id="onboard-risk-scan"
                  onClick={handleRiskScan}
                  disabled={!state.aiKey.trim() || state.riskLoading}
                  className="w-full py-3 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 font-bold text-sm rounded-xl hover:bg-emerald-950/80 hover:border-emerald-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {state.riskLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                      Running V86 Risk Scan...
                    </span>
                  ) : "⚡ Run Live Risk Scan"}
                </button>

                {/* Risk Results */}
                {state.riskResult && (
                  <div className={`rounded-xl border p-5 transition-all ${
                    state.riskResult.riskLevel === "LOW"
                      ? "bg-emerald-950/20 border-emerald-500/30"
                      : state.riskResult.riskLevel === "MEDIUM"
                      ? "bg-yellow-950/20 border-yellow-500/30"
                      : "bg-red-950/20 border-red-500/30"
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold tracking-widest uppercase text-white/40">V86 Risk Assessment</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        state.riskResult.riskLevel === "LOW"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : state.riskResult.riskLevel === "MEDIUM"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {state.riskResult.riskLevel} RISK
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {state.riskResult.passes.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-emerald-400 font-mono">
                          <span className="mt-0.5 shrink-0">✓</span> {p}
                        </div>
                      ))}
                      {state.riskResult.risks.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-400 font-mono">
                          <span className="mt-0.5 shrink-0">⚠</span> {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 text-white/40 hover:text-white text-sm transition-colors">← Back</button>
                <button
                  id="onboard-step2-next"
                  onClick={() => setStep(3)}
                  disabled={!state.riskResult}
                  className="px-8 py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Plan Selection ────────────────────────── */}
          {step === 3 && (
            <div className="p-8 md:p-10">
              <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-1">Step 03 / 04</p>
              <h2 className="text-2xl font-bold mb-1">Choose Your Tier</h2>
              <p className="text-white/40 text-sm mb-8">All plans include SOC 2 compliant infrastructure, V35 Immutable Audit Vault, and zero-downtime deployment.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    id={`plan-${plan.id}`}
                    onClick={() => set({ plan: plan.id })}
                    className={`relative text-left rounded-2xl border p-6 transition-all ${
                      state.plan === plan.id
                        ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                        : "border-white/8 hover:border-white/20"
                    }`}
                    style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.6), rgba(15,15,15,0.9))` }}
                  >
                    {plan.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-black px-3 py-0.5 rounded-full tracking-widest uppercase">
                        {plan.badge}
                      </span>
                    )}
                    {state.plan === plan.id && (
                      <span className="absolute top-4 right-4 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-black text-xs font-bold">✓</span>
                    )}
                    <div className="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">{plan.name}</div>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-black text-white">{plan.price}</span>
                      {plan.period && <span className="text-white/30 text-sm">{plan.period}</span>}
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="text-xs text-white/50 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5 shrink-0">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep(2)} className="px-5 py-2.5 text-white/40 hover:text-white text-sm transition-colors">← Back</button>
                <button
                  id="onboard-step3-next"
                  onClick={() => setStep(4)}
                  disabled={!state.plan}
                  className="px-8 py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors tracking-wide disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Payment ───────────────────────────────── */}
          {step === 4 && (
            <div className="p-8 md:p-10">
              <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-1">Step 04 / 04</p>
              <h2 className="text-2xl font-bold mb-1">Confirm & Activate</h2>
              <p className="text-white/40 text-sm mb-8">
                {state.plan === "enterprise"
                  ? "We'll connect you with our solutions team to design a custom enterprise package."
                  : "You'll be redirected to Stripe's secure checkout. The moment payment clears, your account is live."}
              </p>

              {/* Summary Card */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-6 mb-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Email</span>
                  <span className="text-white font-mono">{state.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Industry</span>
                  <span className="text-white capitalize">{INDUSTRIES.find((i) => i.id === state.industry)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">AI Provider</span>
                  <span className="text-emerald-400 font-mono">{state.aiProvider?.toUpperCase()} ✓ Scanned</span>
                </div>
                <div className="border-t border-white/8 pt-3 flex justify-between">
                  <span className="text-white/40 text-sm">Plan</span>
                  <div className="text-right">
                    <div className="text-white font-bold capitalize">{state.plan} Tier</div>
                    <div className="text-emerald-400 text-sm">
                      {PLANS.find((p) => p.id === state.plan)?.price}
                      {PLANS.find((p) => p.id === state.plan)?.period}
                    </div>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div className="bg-emerald-950/15 border border-emerald-500/10 rounded-xl p-5 mb-6">
                <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-3">What Happens Next</p>
                <div className="space-y-2">
                  {[
                    "Stripe processes your payment (<2s)",
                    "V18 API Key Service provisions your StreetMP key",
                    "Welcome email dispatched with your key + integration code",
                    "You're executing governed AI requests in under 3 minutes",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-white/50">
                      <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-700/40 text-emerald-500 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {i + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(3)} className="px-5 py-2.5 text-white/40 hover:text-white text-sm transition-colors">← Back</button>
                <button
                  id="onboard-checkout-cta"
                  onClick={handleCheckout}
                  disabled={state.checkoutLoading}
                  className="flex-1 ml-4 py-4 font-black text-sm rounded-xl tracking-widest uppercase transition-all disabled:opacity-50 relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #00E599, #00B377)", color: "#000" }}
                >
                  {state.checkoutLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      {state.plan === "enterprise" ? "Connecting..." : "Redirecting to Stripe..."}
                    </span>
                  ) : state.plan === "enterprise" ? (
                    "Contact Sales →"
                  ) : (
                    "Activate Account via Stripe →"
                  )}
                </button>
              </div>

              <p className="text-center text-white/20 text-xs mt-4">
                🔒 Secured by Stripe · PCI DSS Level 1 · 256-bit SSL
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/15 text-xs mt-8 font-mono">
          StreetMP OS • Sovereign AI Infrastructure • Zero human intervention required
        </p>
      </div>
    </div>
  );
}
