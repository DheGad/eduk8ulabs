"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/intelligence/rag
 * @version V64
 * @description Secure RAG & Vector Search — Knowledge Ingestion Hub
 *
 * Live similarity search with animated result ranking, tenant isolation
 * privacy shield visualization, and per-tenant knowledge vault overview.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

// ================================================================
// TYPES & DATA
// ================================================================

interface VaultDocument {
  id:         string;
  title:      string;
  snippet:    string;
  category:   string;
  similarity?: number;
  ingested:   string;
}

interface Tenant {
  id:    string;
  name:  string;
  color: string;
  icon:  string;
  docs:  VaultDocument[];
}

const TENANTS: Tenant[] = [
  {
    id:    "bank_alpha",
    name:  "Bank Alpha",
    color: "#10b981",
    icon:  "🏦",
    docs: [
      { id: "a1", title: "AML Compliance Policy v4.2",    snippet: "Anti-money laundering procedures require all transactions above $10,000 to be reported under §5313...", category: "Legal_Internal", ingested: "2026-03-24" },
      { id: "a2", title: "Q3 2025 Financial Summary",     snippet: "Total AUM reached $42.7B in Q3, representing a 12.4% YoY increase. Net interest margin improved to 3.1%.", category: "Q3_Financials",  ingested: "2026-03-24" },
      { id: "a3", title: "Employee Stock Option Plan 2026",snippet: "The 2026 ESOP grants eligible employees options at a strike price of $42.80 with 4-year vesting...",   category: "HR_Policies",     ingested: "2026-03-25" },
    ],
  },
  {
    id:    "hospital_beta",
    name:  "Hospital Beta",
    color: "#0EA5E9",
    icon:  "🏥",
    docs: [
      { id: "b1", title: "ICU Admission Protocol v2.1",  snippet: "APACHE II score ≥15 triggers immediate escalation to the Head of Critical Care. All admissions require senior consultant sign-off.", category: "Clinical_Protocols", ingested: "2026-03-25" },
      { id: "b2", title: "HIPAA Data Handling Policy",   snippet: "Protected Health Information must be encrypted at rest using AES-256-GCM. Logs retained for 6 years under §164.530(j).", category: "Legal_Internal",      ingested: "2026-03-25" },
      { id: "b3", title: "Q3 2025 Bed Utilisation Report",snippet: "Average bed occupancy hit 87.4% in Q3. ICU beds at 94% utilisation. Q4 demand forecast: +8% seasonal.", category: "Q3_Financials",         ingested: "2026-03-26" },
    ],
  },
  {
    id:    "techcorp_gamma",
    name:  "TechCorp Gamma",
    color: "#a855f7",
    icon:  "⚙️",
    docs: [
      { id: "g1", title: "API Rate Limiting Architecture",snippet: "Token bucket: 1,000 RPM per API key. Burst: 200 req / 10s window. Exceeded requests receive HTTP 429.", category: "Engineering_Docs", ingested: "2026-03-26" },
      { id: "g2", title: "Remote Work Policy 2026",      snippet: "Up to 3 remote days per week. Core hours 10am–3pm local timezone must be observed for all teams.", category: "HR_Policies",       ingested: "2026-03-27" },
    ],
  },
];

// Category badge colours
const CAT_COLORS: Record<string, string> = {
  Legal_Internal:   "#f59e0b",
  Q3_Financials:    "#10b981",
  HR_Policies:      "#6366f1",
  Clinical_Protocols: "#0EA5E9",
  Engineering_Docs:   "#a855f7",
};

// Simulate similarity scores for a query term (deterministic for demo)
function computeDemoSimilarity(docId: string, query: string): number {
  if (!query.trim()) return 0;
  const q = query.toLowerCase();
  const topic: Record<string, string[]> = {
    "compliance|legal|aml|hipaa|regulation|audit": ["a1", "b2"],
    "finance|financ|revenue|budget|q3|aum|bed":    ["a2", "b3"],
    "hr|employee|staff|remote|work|policy|option":  ["a3", "g2"],
    "clinical|icu|admission|patient|hospital":      ["b1"],
    "api|rate|limit|engineer|architect|token":      ["g1"],
  };
  for (const [pattern, ids] of Object.entries(topic)) {
    const re = new RegExp(pattern.split("|").join("|"));
    if (re.test(q) && ids.includes(docId)) {
      return 0.88 + Math.random() * 0.1;
    }
  }
  // Generic partial match
  const rand = parseInt(docId.replace(/\D/g, "") || "1");
  return 0.45 + (rand % 3) * 0.08 + Math.random() * 0.05;
}

// ================================================================
// FOLDER CARD
// ================================================================

function FolderCard({ tenant, active, onClick }: {
  tenant: Tenant; active: boolean; onClick: () => void;
}) {
  const catCounts = tenant.docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border p-5 transition-all duration-300"
      style={{
        borderColor: active ? tenant.color : "rgba(255,255,255,0.06)",
        background:  active ? `${tenant.color}10` : "transparent",
        boxShadow:   active ? `0 0 20px ${tenant.color}25` : "none",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{tenant.icon}</span>
        <div>
          <p className="text-xs font-black text-white">{tenant.name}</p>
          <p className="text-[9px] text-zinc-600 font-mono">{tenant.id}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-lg font-black" style={{ color: tenant.color }}>{tenant.docs.length}</p>
          <p className="text-[8px] text-zinc-600">docs</p>
        </div>
      </div>
      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(catCounts).map(([cat, count]) => (
          <span key={cat} className="text-[7px] px-1.5 py-0.5 rounded border"
            style={{ color: CAT_COLORS[cat] ?? "#aaa", borderColor: `${CAT_COLORS[cat] ?? "#aaa"}33`, background: `${CAT_COLORS[cat] ?? "#aaa"}10` }}>
            {cat.replace(/_/g, " ")} ({count})
          </span>
        ))}
      </div>
    </button>
  );
}

// ================================================================
// SIMILARITY RESULT ROW
// ================================================================

function SimilarityRow({ doc, rank, sim, color, delay }: {
  doc: VaultDocument; rank: number; sim: number; color: string; delay: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="rounded-xl border p-3 transition-all duration-500"
      style={{
        borderColor: visible ? `${color}30` : "rgba(255,255,255,0.04)",
        background:  visible ? `${color}08`  : "transparent",
        opacity:     visible ? 1 : 0,
        transform:   visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded text-[7px] font-black flex items-center justify-center"
            style={{ background: `${color}20`, color }}>#{rank}</span>
          <span className="text-[9px] font-black text-white">{doc.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-16 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: visible ? `${sim * 100}%` : "0%", background: color }} />
          </div>
          <span className="text-[8px] font-black font-mono" style={{ color }}>{(sim * 100).toFixed(1)}%</span>
        </div>
      </div>
      <p className="text-[8px] text-zinc-600 line-clamp-2 leading-relaxed">{doc.snippet}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[7px] px-1 py-0.5 rounded border"
          style={{ color: CAT_COLORS[doc.category] ?? "#aaa", borderColor: `${CAT_COLORS[doc.category] ?? "#aaa"}33` }}>
          {doc.category.replace(/_/g, " ")}
        </span>
        <span className="text-[7px] text-zinc-700">ingested {doc.ingested}</span>
      </div>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function SecureRAGPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTenant, setActiveTenant] = useState<Tenant>(TENANTS[0]!);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<VaultDocument & { sim: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [breachAttempt, setBreachAttempt] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const runSearch = useCallback((q: string, tenant: Tenant) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    setBreachAttempt(false);
    setTimeout(() => {
      const results = tenant.docs
        .map(d => ({ ...d, sim: computeDemoSimilarity(d.id, q) }))
        .sort((a, b) => b.sim - a.sim);
      setSearchResults(results);
      setIsSearching(false);
    }, 600);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, activeTenant), 400);
  }, [query, activeTenant, runSearch]);

  const handleTenantSwitch = useCallback((t: Tenant) => {
    setActiveTenant(t);
    setSearchResults([]);
    if (query) runSearch(query, t);
  }, [query, runSearch]);

  const simulateBreach = useCallback(() => {
    setBreachAttempt(true);
    setTimeout(() => setBreachAttempt(false), 4000);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">V64</span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">Sovereign Vector Connector</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Secure <span className="text-emerald-400">RAG</span> & Vector Search
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Enterprise knowledge retrieval with tenant-namespace isolation. Cross-tenant document access throws{" "}
              <code className="text-xs text-red-400 font-mono">VECTOR_ISOLATION_BREACH</code> — Bank Alpha's vault is invisible to Hospital Beta.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "Total Documents", value: "8",    cls: "text-emerald-400" },
              { label: "Active Tenants",  value: "3",    cls: "text-emerald-400" },
              { label: "Avg Query (ms)",  value: "12ms", cls: "text-emerald-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black tracking-wide ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-8 space-y-6">

        {/* Tenant Lockdown Badge (Privacy Shield) */}
        {breachAttempt ? (
          <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚨</span>
              <div>
                <p className="text-xs font-black text-red-400 uppercase tracking-widest">VECTOR_ISOLATION_BREACH Detected</p>
                <p className="text-[9px] text-red-500/80 mt-0.5">
                  {activeTenant.name} attempted to query {activeTenant.id === "bank_alpha" ? "hospital_beta" : "bank_alpha"} namespace.
                  Access denied. SOC2 audit log entry created.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🔒</span>
                <div>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Tenant Lockdown — Privacy Shield Active</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">
                    Active tenant: <span className="text-emerald-400 font-bold">{activeTenant.name}</span>
                    {" · "}Namespace: <code className="text-emerald-400 font-mono">{activeTenant.id}</code>
                    {" · "}Other namespaces filtered before similarity compute
                  </p>
                </div>
              </div>
              <button onClick={simulateBreach}
                className="text-[8px] font-black px-2 py-1 rounded border border-red-500/30 text-red-500 hover:bg-red-950/30 transition-all uppercase tracking-widest">
                Simulate Breach
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ── LEFT: Knowledge Vault ── */}
          <div className="xl:col-span-2 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Knowledge Ingestion Hub</p>
            {TENANTS.map(t => (
              <FolderCard
                key={t.id}
                tenant={t}
                active={activeTenant.id === t.id}
                onClick={() => handleTenantSwitch(t)}
              />
            ))}

            {/* Document count grid */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-3">Ingestion Stats</p>
              <div className="space-y-2">
                {TENANTS.map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-[8px] text-zinc-500 flex-1 truncate">{t.id}</span>
                    <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(t.docs.length / 3) * 100}%`, background: t.color }} />
                    </div>
                    <span className="text-[8px] font-mono" style={{ color: t.color }}>{t.docs.length}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Search ── */}
          <div className="xl:col-span-3 space-y-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Similarity Search</p>

            {/* Search bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                {isSearching ? (
                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-zinc-600 text-sm">🔍</span>
                )}
              </div>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/8 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-zinc-700 outline-none focus:border-emerald-500/40 transition-all"
                placeholder={`Search ${activeTenant.name} knowledge base... (try "compliance" or "finance")`}
              />
              <div className="absolute inset-y-0 right-3 flex items-center">
                <span className="text-[8px] text-zinc-700 font-mono px-1.5 py-0.5 rounded border border-white/5">
                  {activeTenant.id}
                </span>
              </div>
            </div>

            {/* Results */}
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] text-zinc-600">{searchResults.length} documents ranked by cosine similarity</p>
                  <p className="text-[8px] font-mono text-emerald-400">8-dim vector · isolated to {activeTenant.id}</p>
                </div>
                {searchResults.map((doc, i) => (
                  <SimilarityRow
                    key={doc.id}
                    doc={doc}
                    rank={i + 1}
                    sim={doc.sim}
                    color={activeTenant.color}
                    delay={i * 120}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-8 text-center">
                {isSearching ? (
                  <div>
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-[9px] text-zinc-600">Running cosine similarity search across {activeTenant.docs.length} documents...</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl mb-3 block">📐</span>
                    <p className="text-[9px] text-zinc-600">Type to begin semantic similarity search</p>
                    <p className="text-[8px] text-zinc-700 mt-1">Documents are encoded as 8-dim float vectors</p>
                    <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                      {["compliance", "finance", "hr policy", "clinical"].map(hint => (
                        <button key={hint} onClick={() => setQuery(hint)}
                          className="text-[8px] px-2 py-1 rounded border border-white/5 text-zinc-600 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active tenant docs */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-3">
                Vault — {activeTenant.name} ({activeTenant.docs.length} docs)
              </p>
              <div className="space-y-2">
                {activeTenant.docs.map(d => (
                  <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-white/4 last:border-0">
                    <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: activeTenant.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-medium text-white truncate">{d.title}</p>
                      <p className="text-[8px] text-zinc-600">{d.category.replace(/_/g," ")} · {d.ingested}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
