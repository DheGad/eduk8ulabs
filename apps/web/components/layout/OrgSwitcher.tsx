"use client";

/**
 * @file OrgSwitcher.tsx
 * @component OrgSwitcher
 * @phase Phase 4 — The Enterprise Layer
 * @description
 *   Sidebar dropdown that lets users switch between organizations they belong to.
 *   Stores the active org in localStorage + posts x-streetmp-org-id header context.
 *   On switch, reloads the page so all scoped queries pick up the new org.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface OrgEntry {
  id:          string;
  name:        string;
  slug:        string;
  plan_tier:   "FREE" | "PRO" | "ENTERPRISE";
  member_role: string;
}

const TIER_BADGE: Record<string, string> = {
  FREE:       "border-zinc-700 bg-zinc-800/60 text-zinc-500",
  PRO:        "border-violet-500/30 bg-violet-500/10 text-violet-400",
  ENTERPRISE: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

const ROLE_COLOR: Record<string, string> = {
  OWNER:     "text-amber-400",
  ADMIN:     "text-violet-400",
  DEVELOPER: "text-blue-400",
  VIEWER:    "text-zinc-500",
};

export default function OrgSwitcher() {
  const router   = useRouter();
  const dropRef  = useRef<HTMLDivElement>(null);

  const [orgs,      setOrgs]      = useState<OrgEntry[]>([]);
  const [activeOrg, setActiveOrg] = useState<OrgEntry | null>(null);
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(true);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/org/my-orgs");
      if (!res.ok) return;
      const data = await res.json() as { success: boolean; orgs: OrgEntry[] };
      if (!data.success) return;

      setOrgs(data.orgs);
      // Restore last active org from localStorage
      const saved = localStorage.getItem("streetmp-active-org-id");
      const found = data.orgs.find((o) => o.id === saved) ?? data.orgs[0] ?? null;
      setActiveOrg(found);
    } catch {
      // fail-open: sidebar still renders without org context
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOrgs(); }, [fetchOrgs]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectOrg(org: OrgEntry) {
    setActiveOrg(org);
    localStorage.setItem("streetmp-active-org-id", org.id);
    setOpen(false);
    // Full reload: forces all server components + API routes to pick up new org
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-3 mb-3 h-11 rounded-xl animate-pulse" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }} />
    );
  }

  if (!activeOrg) return null;

  return (
    <div ref={dropRef} className="relative mx-3 mb-3">
      {/* Trigger */}
      <button
        id="org-switcher-trigger"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left group"
        style={{
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-raised)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-label="Switch organization"
      >
        {/* Org avatar */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
        >
          <span className="text-[11px] font-black uppercase" style={{ color: "#7C3AED" }}>
            {activeOrg.name.charAt(0)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-none" style={{ color: "var(--text-primary)" }}>
            {activeOrg.name}
          </p>
          <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
            {activeOrg.member_role}
          </p>
        </div>

        <span className="text-[10px] transition-transform duration-200" style={{ color: "var(--text-dimmed)", transform: open ? "rotate(180deg)" : "none" }}>
          &#9662;
        </span>
      </button>

      {/* Dropdown */}
      {open && orgs.length > 0 && (
        <div
          role="listbox"
          aria-label="Select organization"
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <p className="px-3 py-2 text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-dimmed)", borderBottom: "1px solid var(--border-subtle)" }}>
            Your Organizations
          </p>
          <div role="group">
          {orgs.map((org) => (
            <button
              key={org.id}
              id={`org-option-${org.id}`}
              role="option"
              aria-selected={org.id === activeOrg.id ? "true" : "false"}
              onClick={() => selectOrg(org)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5
                          hover:bg-white/[0.04] transition-colors text-left
                          ${org.id === activeOrg.id ? "bg-white/[0.02]" : ""}`}
            >
              <div className="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.06]
                              flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-zinc-400 uppercase">
                  {org.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white truncate">{org.name}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${TIER_BADGE[org.plan_tier]}`}>
                    {org.plan_tier}
                  </span>
                </div>
                <p className={`text-[10px] mt-0.5 ${ROLE_COLOR[org.member_role] ?? "text-zinc-500"}`}>
                  {org.member_role}
                </p>
              </div>
              {org.id === activeOrg.id && (
                <span className="text-violet-400 text-xs shrink-0">✓</span>
              )}
            </button>
          ))}
          </div>

          <div className="border-t border-white/[0.04] px-3 py-2">
            <a
              href="/dashboard/settings/organization"
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Manage Organizations →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
