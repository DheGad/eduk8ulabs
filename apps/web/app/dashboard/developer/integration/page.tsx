"use client";

import { useState } from "react";

type Tab = "openai-sdk" | "native-sdk" | "curl";

const SNIPPETS: Record<Tab, { label: string; lang: string; code: string }> = {
  "openai-sdk": {
    label: "OpenAI SDK Override",
    lang: "typescript",
    code: `// ✅ Swap ONE LINE — no other changes needed
import OpenAI from "openai";

const openai = new OpenAI({
  // Before: apiKey: process.env.OPENAI_API_KEY
  baseURL: "https://api.streetmp.com/v1",
  apiKey:  process.env.STREETMP_API_KEY,   // Your smp_... key
});

const response = await openai.chat.completions.create({
  model:    "streetmp-auto",              // Auto-routes to optimal model
  messages: [{ role: "user", content: "Summarise this document." }],
});

// All StreetMP OS layers are now active:
// ✓ V12 Policy-as-Code    ✓ V25 Trust Score
// ✓ V17 Cognitive Guard   ✓ V36 ZK Certificate
// ✓ V32 ZK Learning       ✓ V37 Zero-Impact Armor

// Trust headers returned on every response:
const trustScore = response.headers?.get("x-streetmp-trust-score");
const execId     = response.headers?.get("x-streetmp-execution-id");`,
  },
  "native-sdk": {
    label: "StreetMP Native SDK",
    lang: "typescript",
    code: `import { StreetMP } from "streetmp";

const client = new StreetMP(process.env.STREETMP_API_KEY!, {
  baseUrl:        "https://api.streetmp.com",
  defaultModel:   "streetmp-auto",
  certSigningKey: process.env.STREETMP_SIGNING_KEY,  // For local ZK verification
});

// Run a secure, policy-enforced execution
const result = await client.secureRun({
  prompt:         "What is the patient's diagnosis?",
  classification: "CONFIDENTIAL",
});

console.log(result.output);               // AI response
console.log(result.trustScore);           // e.g. 98
console.log(result.trustBand);            // e.g. "PLATINUM"
console.log(result.certificate);          // V36 ZK certificate
// {
//   execution_id:   "exec_a1b2c3...",
//   fingerprint:    "3FA9B0C12D4E",
//   trust_band:     "PLATINUM",
//   verify_url:     "/verify/exec_a1b2c3...",
//   client_verified: true
// }

// Verify a certificate at any time
await fetch(\`https://api.streetmp.com/verify/\${result.certificate?.execution_id}\`);`,
  },
  "curl": {
    label: "cURL / REST",
    lang: "bash",
    code: `# Drop-in proxy — identical to the OpenAI REST API
curl https://api.streetmp.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $STREETMP_API_KEY" \\
  -H "x-data-classification: CONFIDENTIAL" \\
  -d '{
    "model": "streetmp-auto",
    "messages": [{"role": "user", "content": "Hello world"}]
  }'

# Response headers include:
#   x-streetmp-trust-score: 98
#   x-streetmp-trust-band: PLATINUM
#   x-streetmp-execution-id: exec_a1b2c3...
#   x-streetmp-signature: <HMAC-SHA256 ZK certificate>

# Verify any certificate publicly (no auth required):
curl https://api.streetmp.com/verify/exec_a1b2c3...`,
  },
};

export default function IntegrationPage() {
  const [tab, setTab]         = useState<Tab>("openai-sdk");
  const [copied, setCopied]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(SNIPPETS[tab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setPingResult(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/v1/health", { signal: AbortSignal.timeout(5000) });
      setPingResult({
        ok:        res.ok,
        latencyMs: Date.now() - start,
        message:   res.ok ? "StreetMP Proxy Active" : `Proxy returned ${res.status}`,
      });
    } catch {
      setPingResult({ ok: false, latencyMs: Date.now() - start, message: "Connection failed — is the kernel running?" });
    } finally {
      setTesting(false);
    }
  };

  const snippet = SNIPPETS[tab];

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-8 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Drop-In Integration Center</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Integrate StreetMP OS into any existing AI application in under 60 seconds. No architectural changes required.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold uppercase tracking-wider hover:border-blue-500/50 hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {testing
              ? <><span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-white animate-spin" /> Testing...</>
              : "🔌 Test Connection"}
          </button>
        </div>
      </div>

      {/* Ping Result */}
      {pingResult && (
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between animate-in fade-in
          ${pingResult.ok
            ? "bg-emerald-950/30 border-emerald-500/30"
            : "bg-red-950/30 border-red-500/30"}`}
        >
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${pingResult.ok ? "bg-emerald-400" : "bg-red-400"}`} />
            <p className={`text-sm font-bold ${pingResult.ok ? "text-emerald-300" : "text-red-300"}`}>{pingResult.message}</p>
          </div>
          <div className="text-xs text-slate-500 font-mono">{pingResult.latencyMs}ms</div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: "⚡", label: "Integration Time",  val: "< 60 seconds",    color: "text-amber-400" },
          { icon: "🔒", label: "Lines Changed",     val: "1 line",          color: "text-emerald-400" },
          { icon: "🛡️", label: "Security Layers",   val: "V12 → V37 Active",color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <span className="text-2xl">{s.icon}</span>
            <p className={`text-2xl font-black mt-3 mb-1 ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Code Snippet Generator */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b border-slate-800">
          {(["openai-sdk", "native-sdk", "curl"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all
                ${tab === t
                  ? "text-blue-300 border-b-2 border-blue-500 bg-blue-500/5"
                  : "text-slate-500 hover:text-slate-300"}`}
            >
              {SNIPPETS[t].label}
            </button>
          ))}
          <div className="ml-auto flex items-center px-4">
            <button
              onClick={handleCopy}
              className="text-xs text-slate-500 hover:text-white transition-colors border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Code */}
        <pre className="p-6 text-[12px] font-mono leading-relaxed overflow-x-auto text-slate-300 bg-transparent">
          <code>{snippet.code}</code>
        </pre>
      </div>

      {/* Native SDK docs card */}
      {tab === "native-sdk" && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-6 space-y-4 animate-in fade-in">
          <h3 className="text-sm font-bold text-blue-200">streetmp-node SDK Reference</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {[
              { method: "new StreetMP(apiKey, config)", desc: "Initialise the client" },
              { method: "client.secureRun({ prompt })", desc: "Execute with full OS pipeline" },
              { method: "client.ping()",               desc: "Health-check the proxy" },
              { method: "result.trustScore",            desc: "V25 Trust Score (0–100)" },
              { method: "result.certificate",           desc: "V36 ZK Certificate object" },
              { method: "result.certificate.verify_url",desc: "Public verification URL" },
            ].map(r => (
              <div key={r.method} className="border-b border-blue-500/10 pb-3">
                <p className="font-mono text-blue-300 mb-0.5 text-[11px]">{r.method}</p>
                <p className="text-slate-500">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
