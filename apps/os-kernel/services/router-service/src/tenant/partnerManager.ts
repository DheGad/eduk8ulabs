/**
 * @file src/tenant/partnerManager.ts
 * @service router-service
 * @description Command 088 — Partner/Sub-Tenant Resolution Engine
 *
 * Handles the partner SDK execution context:
 *   1. Reads x-streetmp-partner-id from request headers
 *   2. Validates and resolves the associated PartnerBrand
 *   3. Emits V70 PARTNER_SDK_EXECUTION trace event
 *   4. Returns the resolved PartnerContext for downstream use
 *
 * Architecture:
 *   Partners (ISVs, SaaS companies using the SDK) have a partner_id.
 *   Their customers are Sub-Tenants with parent_partner_id set in the registry.
 *   The router treats sub-tenants identically to direct tenants for policy
 *   enforcement — the only difference is the attribution trace event.
 *
 * Backward compatibility:
 *   Requests WITHOUT x-streetmp-partner-id are completely unaffected.
 *   This is purely additive — no existing tenant logic is modified.
 */

import { Request }                             from "express";
import { resolvePartnerBrand, PartnerBrand }   from "../services/branding/brandingService.js";
import { appendTraceEvent }                    from "../middleware/traceProvider.js";

export interface PartnerContext {
  partner_id:   string;
  brand:        PartnerBrand;
  end_user_id?: string;
}

/**
 * Resolve partner context from request headers.
 *
 * Returns null for non-partner (direct) requests — completely fail-open.
 * Emits V70 PARTNER_SDK_EXECUTION trace if a valid partner is resolved.
 */
export function resolvePartnerContext(req: Request): PartnerContext | null {
  const rawPartnerId = req.headers["x-streetmp-partner-id"];
  const partnerId    = typeof rawPartnerId === "string" ? rawPartnerId.trim() : null;

  if (!partnerId) return null;

  const brand = resolvePartnerBrand(partnerId);
  if (!brand) {
    // Unknown partner — log and fail-open (treat as direct request)
    console.warn(`[V88:PartnerManager] Unknown partner_id="${partnerId}" — falling back to direct tenant mode`);
    return null;
  }

  const endUserId = typeof req.headers["x-streetmp-user-id"] === "string"
    ? req.headers["x-streetmp-user-id"].trim()
    : undefined;

  // V70 trace: PARTNER_SDK_EXECUTION
  if (req.traceId && req.traceStartedAt) {
    appendTraceEvent(req.traceId, req.traceStartedAt, "PARTNER_SDK_EXECUTION", {
      partner_id:   brand.partner_id,
      display_name: brand.display_name,
      end_user_id:  endUserId ?? null,
      sdk_version:  req.headers["x-streetmp-sdk"] ?? null,
    });
  }

  console.info(
    `[V88:PartnerManager] partner="${brand.display_name}" (${brand.partner_id}) ` +
    `user=${endUserId ?? "anonymous"} tenant=${req.headers["x-tenant-id"] ?? "unset"}`
  );

  return { partner_id: brand.partner_id, brand, end_user_id: endUserId };
}

/**
 * Injects partner attributions into response headers so the frontend /verify
 * page can detect and apply white-label branding without a second API call.
 */
export function setPartnerResponseHeaders(
  res: import("express").Response,
  ctx: PartnerContext,
): void {
  res.setHeader("x-streetmp-partner-id",   ctx.partner_id);
  res.setHeader("x-streetmp-partner-name", ctx.brand.display_name);
  if (ctx.brand.accent_color) {
    res.setHeader("x-streetmp-partner-accent", ctx.brand.accent_color);
  }
}
