/**
 * @component LegalFooter
 * @description Global legal footer for Login, Register, and Dashboard pages.
 *   Phase 4 — Team & Trust Fortress
 *
 * Content: business address, support email, privacy + terms links.
 * Design: dark, minimal, 1-line on desktop — never competes with main UI.
 */

import Link from "next/link";
import React from "react";

interface LegalFooterProps {
  /** Lighten the background variant (auth pages vs dashboard) */
  variant?: "auth" | "dashboard";
}

export function LegalFooter({ variant = "auth" }: LegalFooterProps) {
  const year = new Date().getFullYear();

  const base =
    variant === "dashboard"
      ? "border-t border-white/[0.04] bg-transparent"
      : "border-t border-white/[0.06] bg-[#080808]";

  return (
    <footer className={`${base} px-6 py-4`} aria-label="Legal footer">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/25 font-medium">
        {/* Left: branding + address */}
        <span className="text-center sm:text-left leading-relaxed">
          © {year} StreetMP Sdn. Bhd. · Unit 3A-01, Menara KL Eco City, Bangsar, 59200 Kuala Lumpur, Malaysia
        </span>

        {/* Right: links + email */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <a
            href="mailto:support@streetmp.com"
            className="hover:text-white/60 transition-colors"
          >
            support@streetmp.com
          </a>
          <Link href="/privacy" className="hover:text-white/60 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white/60 transition-colors">
            Terms of Service
          </Link>
          <Link href="/legal" className="hover:text-white/60 transition-colors">
            Legal Shield
          </Link>
        </div>
      </div>
    </footer>
  );
}
