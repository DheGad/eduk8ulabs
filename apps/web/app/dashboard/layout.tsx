"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser } from "@/lib/apiClient";
import OrgSwitcher from "@/components/layout/OrgSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * @file layout.tsx
 * @version V100 — Project Omega / Unification Pass
 * @description Sovereign Command Center — Unified Sidebar
 *
 * Navigation reorganized into 4 user-goal sections:
 *   WORK     — AI Workspace, App Builder, Workflows, Agents
 *   PROTECT  — Security, Compliance, Vault, Audit
 *   MANAGE   — Infrastructure, IAM, Keys, Billing, Settings
 *   GROW     — Analytics, Marketplace, Developer, Intelligence
 */

// ────────────────────────────────────────────────────────────────
// NAV DATA
// ────────────────────────────────────────────────────────────────

import { Zap, Shield, Settings, TrendingUp, MessageSquare, Puzzle, Store, Bot, Rocket, ShieldCheck, Database, Key, Hexagon, Crosshair, FileText, FileCheck, Search, Activity, Cpu, Cloud, Globe, RefreshCw, Palette, Building2, UserCog, Factory, BarChart2, DollarSign, PlugZap, BrainCircuit, Activity as Flash, BookOpen, Sparkles } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  sub: string;
  badge?: "NEW" | "HOT" | "V100";
}

interface NavSection {
  group: string;
  groupIcon: React.ReactNode;
  items: NavItem[];
}

// ── Core navigation — always visible ─────────────────────────────
const CORE_SECTIONS: NavSection[] = [
  {
    group: "Work",
    groupIcon: <Zap className="w-4 h-4" />,
    items: [
      {
        href: "/dashboard/welcome",
        label: "Get Started",
        icon: <Rocket className="w-4 h-4" />,
        sub: "Setup guide & onboarding",
        badge: "NEW",
      },
      {
        href: "/dashboard/workspace",
        label: "AI Workspace",
        icon: <MessageSquare className="w-4 h-4" />,
        sub: "Secure AI chat — no data leaks",
        badge: "HOT",
      },
      {
        href: "/dashboard/agents",
        label: "AI Assistants",
        icon: <Bot className="w-4 h-4" />,
        sub: "Automated AI workflows",
      },
      {
        href: "/dashboard/workflows",
        label: "AI Workflows",
        icon: <Store className="w-4 h-4" />,
        sub: "Pre-built enterprise automations",
      },
      {
        href: "/dashboard/builder",
        label: "Workflow Builder",
        icon: <Puzzle className="w-4 h-4" />,
        sub: "Build custom no-code workflows",
        badge: "NEW",
      },
    ],
  },
  {
    group: "Protect",
    groupIcon: <Shield className="w-4 h-4" />,
    items: [
      {
        href: "/dashboard/security/dlp",
        label: "AI Protection Engine",
        icon: <ShieldCheck className="w-4 h-4" />,
        sub: "Block PII, control AI access",
      },
      {
        href: "/dashboard/sovereign/audit",
        label: "AI Activity",
        icon: <FileCheck className="w-4 h-4" />,
        sub: "Full tamper-proof audit log",
      },
      {
        href: "/dashboard/compliance/soc2",
        label: "Compliance Reports",
        icon: <FileText className="w-4 h-4" />,
        sub: "SOC 2 · HIPAA · ISO 27001",
      },
    ],
  },
  {
    group: "Manage",
    groupIcon: <Settings className="w-4 h-4" />,
    items: [
      {
        href: "/dashboard/settings/organization",
        label: "Team & Members",
        icon: <Building2 className="w-4 h-4" />,
        sub: "Invite people, manage seats",
        badge: "NEW",
      },
      {
        href: "/dashboard/admin/keys",
        label: "API Keys",
        icon: <Key className="w-4 h-4" />,
        sub: "Developer credentials & access",
      },
      {
        href: "/dashboard/analytics",
        label: "Usage & Cost",
        icon: <BarChart2 className="w-4 h-4" />,
        sub: "AI usage analytics & FinOps",
      },
      {
        href: "/dashboard/developer/integration",
        label: "Integrations",
        icon: <PlugZap className="w-4 h-4" />,
        sub: "SDK, OpenAI override, webhooks",
      },
    ],
  },
];

// ── Advanced navigation — collapsed by default ────────────────────
const ADVANCED_ITEMS: NavItem[] = [
  {
    href: "/dashboard/security/vault",
    label: "Secure Vault",
    icon: <Database className="w-4 h-4" />,
    sub: "AES-256 encrypted key storage",
  },
  {
    href: "/dashboard/security/iam",
    label: "Identity & Access",
    icon: <Key className="w-4 h-4" />,
    sub: "SSO & role-based access control",
  },
  {
    href: "/dashboard/security/pqc",
    label: "Advanced Encryption",
    icon: <Hexagon className="w-4 h-4" />,
    sub: "Post-quantum cryptography",
  },
  {
    href: "/dashboard/admin/security",
    label: "Security Center",
    icon: <Crosshair className="w-4 h-4" />,
    sub: "Hardening & threat elimination",
  },
  {
    href: "/dashboard/admin/audit",
    label: "Compliance Console",
    icon: <FileCheck className="w-4 h-4" />,
    sub: "Generate compliance certificates",
  },
  {
    href: "/dashboard/admin/traces",
    label: "Request Inspector",
    icon: <Search className="w-4 h-4" />,
    sub: "Request timeline & correlation",
  },
  {
    href: "/dashboard/sovereign",
    label: "Infrastructure",
    icon: <Activity className="w-4 h-4" />,
    sub: "Node health & server stats",
  },
  {
    href: "/dashboard/intelligence/consensus",
    label: "Model Router",
    icon: <Cpu className="w-4 h-4" />,
    sub: "Multi-model routing & weighting",
  },
  {
    href: "/dashboard/infrastructure/byoc",
    label: "Private Cloud (BYOC)",
    icon: <Cloud className="w-4 h-4" />,
    sub: "Private Kubernetes & VPC",
  },
  {
    href: "/dashboard/infrastructure/recovery",
    label: "Disaster Recovery",
    icon: <Globe className="w-4 h-4" />,
    sub: "Automated failover & backup",
  },
  {
    href: "/dashboard/security/keys",
    label: "Key Rotation",
    icon: <RefreshCw className="w-4 h-4" />,
    sub: "AES-256 key lifecycle",
  },
  {
    href: "/dashboard/settings/branding",
    label: "Branding",
    icon: <Palette className="w-4 h-4" />,
    sub: "White-label theme engine",
  },
  {
    href: "/dashboard/admin/intelligence",
    label: "Model Connect",
    icon: <BrainCircuit className="w-4 h-4" />,
    sub: "Adaptive model weighting",
  },
  {
    href: "/dashboard/intelligence/caching",
    label: "Semantic Cache",
    icon: <Flash className="w-4 h-4" />,
    sub: "Vector similarity & cost savings",
  },
  {
    href: "/dashboard/intelligence/rag",
    label: "Secure RAG",
    icon: <BookOpen className="w-4 h-4" />,
    sub: "Private vector database",
  },
  {
    href: "/dashboard/showcase/trust-light",
    label: "Executive Showcase",
    icon: <Sparkles className="w-4 h-4" />,
    sub: "Live demo for leadership",
  },
  {
    href: "/dashboard/admin/ops-assistant",
    label: "Ops Monitor",
    icon: <UserCog className="w-4 h-4" />,
    sub: "AI site reliability — admin only",
  },
  {
    href: "/admin/onprem",
    label: "On-Premise Admin",
    icon: <Factory className="w-4 h-4" />,
    sub: "Air-gapped deployment control",
  },
  {
    href: "/dashboard/sovereign/finance",
    label: "Financial Monitoring",
    icon: <DollarSign className="w-4 h-4" />,
    sub: "Live cost tracking & FinOps",
  },
];

// Legacy alias so existing references still work
const NAV_SECTIONS = CORE_SECTIONS;

// ── Badge colours ────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  NEW: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  HOT: "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

// ────────────────────────────────────────────────────────────────
// LAYOUT COMPONENT
// ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isCompromised, setIsCompromised] = useState(false);
  const [brandPrimary, setBrandPrimary] = useState("#10b981");
  const [orgName, setOrgName] = useState("StreetMP");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // ── V62 Dynamic Branding ───────────────────────────────────────
  useEffect(() => {
    const syncBrand = () => {
      const root = getComputedStyle(document.documentElement);
      const primary = root.getPropertyValue("--brand-primary").trim();
      if (primary) setBrandPrimary(primary);
      const stored = sessionStorage.getItem("v62-org-name");
      if (stored) setOrgName(stored);
    };
    syncBrand();
    const t = setInterval(syncBrand, 2000);
    return () => clearInterval(t);
  }, []);

  // ── Tamper Alarm ────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/v1/health/tamper-status");
        if (res.ok) {
          const data = await res.json() as { compromised?: boolean };
          if (data.compromised) setIsCompromised(true);
        }
      } catch { /* fail-open: tamper check does not block UI */ }
    };
    check();
    const t = setInterval(check, 15_000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-expand active section ──────────────────────────────────
  useEffect(() => {
    const active = NAV_SECTIONS.find((s) =>
      s.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    );
    if (active) setExpandedGroup(active.group);
  }, [pathname]);

  // ── [Phase 3] First-Login Redirect ───────────────────────────
  // Runs once on mount. If onboarding has not been completed and the
  // user is not already on /dashboard/welcome, redirect there.
  useEffect(() => {
    if (pathname.startsWith("/dashboard/welcome")) return;
    const done =
      localStorage.getItem("onboarding_completed") === "true" ||
      localStorage.getItem("v100-walkthrough-done") === "true";
    if (!done) router.replace("/dashboard/welcome");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on initial mount only

  function handleLogout() {
    logoutUser();
    router.push("/login");
  }

  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-canvas)" }}>

      {/* ═══════════════════════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════════════════════ */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } shrink-0 flex flex-col transition-all duration-300 border-r sidebar-root`}
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}
      >
        {/* Logo Row */}
        <div
          className={`flex items-center ${
            collapsed ? "justify-center px-0" : "justify-between px-4"
          } py-5`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${brandPrimary}, ${brandPrimary}99)`,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8C3 5.24 5.24 3 8 3s5 2.24 5 5-2.24 5-5 5S3 10.76 3 8z" fill="white" fillOpacity="0.3"/>
                  <path d="M8 5.5C6.62 5.5 5.5 6.62 5.5 8S6.62 10.5 8 10.5 10.5 9.38 10.5 8 9.38 5.5 8 5.5z" fill="white"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>StreetMP OS</p>
                <p className="text-[10px] mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                  Enterprise AI Platform
                </p>
              </div>
            </div>
          )}
          <button
            id="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-xs shrink-0 hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-muted)" }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Status strip */}
        {!collapsed && (
          <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>All systems operational</span>
            </div>
          </div>
        )}

        {/* [Phase 4] Org Switcher */}
        {!collapsed && <OrgSwitcher />}

        {/* Navigation */}
        <nav className="flex-1 px-2 overflow-y-auto space-y-1 pb-4">
          {NAV_SECTIONS.map((section) => {
            const isExpanded = expandedGroup === section.group || collapsed;
            const hasActive = section.items.some((i) => isItemActive(i.href));

            return (
              <div key={section.group}>
                {/* Group Header */}
                {!collapsed && (
                  <button
                    id={`nav-group-${section.group.toLowerCase()}`}
                    onClick={() =>
                      setExpandedGroup(isExpanded ? null : section.group)
                    }
                    className="w-full flex items-center justify-between px-3 py-2 mt-2 rounded-lg transition-all"
                    style={{ color: hasActive ? "var(--text-primary)" : "var(--text-dimmed)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ opacity: hasActive ? 0.9 : 0.5 }}>{section.groupIcon}</span>
                      <span className="text-[11px] font-semibold tracking-normal" style={{ color: hasActive ? "var(--text-muted)" : "var(--text-dimmed)" }}>
                        {section.group}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] transition-transform duration-200 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                      style={{ color: "var(--text-dimmed)" }}
                    >
                      ›
                    </span>
                  </button>
                )}

                {/* Items */}
                {isExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {section.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={collapsed ? item.label : item.sub}
                          className={`flex items-center gap-3 rounded-lg transition-all group ${
                            collapsed
                              ? "px-2 py-2.5 justify-center"
                              : "py-2 pl-3 pr-2"
                          }`}
                          style={{
                            background: active ? "var(--bg-active)" : "transparent",
                            color: active ? "var(--sidebar-active)" : "var(--sidebar-text)",
                            boxShadow: active ? `inset 3px 0 0 ${brandPrimary}` : "none",
                          }}
                        >
                          <span
                            className="text-[16px] shrink-0 transition-opacity"
                            style={{ opacity: active ? 1 : 0.55 }}
                          >
                            {item.icon}
                          </span>
                          {!collapsed && (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p
                                  className="text-[13px] font-medium truncate leading-none"
                                  style={{ color: active ? "var(--sidebar-active)" : "var(--text-secondary)" }}
                                >
                                  {item.label}
                                </p>
                                {item.badge && BADGE_STYLES[item.badge] && (
                                  <span
                                    className={`shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider border ${
                                      BADGE_STYLES[item.badge]
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-[11px] truncate mt-0.5"
                                style={{ color: "var(--text-dimmed)" }}
                              >
                                {item.sub}
                              </p>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Advanced Section (collapsed by default) ─────── */}
          {!collapsed && (
            <div className="mt-1">
              <button
                id="nav-group-advanced"
                onClick={() => setAdvancedExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 mt-2 rounded-lg transition-all"
                style={{ color: "var(--text-dimmed)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ opacity: 0.4 }}>
                    <Settings className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-normal" style={{ color: "var(--text-dimmed)" }}>
                    Advanced
                  </span>
                </div>
                <span
                  className={`text-[10px] transition-transform duration-200 ${
                    advancedExpanded ? "rotate-90" : ""
                  }`}
                  style={{ color: "var(--text-dimmed)" }}
                >
                  ›
                </span>
              </button>

              {advancedExpanded && (
                <div className="space-y-0.5 mt-0.5">
                  {ADVANCED_ITEMS.map((item) => {
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.sub}
                        className="flex items-center gap-3 rounded-lg transition-all group py-2 pl-3 pr-2"
                        style={{
                          background: active ? "var(--bg-active)" : "transparent",
                          color: active ? "var(--sidebar-active)" : "var(--sidebar-text)",
                          boxShadow: active ? `inset 3px 0 0 ${brandPrimary}` : "none",
                        }}
                      >
                        <span
                          className="text-[16px] shrink-0 transition-opacity"
                          style={{ opacity: active ? 1 : 0.45 }}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] font-medium truncate leading-none"
                            style={{ color: active ? "var(--sidebar-active)" : "var(--text-secondary)" }}
                          >
                            {item.label}
                          </p>
                          <p
                            className="text-[11px] truncate mt-0.5"
                            style={{ color: "var(--text-dimmed)" }}
                          >
                            {item.sub}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-2 pb-4 space-y-1 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {!collapsed && (
            <div className="mx-1 mb-2 px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-[10px] font-semibold" style={{ color: "var(--text-dimmed)" }}>
                StreetMP OS · Enterprise
              </p>
              <ThemeToggle />
            </div>
          )}
          <button
            id="sidebar-logout"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 rounded-lg text-xs font-medium transition-all hover:text-red-500 ${
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
            }`}
            style={{ color: "var(--text-dimmed)" }}
            title="Sign out of your session"
          >
            <span className="text-base">↩</span>
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-auto relative min-w-0">
        {/* Tamper Alarm Banner — dev-only */}
        {isCompromised && process.env.NODE_ENV === "development" && (
          <div className="sticky top-0 w-full bg-red-600/90 text-white font-semibold text-center py-2 z-50 text-xs border-b border-red-500/40">
            Security alert detected. Review system diagnostics.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
