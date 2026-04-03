"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/infrastructure/isolation
 * @version V52
 * @description Blast Radius Containment — Multi-Tenant Isolation Grid
 *
 * Shows 3 simulated tenant environments. Simulates a "Memory Overflow Attack"
 * from Bank Beta and shows the firewall locking down Beta while Alpha and Gamma
 * stay fully green and operational. Obsidian & Emerald aesthetic.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS
 */

// ================================================================
// TYPES
// ================================================================

type TenantStatus = "ACTIVE" | "RATE_LIMITED" | "QUARANTINED" | "BLAST_CONTAINED";
type AttackPhase = "idle" | "probing" | "overflow" | "contained";

interface TenantEnv {
  id: string;
  name: string;
  sector: string;
  icon: string;
  sandboxNs: string;
  requestCount: number;
  status: TenantStatus;
  dlpContexts: number;
  vaultKeys: number;
  bleedAttempts: number;
  latencyMs: number;
  memUsageMb: number;
}

interface BleedEvent {
  id: number;
  ts: string;
  tenantId: string;
  tenantName: string;
  resourceId: string;
  resourceType: "vault" | "dlp";
  ownerTenant: string;
  blocked: boolean;
}

// ================================================================
// INITIAL STATE
// ================================================================

const INITIAL_TENANTS: TenantEnv[] = [
  {
    id: "tenant_alpha",
    name: "Hospital Alpha",
    sector: "Healthcare",
    icon: "🏥",
    sandboxNs: "a3f81c9d02b7e4f5a",
    requestCount: 2841,
    status: "ACTIVE",
    dlpContexts: 34,
    vaultKeys: 12,
    bleedAttempts: 0,
    latencyMs: 9,
    memUsageMb: 128,
  },
  {
    id: "tenant_beta",
    name: "Bank Beta",
    sector: "Financial",
    icon: "🏦",
    sandboxNs: "f72e0b3c91a4d8e2b",
    requestCount: 5523,
    status: "ACTIVE",
    dlpContexts: 81,
    vaultKeys: 47,
    bleedAttempts: 0,
    latencyMs: 7,
    memUsageMb: 256,
  },
  {
    id: "tenant_gamma",
    name: "Clinic Gamma",
    sector: "Healthcare",
    icon: "💉",
    sandboxNs: "c14a9f2d70b3e8c61",
    requestCount: 1102,
    status: "ACTIVE",
    dlpContexts: 19,
    vaultKeys: 7,
    bleedAttempts: 0,
    latencyMs: 11,
    memUsageMb: 64,
  },
  {
    id: "tenant_delta",
    name: "Delta Corp",
    sector: "Legal",
    icon: "⚖️",
    sandboxNs: "d88b5e3c12f7a09d4",
    requestCount: 3317,
    status: "ACTIVE",
    dlpContexts: 52,
    vaultKeys: 23,
    bleedAttempts: 0,
    latencyMs: 8,
    memUsageMb: 192,
  },
];

function nowTime(): string {
  return new Date().toISOString().replace("T", " ").slice(11, 23);
}

const STATUS_CONFIG: Record<TenantStatus, { color: string; glow: string; border: string; label: string; bg: string }> = {
  ACTIVE:          { color: "rgb(52,211,153)",   glow: "rgba(16,185,129,0.4)",  border: "rgba(16,185,129,0.3)",  label: "ACTIVE",           bg: "rgba(16,185,129,0.07)"  },
  RATE_LIMITED:    { color: "rgb(253,211,77)",   glow: "rgba(245,158,11,0.4)",  border: "rgba(245,158,11,0.35)", label: "RATE LIMITED",     bg: "rgba(245,158,11,0.07)"  },
  QUARANTINED:     { color: "rgb(252,165,165)",  glow: "rgba(239,68,68,0.4)",   border: "rgba(239,68,68,0.3)",   label: "QUARANTINED",      bg: "rgba(239,68,68,0.07)"   },
  BLAST_CONTAINED: { color: "rgb(248,113,113)",  glow: "rgba(239,68,68,0.6)",   border: "rgba(239,68,68,0.5)",   label: "🚨 BLAST CONTAINED", bg: "rgba(239,68,68,0.1)"  },
};

// ================================================================
// TENANT CARD
// ================================================================

function TenantCard({
  tenant,
  attackPhase,
  isAttacker,
}: {
  tenant: TenantEnv;
  attackPhase: AttackPhase;
  isAttacker: boolean;
}) {
  const cfg = STATUS_CONFIG[tenant.status];
  const isBlasted = tenant.status === "BLAST_CONTAINED";
  const isHealthy = tenant.status === "ACTIVE" && !isAttacker;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-700 relative"
      style={{
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        boxShadow: isBlasted ? `0 0 30px ${cfg.glow}` : isHealthy ? `0 0 12px rgba(16,185,129,0.08)` : "none",
      }}
    >
      {/* Attack overlay shimmer */}
      {isAttacker && attackPhase === "probing" && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse rounded-2xl"
          style={{ background: "rgba(245,158,11,0.05)", zIndex: 1 }}
        />
      )}
      {isAttacker && (attackPhase === "overflow" || attackPhase === "contained") && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse rounded-2xl"
          style={{ background: "rgba(239,68,68,0.08)", zIndex: 1 }}
        />
      )}

      {/* Card header */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: cfg.border, background: "rgba(0,0,0,0.3)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{tenant.icon}</span>
          <div>
            <p className="text-sm font-black text-white tracking-tight">{tenant.name}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{tenant.sector}</p>
          </div>
        </div>
        <div className="text-right">
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded tracking-widest"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-5 space-y-4">
        {/* Sandbox namespace */}
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Sandbox Namespace</p>
          <p className="text-[9px] font-mono" style={{ color: cfg.color }}>{tenant.sandboxNs}…</p>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Requests", value: tenant.requestCount.toLocaleString() },
            { label: "DLP Contexts", value: String(tenant.dlpContexts) },
            { label: "Vault Keys", value: String(tenant.vaultKeys) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg p-2 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-xs font-black" style={{ color: cfg.color, fontFamily: "monospace" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Memory usage bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Memory Partition</p>
            <p className="text-[9px] font-mono" style={{ color: cfg.color }}>
              {isAttacker && attackPhase === "overflow"
                ? "OVERFLOW ⚠"
                : `${tenant.memUsageMb} MB`}
            </p>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: isAttacker && attackPhase === "overflow" ? "100%" : `${Math.min((tenant.memUsageMb / 512) * 100, 100)}%`,
                background: isBlasted
                  ? "rgb(239,68,68)"
                  : isAttacker && attackPhase === "probing"
                  ? "rgb(245,158,11)"
                  : `linear-gradient(90deg, ${cfg.color}, ${cfg.glow})`,
              }}
            />
          </div>
        </div>

        {/* Bleed attempts */}
        {tenant.bleedAttempts > 0 && (
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <p className="text-[9px] font-black text-red-400">
              🚨 {tenant.bleedAttempts} CROSS-TENANT BLEED ATTEMPT{tenant.bleedAttempts > 1 ? "S" : ""} DETECTED
            </p>
          </div>
        )}

        {/* Blast contained message */}
        {isBlasted && (
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)" }}
          >
            <p className="text-[9px] font-black text-red-400 leading-relaxed">
              PARTITION LOCKED. Alpha, Gamma & Delta fully isolated. Cross-tenant bleed: 0 leaked.
              Namespace: <span className="font-mono">{tenant.sandboxNs}…</span>
            </p>
          </div>
        )}

        {/* Latency */}
        <div className="flex items-center justify-between">
          <p className="text-[8px] text-zinc-700 uppercase tracking-widest">Partition Latency</p>
          <p className="text-[9px] font-mono" style={{ color: isBlasted ? "rgb(239,68,68)" : "rgb(113,113,122)" }}>
            {isBlasted ? "∞ (HALTED)" : `${tenant.latencyMs}ms`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function TenantIsolationPage() {
  const [mounted, setMounted]           = useState(false);
  const [tenants, setTenants]           = useState<TenantEnv[]>(INITIAL_TENANTS);
  const [attackPhase, setAttackPhase]   = useState<AttackPhase>("idle");
  const [bleedEvents, setBleedEvents]   = useState<BleedEvent[]>([]);
  const [activeTenants, setActiveTenants]     = useState(4);
  const [bleedEventCount, setBleedEventCount] = useState(0);
  const [partitionIntegrity, setPartitionIntegrity] = useState(100);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const eventId = useRef(0);
  const phaseRef = useRef<AttackPhase>("idle");

  useEffect(() => { setMounted(true); }, []);

  // Auto-run simulation loop
  useEffect(() => {
    if (!mounted) return;

    const simulateAttack = async () => {
      if (phaseRef.current !== "idle") return;
      setSimulationRunning(true);

      // Phase 1: Bank Beta starts probing (2s)
      setAttackPhase("probing");
      phaseRef.current = "probing";
      setTenants((prev) =>
        prev.map((t) => t.id === "tenant_beta" ? { ...t, status: "RATE_LIMITED" } : t)
      );

      // Emit bleed probe event
      const probeEvent: BleedEvent = {
        id: eventId.current++,
        ts: nowTime(),
        tenantId: "tenant_beta",
        tenantName: "Bank Beta",
        resourceId: "dlp_ctx_alpha_9a3f",
        resourceType: "dlp",
        ownerTenant: "Hospital Alpha",
        blocked: true,
      };
      setBleedEvents((prev) => [probeEvent, ...prev].slice(0, 8));
      setBleedEventCount((n) => n + 1);
      setPartitionIntegrity(97);

      await new Promise((r) => setTimeout(r, 2000));

      // Phase 2: Memory overflow attempt (2.5s)
      setAttackPhase("overflow");
      phaseRef.current = "overflow";
      setTenants((prev) =>
        prev.map((t) => t.id === "tenant_beta"
          ? { ...t, memUsageMb: 512, bleedAttempts: 3 }
          : t
        )
      );

      const overflowEvent: BleedEvent = {
        id: eventId.current++,
        ts: nowTime(),
        tenantId: "tenant_beta",
        tenantName: "Bank Beta",
        resourceId: "vault_key_alpha_7f2c",
        resourceType: "vault",
        ownerTenant: "Hospital Alpha",
        blocked: true,
      };
      setBleedEvents((prev) => [overflowEvent, ...prev].slice(0, 8));
      setBleedEventCount((n) => n + 2);
      setPartitionIntegrity(91);

      await new Promise((r) => setTimeout(r, 2500));

      // Phase 3: Blast contained (3s displayed, then reset)
      setAttackPhase("contained");
      phaseRef.current = "contained";
      setTenants((prev) =>
        prev.map((t) => t.id === "tenant_beta"
          ? { ...t, status: "BLAST_CONTAINED", bleedAttempts: 3 }
          : t
        )
      );
      setActiveTenants(3);
      setPartitionIntegrity(100);

      await new Promise((r) => setTimeout(r, 3000));

      // Reset
      setAttackPhase("idle");
      phaseRef.current = "idle";
      setTenants(INITIAL_TENANTS);
      setActiveTenants(4);
      setPartitionIntegrity(100);
      setSimulationRunning(false);
    };

    // Run first attack after 4s, then every 12s
    const timer = setTimeout(simulateAttack, 4000);
    const interval = setInterval(simulateAttack, 12000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [mounted]);

  if (!mounted) return null;

  const betaTenant = tenants.find((t) => t.id === "tenant_beta")!;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "rgb(52,211,153)" }}
              >
                V52
              </span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
                Blast Radius Containment
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Multi-Tenant <span className="text-emerald-400">Isolation Grid</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              HMAC-partitioned sandbox namespaces. Each tenant's memory, Vault keys, and DLP contexts
              are cryptographically isolated. Cross-tenant bleed triggers instant BLAST_CONTAINED lockdown.
            </p>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              {
                label: "Active Sandboxes",
                value: String(activeTenants),
                cls: "text-emerald-400",
                sub: attackPhase === "contained" ? "1 quarantined" : "4 fully isolated",
              },
              {
                label: "Cross-Tenant Leaks",
                value: "0",
                cls: "text-emerald-400",
                sub: bleedEventCount > 0 ? `${bleedEventCount} attempts blocked` : "zero leaked",
              },
              {
                label: "Isolation Enforcement",
                value: "HW/Logic",
                cls: "text-emerald-400",
                sub: "Hardware + Namespace",
              },
              {
                label: "Partition Integrity",
                value: `${partitionIntegrity}%`,
                cls: partitionIntegrity === 100 ? "text-emerald-400" : "text-yellow-400",
                sub: "namespace isolation",
              },
            ].map(({ label, value, cls, sub }) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black uppercase tracking-wide ${cls}`}>{value}</p>
                <p className="text-[8px] text-zinc-700">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div className="p-8 space-y-6">

        {/* Attack simulation banner */}
        {attackPhase !== "idle" && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{
              background: attackPhase === "contained"
                ? "rgba(16,185,129,0.06)"
                : "rgba(239,68,68,0.06)",
              border: attackPhase === "contained"
                ? "1px solid rgba(16,185,129,0.3)"
                : "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <span className="text-2xl">
              {attackPhase === "contained" ? "🛡️" : "🚨"}
            </span>
            <div>
              <p
                className="text-sm font-black tracking-wide"
                style={{ color: attackPhase === "contained" ? "rgb(52,211,153)" : "rgb(248,113,113)" }}
              >
                {attackPhase === "probing" && "ANOMALY DETECTED — Bank Beta probing cross-tenant resources…"}
                {attackPhase === "overflow" && "MEMORY OVERFLOW ATTACK — Bank Beta attempting to access Hospital Alpha vault keys & DLP contexts!"}
                {attackPhase === "contained" && "BLAST RADIUS CONTAINED — Beta partition locked. Alpha & Gamma unaffected. Firewall integrity: 100%."}
              </p>
              <p className="text-[9px] text-zinc-500 mt-0.5">
                TenantFirewall.assignTenantPartition() → checkCrossTenantBleed() → auto-quarantine triggered
              </p>
            </div>
            {attackPhase !== "contained" && (
              <div className="ml-auto">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full animate-ping"
                    style={{ background: "rgb(239,68,68)" }}
                  />
                  <span className="text-[9px] font-mono text-red-400">DETECTING</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tenant Grid — 2×2 layout for 4 enterprise tenants */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              attackPhase={attackPhase}
              isAttacker={tenant.id === "tenant_beta"}
            />
          ))}
        </div>

        {/* Bottom section: pipeline + event log */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Pipeline injection banner */}
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
              Proxy Pipeline — V52 Injection Point
            </p>
            <div className="flex flex-wrap items-center gap-y-2 text-[9px] font-mono">
              {[
                { label: "V49 Attestation",          highlight: false },
                { label: "→", arrow: true },
                { label: "V52 TenantFirewall()",     highlight: true  },
                { label: "→", arrow: true },
                { label: "V50 IAM",                  highlight: false },
                { label: "→", arrow: true },
                { label: "V51 DLP.tokenize()",       highlight: false },
                { label: "→", arrow: true },
                { label: "V48 BFT",                  highlight: false },
                { label: "→", arrow: true },
                { label: "LLM",                      highlight: false },
                { label: "→", arrow: true },
                { label: "V51 DLP.detokenize()",     highlight: false },
                { label: "→", arrow: true },
                { label: "Client",                   highlight: false },
              ].map((step, i) =>
                step.arrow ? (
                  <span key={i} className="text-zinc-700 mx-1">›</span>
                ) : (
                  <span
                    key={i}
                    className="px-2 py-1 rounded font-bold"
                    style={{
                      background: step.highlight ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                      border: step.highlight ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      color: step.highlight ? "rgb(52,211,153)" : "rgb(113,113,122)",
                    }}
                  >
                    {step.label}
                  </span>
                )
              )}
            </div>
            <p className="text-[8px] text-zinc-700 mt-3">
              Tenant partition is assigned <em>before</em> IAM — sandbox namespace is the foundation of every downstream security check.
            </p>
          </div>

          {/* Bleed event log */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                Cross-Tenant Bleed Log
              </p>
              <div className="flex items-center gap-1.5">
                {bleedEvents.length > 0 ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] text-red-500 font-mono">ALERTS</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-emerald-500 font-mono">CLEAN</span>
                  </>
                )}
              </div>
            </div>

            {bleedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-3xl mb-2">🛡️</span>
                <p className="text-sm font-bold text-emerald-400">Zero bleed events</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">All tenant namespaces isolated</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {bleedEvents.map((evt) => (
                  <div key={evt.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-zinc-700 font-mono text-[9px] flex-shrink-0 mt-0.5">{evt.ts}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-red-400">
                        {evt.tenantName} → tried to access {evt.ownerTenant}&apos;s{" "}
                        {evt.resourceType === "vault" ? "🗄️ Vault Key" : "🔐 DLP Context"}
                      </p>
                      <p className="text-[9px] font-mono text-zinc-600 mt-0.5">{evt.resourceId}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span
                        className="text-[8px] font-black px-1.5 py-0.5 rounded"
                        style={{
                          background: evt.blocked ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          color: evt.blocked ? "rgb(52,211,153)" : "rgb(248,113,113)",
                          border: evt.blocked ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)",
                        }}
                      >
                        {evt.blocked ? "BLOCKED" : "LEAKED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
