/**
 * @file app/(public)/sdk/page.tsx
 * @description Command 088 — SDK Developer Portal
 *
 * Route:  /sdk
 * Access: Fully public — static server component, no auth.
 *
 * Design: High-signal developer portal. Dense with code, light on fluff.
 * The value proposition is visible in a single scroll.
 */

import Link from "next/link";

// ─── Code Examples ─────────────────────────────────────────────────────────────

const INSTALL_CMD = `npm install @streetmp/sdk`;

const BEFORE_CODE = `// ❌ BEFORE — Raw OpenAI (unprotected)
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const res = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "user", content: userInput } // ← raw PII, no audit trail,
                                         //   no compliance, no cert
  ],
});

console.log(res.choices[0].message.content);
// No trust score. No execution ID. No STP certificate.
// No proof this was governed. Just vibes.`;

const AFTER_CODE = `// ✅ AFTER — StreetMP OS SDK (governed, certified, auditable)
import { StreetMPClient } from "@streetmp/sdk";

const client = new StreetMPClient({
  apiKey:    process.env.STREETMP_API_KEY,  // smp_live_...
  tenantId:  "acme-corp",
  partnerId: "fintech-partner-sg",          // optional white-label
});

const res = await client.chat.completions.create({
  model:    "gpt-4o",
  messages: [{ role: "user", content: userInput }],
  //         ↑ local PII pre-scan runs HERE before any network I/O
  //           StreetMPPiiError thrown if NRIC/CC/SSN detected
});

console.log(res.choices[0].message.content);
console.log(res.streetmp?.trust_score);   // 87.3
console.log(res.streetmp?.trust_band);    // "GOLD"
console.log(res.streetmp?.execution_id);  // "exec_a3f8c2d1e94b..."
console.log(res.streetmp?.pii_redacted);  // 2 fields masked
// Every call issues a tamper-evident STP/1.0 certificate.
// Verify at: os.streetmp.com/verify/exec_a3f8c2d1e94b...`;

const VERIFY_CODE = `// STP Certificate verification — no account needed
const cert = await client.stp.verify("exec_a3f8c2d1e94b7056fe3a");

console.log(cert.verified);                    // true
console.log(cert.status);                      // "SECURE"
console.log(cert.certificate?.trust_band);     // "GOLD"
console.log(cert.certificate?.compliance_flags);
// ["MAS_TRM_9.2_AI_GOVERNANCE", "V74_CONSENSUS_REQUIRED"]
console.log(cert.attestation?.verified_by);
// "StreetMP Trust Protocol Kernel v1.0"`;

const PARTNER_CODE = `// White-label partner SDK integration
import { StreetMPClient, StreetMPPiiError } from "@streetmp/sdk";

const client = new StreetMPClient({
  apiKey:    "smp_live_partner_key",
  tenantId:  "end-customer-tenant-id",
  partnerId: "your-partner-id",         // registers your brand
  userId:    currentUser.id,            // optional per-user correlation
});

try {
  const res = await client.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
  });
  // Response headers contain:
  // x-streetmp-partner-id:   your-partner-id
  // x-streetmp-partner-name: Your Company Name
  // x-streetmp-partner-accent: #10b981
  // Public /verify page shows: "Verified by Your Company via STP"
} catch (e) {
  if (e instanceof StreetMPPiiError) {
    console.log("Blocked locally:", e.detectedPatterns);
    // ["CREDIT_CARD", "NRIC_FIN"]
    // The request never left your application layer.
  }
}`;

const SDK_CONFIG_CODE = `interface StreetMPClientOptions {
  apiKey:        string;   // smp_live_...  — from os.streetmp.com/dashboard
  tenantId:      string;   // your org identifier
  partnerId?:    string;   // ISV white-label ID
  userId?:       string;   // end-user correlation (never stored with prompts)
  baseUrl?:      string;   // default: https://api.streetmp.com/v1/proxy
  timeoutMs?:    number;   // default: 30_000
  localPiiCheck?: boolean; // default: true — throws StreetMPPiiError on detect
}`;

// ─── Feature Cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🔌",
    title: "Drop-in OpenAI compatible",
    body:  "Same message format as openai.chat.completions.create(). Replace the import, add your API key, done.",
  },
  {
    icon: "🛡️",
    title: "Local PII pre-flight",
    body:  "Scans for CC, SSN, NRIC/FIN, MyKad, IBAN, email before any network I/O. StreetMPPiiError lets you fix your data pipeline.",
  },
  {
    icon: "📜",
    title: "STP Certificate on every call",
    body:  "Every completion returns res.streetmp.execution_id — a Merkle-anchored STP/1.0 certificate verifiable by any auditor.",
  },
  {
    icon: "🏷️",
    title: "White-label branding",
    body:  "Set partnerId to put your company name on public verification pages: 'Verified by [You] via StreetMP Trust Protocol.'",
  },
  {
    icon: "⚖️",
    title: "One-click APAC compliance",
    body:  "MAS TRM · BNM RMiT · PDPA-SG · GDPR enforced at kernel level. No configuration required beyond tenant ID.",
  },
  {
    icon: "📦",
    title: "Zero dependencies",
    body:  "Uses native fetch (Node ≥18). No node_modules bloat. Ships as ESM. 8kB minified.",
  },
];

// ─── Comparison table ─────────────────────────────────────────────────────────

const COMPARE_ROWS = [
  { feature: "Setup time",               direct: "0 min (Cloud SaaS)",                sdk: "2 min (npm install)" },
  { feature: "PII protection",           direct: "Auto (V67 kernel)",                  sdk: "Local + kernel (2 layers)" },
  { feature: "STP certificate",          direct: "✓ on every call",                   sdk: "✓ on every call" },
  { feature: "White-label branding",     direct: "—",                                  sdk: "✓ via partnerId" },
  { feature: "Per-user audit trail",     direct: "Via x-streetmp-user-id header",     sdk: "Via userId option" },
  { feature: "Local PII pre-flight",     direct: "—",                                  sdk: "✓ StreetMPPiiError" },
  { feature: "APAC compliance",          direct: "✓ via tenant config",               sdk: "✓ inherited from tenant" },
  { feature: "Runtime dependencies",     direct: "None (pure HTTP)",                   sdk: "None (native fetch)" },
  { feature: "TypeScript types",         direct: "Auto from response shape",           sdk: "First-class (full DTS)" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "typescript", title }: { code: string; lang?: string; title?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.05] bg-white/[0.02]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          {title ?? lang}
        </span>
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

function InstallChip() {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-zinc-950 px-5 py-3">
      <span className="text-zinc-600 text-sm font-mono">$</span>
      <code className="text-emerald-400 font-mono font-bold text-sm">{INSTALL_CMD}</code>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SdkPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/sdk"      className="text-white font-semibold">SDK</Link>
            <Link href="/stp"      className="hover:text-white transition-colors">STP Protocol</Link>
            <Link href="/verify"   className="hover:text-white transition-colors">Verify</Link>
            <Link href="/scan"     className="text-rose-400 hover:text-rose-300 font-semibold">Risk Scanner</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">
              Get API Key
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808009_1px,transparent_1px),linear-gradient(to_bottom,#80808009_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute -left-[200px] top-0 h-[600px] w-[600px] rounded-full bg-emerald-500/[0.04] blur-[160px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center flex flex-col items-center gap-8">
          {/* Badge */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-1.5 text-xs font-bold text-emerald-300 uppercase tracking-widest">
              @streetmp/sdk
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-mono text-zinc-500">
              v1.0.0 · ESM · 0 deps · Node ≥18
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter leading-[1.02] text-white">
            Build Governance into
            <br />
            <span className="text-emerald-400">Your App in 60 Seconds.</span>
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed">
            One npm install. Drop-in compatible with the OpenAI SDK.
            Every AI call automatically issues a cryptographic STP certificate,
            enforces PII protection, and logs to the Merkle audit trail.
          </p>

          <InstallChip />

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="rounded-2xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-black hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              Get API Key →
            </Link>
            <Link
              href="/stp"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-3.5 text-base font-bold text-white hover:bg-white/[0.07] transition-all"
            >
              Read STP Spec
            </Link>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap justify-center gap-6 text-xs text-zinc-600 mt-2">
            {["MAS TRM", "BNM RMiT", "GDPR Art.25", "HIPAA-ready", "SOC 2 aligned"].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before vs After ─────────────────────────────────────── */}
      <section className="px-6 py-20 bg-black/40 border-y border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white">One import. Full governance.</h2>
            <p className="text-zinc-500 mt-3">The only line that changes is the import.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Before */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-400">Before — Unprotected</span>
              </div>
              <CodeBlock code={BEFORE_CODE} lang="typescript" title="before.ts" />
              <div className="flex flex-wrap gap-2">
                {["No PII protection", "No audit trail", "No compliance", "No certificate", "No trust score"].map((t) => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded border border-red-500/20 bg-red-500/[0.06] text-red-400 font-mono">✗ {t}</span>
                ))}
              </div>
            </div>

            {/* After */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">After — StreetMP SDK</span>
              </div>
              <CodeBlock code={AFTER_CODE} lang="typescript" title="after.ts" />
              <div className="flex flex-wrap gap-2">
                {["Local PII scan", "V13 Merkle audit", "STP certificate", "Trust score", "APAC compliant"].map((t) => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 font-mono">✓ {t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white">Everything. Zero compromise.</h2>
            <p className="text-zinc-500 mt-3">All of StreetMP OS, packaged into a single import.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all group">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STP Verification ────────────────────────────────────── */}
      <section className="px-6 py-16 border-y border-white/[0.04] bg-black/30">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Built-in STP Certificate Verification</h2>
            <p className="text-zinc-500">Every completion returns an execution_id. Verify it any time.</p>
          </div>
          <CodeBlock code={VERIFY_CODE} lang="typescript" title="verify.ts" />
        </div>
      </section>

      {/* ── White-label / Partner SDK ────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded border border-violet-500/30 bg-violet-500/10 text-violet-400 uppercase tracking-widest">
                White-Label / ISV
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Partner SDK — Embed StreetMP in Your Product</h2>
            <p className="text-zinc-500 max-w-2xl">
              Set <code className="text-emerald-400 font-mono">partnerId</code> to white-label the entire trust protocol under your brand.
              Your customers see <em>"Verified by [Your Company] via StreetMP Trust Protocol"</em> on every certificate.
            </p>
          </div>
          <CodeBlock code={PARTNER_CODE} lang="typescript" title="partner-integration.ts" />
        </div>
      </section>

      {/* ── Config reference ─────────────────────────────────────── */}
      <section className="px-6 py-16 border-t border-white/[0.04] bg-black/30">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-6">Configuration Reference</h2>
          <CodeBlock code={SDK_CONFIG_CODE} lang="typescript" title="StreetMPClientOptions" />
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────── */}
      <section className="px-6 py-16 border-t border-white/[0.04]">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8">Direct Proxy vs SDK</h2>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-3 bg-white/[0.03] border-b border-white/[0.07] text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <div className="px-5 py-3">Feature</div>
              <div className="px-5 py-3 text-center">Direct Proxy</div>
              <div className="px-5 py-3 text-center text-emerald-500">@streetmp/sdk</div>
            </div>
            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 text-xs border-b border-white/[0.04] hover:bg-white/[0.01] transition-colors ${
                  i === COMPARE_ROWS.length - 1 ? "border-b-0" : ""
                }`}
              >
                <div className="px-5 py-4 text-zinc-400 font-medium">{row.feature}</div>
                <div className="px-5 py-4 text-center text-zinc-500 font-mono">{row.direct}</div>
                <div className="px-5 py-4 text-center text-emerald-400 font-mono font-semibold">{row.sdk}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-white/[0.04]">
        <div className="mx-auto max-w-3xl text-center flex flex-col items-center gap-8">
          <h2 className="text-4xl font-bold tracking-tight text-white">Ready to govern your AI?</h2>
          <p className="text-zinc-400 max-w-xl">
            Get your StreetMP API key, run the install command, and your first STP-certified call
            will be live in under 60 seconds.
          </p>
          <InstallChip />
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="rounded-2xl bg-emerald-500 px-10 py-4 text-base font-bold text-black hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
            >
              Get API Key — Free →
            </Link>
            <Link
              href="/stp"
              className="rounded-2xl border border-white/10 px-10 py-4 text-base font-bold text-white hover:bg-white/[0.06] transition-all"
            >
              Read STP Specification
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-6 w-full mt-4">
            {[
              { stat: "< 8kB", label: "Bundle size (min)" },
              { stat: "0",     label: "Runtime dependencies" },
              { stat: "100%",  label: "TypeScript coverage" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black text-emerald-400">{s.stat}</span>
                <span className="text-xs text-zinc-600 text-center">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500 font-medium">
          <span className="text-lg font-bold tracking-tighter text-white">StreetMP <span className="text-emerald-400">OS</span></span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <Link href="/sdk"          className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">SDK Docs</Link>
            <Link href="/stp"          className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Specification</Link>
            <Link href="/verify"       className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Verify Certificate</Link>
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/neutrality"   className="hover:text-white transition-colors">Vendor Neutrality</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Risk Scanner</Link>
            <Link href="/login"        className="hover:text-white transition-colors">Console Login</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
