"use client";

/**
 * @file app/dashboard/developer/page.tsx
 * @route /dashboard/developer
 * @phase Phase 5 — Scale & API Marketplace
 * @description
 *   Developer Portal — three tabs:
 *     API KEYS   — Generate/revoke smp_live_* keys, one-time reveal on creation
 *     WEBHOOKS   — Register HTTPS endpoints, view delivery status
 *     USAGE      — Live quota meter pulled from org_usage_quotas
 *     DOCS       — SDK quickstart code snippets
 */

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  id:           string;
  name:         string;
  key_preview:  string;
  role:         string;
  last_used_at: string | null;
  created_at:   string;
  revoked_at:   string | null;
  raw_key?:     string;   // only present immediately after creation
  warning?:     string;
}

interface WebhookEndpoint {
  id:                 string;
  url:                string;
  description:        string | null;
  is_active:          boolean;
  last_triggered_at:  string | null;
  last_status_code:   number | null;
  failure_count:      number;
  disabled_at:        string | null;
  created_at:         string;
  signing_secret?:    string;  // only returned at creation
}

interface QuotaData {
  plan_name:                string;
  monthly_limit:            number;
  current_month_executions: number;
  limit_reached_at:         string | null;
}

type Tab = "keys" | "webhooks" | "usage" | "docs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string | null) {
  if (!iso) return "Never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ROLE_COLOR: Record<string, string> = {
  OWNER:     "text-amber-400 border-amber-500/30 bg-amber-500/10",
  ADMIN:     "text-violet-400 border-violet-500/30 bg-violet-500/10",
  DEVELOPER: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  VIEWER:    "text-zinc-400 border-zinc-600 bg-zinc-800/60",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeveloperPortalPage() {
  const [tab,        setTab]        = useState<Tab>("keys");
  const [keys,       setKeys]       = useState<ApiKey[]>([]);
  const [webhooks,   setWebhooks]   = useState<WebhookEndpoint[]>([]);
  const [quota,      setQuota]      = useState<QuotaData | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Key creation form
  const [newKeyName,    setNewKeyName]    = useState("");
  const [newKeyRole,    setNewKeyRole]    = useState("DEVELOPER");
  const [creatingKey,   setCreatingKey]   = useState(false);
  const [freshKey,      setFreshKey]      = useState<ApiKey | null>(null);

  // Webhook creation form
  const [newWHUrl,     setNewWHUrl]     = useState("");
  const [newWHDesc,    setNewWHDesc]    = useState("");
  const [creatingWH,   setCreatingWH]   = useState(false);
  const [freshWH,      setFreshWH]      = useState<WebhookEndpoint | null>(null);

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, whRes, quotaRes] = await Promise.all([
        fetch("/api/developer/keys"),
        fetch("/api/developer/webhooks"),
        fetch("/api/developer/usage"),
      ]);
      if (keysRes.ok) {
        const d = await keysRes.json() as { success: boolean; keys: ApiKey[] };
        if (d.success) setKeys(d.keys);
      }
      if (whRes.ok) {
        const d = await whRes.json() as { success: boolean; endpoints: WebhookEndpoint[] };
        if (d.success) setWebhooks(d.endpoints);
      }
      if (quotaRes.ok) {
        const d = await quotaRes.json() as { success: boolean; quota: QuotaData };
        if (d.success) setQuota(d.quota);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // ── Create key ─────────────────────────────────────────────────────────────

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setFreshKey(null);
    setMsg(null);
    try {
      const res = await fetch("/api/developer/keys", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newKeyName, role: newKeyRole }),
      });
      const data = await res.json() as { success: boolean; key?: ApiKey; error?: string };
      if (data.success && data.key) {
        setFreshKey(data.key);
        setKeys((prev) => [{ ...data.key!, raw_key: undefined }, ...prev]);
        setNewKeyName("");
      } else {
        setMsg({ type: "err", text: data.error ?? "Failed to create key" });
      }
    } catch {
      setMsg({ type: "err", text: "Network error" });
    } finally {
      setCreatingKey(false);
    }
  }

  // ── Create webhook ─────────────────────────────────────────────────────────

  async function handleCreateWebhook() {
    if (!newWHUrl.startsWith("https://")) {
      setMsg({ type: "err", text: "Webhook URL must use HTTPS" });
      return;
    }
    setCreatingWH(true);
    setFreshWH(null);
    setMsg(null);
    try {
      const res = await fetch("/api/developer/webhooks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: newWHUrl, description: newWHDesc }),
      });
      const data = await res.json() as { success: boolean; endpoint?: WebhookEndpoint; error?: string };
      if (data.success && data.endpoint) {
        setFreshWH(data.endpoint);
        setWebhooks((prev) => [{ ...data.endpoint!, signing_secret: undefined }, ...prev]);
        setNewWHUrl("");
        setNewWHDesc("");
      } else {
        setMsg({ type: "err", text: data.error ?? "Failed to register webhook" });
      }
    } catch {
      setMsg({ type: "err", text: "Network error" });
    } finally {
      setCreatingWH(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const usagePct = quota && quota.monthly_limit > 0
    ? Math.min(100, Math.round((quota.current_month_executions / quota.monthly_limit) * 100))
    : quota?.monthly_limit === -1 ? 0 : 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-light text-white tracking-tight">Developer Portal</h1>
            <p className="text-sm text-zinc-500 mt-1">
              API keys, webhooks, and usage — everything you need to integrate StreetMP.
            </p>
          </div>
          {quota && (
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">This Month</p>
              <p className="text-lg font-light text-white tabular-nums">
                {quota.current_month_executions.toLocaleString()}
                <span className="text-xs text-zinc-600 ml-1">
                  / {quota.monthly_limit === -1 ? "∞" : quota.monthly_limit.toLocaleString()}
                </span>
              </p>
              <p className="text-[10px] text-zinc-600">{quota.plan_name} plan</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] mb-8">
          {(["keys", "webhooks", "usage", "docs"] as Tab[]).map((t) => (
            <button
              key={t}
              id={`dev-tab-${t}`}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "keys" ? "🔑 API Keys" :
               t === "webhooks" ? "🔔 Webhooks" :
               t === "usage" ? "📊 Usage" : "📖 Docs"}
            </button>
          ))}
        </div>

        {/* Global message */}
        {msg && (
          <div className={`mb-6 px-4 py-3 rounded-xl border text-xs ${
            msg.type === "ok"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}>
            {msg.text}
          </div>
        )}

        {/* ── API KEYS TAB ────────────────────────────────────────────────────── */}
        {tab === "keys" && (
          <div className="space-y-6">
            {/* Fresh key reveal */}
            {freshKey?.raw_key && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-400 text-base">⚠️</span>
                  <p className="text-xs font-semibold text-amber-400">{freshKey.warning}</p>
                </div>
                <code className="block w-full p-3 bg-black/40 rounded-xl font-mono text-xs text-emerald-400 break-all">
                  {freshKey.raw_key}
                </code>
                <button
                  id="copy-api-key-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(freshKey.raw_key ?? "");
                    setMsg({ type: "ok", text: "API key copied to clipboard." });
                  }}
                  className="mt-3 text-[10px] text-zinc-500 hover:text-white transition-colors"
                >
                  Copy to clipboard
                </button>
              </div>
            )}

            {/* Create key form */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-5">
              <h2 className="text-sm font-medium text-white mb-4">Create New API Key</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="new-key-name"
                  type="text"
                  placeholder="Key name (e.g. Production, CI/CD)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5
                             text-xs text-white placeholder-zinc-600
                             focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <select
                  id="new-key-role"
                  value={newKeyRole}
                  onChange={(e) => setNewKeyRole(e.target.value)}
                  title="Select key role"
                  className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5
                             text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
                <button
                  id="create-key-btn"
                  onClick={() => void handleCreateKey()}
                  disabled={creatingKey || !newKeyName.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold
                             bg-blue-600 text-white hover:bg-blue-500
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingKey ? "Creating…" : "Generate Key"}
                </button>
              </div>
            </div>

            {/* Keys table */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                <p className="text-xs font-medium text-white">Active Keys</p>
                <span className="text-[10px] font-mono text-zinc-600">{keys.filter(k => !k.revoked_at).length} / 10</span>
              </div>
              {loading ? (
                <div className="p-5 space-y-3">
                  {[0,1,2].map((i) => <div key={i} className="h-12 rounded-xl bg-white/[0.02] animate-pulse" />)}
                </div>
              ) : keys.length === 0 ? (
                <p className="p-8 text-center text-xs text-zinc-600">No API keys yet. Create your first key above.</p>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {keys.map((k) => (
                    <div key={k.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.015] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white">{k.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ROLE_COLOR[k.role] ?? ""}`}>
                            {k.role}
                          </span>
                          {k.revoked_at && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                              REVOKED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{k.key_preview}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-zinc-700">Created {relTime(k.created_at)}</p>
                        <p className="text-[10px] text-zinc-700">Last used: {relTime(k.last_used_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── WEBHOOKS TAB ────────────────────────────────────────────────────── */}
        {tab === "webhooks" && (
          <div className="space-y-6">
            {freshWH?.signing_secret && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
                <p className="text-xs font-semibold text-amber-400 mb-3">⚠️ {(freshWH as any).warning ?? "Copy this signing secret now."}</p>
                <code className="block w-full p-3 bg-black/40 rounded-xl font-mono text-xs text-emerald-400 break-all">
                  {freshWH.signing_secret}
                </code>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Verify incoming requests: <code className="text-zinc-400">x-streetmp-signature: sha256=&lt;hmac&gt;</code>
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-5">
              <h2 className="text-sm font-medium text-white mb-4">Register Webhook Endpoint</h2>
              <div className="space-y-3">
                <input
                  id="new-webhook-url"
                  type="url"
                  placeholder="https://your-app.com/webhooks/streetmp"
                  value={newWHUrl}
                  onChange={(e) => setNewWHUrl(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5
                             text-xs text-white placeholder-zinc-600
                             focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <div className="flex gap-3">
                  <input
                    id="new-webhook-desc"
                    type="text"
                    placeholder="Description (optional)"
                    value={newWHDesc}
                    onChange={(e) => setNewWHDesc(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5
                               text-xs text-white placeholder-zinc-600
                               focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <button
                    id="create-webhook-btn"
                    onClick={() => void handleCreateWebhook()}
                    disabled={creatingWH || !newWHUrl.startsWith("https://")}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold
                               bg-blue-600 text-white hover:bg-blue-500
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingWH ? "Registering…" : "Register"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <p className="text-xs font-medium text-white">Registered Endpoints</p>
              </div>
              {webhooks.length === 0 ? (
                <p className="p-8 text-center text-xs text-zinc-600">No webhook endpoints registered.</p>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {webhooks.map((wh) => (
                    <div key={wh.id} className="px-5 py-4 hover:bg-white/[0.015] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              wh.disabled_at
                                ? "bg-red-500"
                                : wh.is_active ? "bg-emerald-500" : "bg-zinc-600"
                            }`} />
                            <p className="text-xs font-mono text-blue-400 truncate">{wh.url}</p>
                          </div>
                          {wh.description && (
                            <p className="text-[10px] text-zinc-600 mt-0.5 pl-3.5">{wh.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {wh.last_status_code && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full
                              ${wh.last_status_code < 300
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-red-400 bg-red-500/10"}`}>
                              {wh.last_status_code}
                            </span>
                          )}
                          <p className="text-[10px] text-zinc-700 mt-1">
                            {relTime(wh.last_triggered_at)}
                          </p>
                          {wh.failure_count > 0 && (
                            <p className="text-[10px] text-red-400">{wh.failure_count} fail{wh.failure_count !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── USAGE TAB ───────────────────────────────────────────────────────── */}
        {tab === "usage" && quota && (
          <div className="space-y-6 max-w-lg">
            {/* Quota meter */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-medium text-white">Monthly Executions</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">{quota.plan_name} plan</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-light text-white tabular-nums">
                    {quota.current_month_executions.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    / {quota.monthly_limit === -1 ? "Unlimited" : quota.monthly_limit.toLocaleString()}
                  </p>
                </div>
              </div>

              {quota.monthly_limit !== -1 && (
                <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      usagePct >= 90
                        ? "bg-red-500"
                        : usagePct >= 70
                        ? "bg-orange-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              )}

              {quota.limit_reached_at && (
                <div className="mt-4 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10">
                  <p className="text-xs font-semibold text-red-400">
                    ⛔ Quota exceeded — requests returning 429 Too Many Requests
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Resets at start of next billing cycle.
                  </p>
                </div>
              )}
            </div>

            <a
              href="/plans"
              className="flex items-center justify-between px-5 py-4 rounded-2xl
                         border border-violet-500/10 bg-violet-500/[0.03]
                         hover:border-violet-500/20 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-violet-400">Upgrade Your Plan</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Get higher limits + Sentinel + Webhooks</p>
              </div>
              <span className="text-violet-600 group-hover:text-violet-400 transition-colors">→</span>
            </a>
          </div>
        )}

        {/* ── DOCS TAB ────────────────────────────────────────────────────────── */}
        {tab === "docs" && (
          <div className="space-y-6 max-w-2xl">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-6">
              <h2 className="text-sm font-semibold text-white mb-1">SDK Quickstart</h2>
              <p className="text-[11px] text-zinc-600 mb-4">Drop-in replacement for the OpenAI client.</p>
              <pre className="p-4 bg-black/50 rounded-xl overflow-x-auto text-[11px] text-zinc-300 leading-relaxed">
{`import StreetMP from "@streetmp/sdk";

const client = new StreetMP({
  apiKey: "smp_live_<your_key>",  // from Developer Portal
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);`}
              </pre>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Webhook Verification</h2>
              <p className="text-[11px] text-zinc-600 mb-4">Verify the <code className="text-zinc-400">x-streetmp-signature</code> header.</p>
              <pre className="p-4 bg-black/50 rounded-xl overflow-x-auto text-[11px] text-zinc-300 leading-relaxed">
{`import { createHmac } from "crypto";

function verifyWebhook(
  body: string,
  secret: string,
  signature: string
): boolean {
  const expected = "sha256=" +
    createHmac("sha256", secret)
      .update(body)
      .digest("hex");

  return signature === expected;
}`}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "Rate Limit Headers", desc: "X-RateLimit-Limit · X-RateLimit-Used · X-RateLimit-Remaining", icon: "🔢" },
                { title: "Authentication", desc: "Send your key as: Authorization: Bearer smp_live_...", icon: "🔑" },
                { title: "429 Too Many Requests", desc: "Upgrade your plan or wait for monthly reset", icon: "⛔" },
                { title: "Webhook Events", desc: "threat.critical · sentinel.block · quota.exceeded", icon: "🔔" },
              ].map(({ title, desc, icon }) => (
                <div key={title} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{icon}</span>
                    <p className="text-xs font-medium text-white">{title}</p>
                  </div>
                  <p className="text-[11px] text-zinc-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
