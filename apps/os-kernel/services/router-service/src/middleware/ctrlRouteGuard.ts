/**
 * @file middleware/ctrlRouteGuard.ts
 * @service router-service + Next.js (separate but same contract)
 * @phase Phase 6 — Titan Hardening
 * @description
 *   IP-Allowlist Guard for internal `ctrl-titan-9x2k` control plane routes.
 *
 *   ROUTE RENAMING CONTRACT (replaces /admin/* / /api/admin/*):
 *   ─────────────────────────────────────────────────────────────────────
 *   BEFORE                          AFTER (obfuscated)
 *   ─────────────────────────────────────────────────────────────────────
 *   /api/v1/admin/*                 /api/v1/ctrl-titan-9x2k/*
 *   /api/admin/ops                  /api/ctrl-titan-9x2k/ops
 *   /admin/onprem                   /ctrl-titan-9x2k/onprem
 *   /dashboard/admin/*              /dashboard/ctrl-titan-9x2k/*
 *   ─────────────────────────────────────────────────────────────────────
 *
 *   ENFORCEMENT LAYERS:
 *     1. IP allowlist check (this middleware, Express layer for os-kernel)
 *     2. Admin secret header `x-admin-secret` (existing adminSecretGuard.ts)
 *     3. Old /admin/* paths return 404 — not 403 — to avoid path enumeration
 *
 *   IP ALLOWLIST:
 *     Reads from env var CTRL_ALLOWED_IPS (comma-separated CIDR/IP list).
 *     Falls back to CTRL_ALLOWED_IPS_DEFAULT if not set.
 *     Always includes loopback (127.0.0.1, ::1) for internal health checks.
 *
 *   X-Forwarded-For:
 *     Trusts the first IP in X-Forwarded-For only if the immediate connection
 *     is from a known proxy (CTRL_TRUSTED_PROXIES). Otherwise uses socket IP.
 */

import { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger.js";

// ── CIDR matching (no external deps — handles /32 and exact IPs) ──────────────

function ipToInt32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function cidrContains(cidr: string, ip: string): boolean {
  if (cidr === ip) return true;
  const [network, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr ?? "32", 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const networkInt = ipToInt32(network);
  const ipInt      = ipToInt32(ip);
  if (networkInt === null || ipInt === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return ((networkInt & mask) >>> 0) === ((ipInt & mask) >>> 0);
}

function isIpAllowed(ip: string, allowlist: string[]): boolean {
  // Always allow loopback
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return true;
  return allowlist.some((entry) => cidrContains(entry.trim(), ip));
}

// ── Parse allowlist from env ──────────────────────────────────────────────────

function parseAllowlist(): string[] {
  const raw = process.env.CTRL_ALLOWED_IPS ?? process.env.CTRL_ALLOWED_IPS_DEFAULT ?? "";
  const entries = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    log.warn(
      "[CtrlRouteGuard] CTRL_ALLOWED_IPS is not set — ctrl routes are LOCALHOST ONLY. " +
      "Set CTRL_ALLOWED_IPS=x.x.x.x/32,y.y.y.y in production."
    );
  }
  return entries;
}

// Cache allowlist — re-read every 60s to support hot-reloads without restart
let _cachedAllowlist: string[] = [];
let _allowlistLoadedAt         = 0;
const ALLOWLIST_CACHE_MS       = 60_000;

function getAllowlist(): string[] {
  const now = Date.now();
  if (now - _allowlistLoadedAt > ALLOWLIST_CACHE_MS) {
    _cachedAllowlist  = parseAllowlist();
    _allowlistLoadedAt = now;
  }
  return _cachedAllowlist;
}

// ── Trusted proxy list ────────────────────────────────────────────────────────

function getTrustedProxies(): Set<string> {
  const raw = process.env.CTRL_TRUSTED_PROXIES ?? "127.0.0.1,::1";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

// ── Resolve real client IP ────────────────────────────────────────────────────

function resolveClientIp(req: Request): string {
  const socketIp = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
  const trustedProxies = getTrustedProxies();

  if (trustedProxies.has(socketIp)) {
    // Trust X-Forwarded-For only if immediate connection is a known proxy
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
      const firstIp = (Array.isArray(xff) ? xff[0] : xff).split(",")[0].trim();
      if (firstIp) return firstIp.replace("::ffff:", "");
    }
  }

  return socketIp;
}

// ── CTRL route prefix ─────────────────────────────────────────────────────────

export const CTRL_PREFIX = "/api/v1/ctrl-titan-9x2k";

export function isCtrlRoute(path: string): boolean {
  return (
    path.startsWith("/api/v1/ctrl-titan-9x2k") ||
    path.startsWith("/api/ctrl-titan-9x2k") ||
    path.startsWith("/ctrl-titan-9x2k")
  );
}

// ── Main middleware ───────────────────────────────────────────────────────────

/**
 * Mount BEFORE admin route handlers:
 *   app.use("/api/v1/ctrl-titan-9x2k", ctrlRouteGuard, adminSecretGuard, adminRouter);
 *
 * Also mount a 404 tombstone for old /admin/* paths:
 *   app.all("/api/v1/admin/*", adminTombstone);
 *   app.all("/admin/*", adminTombstone);
 */
export function ctrlRouteGuard(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const clientIp   = resolveClientIp(req);
  const allowlist  = getAllowlist();

  if (!isIpAllowed(clientIp, allowlist)) {
    // Return 404 — not 403 — to prevent confirmation of the route's existence
    log.warn("[CtrlRouteGuard] BLOCKED access to ctrl route", {
      path:   req.path,
      // IP is partially masked by logger automatically
      ip:     clientIp,
      method: req.method,
    });
    res.status(404).json({ error: "Not Found" });
    return;
  }

  next();
}

/**
 * Tombstone handler for the old /admin/* paths.
 * Returns 404 (not 301) — prevents path-scanning tools from following redirects.
 */
export function adminTombstone(
  req:  Request,
  res:  Response,
): void {
  log.warn("[CtrlRouteGuard] Access to deprecated admin path", { path: req.path });
  // Deliberate 404 — do NOT hint that the resource moved
  res.status(404).json({ error: "Not Found" });
}
