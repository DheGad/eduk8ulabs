/**
 * @file middleware.ts
 * @description Next.js Edge Middleware — Auth guard + route hardening.
 *
 * ROOT CAUSE FIX: withAuth() returns raw JSON {"error":"Unauthorized"} for
 * browser navigations when token is missing. Replaced with manual getToken()
 * logic that redirects browsers to /login and returns 401 JSON only for /api routes.
 */

import { getToken }         from "next-auth/jwt";
import { NextResponse }     from "next/server";
import type { NextRequest } from "next/server";

// ── Constants ──────────────────────────────────────────────────────────────────
const CTRL_PREFIX        = "/dashboard/ctrl-titan-9x2k";
const CTRL_API_PREFIX    = "/api/ctrl-titan-9x2k";
const OLD_ADMIN_PREFIXES = ["/dashboard/admin", "/admin"];
const OLD_API_ADMIN      = "/api/admin";

// ── Edge-safe IP matching ─────────────────────────────────────────────────────
function isAllowedIp(ip: string, allowlistRaw: string): boolean {
  if (!ip || !allowlistRaw) return false;
  const normalised = ip.replace("::ffff:", "");
  const allowlist  = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const entry of allowlist) {
    if (entry === normalised) return true;
    if (entry.endsWith("/32") && entry.replace("/32", "") === normalised) return true;
    if (entry.endsWith("/24")) {
      const prefix = entry.replace("/24", "").split(".").slice(0, 3).join(".");
      if (normalised.startsWith(prefix + ".")) return true;
    }
    if (normalised === "127.0.0.1" || normalised === "::1") return true;
  }
  return false;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0"
  );
}

// ── Dev bypass: skip auth in local non-production environment ─────────────────
function isDevBypass(): boolean {
  const isDev        = process.env.NODE_ENV !== "production";
  const isLiveDomain = (process.env.NEXTAUTH_URL ?? "").includes("streetmp.com");
  return isDev && !isLiveDomain;
}

// ── Main middleware ───────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Tombstone old /admin/* paths → silent 404 ──────────────────────────
  if (
    OLD_ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith(OLD_API_ADMIN)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // ── 2. Auth guard ──────────────────────────────────────────────────────────
  if (!isDevBypass()) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const isApiRoute = pathname.startsWith("/api/");

      if (isApiRoute) {
        // API callers (fetch/axios): return structured 401
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Browser navigation: ALWAYS redirect to /login — never return raw JSON
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ── 3. Ctrl-titan: IP allowlist + role enforcement ───────────────────────
    if (
      pathname.startsWith(CTRL_PREFIX) ||
      pathname.startsWith(CTRL_API_PREFIX)
    ) {
      const clientIp  = getClientIp(req);
      const allowlist = process.env.CTRL_ALLOWED_IPS ?? "";

      if (!isAllowedIp(clientIp, allowlist)) {
        return new NextResponse(null, { status: 404 }); // Don't confirm route exists
      }

      const role = token.role as string | undefined;
      if (!role || !["ADMIN", "OWNER", "GOD_MODE"].includes(role.toUpperCase())) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/ctrl-titan-9x2k/:path*",
    "/api/ctrl-titan-9x2k/:path*",
  ],
};
