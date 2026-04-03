"use client";

import React, { useState, useEffect, useCallback } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/SkeletonLoader";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiKeyRecord {
  key_id: string;
  tenant_id: string;
  policy_id: string;
  label: string;
  created_at: string;
}

interface GeneratedKey extends ApiKeyRecord {
  plaintext: string;
}

const POLICIES = [
  { id: "FINANCIAL_GRADE",    label: "Financial Grade",    color: "text-amber-400",  badge: "bg-amber-500/10 border-amber-500/25 text-amber-300" },
  { id: "ACADEMIC_INTEGRITY", label: "Academic Integrity", color: "text-blue-400",   badge: "bg-blue-500/10 border-blue-500/25 text-blue-300" },
  { id: "SOVEREIGN_DEFENSE",  label: "Sovereign Defense",  color: "text-red-400",    badge: "bg-red-500/10 border-red-500/25 text-red-300" },
  { id: "GENERIC_BASELINE",   label: "Generic Baseline",   color: "text-slate-400",  badge: "bg-slate-700/50 border-slate-600/30 text-slate-300" },
];

const POLICY_MAP = Object.fromEntries(POLICIES.map((p) => [p.id, p]));
const ROUTER_URL = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

// ─── Sub-components ──────────────────────────────────────────────────────────

function PolicyBadge({ policy_id }: { policy_id: string }) {
  const p = POLICY_MAP[policy_id];
  if (!p) return <span className="text-xs text-slate-600 font-mono">{policy_id}</span>;
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${p.badge}`}>
      {p.label}
    </span>
  );
}

function PlaintextReveal({ plaintext, onDismiss }: { plaintext: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 text-lg">⚠️</div>
        <div>
          <p className="text-sm font-bold text-amber-300">Store this key now — it will not be shown again.</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            This plaintext key is shown exactly once and is never stored on our servers (only the SHA-256 hash is retained). Copy it immediately into a secrets manager.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 flex items-center gap-3">
        <code className="flex-1 text-xs font-mono text-emerald-300 break-all leading-relaxed select-all">
          {plaintext}
        </code>
        <button
          onClick={copy}
          aria-label="Copy key"
          className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-all"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={copy}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all"
        >
          {copied ? "✓ Copied to Clipboard" : "Copy Key to Clipboard"}
        </button>
        <button
          onClick={onDismiss}
          className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-all"
        >
          I&apos;ve saved it →
        </button>
      </div>
    </div>
  );
}

function GenerateKeyModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: (key: GeneratedKey) => void }) {
  const [tenantId, setTenantId] = useState("jpmc");
  const [policyId, setPolicyId] = useState("FINANCIAL_GRADE");
  const [label, setLabel]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!tenantId.trim()) { setError("Tenant ID is required."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ROUTER_URL}/api/v1/admin/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId.trim(), policy_id: policyId, label: label.trim() || undefined }),
      });
      const data = await res.json() as { success: boolean; data?: GeneratedKey; error?: { message: string } };
      if (!data.success || !data.data) { setError(data.error?.message ?? "Failed to generate key."); return; }
      onGenerated(data.data);
    } catch {
      setError("Cannot reach Router Service. Ensure it is running on port 4000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1117] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <p className="text-sm font-bold text-white">Generate API Key</p>
            <p className="text-xs text-slate-500 mt-0.5">Configure policy scope and tenant</p>
          </div>
          <button onClick={onClose} aria-label="Close modal" className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Tenant ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Tenant ID</label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="e.g. jpmc, stanford, pentagon"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
            />
          </div>

          {/* Policy */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">V12 Enforcement Policy</label>
            <div className="grid grid-cols-2 gap-2">
              {POLICIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPolicyId(p.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${policyId === p.id ? "border-blue-500/40 bg-blue-600/15" : "border-slate-700 bg-slate-800/30 hover:border-slate-600"}`}
                >
                  <p className={`text-xs font-bold ${p.color}`}>{p.label}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.id}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
              Label <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. JPMC Production v1"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-xs text-red-300">{error}</div>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            {loading ? "Generating…" : "⚡ Generate Key"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── V26 Integration Guide ───────────────────────────────────────────────────

const PROXY_BASE = "http://localhost:4000/api/proxy/openai";

const CODE_SNIPPETS = {
  node: `import OpenAI from "openai";

const openai = new OpenAI({
  // 1. Point to your StreetMP Sovereign Proxy
  baseURL: "${PROXY_BASE}",
  // 2. Use your StreetMP API key (not your OpenAI key)
  apiKey:  "smp_your_streetmp_api_key",
});

const response = await openai.chat.completions.create({
  model:    "streetmp-auto",  // V22 Smart Router picks the best model
  messages: [{ role: "user", content: "Analyze this contract for GDPR risks." }],
});

// V25 Trust Score is appended to every response
console.log(response.streetmp.trust_score);  // e.g. 97
console.log(response.streetmp.trust_band);   // "HIGH"
console.log(response.choices[0].message.content);`,

  python: `from openai import OpenAI

client = OpenAI(
    base_url="${PROXY_BASE}",
    api_key="smp_your_streetmp_api_key",
)

response = client.chat.completions.create(
    model="streetmp-auto",
    messages=[{"role": "user", "content": "Audit this HIPAA document."}],
)

# StreetMP extends the standard OpenAI response schema
print(response.model_extra["streetmp"]["trust_score"])   # 97
print(response.choices[0].message.content)`,

  curl: `curl -X POST ${PROXY_BASE}/v1/chat/completions \\
  -H "x-api-key: smp_your_streetmp_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "streetmp-auto",
    "messages": [{"role": "user", "content": "Review for compliance risks."}]
  }'

# Response headers include:
#   x-streetmp-trust-score: 97
#   x-streetmp-trust-band:  HIGH
#   x-streetmp-routing:     openai/gpt-4o-mini`,
};

type SnippetKey = keyof typeof CODE_SNIPPETS;

function IntegrationGuide() {
  const [activeTab, setActiveTab] = React.useState<SnippetKey>("node");
  const [copied, setCopied]       = React.useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(CODE_SNIPPETS[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const tabs: { key: SnippetKey; label: string; icon: string }[] = [
    { key: "node",   label: "Node.js",  icon: "⬡" },
    { key: "python", label: "Python",   icon: "🐍" },
    { key: "curl",   label: "cURL",     icon: "⚡" },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              V26 Drop-In Proxy
            </span>
            <span className="ml-2 text-[9px] font-mono px-2 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/8 text-emerald-400">
              NEW
            </span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 hidden sm:block">
          Zero code changes. Swap one line.
        </p>
      </div>

      {/* Explainer */}
      <div className="px-6 pt-4 pb-3">
        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
          Route your existing OpenAI SDK traffic through StreetMP with a single{" "}
          <code className="font-mono text-emerald-300 text-[11px]">baseURL</code> swap.
          Every request is automatically passed through the{" "}
          <span className="text-violet-300">V12 Policy Engine</span>,{" "}
          <span className="text-blue-300">V22 Smart Router</span>,{" "}
          <span className="text-amber-300">V17 Cognitive Governor</span>, and receives a{" "}
          <span className="text-emerald-300">V25 Trust Score</span> — no refactoring required.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-6 pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === t.key
                ? "bg-slate-700 text-white border border-slate-600"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code Block */}
      <div className="relative mx-6 mb-5 rounded-xl overflow-hidden border border-slate-800">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 border-b border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-[10px] font-mono text-slate-600">
            {activeTab === "node" ? "index.ts" : activeTab === "python" ? "main.py" : "terminal"}
          </span>
        </div>
        <pre
          className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto"
          style={{ background: "#080c12", color: "#a0aec0" }}
        >
          {CODE_SNIPPETS[activeTab].split("\n").map((line, i) => {
            // Minimal syntax colouring without an external library
            const isComment      = line.trim().startsWith("//") || line.trim().startsWith("#");
            const isString       = line.includes('"') || line.includes("'");
            const hasKeyword     = /^(import|from|const|let|await|print|curl|export)/.test(line.trim());
            const hasHeader      = line.trim().startsWith("-H") || line.trim().startsWith("-d");
            return (
              <span
                key={i}
                className="block"
                style={{
                  color: isComment ? "#4a5568"
                       : hasKeyword ? "#90cdf4"
                       : hasHeader  ? "#fbd38d"
                       : "#a0aec0",
                }}
              >
                {line}
              </span>
            );
          })}
        </pre>
      </div>

      {/* Response Header callout */}
      <div className="mx-6 mb-5 flex flex-wrap gap-2">
        {[
          { header: "x-streetmp-trust-score", example: "97", color: "emerald" },
          { header: "x-streetmp-trust-band",  example: "HIGH", color: "emerald" },
          { header: "x-streetmp-routing",     example: "openai/gpt-4o-mini", color: "violet" },
          { header: "x-streetmp-key-id",      example: "key_finance_001", color: "blue" },
        ].map(({ header, example, color }) => (
          <div
            key={header}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono
              ${color === "emerald" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" :
                color === "violet"  ? "border-violet-500/20 bg-violet-500/5 text-violet-300" :
                                      "border-blue-500/20 bg-blue-500/5 text-blue-300"}`}
          >
            <span className="text-slate-500">{header}:</span>
            <span>{example}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────


export default function ApiKeysPage() {
  const [keys, setKeys]           = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey]       = useState<GeneratedKey | null>(null);
  const [revoking, setRevoking]   = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ROUTER_URL}/api/v1/admin/keys`);
      const data = await res.json() as { success: boolean; data?: ApiKeyRecord[] };
      if (data.success && data.data) setKeys(data.data);
    } catch {
      setFetchError("Cannot reach Router Service. Is it running on port 4000?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchKeys(); }, [fetchKeys]);

  const handleRevoke = async (key_id: string, label: string) => {
    if (!confirm(`Permanently revoke "${label}"?\n\nThis operation is irreversible.`)) return;
    setRevoking(key_id);
    try {
      const res  = await fetch(`${ROUTER_URL}/api/v1/admin/keys/${key_id}`, { method: "DELETE" });
      const data = await res.json() as { success: boolean };
      if (data.success) setKeys((prev) => prev.filter((k) => k.key_id !== key_id));
    } catch {
      alert("Revocation failed — check network connection.");
    } finally {
      setRevoking(null);
    }
  };

  const handleGenerated = (key: GeneratedKey) => {
    setShowModal(false);
    setNewKey(key);
    setKeys((prev) => [...prev, key]);
  };

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: "#0F172A", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">API & Security Controls</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/20">V19</span>
          </div>
          <p className="text-sm text-slate-500">
            Generate, manage, and revoke API keys with V12 Policy bindings for programmatic access.
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setNewKey(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
        >
          <span>＋</span> Generate Key
        </button>
      </div>

      {/* ── Plaintext Reveal ─────────────────────────────────────────── */}
      {newKey && (
        <PlaintextReveal plaintext={newKey.plaintext} onDismiss={() => setNewKey(null)} />
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-4 flex items-center gap-3">
          <span className="text-red-400 shrink-0">⚠</span>
          <p className="text-sm text-red-300">{fetchError}</p>
          <button onClick={() => setFetchError(null)} className="ml-auto text-xs text-slate-500 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* ── Active Keys Table ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Active API Keys</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600">{keys.length} key{keys.length !== 1 ? "s" : ""}</span>
            <button
              onClick={fetchKeys}
              aria-label="Refresh"
              className="text-[11px] text-slate-500 hover:text-white transition-colors border border-slate-700 rounded-lg px-2.5 py-1 hover:border-slate-500"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} columns={5} />
        ) : keys.length === 0 ? (
          <EmptyState
            icon="key"
            headline="No API Keys Yet"
            description="Generate your first API key to enable programmatic access through the V18 Gateway with V12 Policy enforcement."
            action={{
              label: "Generate API Key",
              onClick: () => { setShowModal(true); setNewKey(null); },
              id: "empty-state-generate-key",
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Key ID", "Label", "Tenant", "Policy", "Created", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.key_id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <code className="text-[11px] font-mono text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded">
                        {key.key_id.slice(0, 16)}…
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium">{key.label}</td>
                    <td className="px-5 py-3.5">
                      <code className="text-[11px] font-mono text-violet-300">{key.tenant_id}</code>
                    </td>
                    <td className="px-5 py-3.5"><PolicyBadge policy_id={key.policy_id} /></td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-500 font-mono text-[10px]">
                        {new Date(key.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleRevoke(key.key_id, key.label)}
                        disabled={revoking === key.key_id}
                        className="text-[11px] text-red-400/70 hover:text-red-400 transition-colors border border-red-500/15 hover:border-red-500/30 rounded-lg px-2.5 py-1 disabled:opacity-40"
                      >
                        {revoking === key.key_id ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Policy Reference ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">V12 Policy Reference</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POLICIES.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
              <PolicyBadge policy_id={p.id} />
              <p className="text-[10px] text-slate-500 font-mono mt-2">{p.id}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Each API key is bound to exactly one V12 Policy. When a request authenticates via{" "}
          <code className="font-mono text-slate-400">x-api-key</code>, the Gateway automatically
          injects the correct <code className="font-mono text-slate-400">x-tenant-id</code> header — routing
          through the Policy Engine, Cognitive Governor, and ZK Prover without any additional configuration.
        </p>
      </div>

      {/* ── Security Note ────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-5 py-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <span className="text-blue-400 text-lg shrink-0 mt-0.5">ℹ</span>
        <div className="text-xs text-slate-400 leading-relaxed">
          <p className="font-semibold text-blue-300 mb-0.5">Zero-Storage Security</p>
          <p>
            API keys are stored as SHA-256 hashes only. Plaintext is shown once at generation
            and is immediately discarded from server memory. Revocation is O(1) and cryptographically
            guaranteed — the hash is removed from the lookup table instantly.
          </p>
        </div>
      </div>

      {/* ── V26 Integration Guide ─────────────────────────────── */}
      <IntegrationGuide />

      {showModal && <GenerateKeyModal onClose={() => setShowModal(false)} onGenerated={handleGenerated} />}
    </div>
  );
}
