"use client";

/**
 * @file app/(public)/docs/page.tsx
 * @description Developer Documentation — Phase 5
 *   Route: /docs
 *   Public — no auth required
 *
 * High-end docs page in the Obsidian/Emerald theme:
 *   - Getting Started
 *   - Authentication
 *   - Node.js fetch example (V26 Proxy / POST /api/v1/execute)
 *   - Python requests example
 *   - Response schema
 *   - Error codes
 *   All code blocks have Copy-to-Clipboard buttons.
 */

import React, { useState } from "react";
import Link from "next/link";

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ code, id }: { code: string; id: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
      setTimeout(() => setState("idle"), 2200);
    } catch {
      /* clipboard API unavailable — silently fail */
    }
  };

  return (
    <button
      id={id}
      onClick={handleCopy}
      aria-label="Copy code to clipboard"
      className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
        state === "copied"
          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
          : "bg-white/[0.05] border border-white/10 text-white/40 hover:text-white/80 hover:border-white/20"
      }`}
    >
      {state === "copied" ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({
  code,
  language,
  id,
}: {
  code: string;
  language: string;
  id: string;
}) {
  return (
    <div className="relative rounded-xl border border-white/[0.08] bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">{language}</span>
      </div>
      <div className="relative">
        <CopyButton code={code} id={`copy-${id}`} />
        <pre className="overflow-x-auto p-5 text-[13px] font-mono leading-relaxed text-white/80">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  id,
  badge,
  title,
  desc,
}: {
  id: string;
  badge: string;
  title: string;
  desc: string;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 tracking-widest uppercase">
          {badge}
        </span>
      </div>
      <h2 className="text-2xl font-bold text-white tracking-tight mb-2">{title}</h2>
      <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
      <div className="mt-5 h-px bg-white/[0.06]" />
    </div>
  );
}

// ─── Code Samples ─────────────────────────────────────────────────────────────

const NODE_EXAMPLE = `const response = await fetch('https://os.streetmp.com/api/v1/execute', {
  method: 'POST',
  headers: {
    'Content-Type':  'application/json',
    'Authorization': 'Bearer YOUR_API_KEY',
    'X-Tenant-ID':   'your-tenant-id',
  },
  body: JSON.stringify({
    prompt:   'Summarise the following contract clause: ...',
    provider: 'openai',
    model:    'gpt-4o',
    options: {
      temperature: 0.3,
      max_tokens:  1024,
    },
  }),
});

const data = await response.json();

console.log(data.response.completion);   // AI output (PII-scrubbed)
console.log(data.trust_score);           // V25 Trust Score (0–100)
console.log(data.certificate.trace_id); // V70 Trace ID for audit`;

const PYTHON_EXAMPLE = `import requests

API_URL   = "https://os.streetmp.com/api/v1/execute"
API_KEY   = "YOUR_API_KEY"
TENANT_ID = "your-tenant-id"

payload = {
    "prompt":   "Summarise the following contract clause: ...",
    "provider": "openai",
    "model":    "gpt-4o",
    "options": {
        "temperature": 0.3,
        "max_tokens":  1024,
    },
}

headers = {
    "Content-Type":  "application/json",
    "Authorization": f"Bearer {API_KEY}",
    "X-Tenant-ID":   TENANT_ID,
}

res = requests.post(API_URL, json=payload, headers=headers, timeout=30)
res.raise_for_status()

data = res.json()
print(data["response"]["completion"])    # AI output (PII-scrubbed)
print(data["trust_score"])               # V25 Trust Score (0–100)
print(data["certificate"]["trace_id"])  # V70 Trace ID for audit`;

const CURL_EXAMPLE = `curl -X POST https://os.streetmp.com/api/v1/execute \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-Tenant-ID: your-tenant-id" \\
  -d '{
    "prompt":   "What is the capital of Singapore?",
    "provider": "openai",
    "model":    "gpt-4o"
  }'`;

const RESPONSE_EXAMPLE = `{
  "success": true,
  "response": {
    "completion": "The capital of Singapore is Singapore City.",
    "model":      "gpt-4o",
    "provider":   "openai",
    "tokens":     { "prompt": 14, "completion": 9, "total": 23 }
  },
  "trust_score": 98,
  "certificate": {
    "trace_id":        "v70-8a3f-2e91-bc4d",
    "zk_signature":    "sha256-Hv3kP9...",
    "merkle_root":     "a4f2b8c1...",
    "timestamp":       "2026-04-01T01:47:33.421Z",
    "dlp_scan_result": "PASS",
    "nemo_guardrail":  "PASS",
    "frameworks":      ["PDPA_SG", "MAS_TRM"]
  }
}`;

const ERROR_EXAMPLE = `// HTTP 403 — Prompt blocked by V71 Firewall
{
  "success": false,
  "error": {
    "code":    "GUARDRAIL_BLOCKED",
    "message": "Prompt failed V71 safety evaluation (injection detected).",
    "trace_id": "v70-err-9b2a-..."
  }
}`;

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "#getting-started",   label: "Getting Started" },
  { href: "#authentication",    label: "Authentication" },
  { href: "#execute-endpoint",  label: "POST /execute" },
  { href: "#node-example",      label: "Node.js Example" },
  { href: "#python-example",    label: "Python Example" },
  { href: "#curl-example",      label: "cURL Example" },
  { href: "#response-schema",   label: "Response Schema" },
  { href: "#error-codes",       label: "Error Codes" },
  { href: "#apac-compliance",   label: "APAC Compliance" },
  { href: "#rate-limits",       label: "Rate Limits" },
];

const ERROR_CODES = [
  { code: "GUARDRAIL_BLOCKED",          status: 403, desc: "Prompt blocked by V71 Prompt Firewall (injection or jailbreak detected)." },
  { code: "DLP_POLICY_VIOLATION",       status: 403, desc: "Prompt contained raw PII that could not be safely tokenised before dispatch." },
  { code: "REGULATORY_SOVEREIGNTY_VIOLATION", status: 403, desc: "Requested inference region violates active APAC compliance framework." },
  { code: "QUOTA_EXCEEDED",             status: 429, desc: "Tenant token quota exhausted. Upgrade plan or wait for reset." },
  { code: "RATE_LIMIT_HIT",             status: 429, desc: "Too many requests. Default: 60 req/min per tenant." },
  { code: "INVALID_API_KEY",            status: 401, desc: "API key missing, expired, or revoked." },
  { code: "MODEL_UNAVAILABLE",          status: 503, desc: "Requested model is temporarily unavailable. Use streetmp-auto for fallback." },
  { code: "INTERNAL_ERROR",             status: 500, desc: "Unexpected internal error. Sentry-tracked. Include trace_id in support ticket." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#0A0A0A]/95 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <span className="text-emerald-400 font-black text-xs">S</span>
            </div>
            <span className="text-sm font-bold tracking-tight">
              StreetMP<span className="text-emerald-400">OS</span>
              <span className="ml-2 text-[10px] text-white/25 font-mono">Docs</span>
            </span>
          </Link>
          <div className="flex items-center gap-5 text-xs font-medium text-white/40">
            <Link href="/architecture"  className="hover:text-white transition-colors hidden md:block">Architecture</Link>
            <Link href="/stp"           className="hover:text-white transition-colors hidden md:block">STP Protocol</Link>
            <Link href="/legal"         className="hover:text-white transition-colors hidden md:block">Legal Shield</Link>
            <Link href="/login"         className="rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-3.5 py-1.5 text-emerald-400 hover:bg-emerald-500/25 transition-all font-semibold">
              Dashboard →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto flex pt-16">

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4 pl-6 border-r border-white/[0.05]">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-3">
              API Reference
            </p>
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-lg text-[13px] text-white/40 hover:text-white hover:bg-white/[0.04] transition-all"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.05] space-y-1">
            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-3">
              Resources
            </p>
            {[
              { href: "/legal",   label: "Legal Shield" },
              { href: "/verify",  label: "Verify Certificate" },
              { href: "/privacy", label: "Privacy Policy" },
            ].map((item) => (
              <a key={item.href} href={item.href} className="block px-3 py-2 rounded-lg text-[13px] text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-8 xl:px-12 py-10 space-y-16">

          {/* Hero */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono text-emerald-400 text-[10px] tracking-widest uppercase mb-5">
              V26 Gateway · REST API
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-3">
              Developer Documentation
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed max-w-2xl">
              The StreetMP OS API is an OpenAI-compatible REST interface with enterprise-grade
              compliance enforcement. Every request passes through the V71 Prompt Firewall,
              V67 DLP engine, and V25 Trust Scorer before reaching any model provider.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                API Status: Operational
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs text-white/60">
                Base URL: <code className="text-emerald-400 ml-1">https://os.streetmp.com</code>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs text-white/60">
                Version: <code className="text-white/80 ml-1">v1</code>
              </div>
            </div>
          </div>

          {/* ── Getting Started ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="getting-started"
              badge="01"
              title="Getting Started"
              desc="Get your first secure AI response in under 60 seconds."
            />
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Create an Account", desc: "Register at os.streetmp.com and verify your email address." },
                { step: "2", title: "Generate an API Key", desc: "Navigate to API Keys in the dashboard. Your key is shown once — copy it immediately." },
                { step: "3", title: "Make Your First Call", desc: "Use the code examples below. Your V35 compliance certificate is generated automatically." },
              ].map((s) => (
                <div key={s.step} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xs mb-4">
                    {s.step}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{s.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Authentication ───────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="authentication"
              badge="02"
              title="Authentication"
              desc="All API requests must include a Bearer token in the Authorization header."
            />
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-4 flex items-start gap-3">
              <span className="text-amber-400 shrink-0 text-lg">⚠</span>
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-0.5">API keys are shown once</p>
                <p className="text-xs text-amber-400/70 leading-relaxed">
                  StreetMP stores only the SHA-256 hash of your API key. If you lose it, generate a new one — there is no recovery mechanism.
                </p>
              </div>
            </div>
            <CodeBlock
              code={`Authorization: Bearer sk_live_your_api_key_here\nX-Tenant-ID: your-tenant-id`}
              language="HTTP Headers"
              id="auth-headers"
            />
          </div>

          {/* ── Execute endpoint ─────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="execute-endpoint"
              badge="03"
              title="POST /api/v1/execute"
              desc="The primary AI execution endpoint. Routes your prompt through the V71 Firewall, V67 DLP engine, and V25 Trust Scorer before forwarding to the provider."
            />
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Parameter", "Type", "Required", "Description"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ["prompt",   "string",  "✓",  "The user prompt. PII is tokenised before dispatch."],
                    ["provider", "string",  "✗",  "openai | anthropic | google | meta (default: openai)"],
                    ["model",    "string",  "✗",  "Model ID e.g. gpt-4o, claude-3-5-sonnet (default: gpt-4o)"],
                    ["options",  "object",  "✗",  "{ temperature, max_tokens, top_p } — provider-specific options"],
                    ["user_id",  "string",  "✗",  "Optional user identifier for per-user audit log attribution"],
                  ].map(([p, t, r, d]) => (
                    <tr key={p} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3"><code className="text-emerald-300 font-mono">{p}</code></td>
                      <td className="px-5 py-3 text-white/40 font-mono">{t}</td>
                      <td className="px-5 py-3 text-white/40">{r}</td>
                      <td className="px-5 py-3 text-white/50">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Node.js Example ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="node-example"
              badge="04"
              title="Node.js Example"
              desc="Using the native fetch API (Node.js ≥18). No SDK required."
            />
            <CodeBlock code={NODE_EXAMPLE} language="JavaScript / TypeScript" id="node-js" />
          </div>

          {/* ── Python Example ───────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="python-example"
              badge="05"
              title="Python Example"
              desc="Using the requests library (pip install requests)."
            />
            <CodeBlock code={PYTHON_EXAMPLE} language="Python 3.8+" id="python" />
          </div>

          {/* ── cURL Example ─────────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="curl-example"
              badge="06"
              title="cURL"
              desc="Quick test from terminal."
            />
            <CodeBlock code={CURL_EXAMPLE} language="Shell" id="curl" />
          </div>

          {/* ── Response Schema ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="response-schema"
              badge="07"
              title="Response Schema"
              desc="Every successful response includes the AI completion, a V25 Trust Score, and a V35 Compliance Certificate with Merkle root and V70 Trace ID."
            />
            <CodeBlock code={RESPONSE_EXAMPLE} language="JSON" id="response" />
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { field: "trust_score",        desc: "V25 Trust Score (0–100). Scores ≥95 indicate full compliance posture." },
                { field: "certificate.trace_id", desc: "V70 Trace ID. Use this in audit queries and support tickets." },
                { field: "certificate.merkle_root", desc: "SHA-256 Merkle root anchoring this execution to the V35 Audit Ledger." },
              ].map(({ field, desc }) => (
                <div key={field} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <code className="text-[11px] text-emerald-300 font-mono block mb-2">{field}</code>
                  <p className="text-[11px] text-white/40 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Error Codes ──────────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="error-codes"
              badge="08"
              title="Error Codes"
              desc="All errors follow a consistent shape: { success: false, error: { code, message, trace_id } }"
            />
            <CodeBlock code={ERROR_EXAMPLE} language="JSON — Error" id="error" />
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {["Error Code", "HTTP", "Description"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {ERROR_CODES.map(({ code, status, desc }) => (
                    <tr key={code} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3"><code className="text-red-300 font-mono text-[11px]">{code}</code></td>
                      <td className="px-5 py-3">
                        <span className={`font-mono font-bold ${status >= 500 ? "text-red-400" : status >= 400 ? "text-amber-400" : "text-emerald-400"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white/40">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── APAC Compliance ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="apac-compliance"
              badge="09"
              title="APAC Compliance Headers"
              desc="Request jurisdiction-specific DLP enforcement by setting the X-Compliance-Framework header."
            />
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { fw: "MAS_TRM",  region: "🇸🇬 Singapore", desc: "Enables NRIC/FIN tokenisation and routes to ap-southeast-1 (Singapore)." },
                { fw: "BNM_RMIT", region: "🇲🇾 Malaysia",  desc: "Enables MyKad tokenisation and routes to ap-southeast-3 (Malaysia/Jakarta)." },
                { fw: "PDPA_SG",  region: "🇸🇬 Singapore", desc: "Lightweight PDPA enforcement — NRIC/FIN masking, 3-year log retention." },
                { fw: "DPDP_IN",  region: "🇮🇳 India",     desc: "Aadhaar and PAN number masking, routes to ap-south-1 (Mumbai)." },
              ].map(({ fw, region, desc }) => (
                <div key={fw} className="rounded-xl border border-emerald-500/10 bg-emerald-950/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-[11px] font-mono text-emerald-300 font-bold">{fw}</code>
                    <span className="text-[10px] text-white/30">{region}</span>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">{desc}</p>
                  <code className="mt-3 block text-[10px] font-mono text-white/25">
                    X-Compliance-Framework: {fw}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* ── Rate Limits ──────────────────────────────────────────────────── */}
          <div className="space-y-5">
            <SectionHeader
              id="rate-limits"
              badge="10"
              title="Rate Limits"
              desc="Limits are enforced per tenant, per endpoint. Exceeding limits returns 429 RATE_LIMIT_HIT."
            />
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {["Plan", "Requests / min", "Tokens / month", "Concurrent"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ["Free",       "10", "100,000",    "2"],
                    ["Growth",     "60", "5,000,000",  "10"],
                    ["Enterprise", "∞",  "Unlimited",  "∞"],
                  ].map(([plan, rpm, tokens, conc]) => (
                    <tr key={plan} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-semibold text-white/70">{plan}</td>
                      <td className="px-5 py-3 text-emerald-400 font-mono">{rpm}</td>
                      <td className="px-5 py-3 text-white/50 font-mono">{tokens}</td>
                      <td className="px-5 py-3 text-white/50 font-mono">{conc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/30 to-transparent p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1.5">Ready to build?</h3>
              <p className="text-sm text-zinc-400">Create your account, generate an API key, and make your first compliant AI call in under 60 seconds.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/register" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-all">
                Get Started →
              </Link>
              <Link href="/verify" className="px-5 py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-semibold hover:text-white hover:border-white/20 transition-all">
                Verify Certificate
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/20">
            <span>© {new Date().getFullYear()} StreetMP Sdn. Bhd. — Bangsar, Kuala Lumpur</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
              <Link href="/terms"   className="hover:text-white/50 transition-colors">Terms</Link>
              <Link href="/legal"   className="hover:text-white/50 transition-colors">Legal Shield</Link>
              <a href="mailto:support@streetmp.com" className="hover:text-white/50 transition-colors">support@streetmp.com</a>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
