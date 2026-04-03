/**
 * @file app/(public)/stp/page.tsx
 * @description Command 087 — StreetMP Trust Protocol (STP) Specification Page.
 *
 * Route:  /stp
 * Access: Fully public — static server component, no auth.
 *
 * Design intent: relentlessly technical. This is for developers, auditors,
 * and regulators — not marketing. Stripe Docs / RFC aesthetics.
 */

import Link from "next/link";

// ─── Spec Data ────────────────────────────────────────────────────────────────

const STP_VERSION = "1.0.0";
const STP_DATE    = "2026-04-01";

const CERT_FIELDS = [
  {
    field:       "execution_id",
    type:        "string",
    example:     "exec_a3f8c2d1e94b7056",
    required:    true,
    description: "Globally unique, non-guessable identifier for this AI execution. Generated using 10 random bytes (80-bit entropy). Format: exec_ + 20 hex chars.",
    privacy:     "Public",
  },
  {
    field:       "issued_at",
    type:        "string (ISO-8601)",
    example:     "2026-04-01T07:14:32.004Z",
    required:    true,
    description: "UTC timestamp of certificate issuance. Precision to milliseconds.",
    privacy:     "Public",
  },
  {
    field:       "trust_score",
    type:        "number (0–100)",
    example:     "87.3",
    required:    true,
    description: "V25 Global Trust Score. Computed from: model safety tier, RBAC permissions exercised, consensus result, NeMo evaluation, and prompt firewall signals.",
    privacy:     "Public",
  },
  {
    field:       "trust_band",
    type:        "enum",
    example:     "GOLD",
    required:    true,
    description: "Human-readable trust classification. PLATINUM (≥90) · GOLD (≥75) · SILVER (≥50) · BRONZE (≥25) · CRITICAL (<25).",
    privacy:     "Public",
  },
  {
    field:       "model",
    type:        "string",
    example:     "gpt-4o",
    required:    true,
    description: "The AI model identifier used for this execution. Drawn from the V22 Smart Router selection or tenant-specified override.",
    privacy:     "Public",
  },
  {
    field:       "provider",
    type:        "string",
    example:     "openai",
    required:    true,
    description: "AI provider. One of: openai · anthropic · google · streetmp (on-prem).",
    privacy:     "Public",
  },
  {
    field:       "region",
    type:        "string",
    example:     "ap-southeast-1",
    required:    true,
    description: "AWS region or on-prem zone where inference was executed. Enforced by V69 Regional Router against tenant data_sovereignty_region.",
    privacy:     "Public",
  },
  {
    field:       "compliance_flags",
    type:        "string[]",
    example:     '["MAS_TRM_9.2_AI_GOVERNANCE","V74_CONSENSUS_REQUIRED"]',
    required:    false,
    description: "V12 and V85 policy tags that were active during this execution. Empty array for unconstrained executions.",
    privacy:     "Public",
  },
  {
    field:       "zk_signature",
    type:        "string (64-char hex)",
    example:     "3a7f1c9d…",
    required:    true,
    description: "HMAC-SHA256 of the canonical payload: execution_id|issued_at|trust_score|compliance_flags|region|model|provider. Field order is fixed. Verifiable with the published signing key root.",
    privacy:     "Public",
  },
  {
    field:       "fingerprint",
    type:        "string (12-char hex)",
    example:     "3A7F1C9D4B2E",
    required:    true,
    description: "The first 12 uppercase hex characters of zk_signature. Human-readable short form for comparison in audit logs.",
    privacy:     "Public",
  },
];

const NEVER_INCLUDED = [
  { field: "prompt",          reason: "Raw user prompt text is PII. The certificate proves a computation occurred — not what was computed." },
  { field: "completion",      reason: "Raw AI response text. Not present in any certificate field by design." },
  { field: "user_id",         reason: "User identity is not needed for execution integrity proofs." },
  { field: "tenant_id",       reason: "Omitted from public verify responses to protect customer privacy." },
  { field: "api_key",         reason: "Never stored anywhere in the kernel — zero persistence by design." },
  { field: "system_overlay",  reason: "Tenant-defined system prompts are confidential corporate instructions." },
];

const TRUST_BANDS = [
  { band: "PLATINUM", range: "≥ 90", color: "text-violet-300 border-violet-500/30 bg-violet-500/10", description: "All security subsystems passed. Consensus reached. NeMo safety clear." },
  { band: "GOLD",     range: "≥ 75", color: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10",   description: "Standard execution. Minor risk signals present but within policy bounds." },
  { band: "SILVER",   range: "≥ 50", color: "text-zinc-300 border-zinc-500/30 bg-zinc-500/10",         description: "Elevated risk. On-prem fallback or reduced model trust tier." },
  { band: "BRONZE",   range: "≥ 25", color: "text-orange-300 border-orange-500/30 bg-orange-500/10",   description: "Significant risk signals. Human review recommended." },
  { band: "CRITICAL", range: "<  25", color: "text-red-300 border-red-500/30 bg-red-500/10",            description: "Policy violation or tampered signature. Execution should be quarantined." },
];

const ENDPOINTS = [
  {
    method:    "GET",
    path:      "/api/v1/public/verify/{hash}",
    desc:      "Look up a certificate by Merkle leaf hash (64-char hex) or execution ID (exec_*).",
    rate:      "30 req/min per IP",
    auth:      "None",
  },
  {
    method:    "GET",
    path:      "/api/v1/public/verify",
    desc:      "Returns STP ledger health — total certificates issued, active Merkle trees, and spec link.",
    rate:      "30 req/min per IP",
    auth:      "None",
  },
  {
    method:    "GET",
    path:      "/api/v1/verify/{execution_id}",
    desc:      "(Authenticated) Internal verification with HMAC re-computation against the cert ledger.",
    rate:      "Standard API quota",
    auth:      "x-api-key or session token",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ anchor, label }: { anchor: string; label: string }) {
  return (
    <div id={anchor} className="flex items-center gap-3 pt-16 pb-2 border-b border-white/[0.06] scroll-mt-24">
      <a href={`#${anchor}`} className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs font-mono">#</a>
      <h2 className="text-2xl font-bold text-white tracking-tight">{label}</h2>
    </div>
  );
}

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-zinc-950 overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-white/[0.02]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{lang}</span>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/50" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/50" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
        </div>
      </div>
      <pre className="p-5 text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

const EXAMPLE_CERT = `{
  "success": true,
  "verified": true,
  "protocol": "STP/1.0",
  "lookup_mode": "execution_id",
  "status": "SECURE",
  "certificate": {
    "execution_id":     "exec_a3f8c2d1e94b7056fe3a",
    "fingerprint":      "3A7F1C9D4B2E",
    "issued_at":        "2026-04-01T07:14:32.004Z",
    "trust_score":      87.3,
    "trust_band":       "GOLD",
    "model":            "gpt-4o",
    "provider":         "openai",
    "region":           "ap-southeast-1",
    "compliance_flags": ["MAS_TRM_9.2_AI_GOVERNANCE", "V74_CONSENSUS_REQUIRED"],
    "zk_signature":     "3a7f1c9d4b2ef839…"
  },
  "attestation": {
    "verified_by":      "StreetMP Trust Protocol Kernel v1.0",
    "algorithm":        "HMAC-SHA256 Canonical Payload",
    "verify_timestamp": "2026-04-01T09:01:15.882Z",
    "stp_spec":         "https://os.streetmp.com/stp"
  },
  "prompt_retained":   false,
  "response_retained": false
}`;

const CANONICAL_PAYLOAD_EXAMPLE = `// Canonical payload — field order is FIXED
const payload = [
  \`execution_id=\${cert.execution_id}\`,
  \`issued_at=\${cert.issued_at}\`,
  \`trust_score=\${cert.trust_score}\`,
  \`compliance_flags=\${cert.compliance_flags.sort().join(",")}\`,
  \`region=\${cert.region}\`,
  \`model=\${cert.model}\`,
  \`provider=\${cert.provider}\`,
].join("|");

const expected = createHmac("sha256", SIGNING_KEY_ROOT)
  .update(payload)
  .digest("hex");

const valid = (expected === cert.zk_signature);`;

const MERKLE_VERIFY_EXAMPLE = `// Verify a Merkle leaf hash
GET /api/v1/public/verify/a3f8c2d1e94b7056fe3a812c490d67b2e15f9308…

// Verify by execution ID
GET /api/v1/public/verify/exec_a3f8c2d1e94b7056fe3a

// Response — see full schema at /stp#certificate-schema`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StpPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-emerald-500/20">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-xl font-medium tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/stp"          className="text-white">STP Spec</Link>
            <Link href="/verify"       className="hover:text-white transition-colors">Verify Certificate</Link>
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 font-semibold">Risk Scanner</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-all">
              Get API Access
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-24 flex gap-12">

        {/* ── Sidebar TOC ─────────────────────────────────────────── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-28 flex flex-col gap-1 text-xs font-medium">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Contents</p>
            {[
              { anchor: "overview",          label: "Overview" },
              { anchor: "certificate-schema", label: "Certificate Schema" },
              { anchor: "trust-bands",       label: "Trust Bands" },
              { anchor: "zk-signature",      label: "ZK Signature" },
              { anchor: "merkle-anchoring",  label: "Merkle Anchoring" },
              { anchor: "privacy-model",     label: "Privacy Model" },
              { anchor: "api-reference",     label: "API Reference" },
              { anchor: "compliance-flags",  label: "Compliance Flags" },
              { anchor: "verification",      label: "Verification" },
            ].map((item) => (
              <a
                key={item.anchor}
                href={`#${item.anchor}`}
                className="text-zinc-500 hover:text-zinc-200 transition-colors py-1 pl-3 border-l border-zinc-800 hover:border-emerald-500/50"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-col gap-2">
              <Link href="/verify" className="text-emerald-400 hover:text-emerald-300 transition-colors py-1 pl-3 border-l border-emerald-500/30 font-semibold">
                → Verify a Certificate
              </Link>
              <Link href="/scan" className="text-rose-400 hover:text-rose-300 transition-colors py-1 pl-3 border-l border-rose-500/30 font-semibold">
                → Live Risk Scanner
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* Header */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest">
                Open Standard
              </span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded border border-white/10 bg-white/[0.03] text-zinc-400 uppercase tracking-widest">
                STP v{STP_VERSION}
              </span>
              <span className="text-[10px] font-mono text-zinc-600">{STP_DATE}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter text-white leading-tight">
              StreetMP Trust Protocol
              <span className="text-zinc-500"> (STP)</span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed">
              An open, cryptographic specification for AI execution governance certificates.
              Free to implement. Auditor-readable. Regulatorily-anchored.
            </p>
          </div>

          {/* Overview callout */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-6 py-5 mb-2">
            <p className="text-sm text-zinc-300 leading-relaxed">
              STP is to AI governance what <strong className="text-white">TLS is to web traffic</strong>: the protocol is free and open,
              but the infrastructure to issue, verify, and audit STP certificates at scale requires StreetMP OS.
              Every AI inference through StreetMP OS automatically produces an STP/1.0 certificate — tamper-evident,
              privacy-preserving, and independently verifiable by any third party.
            </p>
          </div>

          {/* ── Section: Overview ───────────────────────────────────── */}
          <SectionHeader anchor="overview" label="Overview" />

          <div className="prose prose-invert prose-sm max-w-none mt-6 space-y-4 text-zinc-400 leading-relaxed">
            <p>
              Each AI execution through the StreetMP OS router produces exactly one <strong className="text-white">
              STP Execution Certificate</strong>. The certificate is issued as the final step of the pipeline —
              after policy evaluation, PII scrubbing, NeMo safety analysis, and trust scoring — and is stored
              in a tamper-evident in-memory ledger anchored to the V13 Merkle tree.
            </p>
            <p>
              The certificate is designed around a single principle:{" "}
              <em className="text-zinc-300">prove that a computation was governed, without revealing what was computed.</em>
              {" "}No prompt text, no response text, and no user-identifiable content is ever present in an STP certificate.
            </p>
          </div>

          {/* ── Section: Certificate Schema ──────────────────────────── */}
          <SectionHeader anchor="certificate-schema" label="Certificate Schema" />

          <div className="mt-6 rounded-2xl border border-white/[0.07] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-12 bg-white/[0.03] border-b border-white/[0.07] text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <div className="col-span-3 px-4 py-3">Field</div>
              <div className="col-span-2 px-4 py-3">Type</div>
              <div className="col-span-5 px-4 py-3">Description</div>
              <div className="col-span-2 px-4 py-3">Privacy</div>
            </div>
            {CERT_FIELDS.map((f, i) => (
              <div
                key={f.field}
                className={`grid grid-cols-12 border-b border-white/[0.05] hover:bg-white/[0.015] transition-colors text-xs ${
                  i === CERT_FIELDS.length - 1 ? "border-b-0" : ""
                }`}
              >
                <div className="col-span-3 px-4 py-4 font-mono text-emerald-400 font-semibold flex flex-col gap-1">
                  {f.field}
                  {f.required && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">required</span>
                  )}
                </div>
                <div className="col-span-2 px-4 py-4 font-mono text-violet-400 text-[10px]">{f.type}</div>
                <div className="col-span-5 px-4 py-4 text-zinc-400 leading-snug">
                  <p>{f.description}</p>
                  <p className="text-[10px] font-mono text-zinc-600 mt-1.5">e.g. {f.example}</p>
                </div>
                <div className="col-span-2 px-4 py-4">
                  <span className="text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {f.privacy}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-600 mt-3 font-mono">STP v{STP_VERSION} — schema version stable. Non-breaking additions may be added in minor versions.</p>

          {/* ── Section: Trust Bands ─────────────────────────────────── */}
          <SectionHeader anchor="trust-bands" label="Trust Bands" />
          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            {TRUST_BANDS.map((b) => (
              <div key={b.band} className={`rounded-xl border px-4 py-4 flex gap-3 items-start ${b.color}`}>
                <span className="text-lg font-black tracking-tighter shrink-0">{b.band}</span>
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 mb-1">trust_score {b.range}</p>
                  <p className="text-xs text-zinc-400">{b.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Section: ZK Signature ────────────────────────────────── */}
          <SectionHeader anchor="zk-signature" label="ZK Signature Verification" />
          <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
            The <span className="font-mono text-violet-400">zk_signature</span> is an HMAC-SHA256 computed over
            the <strong className="text-white">canonical payload</strong> — a deterministic string constructed
            from all certificate fields in fixed order. Any field mutation invalidates the signature.
            The signing key root is published in the STP governance registry.
          </p>
          <CodeBlock code={CANONICAL_PAYLOAD_EXAMPLE} lang="typescript" />

          {/* ── Section: Merkle Anchoring ─────────────────────────────── */}
          <SectionHeader anchor="merkle-anchoring" label="Merkle Tree Anchoring" />
          <div className="mt-4 space-y-3 text-sm text-zinc-400">
            <p>
              Every STP certificate is appended to a{" "}
              <strong className="text-white">per-tenant, per-day SHA-256 Merkle tree</strong> (V13 engine).
              The tree produces a single <span className="font-mono text-violet-400">merkle_root</span> that
              CISOs can publish out-of-band (email digest, blockchain anchor) as proof that no receipts were
              deleted, inserted, or reordered after the fact.
            </p>
            <div className="rounded-xl border border-white/[0.07] p-4 font-mono text-xs text-zinc-400 space-y-1 bg-zinc-950/60">
              <p className="text-zinc-600"># Leaf hash formula (idempotent, collision-resistant)</p>
              <p><span className="text-violet-400">leaf_hash</span> = SHA256(receipt.signature + <span className="text-emerald-400">&quot;|&quot;</span> + receipt.timestamp)</p>
              <p className="mt-2 text-zinc-600"># Internal node formula</p>
              <p><span className="text-violet-400">node</span> = SHA256(left_child + right_child)</p>
              <p className="mt-2 text-zinc-600"># Root = top of tree. Changes if any leaf mutations.</p>
            </div>
            <p className="text-xs text-zinc-600 font-mono">
              Threat mitigated: log deletion · log insertion · reordering · post-hoc forgery
            </p>
          </div>

          {/* ── Section: Privacy Model ────────────────────────────────── */}
          <SectionHeader anchor="privacy-model" label="Privacy Model — What Is Never Included" />
          <div className="mt-6 rounded-2xl border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-2 bg-white/[0.03] border-b border-white/[0.07] text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <div className="px-5 py-3">Excluded Field</div>
              <div className="px-5 py-3">Reason</div>
            </div>
            {NEVER_INCLUDED.map((n, i) => (
              <div key={n.field}
                className={`grid grid-cols-2 border-b border-white/[0.04] hover:bg-white/[0.01] text-xs ${i === NEVER_INCLUDED.length - 1 ? "border-b-0" : ""}`}>
                <div className="px-5 py-4 font-mono text-red-400 line-through">{n.field}</div>
                <div className="px-5 py-4 text-zinc-500">{n.reason}</div>
              </div>
            ))}
          </div>

          {/* ── Section: API Reference ────────────────────────────────── */}
          <SectionHeader anchor="api-reference" label="Public API Reference" />
          <div className="mt-6 flex flex-col gap-4">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="rounded-xl border border-white/[0.07] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-white/[0.02] border-b border-white/[0.05]">
                  <span className={`text-[10px] font-black px-2 py-1 rounded font-mono uppercase ${
                    ep.method === "GET" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                  }`}>{ep.method}</span>
                  <code className="text-sm text-zinc-200 font-mono">{ep.path}</code>
                </div>
                <div className="px-5 py-4 grid sm:grid-cols-3 gap-4 text-xs">
                  <div className="col-span-2">
                    <p className="text-zinc-300 leading-relaxed">{ep.desc}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 w-16">Auth:</span>
                      <span className="text-zinc-400 font-mono">{ep.auth}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 w-16">Rate:</span>
                      <span className="text-zinc-400 font-mono">{ep.rate}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <CodeBlock code={MERKLE_VERIFY_EXAMPLE} lang="http" />

          {/* ── Section: Compliance Flags ─────────────────────────────── */}
          <SectionHeader anchor="compliance-flags" label="Compliance Flag Registry (V85 APAC)" />
          <p className="text-sm text-zinc-400 mt-4 mb-4 leading-relaxed">
            The following flags may appear in <span className="font-mono text-violet-400">compliance_flags[]</span>{" "}
            when APAC regulatory frameworks (V85) are active for the executing tenant.
          </p>
          <div className="rounded-xl border border-white/[0.07] p-5 font-mono text-xs text-zinc-400 space-y-2 bg-zinc-950/60 leading-relaxed">
            {[
              ["MAS_TRM_9.1_SYSTEM_RISK",      "MAS TRM 2021 §9.1 — Technology risk management controls enforced"],
              ["MAS_TRM_9.2_AI_GOVERNANCE",    "MAS TRM 2021 §9.2 — AI governance framework active"],
              ["V74_CONSENSUS_REQUIRED",        "Dual-model consensus (V74 Truth Gate) was required and executed"],
              ["BNM_RMIT_10.55_AUDIT_LOG",     "BNM RMiT 2020 §10.55 — 7-year audit retention active"],
              ["V69_REGION_SG",                "Data sovereignty locked to Singapore inference region"],
              ["V69_REGION_MY",                "Data sovereignty locked to Malaysia inference region"],
              ["V69_REGION_EU",                "Data sovereignty locked to EU/EEA inference region"],
              ["V13_RETENTION_1825D",           "Audit log retention set to 1,825 days (MAS TRM minimum)"],
              ["V13_RETENTION_2556D",           "Audit log retention set to 2,556 days (BNM RMiT minimum)"],
              ["GDPR_ART25_PBD",               "GDPR Article 25 Privacy-by-Design controls verified"],
              ["V71_PROMPT_FIREWALL_CLEARED",   "V71 heuristic firewall passed — no adversarial jailbreak detected"],
              ["V81_NEMO_EVALUATED",            "NeMo Guardrails secondary safety check passed"],
            ].map(([flag, desc]) => (
              <div key={flag} className="flex gap-3">
                <span className="text-emerald-400 shrink-0 w-64">{flag}</span>
                <span className="text-zinc-600">{desc}</span>
              </div>
            ))}
          </div>

          {/* ── Section: Verification ─────────────────────────────────── */}
          <SectionHeader anchor="verification" label="Example Certificate Response" />
          <p className="text-sm text-zinc-400 mt-4">Full response from <code className="font-mono text-violet-400">GET /api/v1/public/verify/exec_*</code>:</p>
          <CodeBlock code={EXAMPLE_CERT} lang="json" />

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Verify a Certificate Now</h3>
              <p className="text-sm text-zinc-400">Paste any STP execution ID or Merkle leaf hash to verify a real governance certificate.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link
                href="/verify"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:scale-105"
              >
                Verify Certificate →
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/[0.06]"
              >
                Get API Access
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12 bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500">
          <span className="font-bold tracking-tighter text-white">
            StreetMP <span className="text-emerald-400">OS</span>
          </span>
          <div className="flex flex-wrap justify-center gap-8">
            <Link href="/stp"          className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">STP Specification</Link>
            <Link href="/verify"       className="text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">Verify Certificate</Link>
            <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/neutrality"   className="hover:text-white transition-colors">Vendor Neutrality</Link>
            <Link href="/deployment"   className="hover:text-white transition-colors">5-Min Deploy</Link>
            <Link href="/scan"         className="text-rose-400 hover:text-rose-300 transition-colors font-semibold">Risk Scanner</Link>
            <Link href="/login"        className="hover:text-white transition-colors">Console Login</Link>
          </div>
          <span>© 2026 StreetMP. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
