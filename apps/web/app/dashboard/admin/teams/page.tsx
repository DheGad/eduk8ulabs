"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/apiClient";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/SkeletonLoader";

/**
 * @file app/dashboard/admin/teams/page.tsx
 * @description Team Management — Phase 4 (Team & Trust Fortress)
 *
 * Features:
 *   - List current team members (fetched from router-service)
 *   - Invite modal: email + ADMIN | MEMBER role selector
 *   - RBAC note: invitees inherit tenant Compliance Frameworks (V85)
 *     but are restricted by their V65 Role assignment
 *   - Copy invite link fallback when email delivery is unavailable
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberRole   = "OWNER" | "ADMIN" | "MEMBER";
type MemberStatus = "active" | "pending" | "suspended";

interface TeamMember {
  id:         string;
  email:      string;
  name:       string;
  role:       MemberRole;
  status:     MemberStatus;
  joined_at:  string | null;
  invited_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

const ROLE_CONFIG: Record<MemberRole, { color: string; label: string }> = {
  OWNER:  { color: "border-amber-500/30 bg-amber-500/10 text-amber-300",    label: "Owner"  },
  ADMIN:  { color: "border-violet-500/30 bg-violet-500/10 text-violet-300", label: "Admin"  },
  MEMBER: { color: "border-zinc-600/30 bg-zinc-700/20 text-zinc-400",       label: "Member" },
};

const STATUS_CONFIG: Record<MemberStatus, { dot: string; label: string }> = {
  active:    { dot: "bg-emerald-400",  label: "Active"    },
  pending:   { dot: "bg-amber-400 animate-pulse", label: "Pending"   },
  suspended: { dot: "bg-red-400",      label: "Suspended" },
};

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (joinUrl: string, email: string) => void;
}) {
  const [email, setEmail]   = useState("");
  const [role, setRole]     = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch("/api/v1/teams/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: trimmed, role }),
      });

      const data = await res.json() as {
        success: boolean;
        data?: { email: string; joinUrl: string; message: string };
        error?: { message: string };
      };

      if (!data.success || !data.data) {
        setError(data.error?.message ?? "Invitation failed.");
        return;
      }

      onSuccess(data.data.joinUrl, data.data.email);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-bold text-white">Invite Team Member</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Invitees inherit your tenant&#39;s V85 Compliance Frameworks and are governed by their V65 Role.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Email */}
          <div>
            <label
              htmlFor="invite-email"
              className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2"
            >
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
              placeholder="colleague@company.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">
              V65 Role Assignment
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["MEMBER", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === r
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                  }`}
                >
                  <p className="text-xs font-bold text-white">{r.charAt(0) + r.slice(1).toLowerCase()}</p>
                  <p className="text-[10px] text-white/30 mt-0.5 font-mono">
                    {r === "ADMIN" ? "Can invite, manage keys & policies" : "Execute & view audit logs"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* RBAC inheritance note */}
          <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-emerald-950/30 border border-emerald-500/15">
            <span className="text-emerald-400 text-base shrink-0">ℹ</span>
            <p className="text-[11px] text-emerald-400/70 leading-relaxed">
              This user will automatically inherit all active V85 Compliance Frameworks on your tenant
              (MAS TRM, BNM RMiT, PDPA, etc.) upon accepting the invitation.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            id="invite-send-button"
            onClick={handleInvite}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25 hover:border-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                Sending…
              </span>
            ) : (
              "Send Invitation →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Banner ────────────────────────────────────────────────────────────

function InviteSuccess({
  email,
  joinUrl,
  onDismiss,
}: {
  email: string;
  joinUrl: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-emerald-400">
          ✓ Invitation sent to {email}
        </p>
        <button onClick={onDismiss} className="text-white/20 hover:text-white/50 text-xs transition-colors">
          ✕
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] font-mono text-white/40 bg-white/[0.04] rounded-lg px-3 py-2 truncate">
          {joinUrl}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-white/60 hover:text-white transition-colors"
        >
          {copied ? "✓ Copied" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [members, setMembers]       = useState<TeamMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [successInvite, setSuccessInvite] = useState<{ email: string; joinUrl: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const token = getToken();
      const res = await fetch(`${ROUTER_URL}/api/v1/admin/teams/members`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json() as { success: boolean; data?: TeamMember[] };
      if (data.success && data.data) setMembers(data.data);
    } catch {
      // Graceful: show empty state with invite CTA — service may not yet have the endpoint
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  const handleInviteSuccess = (joinUrl: string, email: string) => {
    setShowModal(false);
    setSuccessInvite({ email, joinUrl });
    // Re-fetch after 800ms to pick up new pending member
    setTimeout(() => void fetchMembers(), 800);
  };

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "#0F172A", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Team Management</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-violet-600/20 text-violet-400 border border-violet-500/20">V65 RBAC</span>
          </div>
          <p className="text-sm text-slate-500">
            Invite collaborators. All members inherit active V85 Compliance Frameworks and are governed by V65 Role restrictions.
          </p>
        </div>
        <button
          id="open-invite-modal"
          onClick={() => { setShowModal(true); setSuccessInvite(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 hover:border-emerald-500/50 transition-all"
        >
          <span>＋</span> Invite Member
        </button>
      </div>

      {/* ── Success banner ────────────────────────────────────── */}
      {successInvite && (
        <InviteSuccess
          email={successInvite.email}
          joinUrl={successInvite.joinUrl}
          onDismiss={() => setSuccessInvite(null)}
        />
      )}

      {/* ── Fetch error ───────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-4 flex items-center gap-3">
          <span className="text-red-400 shrink-0">⚠</span>
          <p className="text-sm text-red-300">{fetchError}</p>
        </div>
      )}

      {/* ── RBAC Reference ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { role: "OWNER", perms: "Full access. Cannot be revoked remotely.", color: "amber" },
          { role: "ADMIN", perms: "Invite members, manage API keys, view all audit logs.", color: "violet" },
          { role: "MEMBER", perms: "Execute AI calls and view own audit logs only.", color: "zinc" },
        ].map(({ role, perms, color }) => (
          <div
            key={role}
            className={`rounded-xl border p-4 ${
              color === "amber" ? "border-amber-500/20 bg-amber-950/10" :
              color === "violet" ? "border-violet-500/20 bg-violet-950/10" :
              "border-zinc-700/30 bg-zinc-800/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                color === "amber" ? "text-amber-400 bg-amber-500/10" :
                color === "violet" ? "text-violet-400 bg-violet-500/10" :
                "text-zinc-400 bg-zinc-700/30"
              }`}>{role}</span>
            </div>
            <p className="text-xs text-slate-400">{perms}</p>
          </div>
        ))}
      </div>

      {/* ── Members Table ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Team Members
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={fetchMembers}
              aria-label="Refresh team members"
              className="text-[11px] text-slate-500 hover:text-white transition-colors border border-slate-700 rounded-lg px-2.5 py-1 hover:border-slate-500"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={3} columns={5} />
        ) : members.length === 0 ? (
          <EmptyState
            icon="sparkle"
            headline="Your team starts here"
            description="Invite colleagues to collaborate in your sovereign AI workspace. All members automatically inherit your tenant's active V85 Compliance Frameworks."
            action={{
              label: "Invite Your First Member",
              onClick: () => setShowModal(true),
              id: "empty-state-invite",
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Member", "Role", "Status", "Joined", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const roleConf   = ROLE_CONFIG[m.role];
                  const statusConf = STATUS_CONFIG[m.status];
                  return (
                    <tr key={m.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-slate-200">{m.name || "—"}</p>
                          <p className="text-slate-500 font-mono mt-0.5">{m.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${roleConf.color}`}>
                          {roleConf.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                          <span className="text-slate-400 capitalize">{statusConf.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-[10px]">
                        {m.joined_at
                          ? new Date(m.joined_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })
                          : "Pending"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {m.role !== "OWNER" && (
                          <button className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors border border-red-500/10 hover:border-red-500/25 rounded-lg px-2.5 py-1">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <InviteModal onClose={() => setShowModal(false)} onSuccess={handleInviteSuccess} />
      )}
    </div>
  );
}
