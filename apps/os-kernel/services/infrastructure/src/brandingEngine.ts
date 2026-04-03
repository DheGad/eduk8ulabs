/**
 * @file brandingEngine.ts
 * @service os-kernel/services/infrastructure
 * @version V62
 * @description Enterprise White-Label Branding Service — StreetMP OS
 *
 * Manages per-tenant visual identity overrides: logo, primary colour,
 * organisation name, and derived colour tokens (hover, border, glow).
 * In production this fetches from a Tenant Config Store (DynamoDB/Redis).
 * Here we provide 3 pre-configured mock themes to demonstrate the
 * white-label capability to enterprise buyers.
 *
 * Tech Stack Lock : TypeScript · Node.js · Zero Python
 */

// ================================================================
// TYPES
// ================================================================

export interface ThemeConfig {
  tenantId:        string;
  orgName:         string;
  logoUrl:         string;          // SVG data URI or HTTPS URL
  primaryColor:    string;          // Hex, e.g. "#10b981"
  primaryLight:    string;          // Lighter tint for backgrounds
  primaryDark:     string;          // Darker shade for borders
  primaryGlow:     string;          // Box-shadow glow (rgba)
  themeName:       string;
  cssVariables:    Record<string, string>;
}

export interface TenantBrandingResult {
  found:   boolean;
  theme:   ThemeConfig;
  source:  "TENANT_CONFIG" | "DEFAULT";
}

// ================================================================
// MOCK THEME LIBRARY
// ================================================================

const EMERALD_THEME: ThemeConfig = {
  tenantId:     "default",
  orgName:      "StreetMP OS",
  logoUrl:      "",               // Uses S initials by default
  primaryColor: "#10b981",        // emerald-500
  primaryLight: "rgba(16,185,129,0.1)",
  primaryDark:  "rgba(16,185,129,0.3)",
  primaryGlow:  "rgba(16,185,129,0.25)",
  themeName:    "Standard Emerald",
  cssVariables: {
    "--brand-primary":  "#10b981",
    "--brand-light":    "rgba(16,185,129,0.1)",
    "--brand-dark":     "rgba(16,185,129,0.3)",
    "--brand-glow":     "rgba(16,185,129,0.25)",
    "--brand-text":     "#10b981",
  },
};

const MAYBANK_GOLD_THEME: ThemeConfig = {
  tenantId:     "maybank",
  orgName:      "Maybank AI Gateway",
  logoUrl:      "",
  primaryColor: "#FFC107",        // Amber-400 / Maybank Gold
  primaryLight: "rgba(255,193,7,0.1)",
  primaryDark:  "rgba(255,193,7,0.3)",
  primaryGlow:  "rgba(255,193,7,0.25)",
  themeName:    "Maybank Gold",
  cssVariables: {
    "--brand-primary":  "#FFC107",
    "--brand-light":    "rgba(255,193,7,0.1)",
    "--brand-dark":     "rgba(255,193,7,0.3)",
    "--brand-glow":     "rgba(255,193,7,0.25)",
    "--brand-text":     "#FFC107",
  },
};

const HOSPITAL_BLUE_THEME: ThemeConfig = {
  tenantId:     "hospital",
  orgName:      "HealthOS Sovereign AI",
  logoUrl:      "",
  primaryColor: "#0EA5E9",        // sky-500 / Hospital Blue
  primaryLight: "rgba(14,165,233,0.1)",
  primaryDark:  "rgba(14,165,233,0.3)",
  primaryGlow:  "rgba(14,165,233,0.25)",
  themeName:    "Hospital Blue",
  cssVariables: {
    "--brand-primary":  "#0EA5E9",
    "--brand-light":    "rgba(14,165,233,0.1)",
    "--brand-dark":     "rgba(14,165,233,0.3)",
    "--brand-glow":     "rgba(14,165,233,0.25)",
    "--brand-text":     "#0EA5E9",
  },
};

const THEME_REGISTRY: Record<string, ThemeConfig> = {
  default:   EMERALD_THEME,
  maybank:   MAYBANK_GOLD_THEME,
  hospital:  HOSPITAL_BLUE_THEME,
};

// ================================================================
// BRANDING SERVICE
// ================================================================

export class BrandingService {

  /**
   * Returns the ThemeConfig for a given tenantId.
   * Falls back to the default Emerald theme if tenantId is unknown.
   */
  public getThemeConfig(tenantId: string): TenantBrandingResult {
    const theme = THEME_REGISTRY[tenantId.toLowerCase()];

    if (theme) {
      console.info(`[V62:BrandingService] Theme resolved: "${theme.themeName}" for tenant: ${tenantId}`);
      return { found: true, theme, source: "TENANT_CONFIG" };
    }

    console.info(`[V62:BrandingService] Unknown tenant "${tenantId}" — falling back to Standard Emerald`);
    return { found: false, theme: EMERALD_THEME, source: "DEFAULT" };
  }

  /**
   * Returns all available themes (for the Brand Configurator UI).
   */
  public getAllThemes(): ThemeConfig[] {
    return Object.values(THEME_REGISTRY);
  }

  /**
   * Generates an inline <style> block of CSS variables for a given tenant.
   * Injected into the dashboard layout's <head> per-request in production.
   */
  public buildCSSVariableBlock(tenantId: string): string {
    const { theme } = this.getThemeConfig(tenantId);
    const vars = Object.entries(theme.cssVariables)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    return `:root {\n${vars}\n}`;
  }
}

// Singleton export
export const globalBrandingService = new BrandingService();
