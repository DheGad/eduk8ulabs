/**
 * @file InfrastructureLiveLayer.tsx
 * @description Persistent atmospheric layer that creates the cinematic
 * "living AI infrastructure" feeling across the entire landing page.
 *
 * This component renders fixed/absolute overlays:
 * - Orbital glow orbs that drift slowly
 * - A mesh grid that provides the "operational floor"
 * - Vertical data streams (thin lines descending)
 * - Floating telemetry indicators at section boundaries
 * - A radar pulse ring that pulses from center
 *
 * IMPORTANT: This is purely visual. No content, no layout impact.
 * Positioned fixed/absolute with pointer-events: none.
 */

"use client";

import { useEffect, useState } from "react";

// Telemetry labels that float at section connectors
const TELEMETRY_LABELS = [
  "NeMo CLAW: ACTIVE",
  "PATTERN_MATCH: 99.2%",
  "LATENCY: 12ms",
  "NODES: 31",
  "ENCLAVE: SECURE",
  "ZERO RETENTION: ON",
  "APAC ROUTING: SG",
  "TLS 1.3: VERIFIED",
  "HMAC: VALID",
  "PII SCAN: LIVE",
];

// Stream data lines
const STREAM_CHARS = "01ABCDEF░▓█▀▄╔╗╚╝─│┼◆◇";

function randomChar() {
  return STREAM_CHARS[Math.floor(Math.random() * STREAM_CHARS.length)];
}

function DataStreamColumn({ left, delay, duration }: { left: number; delay: number; duration: number }) {
  const [chars, setChars] = useState<string[]>([]);

  useEffect(() => {
    setChars(Array.from({ length: 18 }, () => randomChar()));
    const interval = setInterval(() => {
      setChars(prev => {
        const next = [...prev];
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = randomChar();
        return next;
      });
    }, 180 + Math.random() * 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute top-0 flex flex-col gap-1 pointer-events-none"
      style={{
        left: `${left}%`,
        animation: `data-stream ${duration}s linear ${delay}s infinite`,
        opacity: 0,
      }}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          className="text-[8px] font-mono text-emerald-400/20 leading-none"
          style={{ opacity: i < 4 || i > 13 ? 0.1 : 0.6 }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function InfrastructureLiveLayer() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      {/* ── Fixed orbital glows that drift across the entire page ──────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Primary emerald orb */}
        <div
          className="absolute animate-glow-drift"
          style={{
            top: "15%",
            left: "10%",
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Secondary indigo orb */}
        <div
          className="absolute animate-glow-drift-slow"
          style={{
            bottom: "20%",
            right: "8%",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Tertiary micro orb — top right */}
        <div
          className="absolute animate-glow-drift-reverse"
          style={{
            top: "40%",
            right: "20%",
            width: 300,
            height: 300,
            background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
      </div>

      {/* ── Fixed vertical data streams (left and right margins) ─────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Left column streams */}
        <DataStreamColumn left={1.5} delay={0} duration={7} />
        <DataStreamColumn left={3.5} delay={2.5} duration={9} />
        <DataStreamColumn left={6}   delay={1}   duration={6} />
        {/* Right column streams */}
        <DataStreamColumn left={94} delay={0.5} duration={8} />
        <DataStreamColumn left={96} delay={3}   duration={10} />
        <DataStreamColumn left={98} delay={1.5} duration={7} />
      </div>

      {/* ── Fixed floating telemetry strip — left edge ───────────────── */}
      <div
        className="fixed left-4 top-1/3 z-10 pointer-events-none hidden xl:flex flex-col gap-3"
        aria-hidden="true"
      >
        {TELEMETRY_LABELS.slice(0, 5).map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-1.5 animate-telemetry"
            style={{ animationDelay: `${i * 0.8}s` }}
          >
            <span className="w-1 h-1 rounded-full bg-emerald-500 status-live" />
            <span className="text-[9px] font-mono text-emerald-500/30 uppercase tracking-widest whitespace-nowrap">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Fixed floating telemetry strip — right edge ──────────────── */}
      <div
        className="fixed right-4 top-1/2 z-10 pointer-events-none hidden xl:flex flex-col gap-3"
        aria-hidden="true"
      >
        {TELEMETRY_LABELS.slice(5).map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-1.5 justify-end animate-telemetry-slow"
            style={{ animationDelay: `${i * 1.1}s` }}
          >
            <span className="text-[9px] font-mono text-indigo-400/25 uppercase tracking-widest whitespace-nowrap">
              {label}
            </span>
            <span className="w-1 h-1 rounded-full bg-indigo-400 status-live-slow" />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * SectionAtmosphere — inject into any individual section to add:
 * - Mesh grid overlay
 * - Orbital glow
 * - Section-local telemetry label
 * - Optional radar pulse
 */
export function SectionAtmosphere({
  glowColor = "rgba(16,185,129,0.08)",
  glowColor2 = "rgba(99,102,241,0.05)",
  showMesh = true,
  showScan = false,
  telemetry,
  pulse = false,
}: {
  glowColor?: string;
  glowColor2?: string;
  showMesh?: boolean;
  showScan?: boolean;
  telemetry?: string;
  pulse?: boolean;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Mesh grid */}
      {showMesh && (
        <div className="absolute inset-0 infra-mesh opacity-60" />
      )}
      {/* Gradient fade so mesh doesn't reach edges harshly */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]/40" />

      {/* Primary orbital glow */}
      <div
        className="absolute animate-glow-drift"
        style={{
          top: "20%",
          left: "15%",
          width: 500,
          height: 300,
          background: `radial-gradient(ellipse, ${glowColor} 0%, transparent 70%)`,
          borderRadius: "50%",
        }}
      />
      {/* Secondary orbital glow */}
      <div
        className="absolute animate-glow-drift-reverse"
        style={{
          bottom: "15%",
          right: "10%",
          width: 400,
          height: 250,
          background: `radial-gradient(ellipse, ${glowColor2} 0%, transparent 70%)`,
          borderRadius: "50%",
        }}
      />

      {/* Scan line */}
      {showScan && (
        <div
          className="absolute left-0 right-0 h-px animate-grid-scan"
          style={{
            background: "linear-gradient(to right, transparent 0%, rgba(16,185,129,0.3) 30%, rgba(16,185,129,0.6) 50%, rgba(16,185,129,0.3) 70%, transparent 100%)",
            boxShadow: "0 0 8px rgba(16,185,129,0.4)",
            top: 0,
          }}
        />
      )}

      {/* Radar pulse rings */}
      {pulse && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute rounded-full border border-emerald-500/20 animate-radar"
            style={{ width: 120, height: 120, top: -60, left: -60 }}
          />
          <div
            className="absolute rounded-full border border-emerald-500/10 animate-radar-delay"
            style={{ width: 120, height: 120, top: -60, left: -60 }}
          />
        </div>
      )}

      {/* Section telemetry label */}
      {telemetry && (
        <div className="absolute top-4 right-6 hidden lg:flex items-center gap-2 animate-telemetry">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-live" />
          <span className="text-[9px] font-mono text-emerald-500/40 uppercase tracking-widest">
            {telemetry}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * SectionConnector — renders between sections to blend them atmospherically
 */
export function SectionConnector({ variant = "default" }: { variant?: "default" | "intense" }) {
  return (
    <div className="relative h-px w-full pointer-events-none overflow-visible" aria-hidden="true">
      {/* The visible connector line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: variant === "intense"
            ? "linear-gradient(to right, transparent 0%, rgba(16,185,129,0.3) 30%, rgba(16,185,129,0.5) 50%, rgba(16,185,129,0.3) 70%, transparent 100%)"
            : "linear-gradient(to right, transparent 0%, rgba(16,185,129,0.1) 30%, rgba(16,185,129,0.2) 50%, rgba(16,185,129,0.1) 70%, transparent 100%)",
          boxShadow: variant === "intense"
            ? "0 0 12px rgba(16,185,129,0.25)"
            : "0 0 6px rgba(16,185,129,0.1)",
        }}
      />
      {/* Glow bloom above */}
      <div
        className="absolute inset-x-0"
        style={{
          top: -30,
          height: 60,
          background: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.03) 50%, transparent)",
        }}
      />
    </div>
  );
}
