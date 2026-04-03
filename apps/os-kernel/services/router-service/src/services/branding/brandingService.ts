/**
 * @file src/services/branding/brandingService.ts
 * @service router-service
 * @description Command 088 — White-Label Branding Engine
 *
 * Resolves partner branding configuration from the x-streetmp-partner-id
 * request header. Used by:
 *   • The /verify public page — shows "Verified by [Partner] via StreetMP"
 *   • The V70 trace event meta for partner attribution
 *   • SDK consumers that embed the verification widget
 *
 * Design: In-memory registry. In production, this is hydrated from a DB table.
 * Fail-open: unknown partner_id returns null (default StreetMP branding).
 */

export interface PartnerBrand {
  partner_id:      string;
  display_name:    string;
  logo_url?:       string;
  accent_color?:   string;    // hex, e.g. "#10b981"
  verify_tagline?: string;    // shown on /verify page
  homepage?:       string;
}

// ─── In-Memory Partner Registry ────────────────────────────────────────────────
// Seeded with demo partners. In production: load from DB on startup.

const PARTNER_REGISTRY = new Map<string, PartnerBrand>([
  [
    "fintech-partner-sg",
    {
      partner_id:    "fintech-partner-sg",
      display_name:  "MyCFO (SG)",
      accent_color:  "#10b981",
      verify_tagline:"Powered by StreetMP Trust Protocol — MAS TRM Certified",
      homepage:      "https://mycfo.com.sg",
    },
  ],
  [
    "hr-platform-my",
    {
      partner_id:    "hr-platform-my",
      display_name:  "TalentAI Malaysia",
      accent_color:  "#6366f1",
      verify_tagline:"AI Governance by StreetMP OS — BNM RMiT Compliant",
      homepage:      "https://talentai.my",
    },
  ],
  [
    "legaltech-partner",
    {
      partner_id:    "legaltech-partner",
      display_name:  "LexAI APAC",
      accent_color:  "#f59e0b",
      verify_tagline:"Verified via StreetMP Trust Protocol — Legal Grade AI",
      homepage:      "https://lexai.io",
    },
  ],
]);

// ─── API ───────────────────────────────────────────────────────────────────────

/**
 * Resolve partner branding by partner_id.
 * Returns null if unknown — callers must fall back to default StreetMP branding.
 */
export function resolvePartnerBrand(partner_id: string | undefined | null): PartnerBrand | null {
  if (!partner_id) return null;
  return PARTNER_REGISTRY.get(partner_id.trim()) ?? null;
}

/**
 * Register a new partner (called during partner onboarding).
 * Thread-safe for single-process use. For horizontal scaling, replicate to DB.
 */
export function registerPartner(brand: PartnerBrand): void {
  PARTNER_REGISTRY.set(brand.partner_id, brand);
  console.info(`[V88:Branding] Partner registered: ${brand.partner_id} (${brand.display_name})`);
}

/**
 * List all registered partners. Admin-only.
 */
export function listPartners(): PartnerBrand[] {
  return Array.from(PARTNER_REGISTRY.values());
}

/** Total registered partners — for monitoring */
export function partnerCount(): number {
  return PARTNER_REGISTRY.size;
}
