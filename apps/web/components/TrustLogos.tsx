"use client";

// ================================================================
// TRUST LOGOS — Architected for the world's most regulated industries
// ================================================================

const REGULATED_INDUSTRIES = [
  {
    id: "healthcare",
    label: "Healthcare",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Z" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
    badge: "HIPAA",
  },
  {
    id: "finance",
    label: "Finance & Banking",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
    badge: "SOC2",
  },
  {
    id: "government",
    label: "Government",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 22V9l9-7 9 7v13" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
    badge: "FedRAMP",
  },
  {
    id: "legal",
    label: "Legal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 2v6" />
        <path d="M5.2 10H18.8" />
        <path d="M5 10l-2 8h18l-2-8" />
        <path d="M12 2 6 10" />
        <path d="M12 2l6 8" />
      </svg>
    ),
    badge: "GDPR",
  },
];

export function TrustLogos() {
  return (
    <section className="w-full border-t border-b border-white/[0.04] bg-[#070707] py-14 px-6 overflow-hidden">
      <div className="mx-auto max-w-7xl">
        {/* Headline */}
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-10">
          Architected for the world&apos;s most regulated industries
        </p>

        {/* Industry Logo Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {REGULATED_INDUSTRIES.map((industry) => (
            <div
              key={industry.id}
              className="group relative flex flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              {/* Grayscale icon container */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition-colors duration-300 group-hover:text-zinc-200">
                {industry.icon}
              </div>

              {/* Label */}
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-sm font-semibold text-zinc-300 transition-colors duration-300 group-hover:text-white">
                  {industry.label}
                </span>
                {/* Compliance badge */}
                <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 transition-colors duration-300 group-hover:text-zinc-400">
                  {industry.badge}
                </span>
              </div>

              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-t from-white/[0.02] to-transparent" />
            </div>
          ))}
        </div>

        {/* Verified strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {["ISO 27001", "FIPS 140-3", "NIST 800-53", "PCI DSS"].map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
            >
              <span className="h-1 w-1 rounded-full bg-zinc-600" />
              {cert}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TrustLogos;
