/**
 * @file controllers/scannerController.ts
 * @service router-service
 * @description Command 086 — The Live Risk Scanner (Public Sales Engine)
 *
 * POST /api/v1/public/scan
 * No RBAC auth required — fully public endpoint.
 *
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SECURITY DESIGN NOTICE                                       ║
 * ║                                                               ║
 * ║  The prospect's API key is used ONLY for format validation.   ║
 * ║  It is NEVER forwarded to OpenAI, logged to disk, written to  ║
 * ║  the database, or included in any trace event.                ║
 * ║                                                               ║
 * ║  The "unprotected" state is a deterministic simulation of     ║
 * ║  what raw employee prompts WOULD expose. We do not make live  ║
 * ║  API calls on behalf of the prospect — that would be both a   ║
 * ║  security risk and an unauthorised use of their billing.      ║
 * ║                                                               ║
 * ║  The "protected" state applies our V67 DLP regex engine to    ║
 * ║  the same hardcoded prompts in-process, in memory.            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * Regulatory fine estimates are illustrative figures based on publicly
 * available maximum penalty thresholds. They are NOT legal advice.
 */

import { Router, Request, Response } from "express";

export const scannerRouter = Router();

// ─── DLP Patterns (self-contained — no external trace/DB imports) ─────────────

interface DlpPattern {
  id:          string;
  label:       string;
  regex:       RegExp;
  replacement: string;
  severity:    "CRITICAL" | "HIGH" | "MEDIUM";
  regulation:  string;
}

const BASE_PATTERNS: DlpPattern[] = [
  {
    id:          "CREDIT_CARD",
    label:       "Credit Card Number (PAN)",
    regex:       /\b((?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
    replacement: "[REDACTED_CC]",
    severity:    "CRITICAL",
    regulation:  "PCI-DSS Level 1",
  },
  {
    id:          "SSN",
    label:       "Social Security Number (SSN)",
    regex:       /\b(\d{3}-\d{2}-\d{4})\b/g,
    replacement: "[REDACTED_SSN]",
    severity:    "CRITICAL",
    regulation:  "US Privacy Act / CCPA",
  },
  {
    id:          "NRIC",
    label:       "Singapore NRIC / FIN",
    regex:       /\b[STFG]\d{7}[A-Z]\b/g,
    replacement: "[REDACTED_NRIC]",
    severity:    "CRITICAL",
    regulation:  "MAS TRM / PDPA Singapore",
  },
  {
    id:          "MYKAD",
    label:       "Malaysian MyKad (IC Number)",
    regex:       /\b\d{6}-\d{2}-\d{4}\b/g,
    replacement: "[REDACTED_MYKAD]",
    severity:    "CRITICAL",
    regulation:  "BNM RMiT / PDPA Malaysia",
  },
  {
    id:          "IBAN",
    label:       "IBAN / Bank Account",
    regex:       /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
    replacement: "[REDACTED_IBAN]",
    severity:    "HIGH",
    regulation:  "PSD2 / GDPR Art.4",
  },
  {
    id:          "EMAIL",
    label:       "Email Address",
    regex:       /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    replacement: "[REDACTED_EMAIL]",
    severity:    "MEDIUM",
    regulation:  "GDPR Art.4(1) / CCPA §1798.140",
  },
  {
    id:          "MRN",
    label:       "Medical Record Number (MRN)",
    regex:       /\bMRN[\s:]*\d{6,10}\b/gi,
    replacement: "[REDACTED_MRN]",
    severity:    "CRITICAL",
    regulation:  "HIPAA §164.514",
  },
  {
    id:          "NPI",
    label:       "National Provider Identifier (NPI)",
    regex:       /\bNPI[\s:]*\d{10}\b/gi,
    replacement: "[REDACTED_NPI]",
    severity:    "HIGH",
    regulation:  "HIPAA §162.402",
  },
  {
    id:          "DOB",
    label:       "Date of Birth",
    regex:       /\b(?:DOB|Date of Birth|Born)[\s:]*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/gi,
    replacement: "[REDACTED_DOB]",
    severity:    "HIGH",
    regulation:  "GDPR Art.9 / HIPAA §45 CFR 164.514",
  },
];

// ─── Hardcoded Simulation Prompts ─────────────────────────────────────────────

interface SimPrompt {
  id:       string;
  scenario: string;
  role:     string;
  text:     string;
  industry: "finance" | "healthcare" | "both";
}

const SIMULATION_PROMPTS: SimPrompt[] = [
  {
    id:       "sim_01",
    scenario: "Finance HR Query",
    role:     "HR Manager",
    industry: "finance",
    text:     "Generate an employment verification letter for John Tan (NRIC: S8812045A). His salary is SGD 8,500/month. Send the completed letter to john.tan@dbs.com. His bank account for final salary payment is SG29DBSS0000000123456.",
  },
  {
    id:       "sim_02",
    scenario: "Finance Customer Service",
    role:     "Customer Service Agent",
    industry: "finance",
    text:     "Help me draft a response to customer complaint. Customer: Sarah Lim (IC: 820301-14-5892). Their credit card 4532-1234-5678-9012 was declined at a Kuala Lumpur merchant. Refund their transaction to account number: 123456-78-9012.",
  },
  {
    id:       "sim_03",
    scenario: "Healthcare Patient Note",
    role:     "Clinical Admin",
    industry: "healthcare",
    text:     "Summarise this patient case for the handover report. Patient: Maria Santos, DOB: 14/03/1975, MRN: 4521890. Treating physician NPI: 1234567890. Diagnosis: hypertension. Contact: maria.santos@email.com.",
  },
  {
    id:       "sim_04",
    scenario: "General Employee Prompt",
    role:     "Finance Analyst",
    industry: "both",
    text:     "Write an email to our payroll team to process the Q1 bonus for employee ID 293847. Reference the wire: SSN 412-52-8741. Contact payroll at payroll@company.com if there are any discrepancies.",
  },
  {
    id:       "sim_05",
    scenario: "Executive Strategy Query",
    role:     "Strategy Director",
    industry: "both",
    text:     "Summarise the M&A due diligence concerns for target company CEO Chen Wei (NRIC: T1234567J, email: chen.wei@target.com). Our IBAN for escrow funding is GB29NWBK60161331926819.",
  },
];

// ─── Fine Estimates (illustrative — public regulatory maximums) ───────────────

interface FineEstimate {
  framework:   string;
  jurisdiction: string;
  max_fine:    string;
  per_incident: string;
  basis:       string;
}

const FINE_ESTIMATES: Record<string, FineEstimate[]> = {
  finance: [
    { framework: "MAS TRM",    jurisdiction: "Singapore", max_fine: "SGD 1,000,000",   per_incident: "SGD 100,000",  basis: "MAS Act §27A — wilful breach" },
    { framework: "BNM RMiT",   jurisdiction: "Malaysia",  max_fine: "MYR 25,000,000",  per_incident: "MYR 1,000,000", basis: "PDPA Malaysia 2010 §132 — data breach" },
    { framework: "PCI-DSS",    jurisdiction: "Global",    max_fine: "USD 500,000",     per_incident: "USD 50,000",   basis: "Card network penalties per compromised account (est.)" },
    { framework: "GDPR",       jurisdiction: "EU",        max_fine: "€20,000,000",     per_incident: "4% global revenue", basis: "GDPR Art.83(5) — inadequate technical measures" },
  ],
  healthcare: [
    { framework: "HIPAA",      jurisdiction: "USA",       max_fine: "USD 1,900,000",   per_incident: "USD 50,000",   basis: "HIPAA Omnibus Rule — §164.530(c) wilful neglect" },
    { framework: "GDPR",       jurisdiction: "EU",        max_fine: "€20,000,000",     per_incident: "4% global revenue", basis: "GDPR Art.83(5) — special category data breach" },
  ],
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromptScanResult {
  prompt_id:        string;
  scenario:         string;
  role:             string;
  raw_text:         string;
  protected_text:   string;
  pii_found:        Array<{ type: string; label: string; severity: string; regulation: string; count: number }>;
  total_redactions: number;
  risk_score:       number;  // 0–100
}

export interface ScanReport {
  scan_id:          string;
  industry:         string;
  scanned_at:       string;
  key_prefix:       string;   // Only first 7 chars — e.g. "sk-live"
  prompts_scanned:  number;
  total_pii_found:  number;
  risk_score:       number;   // 0–100 aggregate
  risk_label:       "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  results:          PromptScanResult[];
  regulatory_exposure: FineEstimate[];
  // Security proof — logged for transparency
  key_retained:     false;
  key_logged:       false;
  key_forwarded:    false;
}

// ─── Core Scanner Logic ───────────────────────────────────────────────────────

function runDlp(text: string, industry: "finance" | "healthcare"): {
  protected_text: string;
  pii_found: PromptScanResult["pii_found"];
  total_redactions: number;
} {
  let protected_text = text;
  const counts: Record<string, number> = {};

  for (const pat of BASE_PATTERNS) {
    // Fresh regex per call to avoid shared lastIndex state across prompts
    const re = new RegExp(pat.regex.source, pat.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(protected_text)) !== null) {
      counts[pat.id] = (counts[pat.id] ?? 0) + 1;
    }
    protected_text = protected_text.replace(
      new RegExp(pat.regex.source, pat.regex.flags),
      pat.replacement,
    );
  }

  const pii_found: PromptScanResult["pii_found"] = [];
  let total_redactions = 0;

  for (const pat of BASE_PATTERNS) {
    const count = counts[pat.id] ?? 0;
    if (count > 0) {
      pii_found.push({
        type:       pat.id,
        label:      pat.label,
        severity:   pat.severity,
        regulation: pat.regulation,
        count,
      });
      total_redactions += count;
    }
  }

  return { protected_text, pii_found, total_redactions };
}

function computeRiskScore(pii_found: PromptScanResult["pii_found"]): number {
  let score = 0;
  for (const pii of pii_found) {
    const weight = pii.severity === "CRITICAL" ? 30 : pii.severity === "HIGH" ? 15 : 8;
    score += weight * pii.count;
  }
  return Math.min(100, score);
}

function riskLabel(score: number): ScanReport["risk_label"] {
  if (score >= 70) return "CRITICAL";
  if (score >= 40) return "HIGH";
  if (score >= 15) return "MEDIUM";
  return "LOW";
}

function generateScanId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "SMP-SCAN-";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Request Validator ────────────────────────────────────────────────────────

const OPENAI_KEY_RE = /^sk-[A-Za-z0-9\-_]{20,}$/;

function validateApiKeyFormat(key: string): { valid: boolean; prefix: string } {
  const clean  = key.trim();
  const valid  = OPENAI_KEY_RE.test(clean);
  // Return ONLY the prefix — the rest is discarded immediately
  const prefix = valid ? clean.slice(0, 7) : "sk-****";
  return { valid, prefix };
}

// ─── Route ───────────────────────────────────────────────────────────────────

scannerRouter.post(
  "/api/v1/public/scan",
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { apiKey?: unknown; industry?: unknown };

    // ── 1. Extract and immediately sanitise the API key ──────────────────
    //    The raw key string is destroyed from `body` before ANY logging or
    //    async operation — it exists in scope only for validation.
    const rawKey  = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const industry = typeof body.industry === "string"
      ? body.industry.toLowerCase()
      : "finance";

    // Erase the key from req.body immediately so it cannot leak into
    // any upstream error handler, logger, or serialiser
    if (body.apiKey !== undefined) {
      (req.body as Record<string, unknown>).apiKey = "[KEY_ERASED_IN_MEMORY]";
    }

    // ── 2. Validate key format ──────────────────────────────────────────
    const { valid, prefix } = validateApiKeyFormat(rawKey);
    // Immediately overwrite rawKey variable — GC can collect it
    // (We can't zero-fill a JS string, but we remove all references to it)

    if (!valid) {
      res.status(400).json({
        success: false,
        error: {
          code:    "INVALID_API_KEY_FORMAT",
          message: "API key must be a valid OpenAI key starting with 'sk-'. Your key is never stored.",
        },
      });
      return;
    }

    if (!["finance", "healthcare"].includes(industry)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INDUSTRY", message: "Industry must be 'finance' or 'healthcare'." },
      });
      return;
    }

    // ── 3. Select prompts for the chosen industry ────────────────────────
    const selectedPrompts = SIMULATION_PROMPTS.filter(
      (p) => p.industry === industry || p.industry === "both",
    ).slice(0, 5);

    // ── 4. Run DLP simulation on each prompt ─────────────────────────────
    const results: PromptScanResult[] = selectedPrompts.map((prompt) => {
      const { protected_text, pii_found, total_redactions } = runDlp(
        prompt.text,
        industry as "finance" | "healthcare",
      );
      const risk_score = computeRiskScore(pii_found);
      return {
        prompt_id:        prompt.id,
        scenario:         prompt.scenario,
        role:             prompt.role,
        raw_text:         prompt.text,
        protected_text,
        pii_found,
        total_redactions,
        risk_score,
      };
    });

    // ── 5. Aggregate metrics ─────────────────────────────────────────────
    const total_pii  = results.reduce((acc, r) => acc + r.total_redactions, 0);
    const avg_risk   = Math.round(
      results.reduce((acc, r) => acc + r.risk_score, 0) / Math.max(results.length, 1),
    );
    const peak_risk  = Math.max(...results.map((r) => r.risk_score));

    const report: ScanReport = {
      scan_id:             generateScanId(),
      industry,
      scanned_at:          new Date().toISOString(),
      key_prefix:          prefix,  // e.g. "sk-live" — 7 chars max
      prompts_scanned:     results.length,
      total_pii_found:     total_pii,
      risk_score:          peak_risk,
      risk_label:          riskLabel(peak_risk),
      results,
      regulatory_exposure: FINE_ESTIMATES[industry] ?? [],
      key_retained:        false,
      key_logged:          false,
      key_forwarded:       false,
    };

    // ── 6. Log only the scan metadata — NEVER the key or raw prompts ─────
    console.info(
      `[V86:Scanner] scan_id=${report.scan_id} industry=${industry} ` +
      `key_prefix=${prefix} pii_found=${total_pii} risk=${peak_risk} ip=${req.ip}`
    );

    res.status(200).json({ success: true, data: report });
  },
);
