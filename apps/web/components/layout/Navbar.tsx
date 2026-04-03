"use client";

/**
 * @file Navbar.tsx
 * @description StreetMP OS — Auth-Aware Navigation Shell.
 *
 * Reads the JWT from cookie/localStorage on mount and shows:
 *   • Logged out: "Log In" + "Join Now" CTAs
 *   • Logged in:  user email chip, HCQ score badge (engineers), "Dashboard" button
 *
 * Uses useEffect to defer hydration (avoids SSR mismatch since token
 * lives in client-only storage).
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { logoutUser } from "@/lib/apiClient";

// ================================================================
// JWT DECODE HELPER (mirrors middleware — no crypto needed)
// ================================================================

interface TokenPayload {
  sub?:       string;
  email?:     string;
  name?:      string;
  role?:      string;
  hcq_score?: number;
  exp?:       number;
}

function readTokenPayload(): TokenPayload | null {
  if (typeof window === "undefined") return null;
  try {
    // Check cookie first (non-httpOnly variant)
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("auth_token="));
    const raw = cookie
      ? cookie.trim().slice("auth_token=".length)
      : (localStorage.getItem("auth_token") ?? "");
    if (!raw) return null;

    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, "="));
    const payload = JSON.parse(json) as TokenPayload;

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function HCQBadge({ score }: { score: number }) {
  const tier = score >= 90 ? "Elite" : score >= 75 ? "Pro" : "Builder";
  const color = score >= 90
    ? { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", text: "rgb(251,191,36)" }
    : score >= 75
    ? { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.3)", text: "rgb(167,139,250)" }
    : { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", text: "rgb(52,211,153)" };

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide"
      style={{ background: color.bg, borderColor: color.border, color: color.text }}
    >
      <span>⚡</span>
      <span>HCQ {score.toFixed(0)}</span>
      <span className="opacity-60">{tier}</span>
    </div>
  );
}

function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className="text-sm transition-colors duration-150"
      style={{ color: active ? "rgb(167,139,250)" : "rgb(113,113,122)" }}
    >
      {children}
    </Link>
  );
}

// ================================================================
// MAIN NAVBAR
// ================================================================

export function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]           = useState<TokenPayload | null>(null);
  const [hydrated, setHydrated]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  // Defer hydration to avoid SSR mismatch
  useEffect(() => {
    setUser(readTokenPayload());
    setHydrated(true);
  }, []);

  // Re-read token on route changes (handles login/logout navigation)
  useEffect(() => {
    setUser(readTokenPayload());
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    logoutUser();
    setUser(null);
    router.push("/");
  }

  const isEngineer = user?.role === "engineer";
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "User";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#050507]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* ── Logo ──────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center group-hover:bg-violet-500 transition-colors">
            <span className="text-white text-[10px] font-black">S</span>
          </div>
          <span className="text-sm font-bold tracking-tight text-white">
            Streetmp<span className="text-violet-400">OS</span>
          </span>
        </Link>

        {/* ── Centre nav (desktop) ──────────────────────────── */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink href="/marketplace" active={pathname.startsWith("/marketplace")}>
            Marketplace
          </NavLink>
          {user && (
            <NavLink href="/dashboard" active={pathname.startsWith("/dashboard")}>
              Dashboard
            </NavLink>
          )}
          {user && isEngineer && (
            <NavLink href="/dashboard/enterprise" active={pathname.startsWith("/dashboard/enterprise")}>
              Enterprise
            </NavLink>
          )}
        </nav>

        {/* ── Auth area (desktop) ───────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {!hydrated ? (
            // Skeleton to avoid layout shift
            <div className="h-8 w-32 rounded-lg bg-white/[0.04] animate-pulse" />
          ) : user ? (
            <>
              {isEngineer && user.hcq_score !== undefined && (
                <HCQBadge score={user.hcq_score} />
              )}

              {/* User chip */}
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
                <div className="h-5 w-5 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-violet-300 uppercase">
                    {displayName.slice(0, 2)}
                  </span>
                </div>
                <span className="text-xs text-zinc-300 max-w-[120px] truncate">{displayName}</span>
              </div>

              {/* Dashboard link */}
              <Link
                href="/dashboard"
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-all duration-150"
              >
                Dashboard
              </Link>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12] transition-all duration-150"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 hover:border-violet-500/60 transition-all duration-150"
              >
                Join Now →
              </Link>
            </>
          )}
        </div>

        {/* ── Hamburger (mobile) ────────────────────────────── */}
        <button
          type="button"
          className="md:hidden p-2 rounded-lg border border-white/[0.06] text-zinc-400 hover:text-white transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.04] bg-[#050507]/95 backdrop-blur-xl px-4 py-4 space-y-3">
          <Link href="/marketplace" className="block text-sm text-zinc-400 hover:text-white py-2 transition-colors" onClick={() => setMenuOpen(false)}>
            Marketplace
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="block text-sm text-zinc-400 hover:text-white py-2 transition-colors" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              {isEngineer && (
                <Link href="/dashboard/enterprise" className="block text-sm text-zinc-400 hover:text-white py-2 transition-colors" onClick={() => setMenuOpen(false)}>
                  Enterprise
                </Link>
              )}
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-zinc-500 truncate max-w-[160px]">{displayName}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-3 pt-2 border-t border-white/[0.06]">
              <Link href="/login" className="flex-1 text-center rounded-xl border border-white/[0.08] py-2.5 text-sm text-zinc-400" onClick={() => setMenuOpen(false)}>
                Log In
              </Link>
              <Link href="/register" className="flex-1 text-center rounded-xl border border-violet-500/40 bg-violet-500/10 py-2.5 text-sm text-violet-300 font-semibold" onClick={() => setMenuOpen(false)}>
                Join Now
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Navbar;
