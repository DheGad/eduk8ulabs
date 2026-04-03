"use client";

/**
 * @file page.tsx
 * @route /dashboard/settings/organization
 * @phase Phase 4 — The Enterprise Layer
 * @description
 *   Organization Settings page with three tabs:
 *     TEAM   — Member list with inline role editor + remove button
 *     INVITE — Send email invites (ADMIN/OWNER only)
 *     ORG    — Org name/slug display (read-only for now; OWNER can edit)
 *
 *   All data comes from /api/org/[orgId]/* routes — no mocks.
 *   The active org id is read from localStorage (set by OrgSwitcher).
 */

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgRole = "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";
type PlanTier = "FREE" | "PRO" | "ENTERPRISE";

interface Member {
  id:           string;
  user_id:      string;
  role:         OrgRole;
  email:        string | null;
  display_name: string | null;
  created_at:   string;
}

interface OrgInfo {
  id:          string;
  name:        string;
  slug:        string;
  plan_tier:   PlanTier;
  created_at:  string;
  caller_role: OrgRole;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<OrgRole, string> = {
  OWNER:     "border-amber-500/30 bg-amber-500/10 text-amber-400",
  ADMIN:     "border-violet-500/30 bg-violet-500/10 text-violet-400",
  DEVELOPER: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  VIEWER:    "border-zinc-700 bg-zinc-800/60 text-zinc-400",
};

const TIER_STYLES: Record<PlanTier, string> = {
  FREE:       "border-zinc-700 bg-zinc-800/60 text-zinc-400",
  PRO:        "border-violet-500/30 bg-violet-500/10 text-violet-300",
  ENTERPRISE: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const ROLE_CAPABILITIES: Record<OrgRole, string[]> = {
  OWNER:     ["Full billing", "Member management", "System access", "All admin operations"],
  ADMIN:     ["Manage members & invites", "View all logs & costs", "API key management"],
  DEVELOPER: ["Manage API keys", "View technical traces", "Execute LLM prompts"],
  VIEWER:    ["Read-only dashboard access", "View analytics & compliance"],
};

const ASSIGNABLE_ROLES: OrgRole[] = ["ADMIN", "DEVELOPER", "VIEWER"];
type Tab = "team" | "invite" | "org";

// ── Helper ────────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OrganizationSettingsPage() {
  const [activeTab,  setActiveTab]  = useState<Tab>("team");
  const [orgId,      setOrgId]      = useState<string | null>(null);
  const [orgInfo,    setOrgInfo]    = useState<OrgInfo | null>(null);
  const [members,    setMembers]    = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState<OrgRole>("DEVELOPER");
  const [inviteMsg,   setInviteMsg]   = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Role change state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [savingMemberId,  setSavingMemberId]  = useState<string | null>(null);

  // Resolve active org from localStorage
  useEffect(() => {
    const id = localStorage.getItem("streetmp-active-org-id");
    setOrgId(id);
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/members`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as {
        success: boolean;
        members: Member[];
        caller_role: OrgRole;
      };
      if (!data.success) throw new Error("API error");
      setMembers(data.members);
      setOrgInfo((prev) => prev ? { ...prev, caller_role: data.caller_role } : null);
    } catch (e) {
      setError(`Failed to load members: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Fetch org info from my-orgs (has plan_tier etc.)
  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      try {
        const res = await fetch("/api/org/my-orgs");
        const data = await res.json() as { success: boolean; orgs: Array<OrgInfo & { member_role: OrgRole }> };
        if (data.success) {
          const org = data.orgs.find((o) => o.id === orgId);
          if (org) setOrgInfo({ ...org, caller_role: org.member_role });
        }
      } catch { /* fail-open */ }
    })();
  }, [orgId]);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  // ── Invite ────────────────────────────────────────────────────────────────

  async function handleInvite() {
    if (!orgId || !inviteEmail.includes("@")) return;
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`/api/org/${orgId}/invites`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setInviteMsg({ type: "ok", text: `✓ Invite sent to ${inviteEmail}` });
        setInviteEmail("");
      } else {
        setInviteMsg({ type: "err", text: data.error ?? "Invite failed" });
      }
    } catch {
      setInviteMsg({ type: "err", text: "Network error" });
    } finally {
      setInviteLoading(false);
    }
  }

  // ── Role change ───────────────────────────────────────────────────────────

  async function handleRoleChange(memberId: string, newRole: OrgRole) {
    if (!orgId) return;
    setSavingMemberId(memberId);
    try {
      const res = await fetch(`/api/org/${orgId}/members`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ member_id: memberId, role: newRole }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setMembers((prev) =>
          prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m)
        );
      }
    } catch { /* fail-open */ } finally {
      setSavingMemberId(null);
      setEditingMemberId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const canManage = orgInfo?.caller_role === "OWNER" || orgInfo?.caller_role === "ADMIN";

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20
                            flex items-center justify-center">
              <span className="text-lg font-black text-violet-400">
                {orgInfo?.name?.charAt(0) ?? "O"}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-light text-white tracking-tight">
                {orgInfo?.name ?? "Organization Settings"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {orgInfo?.plan_tier && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_STYLES[orgInfo.plan_tier]}`}>
                    {orgInfo.plan_tier}
                  </span>
                )}
                {orgInfo?.slug && (
                  <span className="text-[10px] font-mono text-zinc-600">/{orgInfo.slug}</span>
                )}
                {orgInfo?.caller_role && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_STYLES[orgInfo.caller_role]}`}>
                    {orgInfo.caller_role}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] mb-8">
          {(["team", "invite", "org"] as Tab[]).map((tab) => (
            <button
              key={tab}
              id={`org-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-violet-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "team" ? "👥 Team" : tab === "invite" ? "✉️ Invite" : "⚙️ Organization"}
            </button>
          ))}
        </div>

        {/* ── TEAM TAB ───────────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Role legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {(["OWNER", "ADMIN", "DEVELOPER", "VIEWER"] as OrgRole[]).map((role) => (
                <div
                  key={role}
                  id={`role-legend-${role.toLowerCase()}`}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_STYLES[role]} mb-2 inline-block`}>
                    {role}
                  </span>
                  <ul className="space-y-0.5">
                    {(ROLE_CAPABILITIES[role] ?? []).map((cap) => (
                      <li key={cap} className="text-[10px] text-zinc-600 leading-tight">
                        · {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>


            {/* Members table */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                <p className="text-xs font-medium text-white">Team Members</p>
                <span className="text-[10px] font-mono text-zinc-600">{members.length} member{members.length !== 1 ? "s" : ""}</span>
              </div>

              {loading ? (
                <div className="p-5 space-y-3">
                  {[0,1,2].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" />)}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.015] transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/20
                                      flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-violet-400 uppercase">
                          {(m.display_name ?? m.email ?? "?").charAt(0)}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {m.display_name ?? m.email ?? "Unknown"}
                        </p>
                        <p className="text-[10px] text-zinc-600 truncate">{m.email}</p>
                      </div>

                      {/* Role selector (ADMIN/OWNER) or badge (others) */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-700 hidden sm:inline">
                          {relTime(m.created_at)}
                        </span>

                        {canManage && m.role !== "OWNER" ? (
                          editingMemberId === m.id ? (
                            <select
                              id={`member-role-select-${m.id}`}
                              title={`Change role for ${m.display_name ?? m.email ?? "member"}`}
                              defaultValue={m.role}
                              disabled={savingMemberId === m.id}
                              onChange={(e) => void handleRoleChange(m.id, e.target.value as OrgRole)}
                              className="text-[10px] bg-[#16161c] border border-white/10 rounded-lg px-2 py-1
                                         text-white focus:outline-none focus:border-violet-500/50"
                              autoFocus
                            >
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              id={`member-role-btn-${m.id}`}
                              onClick={() => setEditingMemberId(m.id)}
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border
                                          ${ROLE_STYLES[m.role]} hover:opacity-80 transition-opacity`}
                            >
                              {m.role}
                            </button>
                          )
                        ) : (
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${ROLE_STYLES[m.role]}`}>
                            {m.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INVITE TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "invite" && (
          <div className="max-w-lg">
            {!canManage ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-8 text-center">
                <p className="text-sm text-zinc-500">You need ADMIN or OWNER role to send invites.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b0f] p-6">
                <h2 className="text-sm font-semibold text-white mb-1">Invite a Team Member</h2>
                <p className="text-[11px] text-zinc-600 mb-6">
                  They'll receive an email with a secure 7-day invite link.
                </p>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="invite-email" className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3
                                 text-sm text-white placeholder-zinc-600
                                 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="invite-role" className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                      Assign Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {ASSIGNABLE_ROLES.map((role) => (
                        <button
                          key={role}
                          id={`invite-role-${role.toLowerCase()}`}
                          onClick={() => setInviteRole(role)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                            inviteRole === role
                              ? ROLE_STYLES[role]
                              : "border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-white/10"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    {/* Capability preview */}
                    <div className="mt-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">
                        {inviteRole} can:
                      </p>
                      {ROLE_CAPABILITIES[inviteRole].map((cap) => (
                        <p key={cap} className="text-[10px] text-zinc-500 leading-tight">· {cap}</p>
                      ))}
                    </div>
                  </div>

                  {inviteMsg && (
                    <p className={`text-xs px-4 py-3 rounded-xl border ${
                      inviteMsg.type === "ok"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/20 bg-red-500/10 text-red-400"
                    }`}>
                      {inviteMsg.text}
                    </p>
                  )}

                  <button
                    id="send-invite-btn"
                    onClick={() => void handleInvite()}
                    disabled={inviteLoading || !inviteEmail.includes("@")}
                    className="w-full py-3 px-6 rounded-xl text-sm font-semibold
                               bg-violet-600 text-white
                               hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
                               transition-all active:scale-[0.98]"
                  >
                    {inviteLoading ? "Sending…" : `Send Invite as ${inviteRole}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORG TAB ────────────────────────────────────────────────────────── */}
        {activeTab === "org" && orgInfo && (
          <div className="space-y-4 max-w-lg">
            {(
              [
                { label: "Organization ID", value: orgInfo.id,   mono: true },
                { label: "Display Name",    value: orgInfo.name, mono: false },
                { label: "URL Slug",        value: orgInfo.slug, mono: true },
                { label: "Created",         value: relTime(orgInfo.created_at), mono: false },
              ] as Array<{ label: string; value: string; mono: boolean }>
            ).map(({ label, value, mono }) => (
              <div
                key={label}
                className="flex items-center justify-between px-5 py-4
                           rounded-2xl border border-white/[0.06] bg-[#0b0b0f]"
              >
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
                <span className={`text-xs text-zinc-300 ${mono ? "font-mono" : ""}`}>{value}</span>
              </div>
            ))}

            {/* Plan tier */}
            <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-white/[0.06] bg-[#0b0b0f]">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Plan</span>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${TIER_STYLES[orgInfo.plan_tier]}`}>
                {orgInfo.plan_tier}
              </span>
            </div>

            {orgInfo.caller_role === "OWNER" && (
              <a
                href="/dashboard/sovereign/finance"
                className="flex items-center justify-between px-5 py-4
                           rounded-2xl border border-violet-500/10 bg-violet-500/[0.03]
                           hover:border-violet-500/20 transition-colors group"
              >
                <div>
                  <p className="text-xs font-medium text-violet-400">Upgrade Plan</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Unlock ENTERPRISE features</p>
                </div>
                <span className="text-violet-600 group-hover:text-violet-400 transition-colors">→</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
