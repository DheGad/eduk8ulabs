import type { Metadata } from "next";
import { verifyExecutionProof, ExecutionProofReceipt } from "@/lib/apiClient";

// ================================================================
// DYNAMIC SEO METADATA
// ================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Execution Proof ${id.slice(0, 8)}… | StreetMP Trust Hub`,
    description:
      "Cryptographically verified Proof of Execution — powered by the StreetMP OS Enforcer. This receipt proves the AI output was generated and verified deterministically.",
    robots: "noindex", // Individual receipts are not search-indexed
  };
}

// ================================================================
// SERVER COMPONENT — fetches proof SSR via Trust Service
// ================================================================

async function fetchProof(id: string): Promise<ExecutionProofReceipt | null> {
  try {
    return await verifyExecutionProof(id);
  } catch {
    return null;
  }
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function HashBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 font-mono text-xs text-emerald-400 break-all leading-relaxed">
        {value}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500 shrink-0 w-36">{label}</span>
      <span className="text-xs text-zinc-200 font-mono text-right break-all">{value}</span>
    </div>
  );
}

// ================================================================
// PAGE
// ================================================================

export default async function VerifyProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proof = await fetchProof(id);

  if (!proof) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center flex flex-col gap-6">
          {/* Error shield */}
          <div className="flex items-center justify-center">
            <div className="relative h-28 w-28">
              <div className="absolute inset-0 rounded-full bg-red-500/[0.08] animate-ping" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <span className="text-4xl">⚠</span>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-light text-white mb-2">Proof Not Found</h1>
            <p className="text-sm text-zinc-500">
              No execution proof exists for ID <code className="text-red-400 font-mono">{id.slice(0, 16)}…</code>.
              The proof may have been issued by a different StreetMP OS node or the ID is incorrect.
            </p>
          </div>
          <a
            href="/marketplace"
            className="inline-block rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to Marketplace
          </a>
        </div>
      </div>
    );
  }

  const isValid = proof.is_cryptographically_valid;
  const shortId = proof.proof_id.slice(0, 8);
  const timestamp = new Date(proof.created_at).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "UTC",
  });

  return (
    <div className="min-h-screen bg-[#050507] text-white">

      {/* ── Ambient glow ──────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{
            background: isValid
              ? "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#050507]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-violet-600 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">S</span>
          </div>
          <span className="text-sm font-semibold">Streetmp <span className="text-violet-400">Trust Hub</span></span>
        </div>
        <span className="text-xs text-zinc-600 font-mono">RECEIPT #{shortId}</span>
      </nav>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="relative pt-28 pb-24 px-6 flex flex-col items-center gap-12">

        {/* ── Verification Badge ────────────────────────────────── */}
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Shield SVG */}
          <div className="relative">
            {/* Outer pulse ring */}
            {isValid && (
              <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/10 scale-110" />
            )}
            <div
              className="relative flex h-36 w-36 items-center justify-center rounded-full border-2"
              style={{
                borderColor: isValid ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
                background: isValid
                  ? "radial-gradient(circle at center, rgba(16,185,129,0.12) 0%, transparent 70%)"
                  : "radial-gradient(circle at center, rgba(239,68,68,0.12) 0%, transparent 70%)",
                boxShadow: isValid
                  ? "0 0 60px rgba(16,185,129,0.15), inset 0 0 30px rgba(16,185,129,0.05)"
                  : "0 0 60px rgba(239,68,68,0.15), inset 0 0 30px rgba(239,68,68,0.05)",
              }}
            >
              <svg width="56" height="64" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M28 2L4 12V32C4 46.4 14.4 59.6 28 63C41.6 59.6 52 46.4 52 32V12L28 2Z"
                  fill={isValid ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}
                  stroke={isValid ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)"}
                  strokeWidth="2"
                />
                {isValid ? (
                  <path
                    d="M18 32L24 38L38 24"
                    stroke="rgba(16,185,129,0.9)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <>
                    <path d="M22 22L34 34" stroke="rgba(239,68,68,0.9)" strokeWidth="3" strokeLinecap="round" />
                    <path d="M34 22L22 34" stroke="rgba(239,68,68,0.9)" strokeWidth="3" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </div>
          </div>

          <div>
            <div
              className="text-xs font-mono font-bold tracking-[0.3em] mb-2 uppercase"
              style={{ color: isValid ? "rgba(16,185,129,0.9)" : "rgba(239,68,68,0.9)" }}
            >
              {isValid ? "✓  Cryptographically Verified" : "⚠  Signature Invalid"}
            </div>
            <h1 className="text-3xl font-extralight tracking-tight text-white mb-2">
              Proof of Execution
            </h1>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
              Receipt <code className="text-zinc-400 font-mono">{shortId}…</code>
            </p>
          </div>

          {/* Validity pill */}
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
            style={{
              borderColor: isValid ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
              background: isValid ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              color: isValid ? "rgb(52,211,153)" : "rgb(252,165,165)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: isValid ? "rgb(52,211,153)" : "rgb(252,165,165)" }}
            />
            {proof.validation_note}
          </div>
        </div>

        {/* ── Receipt card ──────────────────────────────────────── */}
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Execution Metadata */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">Execution Metadata</p>
            <MetaRow label="Model Used" value={proof.model_used} />
            <MetaRow label="Executed At" value={`${timestamp} UTC`} />
            <MetaRow label="Proof ID" value={proof.proof_id} />
            <MetaRow label="Usage Log ID" value={proof.usage_log_id} />
          </div>

          {/* Cryptographic Hashes */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col gap-5">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Cryptographic Fingerprints</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                These SHA-256 hashes prove the exact prompt and output without revealing sensitive content.
                If either hash changes, this receipt is invalid.
              </p>
            </div>
            <HashBlock label="Prompt Hash (SHA-256)" value={proof.prompt_hash} />
            <HashBlock label="Output Hash (SHA-256)" value={proof.output_hash} />
            <HashBlock label="Schema Hash (SHA-256)" value={proof.schema_hash} />
          </div>

          {/* Explanation block */}
          <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.04] p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-violet-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-widest">How Verification Works</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When the StreetMP OS Enforcer validates an AI response, it hashes both the input prompt and
              the verified output using <strong className="text-zinc-300">SHA-256</strong>, then generates an{" "}
              <strong className="text-zinc-300">HMAC-SHA256 signature</strong> binding them together.
              This signature is stored alongside the hashes in the execution proof record.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When you view this receipt, the Trust Service <strong className="text-zinc-300">recomputes</strong> the
              expected signature from the stored hashes. A match proves the database record has{" "}
              <strong className="text-zinc-300">not been tampered with</strong> since the moment of execution.
              The raw prompt and output are never stored or returned — only their fingerprints.
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex gap-6 text-xs text-zinc-600">
          <a href="/marketplace" className="hover:text-zinc-400 transition-colors">Marketplace</a>
          <a href="/" className="hover:text-zinc-400 transition-colors">StreetMP OS</a>
        </div>
      </main>
    </div>
  );
}
