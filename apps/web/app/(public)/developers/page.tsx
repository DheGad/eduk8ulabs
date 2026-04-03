import Link from "next/link";

/**
 * @file app/(public)/developers/page.tsx
 * @description Command 088 — Developer & ISV Onboarding Landing Page
 *
 * Route:  /developers
 * Access: Fully public — static server component, no auth.
 *
 * Target: founders, ISVs, and platform engineers who want to embed
 * enterprise AI compliance into their own products via @streetmp/sdk.
 * Design goal: highest-converting page in the funnel.
 */

// ─── Static data ──────────────────────────────────────────────────────────────

const THREE_LINES = `import { StreetMPClient } from "@streetmp/sdk";

const client = new StreetMPClient({ apiKey: process.env.STREETMP_API_KEY, tenantId: "your-app" });
const res    = await client.chat.completions.create({ model: "gpt-4o", messages });

// res.streetmp.trust_score   → 87.3
// res.streetmp.execution_id  → "exec_a3f8c2d1e94b…"
// STP/1.0 certificate issued. Auditable forever.`;

const REVENUE_MODEL = `// Your product charges $0.015/1k tokens
// StreetMP OS charges $0.008/1k tokens
// Compliance margin:  $0.007/1k tokens — recurring, at scale

// Example: 10M tokens/month → $70,000/month compliance revenue
// No lawyers. No auditors. No manual work.`;

const STATS = [
  { value: "3",     unit: "lines",   label: "to full integration" },
  { value: "< 8",   unit: "kB",      label: "SDK bundle size" },
  { value: "0",     unit: "deps",    label: "runtime dependencies" },
  { value: "100%",  unit: "typed",   label: "TypeScript coverage" },
];

const PARTNER_PERKS = [
  {
    icon: "🏷️",
    title: "White-label certificates",
    body: 'Public /verify pages show "Verified by [Your Brand] via StreetMP Trust Protocol" — your brand, our infrastructure.',
  },
  {
    icon: "💳",
    title: "Revenue share per execution",
    body: "Every API call your customers make through your SDK generates a compliance margin you capture. Fully automated billing.",
  },
  {
    icon: "📊",
    title: "Partner analytics dashboard",
    body: "See token usage, revenue, trust score distribution, and PII interception rates across all your sub-tenants in real time.",
  },
  {
    icon: "⚖️",
    title: "APAC compliance pre-wired",
    body: "MAS TRM · BNM RMiT · PDPA-SG · GDPR enforced at the kernel level. Sell into Singapore & Malaysia on day one.",
  },
  {
    icon: "🔐",
    title: "Custom policy presets",
    body: "Define which V12 zero-trust rules apply to your end-users. Lock down models, regions, or PII categories by plan tier.",
  },
  {
    icon: "🌐",
    title: "Endpoint aliasing",
    body: "Point api.yourstartup.com → api.streetmp.com via CNAME. Your customers never see StreetMP unless you want them to.",
  },
];

const TIERS = [
  {
    name: "Startup",
    price: "Free",
    sub: "up to 1M tokens/mo",
    highlight: false,
    items: [
      "Full @streetmp/sdk access",
      "STP certificates on every call",
      "V67 DLP + V71 Firewall",
      "1 white-label partner ID",
      "Community support",
    ],
  },
  {
    name: "Growth",
    price: "$299",
    sub: "per month + usage",
    highlight: true,
    items: [
      "Everything in Startup",
      "Custom policy presets (V12)",
      "Endpoint aliasing (CNAME)",
      "Partner analytics dashboard",
      "Revenue-share billing",
      "Priority support (SLA 4h)",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    sub: "contact sales",
    highlight: false,
    items: [
      "Everything in Growth",
      "On-prem SDK deployment",
      "APAC regulatory packs (V85)",
      "Dedicated partner success manager",
      "Custom STP certificate branding",
      "SOC 2 Type II reports on request",
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CodeBlock({ code, title, lang = "typescript" }: { code: string; title?: string; lang?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.05] bg-white/[0.02]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{title ?? lang}</span>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/50" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/50" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
        </div>
      </div>
      <pre className="p-5 text-[11px] sm:text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevelopersLandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden selection:bg-emerald-500/20">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/developers" className="text-white font-semibold">Developers</Link>
            <Link href="/sdk"        className="hover:text-white transition-colors">SDK Docs</Link>
            <Link href="/stp"        className="hover:text-white transition-colors">STP Protocol</Link>
            <Link href="/scan"       className="text-rose-400 hover:text-rose-300 font-semibold">Risk Scanner</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"    className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors px-3 py-2">Sign In</Link>
            <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">
              Start Building
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808009_1px,transparent_1px),linear-gradient(to_bottom,#80808009_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-emerald-500/[0.04] blur-[160px]" />
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-500/[0.03] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center flex flex-col items-center gap-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-2 text-xs font-bold text-emerald-300 uppercase tracking-widest">
              Command 088 — White-Label Ecosystem
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-mono text-zinc-500">
              @streetmp/sdk v1.0 · ESM · 0 deps
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[1.00] text-white">
            AI Compliance<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              as an SDK.
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-zinc-400 max-w-2xl leading-relaxed font-medium">
            Add enterprise-grade security and audit trails to your AI app in 3 lines of code.{" "}
            <span className="text-white font-semibold">Monetize compliance effortlessly.</span>
          </p>

          {/* 3-line code teaser */}
          <div className="w-full max-w-2xl text-left">
            <CodeBlock code={THREE_LINES} title="3 lines to full compliance" lang="typescript" />
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="rounded-2xl bg-emerald-500 px-10 py-4 text-base font-bold text-black hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
            >
              Get Your Partner ID →
            </Link>
            <Link
              href="/sdk"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-10 py-4 text-base font-bold text-white hover:bg-white/[0.07] transition-all"
            >
              Read SDK Docs
            </Link>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap justify-center gap-8 text-xs text-zinc-600">
            {["MAS TRM", "BNM RMiT", "GDPR Art.25", "SOC 2 aligned", "HIPAA-ready"].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.04] bg-black/40 px-6 py-10">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-emerald-400 tracking-tighter">{s.value}</span>
                <span className="text-sm font-bold text-zinc-500">{s.unit}</span>
              </div>
              <span className="text-xs text-zinc-600 font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── The Revenue Model ────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl flex flex-col lg:flex-row gap-16 items-center">
          <div className="flex-1 flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-3 py-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 uppercase tracking-widest">
                The Business Model
              </span>
            </div>
            <h2 className="text-4xl font-black tracking-tighter text-white leading-tight">
              Turn compliance<br />into a{" "}
              <span className="text-emerald-400">revenue stream.</span>
            </h2>
            <div className="space-y-4 text-zinc-400 text-base leading-relaxed">
              <p>
                Every AI call your customers make through your product routes through StreetMP OS.
                You charge them a compliance premium — we handle the infrastructure, certificates,
                regulatory enforcement, and audit trail.
              </p>
              <p>
                The margin is{" "}
                <strong className="text-white">fully automated and recurring.</strong> No lawyers.
                No auditors. No manual compliance work. Just token throughput.
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
              <span className="text-2xl">💰</span>
              <p className="text-sm text-zinc-300">
                A fintech with 10M tokens/month usage generates{" "}
                <strong className="text-emerald-400">$70,000/month</strong> in compliance margin.
              </p>
            </div>
          </div>
          <div className="flex-1 w-full">
            <CodeBlock code={REVENUE_MODEL} title="compliance-margin.ts" lang="typescript" />
          </div>
        </div>
      </section>

      {/* ── Partner Perks ────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-[#060606] border-y border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tighter text-white mb-4">
              Everything you need to sell AI compliance.
            </h2>
            <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
              StreetMP OS handles the hard parts. You ship the product.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PARTNER_PERKS.map((perk) => (
              <div
                key={perk.title}
                className="rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-7 hover:border-emerald-500/20 hover:bg-white/[0.02] transition-all group"
              >
                <div className="text-3xl mb-5">{perk.icon}</div>
                <h3 className="text-base font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">
                  {perk.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{perk.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tighter text-white mb-4">Partner Pricing</h2>
            <p className="text-zinc-500 max-w-xl mx-auto">
              Start free. Scale when your customers do. No upfront contracts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-3xl border p-8 flex flex-col gap-6 relative overflow-hidden ${
                  tier.highlight
                    ? "border-emerald-500/40 bg-emerald-500/[0.05] shadow-[0_0_60px_rgba(16,185,129,0.08)]"
                    : "border-white/[0.07] bg-zinc-950/60"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
                )}
                {tier.highlight && (
                  <div className="absolute top-4 right-4">
                    <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black text-black uppercase tracking-widest">
                      Most popular
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">{tier.name}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tighter">{tier.price}</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 font-mono">{tier.sub}</p>
                </div>

                <ul className="flex flex-col gap-3">
                  {tier.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-400">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.name === "Enterprise" ? "/register?plan=enterprise" : "/register"}
                  className={`mt-auto rounded-xl py-3 text-sm font-bold text-center transition-all ${
                    tier.highlight
                      ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      : "border border-white/10 text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {tier.name === "Enterprise" ? "Contact Sales" : "Get Started →"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-white/[0.04] relative overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-3xl text-center flex flex-col items-center gap-8">
          <h2 className="text-5xl font-black tracking-tighter text-white">
            Your first certified call<br />
            <span className="text-emerald-400">in 60 seconds.</span>
          </h2>
          <p className="text-xl text-zinc-400 max-w-xl">
            Join founders who are turning AI governance into a product feature — and a revenue line.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/register" className="rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              Get Partner ID →
            </Link>
            <Link href="/sdk" className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-5 text-lg font-bold text-white hover:bg-white/[0.06] transition-all">
              SDK Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#080808]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">StreetMP <span className="text-emerald-400">OS</span></span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/developers" className="text-white font-semibold">Developer Portal</Link>
            <Link href="/sdk"        className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">SDK Docs</Link>
            <Link href="/stp"        className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Open Standard</Link>
            <Link href="/verify"     className="hover:text-white transition-colors">Verify Certificate</Link>
            <Link href="/neutrality" className="hover:text-white transition-colors">Vendor Neutrality</Link>
            <Link href="/scan"       className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Risk Scanner</Link>
            <Link href="/login"      className="hover:text-white transition-colors">Console Login</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
