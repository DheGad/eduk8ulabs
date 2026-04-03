"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/security/dlp
 * @version V51
 * @description Data Loss Prevention — Live Redaction Matrix
 *
 * Shows real-time PII tokenization: raw prompt → scrubbed payload → AI response → restored.
 * Aesthetic: Obsidian & Emerald (bg-black, border-white/10, text-emerald-400).
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS
 */

// ================================================================
// TYPES
// ================================================================

type PIICategory = "SSN" | "CREDIT_CARD" | "EMAIL" | "PHONE" | "MEDICAL_ID" | "DOB" | "FULL_NAME" | "ADDRESS" | "IP_ADDRESS";

interface PIIDetection {
  original: string;
  token: string;
  category: PIICategory;
}

interface RedactionEvent {
  id: number;
  ts: string;
  rawPrompt: string;
  sanitized: string;
  detections: PIIDetection[];
  latencyMs: number;
  compliance: string[];
}

// ================================================================
// MOCK DATA — realistic raw prompts with embedded PII
// ================================================================

const MOCK_SCENARIOS: { raw: string; detections: PIIDetection[]; compliance: string[] }[] = [
  {
    raw: "Patient Dr. Sarah Mitchell, DOB: 04/12/1982, SSN 521-83-4921 needs prescription review. MRN: 8830421. Contact: s.mitchell@email.com, (415) 883-2901.",
    detections: [
      { original: "Sarah Mitchell", token: "[STREETMP_SECURE_FULL_NAME_01]", category: "FULL_NAME" },
      { original: "04/12/1982", token: "[STREETMP_SECURE_DOB_01]", category: "DOB" },
      { original: "521-83-4921", token: "[STREETMP_SECURE_SSN_01]", category: "SSN" },
      { original: "8830421", token: "[STREETMP_SECURE_MEDICAL_ID_01]", category: "MEDICAL_ID" },
      { original: "s.mitchell@email.com", token: "[STREETMP_SECURE_EMAIL_01]", category: "EMAIL" },
      { original: "(415) 883-2901", token: "[STREETMP_SECURE_PHONE_01]", category: "PHONE" },
    ],
    compliance: ["HIPAA", "GDPR"],
  },
  {
    raw: "Process refund for Client James Okafor. Card: 4532 1234 5678 9010, billing address 742 Evergreen Terrace, Springfield. Email: james.o@corporate.io, IP: 192.168.1.42.",
    detections: [
      { original: "James Okafor", token: "[STREETMP_SECURE_FULL_NAME_01]", category: "FULL_NAME" },
      { original: "4532 1234 5678 9010", token: "[STREETMP_SECURE_CREDIT_CARD_01]", category: "CREDIT_CARD" },
      { original: "742 Evergreen Terrace, Springfield", token: "[STREETMP_SECURE_ADDRESS_01]", category: "ADDRESS" },
      { original: "james.o@corporate.io", token: "[STREETMP_SECURE_EMAIL_01]", category: "EMAIL" },
      { original: "192.168.1.42", token: "[STREETMP_SECURE_IP_ADDRESS_01]", category: "IP_ADDRESS" },
    ],
    compliance: ["PCI-DSS", "GDPR"],
  },
  {
    raw: "Employee Mr. Kevin Torres, SSN 899-22-7741, DOB: 11/03/1975. Direct deposit to Visa 5421 8800 3311 4490. HR contact: k.torres@acmecorp.com, +1 (628) 200-1133.",
    detections: [
      { original: "Kevin Torres", token: "[STREETMP_SECURE_FULL_NAME_01]", category: "FULL_NAME" },
      { original: "899-22-7741", token: "[STREETMP_SECURE_SSN_01]", category: "SSN" },
      { original: "11/03/1975", token: "[STREETMP_SECURE_DOB_01]", category: "DOB" },
      { original: "5421 8800 3311 4490", token: "[STREETMP_SECURE_CREDIT_CARD_01]", category: "CREDIT_CARD" },
      { original: "k.torres@acmecorp.com", token: "[STREETMP_SECURE_EMAIL_01]", category: "EMAIL" },
      { original: "+1 (628) 200-1133", token: "[STREETMP_SECURE_PHONE_01]", category: "PHONE" },
    ],
    compliance: ["HIPAA", "PCI-DSS", "GDPR"],
  },
  {
    raw: "Generate contract for Ms. Priya Sharma, 98 Ocean Drive Suite 400. Signed docs to priya.sharma@lawfirm.net. IBAN: 4111 1111 1111 1111. DOB: 22/07/1990.",
    detections: [
      { original: "Priya Sharma", token: "[STREETMP_SECURE_FULL_NAME_01]", category: "FULL_NAME" },
      { original: "98 Ocean Drive Suite 400", token: "[STREETMP_SECURE_ADDRESS_01]", category: "ADDRESS" },
      { original: "priya.sharma@lawfirm.net", token: "[STREETMP_SECURE_EMAIL_01]", category: "EMAIL" },
      { original: "4111 1111 1111 1111", token: "[STREETMP_SECURE_CREDIT_CARD_01]", category: "CREDIT_CARD" },
      { original: "22/07/1990", token: "[STREETMP_SECURE_DOB_01]", category: "DOB" },
    ],
    compliance: ["GDPR", "PCI-DSS"],
  },
];

const CATEGORY_COLORS: Record<PIICategory, { bg: string; text: string; border: string; label: string }> = {
  SSN: { bg: "rgba(239,68,68,0.12)", text: "rgb(252,165,165)", border: "rgba(239,68,68,0.3)", label: "SSN" },
  CREDIT_CARD: { bg: "rgba(245,158,11,0.12)", text: "rgb(253,211,77)", border: "rgba(245,158,11,0.35)", label: "CARD" },
  EMAIL: { bg: "rgba(59,130,246,0.12)", text: "rgb(147,197,253)", border: "rgba(59,130,246,0.3)", label: "EMAIL" },
  PHONE: { bg: "rgba(139,92,246,0.12)", text: "rgb(196,181,253)", border: "rgba(139,92,246,0.3)", label: "PHONE" },
  MEDICAL_ID: { bg: "rgba(236,72,153,0.12)", text: "rgb(249,168,212)", border: "rgba(236,72,153,0.3)", label: "MEDICAL" },
  DOB: { bg: "rgba(20,184,166,0.12)", text: "rgb(94,234,212)", border: "rgba(20,184,166,0.3)", label: "DOB" },
  FULL_NAME: { bg: "rgba(16,185,129,0.10)", text: "rgb(110,231,183)", border: "rgba(16,185,129,0.3)", label: "NAME" },
  ADDRESS: { bg: "rgba(234,179,8,0.10)", text: "rgb(253,224,71)", border: "rgba(234,179,8,0.3)", label: "ADDRESS" },
  IP_ADDRESS: { bg: "rgba(100,116,139,0.12)", text: "rgb(203,213,225)", border: "rgba(100,116,139,0.3)", label: "IP" },
};

function nowTime(): string {
  return new Date().toISOString().replace("T", " ").slice(11, 23);
}

// ================================================================
// HIGHLIGHT — marks PII tokens in sanitized text with emerald glow
// ================================================================

function HighlightedText({ text, detections, mode }: { text: string; detections: PIIDetection[]; mode: "raw" | "sanitized" }) {
  if (mode === "raw") {
    // Highlight original PII in raw text
    let parts: { text: string; category?: PIICategory }[] = [{ text }];
    for (const d of detections) {
      parts = parts.flatMap((p) => {
        if (p.category) return [p];
        const idx = p.text.indexOf(d.original);
        if (idx === -1) return [p];
        return [
          { text: p.text.slice(0, idx) },
          { text: d.original, category: d.category },
          { text: p.text.slice(idx + d.original.length) },
        ].filter((x) => x.text);
      });
    }
    return (
      <span>
        {parts.map((p, i) =>
          p.category ? (
            <span
              key={i}
              className="rounded px-0.5 font-semibold"
              style={{
                background: CATEGORY_COLORS[p.category]?.bg,
                color: CATEGORY_COLORS[p.category]?.text,
                border: `1px solid ${CATEGORY_COLORS[p.category]?.border}`,
              }}
            >
              {p.text}
            </span>
          ) : (
            <span key={i} className="text-zinc-400">{p.text}</span>
          )
        )}
      </span>
    );
  }

  // Sanitized — highlight tokens in emerald
  let sanitizedParts: { text: string; isToken: boolean; category?: PIICategory }[] = [{ text, isToken: false }];
  for (const d of detections) {
    sanitizedParts = sanitizedParts.flatMap((p) => {
      if (p.isToken) return [p];
      const idx = p.text.indexOf(d.token);
      if (idx === -1) return [p];
      return [
        { text: p.text.slice(0, idx), isToken: false },
        { text: d.token, isToken: true, category: d.category },
        { text: p.text.slice(idx + d.token.length), isToken: false },
      ].filter((x) => x.text);
    });
  }

  return (
    <span>
      {sanitizedParts.map((p, i) =>
        p.isToken ? (
          <span
            key={i}
            className="rounded px-0.5 font-mono font-bold text-[9px]"
            style={{
              background: "rgba(16,185,129,0.12)",
              color: "rgb(52,211,153)",
              border: "1px solid rgba(16,185,129,0.3)",
              boxShadow: "0 0 6px rgba(16,185,129,0.2)",
            }}
          >
            {p.text}
          </span>
        ) : (
          <span key={i} className="text-zinc-400">{p.text}</span>
        )
      )}
    </span>
  );
}

// Build the sanitized text from raw + detections
function buildSanitized(raw: string, detections: PIIDetection[]): string {
  let out = raw;
  for (const d of detections) {
    out = out.replace(d.original, d.token);
  }
  return out;
}

// ================================================================
// COMPLIANCE BADGE
// ================================================================

function ComplianceBadge({ label }: { label: string }) {
  const style: Record<string, { bg: string; text: string; border: string }> = {
    HIPAA: { bg: "rgba(16,185,129,0.1)", text: "rgb(52,211,153)", border: "rgba(16,185,129,0.3)" },
    "PCI-DSS": { bg: "rgba(245,158,11,0.1)", text: "rgb(253,211,77)", border: "rgba(245,158,11,0.3)" },
    GDPR: { bg: "rgba(139,92,246,0.1)", text: "rgb(196,181,253)", border: "rgba(139,92,246,0.3)" },
  };
  const s = style[label] ?? { bg: "rgba(255,255,255,0.05)", text: "rgb(161,161,170)", border: "rgba(255,255,255,0.1)" };
  return (
    <span
      className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {label}
    </span>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function DLPPage() {
  const [mounted, setMounted] = useState(false);
  const [activeScenario, setActiveScenario] = useState(0);
  const [events, setEvents] = useState<RedactionEvent[]>([]);
  const [piiMasked, setPiiMasked] = useState(8402);
  const [violationsPrevented, setViolationsPrevented] = useState(142);
  const [latencyMs, setLatencyMs] = useState(12);
  const [scanLine, setScanLine] = useState(false);
  const eventId = useRef(0);

  useEffect(() => {
    setMounted(true);

    // Seed with first scenario immediately
    const first = MOCK_SCENARIOS[0]!;
    setEvents([{
      id: eventId.current++,
      ts: nowTime(),
      rawPrompt: first.raw,
      sanitized: buildSanitized(first.raw, first.detections),
      detections: first.detections,
      latencyMs: 11,
      compliance: first.compliance,
    }]);
  }, []);

  // Cycle through scenarios
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      const nextIdx = (activeScenario + 1) % MOCK_SCENARIOS.length;
      const scenario = MOCK_SCENARIOS[nextIdx]!;
      const lat = 8 + Math.floor(Math.random() * 10);

      setScanLine(true);
      setTimeout(() => setScanLine(false), 600);
      setActiveScenario(nextIdx);

      const newEvent: RedactionEvent = {
        id: eventId.current++,
        ts: nowTime(),
        rawPrompt: scenario.raw,
        sanitized: buildSanitized(scenario.raw, scenario.detections),
        detections: scenario.detections,
        latencyMs: lat,
        compliance: scenario.compliance,
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 6));
      setPiiMasked((n) => n + scenario.detections.length);
      setViolationsPrevented((n) => n + 1);
      setLatencyMs(lat);
    }, 4500);

    return () => clearInterval(interval);
  }, [mounted, activeScenario]);

  const current = MOCK_SCENARIOS[activeScenario];
  if (!mounted || !current) return null;

  const sanitizedText = buildSanitized(current.raw, current.detections);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "rgb(52,211,153)" }}
              >
                V51
              </span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
                Data Loss Prevention
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Live <span className="text-emerald-400">Redaction Matrix</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Bi-directional PII tokenization. Prompts are scrubbed before reaching any external LLM.
              Responses are restored transparently. HIPAA · PCI-DSS · GDPR compliant.
            </p>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-6 lg:gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "PII Entities Masked", value: piiMasked.toLocaleString(), cls: "text-emerald-400" },
              { label: "Violations Prevented", value: String(violationsPrevented), cls: "text-red-400" },
              { label: "Tokenization Latency", value: `${latencyMs}ms`, cls: "text-zinc-300 font-mono" },
              { label: "Active Contexts", value: "4", cls: "text-zinc-300" },
            ].map(({ label, value, cls }, i) => (
              <div key={i} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black uppercase tracking-wide ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div className="p-8 space-y-6">

        {/* ── LIVE REDACTION PANEL ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* RAW — left panel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black text-red-400 tracking-widest uppercase">
                  Raw Prompt · PII EXPOSED
                </span>
              </div>
              <span className="text-[8px] text-zinc-600 font-mono">pre-tokenization</span>
            </div>
            <div className="p-5 min-h-[140px] relative">
              {scanLine && (
                <div
                  className="absolute left-0 top-0 w-full h-0.5 animate-pulse"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)" }}
                />
              )}
              <p className="text-sm leading-relaxed">
                <HighlightedText text={current.raw} detections={current.detections} mode="raw" />
              </p>
            </div>
          </div>

          {/* SANITIZED — right panel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase">
                  Tokenized Payload · PII REDACTED
                </span>
              </div>
              <span className="text-[8px] text-zinc-600 font-mono">safe for external LLM</span>
            </div>
            <div className="p-5 min-h-[140px] relative">
              {scanLine && (
                <div
                  className="absolute left-0 top-0 w-full h-0.5 animate-pulse"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)" }}
                />
              )}
              <p className="text-sm leading-relaxed">
                <HighlightedText text={sanitizedText} detections={current.detections} mode="sanitized" />
              </p>
            </div>
          </div>
        </div>

        {/* ── DETECTIONS + PIPELINE STATUS ─────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Detected entities */}
          <div
            className="xl:col-span-1 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                Detected PII Entities — Current Request
              </p>
            </div>
            <div className="p-4 space-y-2">
              {current.detections.map((d, i) => {
                const c = CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.EMAIL;
                return (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest"
                        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                      >
                        {c.label}
                      </span>
                      <span className="text-[8px] text-zinc-600 font-mono">Entity {i + 1}</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-mono truncate line-through">{d.original}</p>
                    <p
                      className="text-[9px] font-mono font-bold truncate mt-0.5"
                      style={{ color: "rgb(52,211,153)" }}
                    >
                      {d.token}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event log + compliance */}
          <div className="xl:col-span-2 space-y-4">

            {/* Compliance badges */}
            <div
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}
            >
              <span className="text-xl">🛡️</span>
              <div className="flex-1">
                <p className="text-xs font-black text-emerald-400 tracking-wide mb-1">COMPLIANCE FRAMEWORKS ACTIVE</p>
                <div className="flex flex-wrap gap-1.5">
                  {current.compliance.map((c) => <ComplianceBadge key={c} label={c} />)}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Entities Masked</p>
                <p className="text-lg font-black text-emerald-400 font-mono">{current.detections.length}</p>
              </div>
            </div>

            {/* Pipeline injection banner */}
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
                Proxy Pipeline — V51 Injection Points
              </p>
              <div className="flex items-center gap-0 text-[9px] font-mono flex-wrap gap-y-2">
                {[
                  { label: "V49 Attestation", active: true },
                  { label: "→", active: false, arrow: true },
                  { label: "V50 IAM", active: true },
                  { label: "→", active: false, arrow: true },
                  { label: "V51 DLP.tokenize()", active: true, highlight: true },
                  { label: "→", active: false, arrow: true },
                  { label: "V48 BFT", active: true },
                  { label: "→", active: false, arrow: true },
                  { label: "LLM", active: true },
                  { label: "→", active: false, arrow: true },
                  { label: "V51 DLP.detokenize()", active: true, highlight: true },
                  { label: "→", active: false, arrow: true },
                  { label: "Client", active: true },
                ].map((step, i) =>
                  step.arrow ? (
                    <span key={i} className="text-zinc-700 mx-1">›</span>
                  ) : (
                    <span
                      key={i}
                      className="px-2 py-1 rounded font-bold"
                      style={{
                        background: step.highlight ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                        border: step.highlight ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                        color: step.highlight ? "rgb(52,211,153)" : "rgb(113,113,122)",
                      }}
                    >
                      {step.label}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Recent redaction events */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Recent Redaction Events</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] text-emerald-500 font-mono">LIVE</span>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {events.map((evt) => (
                  <div key={evt.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-zinc-700 font-mono text-[9px] flex-shrink-0 mt-0.5">{evt.ts}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-zinc-400 truncate">{evt.rawPrompt.slice(0, 65)}…</p>
                      <div className="flex items-center gap-2 mt-1">
                        {evt.compliance.map((c) => <ComplianceBadge key={c} label={c} />)}
                        <span className="text-[8px] text-zinc-600 font-mono">{evt.latencyMs}ms</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] font-black text-emerald-400">{evt.detections.length} masked</p>
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
