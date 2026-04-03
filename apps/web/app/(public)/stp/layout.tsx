/**
 * @file app/(public)/stp/layout.tsx
 * @description SEO metadata layout for the STP specification page.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StreetMP Trust Protocol (STP) Specification | Developer Docs",
  description:
    "The open, cryptographic standard for AI execution governance. Every AI interaction through StreetMP OS produces a tamper-evident STP certificate — zero prompt content, full Merkle audit trail.",
  openGraph: {
    title: "StreetMP Trust Protocol (STP) | Open Standard",
    description:
      "The SSL/HTTPS of AI governance. Free, open, auditor-readable. Publish your AI compliance posture as a cryptographic fact.",
    url: "https://os.streetmp.com/stp",
    siteName: "StreetMP OS",
  },
};

export default function StpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
