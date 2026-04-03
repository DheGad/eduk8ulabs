"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/infrastructure/attestation
 * @version V49
 * @description Silicon Hardware Attestation — Hardware Root of Trust Dashboard.
 *
 * Simulates AWS Nitro Enclave / Intel TDX PCR verification in real-time.
 * Aesthetic: Obsidian & Emerald (bg-black, border-white/10, text-emerald-400).
 */

// ================================================================
// TYPES
// ================================================================

interface PCREntry {
  id: string;
  register: string;
  label: string;
  hash: string;
  status: "VERIFIED" | "SCANNING" | "PENDING";
  lastChecked: string;
}

interface TerminalLine {
  id: number;
  ts: string;
  register: string;
  hash: string;
  tag: "VERIFIED" | "BOOT" | "WARN" | "INIT";
}

// ================================================================
// CONSTANTS — Mock SHA-384 baselines
// ================================================================

const PCR_BASELINES: Pick<PCREntry, "register" | "label" | "hash">[] = [
  {
    register: "PCR0",
    label: "OS / Kernel Execution State",
    hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
  },
  {
    register: "PCR1",
    label: "Platform Configuration Lock",
    hash: "9c8b7a6f5e4d3c2b1a09f8e7d6c5b4a39c8b7a6f5e4d3c2b1a09f8e7d6c5b4a3ef12",
  },
  {
    register: "PCR2",
    label: "Application Binary Integrity",
    hash: "3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c3b21",
  },
];

function buildPCRState(): PCREntry[] {
  return PCR_BASELINES.map((p, i) => ({
    ...p,
    id: `pcr-${i}`,
    status: "PENDING",
    lastChecked: "—",
  }));
}

function shortHash(hash: string, len = 14): string {
  return hash.slice(0, len) + "…" + hash.slice(-6);
}

function nowTs(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

function nowTime(): string {
  return new Date().toISOString().split("T")[1]?.slice(0, 12) ?? "";
}

function randomHexSuffix(): string {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function GlowRing({ active }: { active: boolean }) {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Outer pulse */}
      {active && (
        <>
          <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-emerald-500/15 animate-ping [animation-delay:300ms]" />
        </>
      )}
      {/* Static rings */}
      <div
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: active ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.06)" }}
      />
      <div className="absolute inset-3 rounded-full border border-white/5" />
      <div className="absolute inset-6 rounded-full border border-white/5" />
      {/* Core */}
      <div
        className="relative z-10 w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1"
        style={{
          background: active
            ? "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)"
            : "rgba(255,255,255,0.03)",
          border: active ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: active ? "0 0 30px rgba(16,185,129,0.25), inset 0 0 20px rgba(16,185,129,0.05)" : "none",
        }}
      >
        <span className="text-2xl">🖧</span>
        <span className="text-[8px] font-black tracking-[0.15em] text-white/60">SILICON</span>
      </div>
    </div>
  );
}

function PCRCard({ entry, index, delay }: { entry: PCREntry; index: number; delay: number }) {
  const colors = {
    VERIFIED: {
      border: "rgba(16,185,129,0.3)",
      bg: "rgba(16,185,129,0.05)",
      badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      dot: "bg-emerald-400",
    },
    SCANNING: {
      border: "rgba(251,191,36,0.3)",
      bg: "rgba(251,191,36,0.04)",
      badge: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      dot: "bg-amber-400 animate-pulse",
    },
    PENDING: {
      border: "rgba(255,255,255,0.08)",
      bg: "rgba(255,255,255,0.02)",
      badge: "bg-zinc-800 border-white/10 text-zinc-500",
      dot: "bg-zinc-600",
    },
  };
  const c = colors[entry.status];

  return (
    <div
      className="rounded-xl p-4 transition-all duration-700"
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
          <span className="text-xs font-black tracking-widest text-white/90 uppercase">
            {entry.register}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">#{index}</span>
        </div>
        <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded border uppercase ${c.badge}`}>
          {entry.status}
        </span>
      </div>

      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">{entry.label}</p>

      <div className="font-mono text-[10px] text-emerald-400/80 bg-black/30 rounded px-2 py-1.5 break-all leading-relaxed">
        {shortHash(entry.hash, 20)}
      </div>

      <p className="text-[9px] text-zinc-600 mt-2 font-mono">
        Last verified: {entry.lastChecked}
      </p>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function SiliconAttestationPage() {
  const [mounted, setMounted] = useState(false);
  const [pcrs, setPcrs] = useState<PCREntry[]>(buildPCRState());
  const [termLines, setTermLines] = useState<TerminalLine[]>([]);
  const [tamperEvents] = useState(0);
  const [uptimeSec, setUptimeSec] = useState(0);
  const [scanCycle, setScanCycle] = useState(0);
  const lineId = useRef(0);
  const termRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  useEffect(() => {
    setMounted(true);

    // Initial boot log
    const bootLines: TerminalLine[] = [
      { id: lineId.current++, ts: nowTime(), register: "SYS", hash: "Initializing Nitro Enclave Boot Sequence…", tag: "BOOT" },
      { id: lineId.current++, ts: nowTime(), register: "SYS", hash: "Loading Platform Configuration Registers…", tag: "INIT" },
      { id: lineId.current++, ts: nowTime(), register: "SYS", hash: "Establishing HMAC-SHA-384 baseline signatures…", tag: "INIT" },
    ];
    setTermLines(bootLines);

    // Stagger PCR activation
    PCR_BASELINES.forEach((_, i) => {
      setTimeout(() => {
        setPcrs((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "SCANNING" } : p
          )
        );

        setTimeout(() => {
          setPcrs((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: "VERIFIED", lastChecked: nowTs() }
                : p
            )
          );
          setTermLines((prev) => {
            const next = [
              ...prev,
              {
                id: lineId.current++,
                ts: nowTime(),
                register: `PCR${i}`,
                hash: PCR_BASELINES[i]!.hash.slice(0, 32) + "…",
                tag: "VERIFIED" as const,
              },
            ];
            return next.slice(-20);
          });
        }, 1200);
      }, 800 + i * 900);
    });
  }, []);

  // Continuous re-verification loop
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * 3);

      setPcrs((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, status: "SCANNING" } : p))
      );

      setTimeout(() => {
        const suffix = randomHexSuffix();
        setPcrs((prev) =>
          prev.map((p, i) =>
            i === idx
              ? { ...p, status: "VERIFIED", lastChecked: nowTs() }
              : p
          )
        );

        setTermLines((prev) => {
          const next = [
            ...prev,
            {
              id: lineId.current++,
              ts: nowTime(),
              register: `PCR${idx}`,
              hash: PCR_BASELINES[idx]!.hash.slice(0, 24) + suffix + "…",
              tag: "VERIFIED" as const,
            },
          ];
          return next.slice(-22);
        });

        setScanCycle((c) => c + 1);
      }, 900);
    }, 2800);

    return () => clearInterval(interval);
  }, [mounted]);

  // Uptime counter
  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(() => setUptimeSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mounted]);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [termLines]);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const allVerified = pcrs.every((p) => p.status === "VERIFIED");

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  color: "rgb(52,211,153)",
                }}
              >
                V49
              </span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
                Silicon Hardware Attestation
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Hardware{" "}
              <span className="text-emerald-400">Root of Trust</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-lg">
              AWS Nitro Enclave simulation. PCR measurements verified against
              the signed boot manifest. Any deviation halts all AI execution.
            </p>
          </div>

          {/* Metric Strip */}
          <div className="flex flex-wrap items-center gap-6 lg:gap-8 border-l border-white/8 lg:pl-8">
            {[
              {
                label: "Enclave State",
                value: allVerified ? "Locked & Verified" : "Scanning…",
                valueClass: allVerified ? "text-emerald-400" : "text-amber-400",
              },
              {
                label: "Hardware",
                value: "AWS Nitro (Mock)",
                valueClass: "text-zinc-300",
              },
              {
                label: "Tamper Events",
                value: String(tamperEvents),
                valueClass: tamperEvents === 0 ? "text-emerald-400" : "text-red-400",
              },
              {
                label: "Scan Cycles",
                value: String(scanCycle),
                valueClass: "text-zinc-300",
              },
              {
                label: "Enclave Uptime",
                value: formatUptime(uptimeSec),
                valueClass: "text-zinc-300 font-mono",
              },
            ].map(({ label, value, valueClass }, i) => (
              <div key={i} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">
                  {label}
                </p>
                <p className={`text-sm font-black uppercase tracking-wide ${valueClass}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Left: CPU Enclave Visual + PCR Cards */}
        <div className="xl:col-span-1 space-y-6">

          {/* CPU Diagram */}
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-6 relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* Background glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: allVerified ? "radial-gradient(circle, rgba(16,185,129,0.8), transparent 70%)" : "radial-gradient(circle, rgba(251,191,36,0.6), transparent 70%)" }}
            />

            <div className="text-center relative z-10">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                CPU Enclave Isolation
              </p>
              <GlowRing active={allVerified} />
            </div>

            {/* Status */}
            <div
              className="relative z-10 w-full rounded-lg px-4 py-3 flex items-center gap-3"
              style={{
                background: allVerified ? "rgba(16,185,129,0.08)" : "rgba(251,191,36,0.08)",
                border: allVerified ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(251,191,36,0.2)",
              }}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allVerified ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
              <div>
                <p className={`text-xs font-black tracking-wide ${allVerified ? "text-emerald-400" : "text-amber-400"}`}>
                  {allVerified ? "ENCLAVE SECURED" : "SCANNING REGISTERS"}
                </p>
                <p className="text-[9px] text-zinc-600 font-mono mt-0.5">
                  {allVerified ? "All PCR measurements match signed baseline" : "Platform configuration registers updating…"}
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="relative z-10 w-full grid grid-cols-3 gap-2">
              {["Kernel", "Config", "Binary"].map((lbl, i) => (
                <div
                  key={i}
                  className="text-center py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[8px] text-zinc-600 uppercase tracking-wider">PCR{i}</p>
                  <p className="text-[9px] text-zinc-400 font-semibold">{lbl}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PCR Register Cards */}
          <div className="space-y-3">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest pl-1">
              Platform Configuration Registers
            </p>
            {pcrs.map((entry, i) => (
              <PCRCard key={entry.id} entry={entry} index={i} delay={i * 100} />
            ))}
          </div>
        </div>

        {/* Right: Terminal + Info Cards */}
        <div className="xl:col-span-2 space-y-6">

          {/* Live PCR Attestation Terminal */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Terminal chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-[10px] text-zinc-500 font-mono ml-2">
                nitro-attestation-daemon — hw-root-of-trust
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-500 font-mono">LIVE</span>
              </div>
            </div>

            {/* Terminal body */}
            <div
              ref={termRef}
              className="h-80 overflow-y-auto p-4 font-mono bg-black/60"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="space-y-1.5">
                {termLines.map((line) => {
                  const tagStyles: Record<TerminalLine["tag"], string> = {
                    VERIFIED: "text-emerald-500",
                    BOOT: "text-sky-400",
                    WARN: "text-amber-400",
                    INIT: "text-zinc-500",
                  };
                  const tagBadge: Record<TerminalLine["tag"], string> = {
                    VERIFIED: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                    BOOT: "bg-sky-500/10 border-sky-500/30 text-sky-400",
                    WARN: "bg-amber-500/10 border-amber-500/30 text-amber-400",
                    INIT: "bg-zinc-800 border-white/10 text-zinc-500",
                  };

                  return (
                    <div
                      key={line.id}
                      className="flex items-baseline gap-2 text-[11px] leading-5"
                    >
                      <span className="text-zinc-700 flex-shrink-0">›</span>
                      <span className="text-zinc-600 flex-shrink-0">{line.ts}</span>
                      <span className={`flex-shrink-0 w-10 font-bold ${tagStyles[line.tag]}`}>
                        {line.register}
                      </span>
                      <span className="text-zinc-400 flex-1 truncate">{line.hash}</span>
                      <span
                        className={`flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded border font-bold tracking-widest ${tagBadge[line.tag]}`}
                      >
                        {line.tag}
                      </span>
                    </div>
                  );
                })}

                {/* Blinking cursor */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-zinc-700">›</span>
                  <span className="w-2 h-3.5 bg-emerald-500 opacity-80 animate-pulse rounded-sm inline-block" />
                </div>
              </div>
            </div>
          </div>

          {/* Info Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "🔐",
                title: "Enclave Type",
                value: "AWS Nitro",
                sub: "Mock PCR Simulation",
                color: "rgba(16,185,129,0.2)",
              },
              {
                icon: "🔀",
                title: "Hash Algorithm",
                value: "SHA-384",
                sub: "HMAC-signed payload",
                color: "rgba(139,92,246,0.2)",
              },
              {
                icon: "⚡",
                title: "Proxy Guard",
                value: "INJECTED",
                sub: "Pre-execution gate active",
                color: "rgba(245,158,11,0.2)",
              },
            ].map(({ icon, title, value, sub, color }, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3"
                  style={{ background: color }}
                >
                  {icon}
                </div>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">
                  {title}
                </p>
                <p className="text-sm font-black text-white tracking-wide">{value}</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Proxy Injection Status Banner */}
          <div
            className="rounded-xl p-5"
            style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="text-2xl">🛡️</div>
                <div>
                  <p className="text-sm font-black text-emerald-400 tracking-wide">
                    PROXY PIPELINE GUARD — ACTIVE
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    <code className="text-zinc-400">proxyRoutes.ts</code> → V49 attestation check fires{" "}
                    <em>before any prompt processing</em>. A PCR mismatch throws{" "}
                    <code className="text-red-400">FATAL_ENCLAVE_COMPROMISE</code> and halts all traffic.
                  </p>
                </div>
              </div>
              <div
                className="flex-shrink-0 px-4 py-2 rounded-lg text-[10px] font-black tracking-widest text-emerald-400 uppercase"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                HTTP 403 on Tamper
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
