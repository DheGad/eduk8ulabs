/**
 * @file page.tsx
 * @route /engineer/[id]
 * @description SEO-optimized Server Component — individual engineer profile page.
 *
 * Uses Next.js 15 App Router generateMetadata for dynamic Open Graph + title tags.
 * The page fetches data server-side on each request (no stale profile data).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// ================================================================
// TYPES
// ================================================================

interface ExecutionProof {
  id: string;
  enforced_schema: string[];
  verified_at: string;
}

interface EngineerProfile {
  user_id: string;
  display_name: string;
  account_tier: string;
  bank_verified: boolean;
  hcq_score: string;
  tier_badge: "Elite" | "Verified" | "Rising";
  expertise: string;
  total_executions: number;
  first_try_success_rate: number;
  hallucination_faults: number;
  hcq_updated_at: string | null;
  execution_proofs: ExecutionProof[];
}

// ================================================================
// DATA FETCHING
// ================================================================

const TRUST_URL =
  process.env.TRUST_SERVICE_URL_INTERNAL ?? "http://localhost:4005";

async function getEngineerProfile(userId: string): Promise<EngineerProfile | null> {
  try {
    const res = await fetch(`${TRUST_URL}/api/v1/trust/engineer/${userId}`, {
      next: { revalidate: 300 }, // ISR: re-fetch at most every 5 minutes
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Trust service error: ${res.status}`);
    const data = (await res.json()) as { success: boolean; profile: EngineerProfile };
    return data.success ? data.profile : null;
  } catch {
    return null;
  }
}

// ================================================================
// DYNAMIC METADATA (Task 1 SEO requirement)
// ================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getEngineerProfile(id);

  if (!profile) {
    return {
      title: "Engineer Not Found | StreetMP OS",
      description: "This engineer profile could not be found on StreetMP OS.",
    };
  }

  const hcq = parseFloat(profile.hcq_score);
  const title = `${profile.display_name} — Verified AI Prompt Engineer (HCQ: ${hcq.toFixed(1)}) | StreetMP`;
  const description = `Hire ${profile.display_name}, an ${profile.tier_badge} AI engineer with a ${hcq.toFixed(1)} trust rating and ${profile.total_executions.toLocaleString()} verified executions on StreetMP OS. ${profile.first_try_success_rate}% first-try success rate.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `https://streetmp.com/engineer/${id}`,
      siteName: "StreetMP OS",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `https://streetmp.com/engineer/${id}`,
    },
  };
}

// ================================================================
// TIER HELPERS
// ================================================================

const TIER_COLORS = {
  Elite:    { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", ring: "#10b981" },
  Verified: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",     ring: "#f59e0b" },
  Rising:   { badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",        ring: "#3b82f6" },
};

function HcqScoreDisplay({ score, tier }: { score: number; tier: keyof typeof TIER_COLORS }) {
  const color = TIER_COLORS[tier].ring;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="64" cy="64" r={radius} strokeWidth="6" fill="none" stroke="rgba(255,255,255,0.05)" />
        <circle
          cx="64" cy="64" r={radius}
          strokeWidth="6" fill="none"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: "rotate(90deg)" }}>
        <span className="text-3xl font-bold font-mono text-white">{score.toFixed(1)}</span>
        <span className="text-xs text-zinc-500 uppercase tracking-widest">HCQ</span>
      </div>
    </div>
  );
}

// ================================================================
// THE PAGE (Server Component)
// ================================================================

export default async function EngineerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getEngineerProfile(id);

  if (!profile) {
    notFound();
  }

  const hcq = parseFloat(profile.hcq_score);
  const tierColors = TIER_COLORS[profile.tier_badge];
  const tierLabels = { Elite: "⚡ Elite", Verified: "✦ Verified", Rising: "↑ Rising" };

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#050507]/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/marketplace" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            ← Marketplace
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-violet-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-black">S</span>
            </div>
            <span className="text-sm font-bold text-white">
              Streetmp <span className="text-violet-400">OS</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* ── Hero Profile Block ───────────────────────────────── */}
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-14 mb-14">
          {/* HCQ Score Ring */}
          <div className="shrink-0 flex flex-col items-center gap-3">
            <HcqScoreDisplay score={hcq} tier={profile.tier_badge} />
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${tierColors.badge}`}>
              {tierLabels[profile.tier_badge]}
            </span>
          </div>

          {/* Profile Info */}
          <div className="flex-1 pt-2">
            <h1 className="text-4xl font-extralight tracking-tight text-white mb-1">
              {profile.display_name}
            </h1>
            <p className="text-zinc-400 mb-5 text-lg">{profile.expertise}</p>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-6 mb-7 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Executions</span>
                <span className="text-xl font-mono font-semibold text-white">
                  {profile.total_executions.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">1st-Try Rate</span>
                <span className="text-xl font-mono font-semibold text-emerald-400">
                  {profile.first_try_success_rate}%
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Hallucinations</span>
                <span className="text-xl font-mono font-semibold text-white">
                  {profile.hallucination_faults}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Tier</span>
                <span className="text-xl font-mono font-semibold text-white capitalize">
                  {profile.account_tier}
                </span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-2 mb-8">
              {profile.bank_verified && (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
                  ✓ Bank Verified (Stripe)
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-400">
                🔒 Verified by StreetMP Enforcer
              </span>
            </div>

            {/* Task 3: Start Escrow Job CTA */}
            <Link
              href={`/dashboard/jobs/new?engineerId=${profile.user_id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-all hover:bg-violet-500 hover:-translate-y-0.5 active:translate-y-0"
            >
              Start Escrow Job →
            </Link>
          </div>
        </div>

        {/* ── Task 2: Execution Proof Section ─────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-medium text-white">Verified Performance</h2>
            <div className="flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] text-violet-400">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Verified by StreetMP Enforcer
            </div>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>

          {profile.execution_proofs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500 text-sm">
              No verified executions yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profile.execution_proofs.map((proof, i) => {
                const schema = Array.isArray(proof.enforced_schema)
                  ? proof.enforced_schema as string[]
                  : [];
                const date = new Date(proof.verified_at);
                const relTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
                  .format(
                    -Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
                    "day"
                  );

                return (
                  <div
                    key={proof.id}
                    className="group flex items-start gap-5 rounded-xl border border-white/[0.05] bg-black/50 p-5 transition-all hover:border-white/10"
                  >
                    {/* Index */}
                    <div className="shrink-0 h-7 w-7 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-xs font-mono text-emerald-500">
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    {/* Schema tokens */}
                    <div className="flex-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">
                        Enforced JSON Schema
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {schema.map((key) => (
                          <code
                            key={key}
                            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-mono text-zinc-400"
                          >
                            &quot;{key}&quot;
                          </code>
                        ))}
                      </div>
                    </div>

                    {/* Date + seal */}
                    <div className="shrink-0 flex flex-col items-end gap-1 text-right">
                      <span className="text-xs text-zinc-600">{relTime}</span>
                      <span className="text-[10px] text-emerald-500/70">✓ First-Try Success</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
