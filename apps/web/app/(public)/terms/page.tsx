/**
 * @file app/(public)/terms/page.tsx
 * @description Terms of Service — Professional legal page.
 *   Route: /terms
 *   Phase 4 — Team & Trust Fortress
 *
 * Covers: acceptable use, liability cap, SLA, governing law (Singapore).
 */

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | StreetMP OS",
  description:
    "StreetMP OS Terms of Service — acceptable use, SLA, liability limitations, and governing law.",
};

const SECTIONS = [
  {
    id: "acceptance",
    heading: "1. Acceptance of Terms",
    body: `By creating an account or accessing the StreetMP OS platform ("Platform"), you ("User", "Customer") agree to be bound by these Terms of Service ("Terms") and our Privacy Policy, which is incorporated herein by reference.

If you are accepting these Terms on behalf of a company or legal entity, you represent that you have the authority to bind that entity to these Terms. If you do not agree to these Terms, you may not access or use the Platform.`,
  },
  {
    id: "services",
    heading: "2. Description of Services",
    body: `StreetMP OS provides a sovereign AI execution infrastructure including:

• **AI Workspace**: Encrypted, zero-knowledge AI chat sessions routed through V71 Prompt Firewall.
• **Compliance Engine**: Automated DLP scrubbing, V35 Merkle-anchored audit logs, and regulatory certificate generation.
• **API Gateway**: OpenAI-compatible REST API with V12 Policy enforcement and V25 Trust Scoring.
• **Marketplace**: A curated store of verified AI compliance plugins.
• **Team Collaboration**: Multi-user workspace with RBAC role assignments.

Services are provided "as available" and may be modified at any time with reasonable notice.`,
  },
  {
    id: "acceptable-use",
    heading: "3. Acceptable Use Policy",
    body: `You agree not to use the Platform to:

• Generate, distribute, or facilitate content that is illegal, harmful, fraudulent, or violates any third-party rights.
• Attempt to circumvent, disable, or interfere with the V71 Prompt Firewall, V81 NeMo Guardrails, or any other security controls.
• Reverse-engineer, decompile, or disassemble any portion of the Platform.
• Use the Platform to train competing AI models without explicit written consent.
• Exceed API rate limits or engage in denial-of-service attacks.
• Introduce malicious code, viruses, or any software designed to disrupt Platform operation.

Violation of this policy will result in immediate account suspension and may result in legal action.`,
  },
  {
    id: "accounts",
    heading: "4. Account Registration & Security",
    body: `You are responsible for maintaining the confidentiality of your API keys and credentials. StreetMP API keys are displayed exactly once upon generation and stored only as SHA-256 hashes — we cannot recover plaintext keys.

You agree to notify support@streetmp.com immediately of any unauthorised access or security breach. StreetMP is not liable for loss or damage arising from your failure to maintain credential security.`,
  },
  {
    id: "payment",
    heading: "5. Billing & Payment",
    body: `Subscription fees are billed monthly or annually in advance. Usage-based charges (token consumption, escrow fees) are billed in arrears. All fees are exclusive of applicable taxes.

Invoices are generated automatically and delivered via email. Payments are processed by Stripe Inc. StreetMP does not store payment card data.

If payment fails, access to the Platform may be suspended after a 7-day grace period. Disputed charges must be raised within 30 days of invoice date.`,
  },
  {
    id: "ip",
    heading: "6. Intellectual Property",
    body: `StreetMP retains all intellectual property rights in the Platform, including the V35 Audit Ledger technology, V12 Policy Engine, and all associated documentation.

Customer Data (prompts, outputs, and uploaded content) remains the intellectual property of the Customer. By using the Platform, you grant StreetMP a limited, non-exclusive licence to process Customer Data solely for the purpose of providing the Services.

You may not reproduce, distribute, or create derivative works of the Platform without express written permission.`,
  },
  {
    id: "limitation",
    heading: "7. Limitation of Liability",
    body: `To the maximum extent permitted by applicable law:

• StreetMP's total cumulative liability to you for any claims arising out of or related to these Terms or the Services shall not exceed the greater of (a) the fees paid by you in the 12 months preceding the claim, or (b) SGD 500.

• StreetMP is not liable for any indirect, incidental, consequential, special, or exemplary damages, including loss of revenue, loss of data, or loss of business — even if advised of the possibility of such damages.

• AI-generated outputs constitute guidance only and are not legal, financial, or medical advice. The Customer assumes sole responsibility for decisions made on the basis of AI outputs.`,
  },
  {
    id: "sla",
    heading: "8. Service Level Agreement",
    body: `StreetMP targets 99.5% monthly uptime for the API Gateway and Dashboard. Scheduled maintenance windows (maximum 4 hours/month) are excluded from uptime calculations.

In the event of SLA breach, Customers on paid plans may request service credits proportional to the downtime duration. Credits are applied to the next invoice and are the sole remedy for uptime-related claims.`,
  },
  {
    id: "termination",
    heading: "9. Termination",
    body: `Either party may terminate the agreement with 30 days' written notice. StreetMP may terminate immediately if you breach these Terms or engage in conduct that poses a security risk to other Users or the Platform.

Upon termination: (a) your access to the Platform is revoked; (b) Customer Data is retained for the period required by your active compliance framework, then cryptographically wiped; (c) outstanding invoices become immediately due.`,
  },
  {
    id: "governing-law",
    heading: "10. Governing Law & Dispute Resolution",
    body: `These Terms are governed by and construed in accordance with the laws of the Republic of Singapore, without regard to conflict of law principles.

Any dispute arising from these Terms shall first be submitted to mediation under the Singapore Mediation Centre Rules. If mediation fails, disputes shall be resolved by binding arbitration under the Singapore International Arbitration Centre (SIAC) Rules.

Both parties waive the right to a jury trial and class action proceedings to the maximum extent permitted by applicable law.`,
  },
  {
    id: "contact",
    heading: "11. Contact",
    body: `For legal notices or queries regarding these Terms:

**StreetMP Sdn. Bhd.**
Unit 3A-01, Menara KL Eco City
Bangsar, 59200 Kuala Lumpur, Malaysia

Email: support@streetmp.com
Legal: legal@streetmp.com

Last updated: 1 April 2026`,
  },
];

export default function TermsPage() {
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
            <Link href="/privacy" className="text-white/40 hover:text-white transition-colors">Privacy</Link>
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
            Terms of Service
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Effective: 1 April 2026 · Governing Law: Singapore · SIAC Arbitration
          </p>
          <div className="mt-6 h-px bg-white/[0.06]" />
        </div>

        {/* Body */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-lg font-bold text-white mb-3">{section.heading}</h2>
              <div className="text-white/55 text-sm leading-relaxed">
                {section.body.split("\n\n").map((para, i) => (
                  <p key={i} className="whitespace-pre-line mb-3">
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
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
            <Link href="/legal" className="hover:text-white/50 transition-colors">Legal Shield</Link>
            <Link href="/dashboard" className="hover:text-white/50 transition-colors">Dashboard</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
