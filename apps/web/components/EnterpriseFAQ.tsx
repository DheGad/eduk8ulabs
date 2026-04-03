"use client";

import { useState } from "react";

// ================================================================
// ENTERPRISE FAQ — Accordion
// ================================================================

const FAQ_ITEMS = [
  {
    id: "data-training",
    question: "Is my data used to train models?",
    answer:
      "Never. StreetMP OS acts as a local proxy that sanitizes data before egress. Your inputs are tokenized, redacted, and stripped of identifiable content before any AI interaction occurs. The raw data — your prompts, proprietary content, PII — never reaches a model's training pipeline. Zero retention. Mathematically guaranteed.",
    badge: "Data Sovereignty",
    badgeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    accentColor: "border-emerald-500/30",
    iconColor: "text-emerald-400",
  },
  {
    id: "compliance-proof",
    question: "How do we prove compliance?",
    answer:
      "Every transaction generates a cryptographic Merkle-hash in your immutable audit logs. Each entry is SHA-256 chained to the previous record — creating a tamper-evident ledger that cannot be altered without breaking the chain. These logs are exportable as a signed PDF Legal Exhibit or structured JSON for your auditors, legal team, or regulators. Perfect for SOC2, HIPAA, and GDPR compliance reviews.",
    badge: "Immutable Audit",
    badgeColor: "text-violet-400 border-violet-500/30 bg-violet-500/10",
    accentColor: "border-violet-500/30",
    iconColor: "text-violet-400",
  },
  {
    id: "deployment",
    question: "Where does StreetMP OS run?",
    answer:
      "StreetMP OS deploys as a sovereign proxy within your own infrastructure — your cloud, your VPC, your on-premise environment. We do not operate a shared multi-tenant layer that touches your data. Your security perimeter never expands. Optionally, we offer isolated sovereign enclaves for organizations that need zero-infrastructure overhead.",
    badge: "Infrastructure",
    badgeColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    accentColor: "border-amber-500/30",
    iconColor: "text-amber-400",
  },
  {
    id: "integration",
    question: "How long does enterprise deployment take?",
    answer:
      "Under 15 minutes for standard deployments via our Docker-native SDK. For enterprise SAML/SSO, custom policy engines, and dedicated node configuration, our white-glove team completes full onboarding in under 48 hours. No vendor lock-in. No code changes required. We inject into your existing AI workflow transparently.",
    badge: "Deployment",
    badgeColor: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    accentColor: "border-sky-500/30",
    iconColor: "text-sky-400",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function EnterpriseFAQ() {
  const [openId, setOpenId] = useState<string | null>("data-training");

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <section className="w-full py-24 px-6 border-t border-white/[0.04] bg-[#0A0A0A]">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-emerald-500 tracking-[0.3em] uppercase mb-4">
            Trust & Compliance
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
            Enterprise Security, Answered.
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            The questions your legal team, CISO, and auditors will ask — with cryptographic proof to back every answer.
          </p>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? `${item.accentColor} bg-white/[0.03]`
                    : "border-white/[0.08] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.025]"
                }`}
              >
                {/* Question row */}
                <button
                  id={`faq-btn-${item.id}`}
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen ? "true" : "false"}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left group"
                >
                  <div className="flex items-center gap-4">
                    {/* Badge */}
                    <span
                      className={`hidden sm:inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                    <span className="text-base font-semibold text-white leading-snug">
                      {item.question}
                    </span>
                  </div>
                  <span className={`shrink-0 transition-colors duration-200 ${isOpen ? item.iconColor : "text-zinc-500 group-hover:text-zinc-300"}`}>
                    <ChevronIcon open={isOpen} />
                  </span>
                </button>

                {/* Answer panel */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-6 pt-0">
                      {/* Divider */}
                      <div className={`h-px mb-4 ${isOpen ? `bg-gradient-to-r from-transparent via-white/[0.08] to-transparent` : ""}`} />
                      <p className="text-[15px] text-zinc-400 leading-relaxed font-medium">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:bg-zinc-200 hover:scale-[1.02] shadow-lg"
          >
            Request Security Whitepaper →
          </a>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/[0.06]"
          >
            View Compliance Tiers
          </a>
        </div>
      </div>
    </section>
  );
}

export default EnterpriseFAQ;
