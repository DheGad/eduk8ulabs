/**
 * @file app/(public)/privacy/page.tsx
 * @description Privacy Policy — Professional legal page.
 *   Route: /privacy
 *   Phase 4 — Team & Trust Fortress
 *
 * Covers: GDPR, PDPA Singapore, DPDP India (APAC frameworks).
 * Typography: serif headings, optimal line-length, generous whitespace.
 */

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | StreetMP OS",
  description:
    "StreetMP OS Privacy Policy — how we collect, process, and protect your personal data under GDPR, PDPA, and DPDP.",
};

const SECTIONS = [
  {
    id: "overview",
    heading: "1. Overview",
    body: `StreetMP Sdn. Bhd. ("StreetMP", "we", "our") operates the StreetMP OS platform — a sovereign AI execution infrastructure. This Privacy Policy explains what personal data we collect, why we collect it, how it is protected, and the rights you hold as a data subject under applicable law, including the Singapore Personal Data Protection Act 2012 (PDPA), the European Union General Data Protection Regulation (GDPR), and the India Digital Personal Data Protection Act 2023 (DPDP).`,
  },
  {
    id: "data-collected",
    heading: "2. Data We Collect",
    body: `We collect the following categories of personal data:

• **Account Data**: name, email address, hashed password, and role (Client / Engineer / Admin).
• **Usage Data**: API request logs, token consumption metrics, model selections, and execution timestamps. These are retained as part of the immutable V35 Audit Ledger for regulatory compliance.
• **Billing Data**: Stripe Connect account identifiers (partially masked). We do not store raw payment card numbers.
• **Session Data**: JWT session tokens stored server-side; browser cookies contain only non-sensitive session identifiers.
• **Prompt Metadata**: SHA-256 hashes of prompt inputs and outputs. Raw prompt text is never stored — only its cryptographic fingerprint.

We never sell, broker, or rent personal data to third parties.`,
  },
  {
    id: "legal-basis",
    heading: "3. Legal Basis for Processing",
    body: `Under GDPR (Article 6), we process personal data on the following lawful bases:

• **Contract Performance (Art. 6(1)(b))**: Processing required to provide API execution services, issue compliance certificates, and manage billing.
• **Legitimate Interests (Art. 6(1)(f))**: Security monitoring, fraud prevention, and abuse detection.
• **Legal Obligation (Art. 6(1)(c))**: Retaining audit logs as required by MAS TRM, BNM RMiT, and other applicable financial regulations.
• **Consent (Art. 6(1)(a))**: Marketing communications. You may withdraw consent at any time by emailing support@streetmp.com.

For Singapore users, processing is conducted under sections 13–15 of the PDPA. For India users, processing aligns with DPDP Chapter II obligations.`,
  },
  {
    id: "data-retention",
    heading: "4. Data Retention",
    body: `Retention schedules are determined by the compliance framework active on your account:

• **Default (GDPR)**: Audit logs retained for 3 years. Account data retained for the duration of the contract plus 1 year after closure.
• **MAS TRM**: Audit logs retained for 5 years (1,825 days) per MAS TRM §9.4.1.
• **BNM RMiT**: Audit logs retained for 7 years (2,556 days) per BNM RMiT §10.55.

After the applicable retention period, data is cryptographically wiped from all primary and backup storage.`,
  },
  {
    id: "data-security",
    heading: "5. Security Measures",
    body: `StreetMP OS employs enterprise-grade security at every layer:

• **Encryption**: All data is encrypted in transit (TLS 1.3) and at rest (AES-256-GCM).
• **Zero-Knowledge Architecture**: Raw prompt text passes through the V67 DLP Scrubber and is never logged in cleartext. Only SHA-256 hashes are persisted.
• **Hardware Enclave**: Sensitive operations run within AWS Nitro Enclaves — an isolated execution environment with no persistent memory.
• **API Keys**: Stored exclusively as SHA-256 hashes. Plaintext keys are displayed once upon generation and immediately discarded.
• **Access Control**: All internal service communication requires HMAC-signed tokens. Human access to production databases follows a Zero Standing Privilege policy.`,
  },
  {
    id: "your-rights",
    heading: "6. Your Rights",
    body: `Depending on your jurisdiction, you have the following rights regarding your personal data:

• **Access (GDPR Art. 15, PDPA §21)**: Request a copy of all personal data we hold about you.
• **Rectification (GDPR Art. 16, PDPA §22)**: Request correction of inaccurate data.
• **Erasure (GDPR Art. 17, DPDP §11)**: Request deletion of your data. Note: data anchored in the V35 Immutable Audit Ledger cannot be erased due to legal obligations.
• **Portability (GDPR Art. 20)**: Receive your account data in machine-readable format (JSON/CSV).
• **Objection / Withdrawal of Consent**: Object to processing based on legitimate interests, or withdraw marketing consent at any time.

To exercise any right, email **support@streetmp.com** with subject "Data Rights Request — [Your Right]". We will respond within 30 days.`,
  },
  {
    id: "third-parties",
    heading: "7. Third-Party Processors",
    body: `We share personal data only with trusted processors under Data Processing Agreements:

• **Stripe Inc.** (payment processing) — SOC 2 Type II certified.
• **Resend Inc.** (transactional email) — data processed in the EU.
• **Sentry Inc.** (error monitoring) — PII scrubbed before transmission per our Sentry DSN configuration.
• **AWS** (infrastructure) — data residency enforced per your active compliance framework (SG / MY / EU).`,
  },
  {
    id: "contact",
    heading: "8. Contact & DPO",
    body: `For privacy inquiries, data rights requests, or to report a breach:

**StreetMP Sdn. Bhd.**
Unit 3A-01, Menara KL Eco City
Bangsar, 59200 Kuala Lumpur, Malaysia

Email: support@streetmp.com
DPO Email: dpo@streetmp.com (EU/UK GDPR enquiries)

Last updated: 1 April 2026`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0A0A0A]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tighter text-white">StreetMP</span>
            <span className="text-lg font-black tracking-tighter text-emerald-400">OS</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-white/40 hover:text-white transition-colors">Terms</Link>
            <Link href="/legal" className="text-white/40 hover:text-white transition-colors">Legal Shield</Link>
            <Link href="/login" className="rounded-full border border-white/10 px-4 py-1.5 text-white/70 hover:text-white hover:border-white/20 transition-all text-xs font-semibold">Sign In</Link>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-6 pt-28 pb-24">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-6">
            Legal Document
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-3">
            Privacy Policy
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Effective: 1 April 2026 · Governing Law: Singapore · GDPR / PDPA / DPDP compliant
          </p>
          <div className="mt-6 h-px bg-white/[0.06]" />
        </div>

        {/* Body */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-lg font-bold text-white mb-3">{section.heading}</h2>
              <div className="text-white/55 text-sm leading-relaxed space-y-3">
                {section.body.split("\n\n").map((para, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/25">
          <span>© {new Date().getFullYear()} StreetMP Sdn. Bhd. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms of Service</Link>
            <Link href="/legal" className="hover:text-white/50 transition-colors">Legal Shield</Link>
            <Link href="/dashboard" className="hover:text-white/50 transition-colors">Dashboard</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
