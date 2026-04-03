"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getMarketplaceProfiles,
  type MarketplaceProfile,
} from "@/lib/apiClient";

// ----------------------------------------------------------------
// HCQ Tier Color Map
// ----------------------------------------------------------------
const TIER_CONFIG = {
  Elite: {
    label: "⚡ Elite",
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.08)]",
    scoreColor: "text-emerald-400",
  },
  Verified: {
    label: "✦ Verified",
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.06)]",
    scoreColor: "text-amber-400",
  },
  Rising: {
    label: "↑ Rising",
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    glow: "shadow-[0_0_30px_rgba(59,130,246,0.06)]",
    scoreColor: "text-blue-400",
  },
};

function HcqRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 95 ? "#10b981" : score >= 80 ? "#f59e0b" : "#3b82f6";

  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="rotate-[-90deg]">
      <circle cx="38" cy="38" r={radius} strokeWidth="5" fill="none" stroke="rgba(255,255,255,0.05)" />
      <circle
        cx="38" cy="38" r={radius}
        strokeWidth="5" fill="none"
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

function EngineerCard({ profile }: { profile: MarketplaceProfile }) {
  const tier = TIER_CONFIG[profile.tier_badge];
  const hcq = parseFloat(profile.hcq_score);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border ${tier.border} bg-black/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${tier.glow} hover:border-opacity-60`}
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-5 pb-4">
        {/* HCQ Score Ring */}
        <div className="relative shrink-0">
          <HcqRing score={hcq} />
          <div className="absolute inset-0 flex items-center justify-center rotate-90">
            <span className={`text-lg font-bold font-mono ${tier.scoreColor}`}>{hcq.toFixed(1)}</span>
          </div>
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{profile.display_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} font-medium border ${tier.border}`}>
              {tier.label}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{profile.expertise}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-white/5" />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-px p-5 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Executions</span>
          <span className="text-sm font-mono font-semibold text-white">
            {profile.total_executions >= 1000
              ? `${(profile.total_executions / 1000).toFixed(1)}k`
              : profile.total_executions.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">1st-Try</span>
          <span className="text-sm font-mono font-semibold text-white">
            {profile.first_try_success_rate}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Bank</span>
          {profile.bank_verified ? (
            <span className="text-xs font-medium text-emerald-400">✓ Verified</span>
          ) : (
            <span className="text-xs text-zinc-600">—</span>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="p-5 pt-0">
        <Link
          href={`/hire?engineer=${profile.user_id}`}
          className={`block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-all duration-200
            ${
              profile.tier_badge === "Elite"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                : profile.tier_badge === "Verified"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
            }`}
        >
          Hire Now →
        </Link>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [profiles, setProfiles] = useState<MarketplaceProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [minHcq, setMinHcq] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input 350ms
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 350);
  };

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMarketplaceProfiles({
        min_hcq: minHcq,
        search: debouncedSearch,
        limit: 50,
      });
      setProfiles(result.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace.");
    } finally {
      setIsLoading(false);
    }
  }, [minHcq, debouncedSearch]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const eliteCount = profiles.filter((p) => p.tier_badge === "Elite").length;
  const verifiedCount = profiles.filter((p) => p.tier_badge === "Verified").length;

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* ── Top Nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#050507]/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">S</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Streetmp <span className="text-violet-400">OS</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-300 hover:bg-white/10 transition-all"
          >
            Dashboard →
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/[0.05]">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-64 w-96 blur-3xl rounded-full bg-violet-600/10" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 py-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {eliteCount + verifiedCount} Verified Engineers Available
          </div>
          <h1 className="text-5xl font-extralight tracking-tight text-white mb-4">
            The HCQ<br />
            <span className="bg-gradient-to-r from-violet-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent font-medium">
              Talent Marketplace
            </span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto">
            Every engineer is ranked by their Hallucination-Correction Quotient — 
            the world's first objective measure of AI output quality.
          </p>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-40 border-b border-white/[0.05] bg-[#050507]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          {/* Search */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name or expertise..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-violet-500/40 focus:bg-white/[0.07]"
            />
          </div>

          {/* Min HCQ Slider */}
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-zinc-400 whitespace-nowrap">Min HCQ:</span>
            <input
              type="range"
              min={0}
              max={99}
              step={5}
              value={minHcq}
              onChange={(e) => setMinHcq(Number(e.target.value))}
              className="w-32 accent-violet-500 cursor-pointer"
            />
            <span className="w-12 text-center font-mono text-sm text-violet-400 font-bold tabular-nums">
              {minHcq}+
            </span>
          </div>

          {/* Result count */}
          <div className="hidden md:block text-xs text-zinc-500 shrink-0">
            {isLoading ? "Loading..." : `${profiles.length} engineers`}
          </div>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchProfiles}
              className="text-xs text-zinc-400 underline hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-2xl">🔍</p>
            <p className="text-zinc-400 text-sm">
              No engineers match your filters.{" "}
              <button
                onClick={() => { setMinHcq(0); setSearch(""); setDebouncedSearch(""); }}
                className="text-violet-400 hover:underline"
              >
                Reset filters
              </button>
            </p>
          </div>
        ) : (
          <>
            {/* Elite section header */}
            {eliteCount > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  ⚡ Elite Tier ({eliteCount})
                </span>
                <div className="flex-1 h-px bg-emerald-500/10" />
              </div>
            )}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {profiles.map((profile) => (
                <EngineerCard key={profile.user_id} profile={profile} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
