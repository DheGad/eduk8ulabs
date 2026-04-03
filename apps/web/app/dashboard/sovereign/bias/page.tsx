"use client";

import React, { useEffect, useRef } from "react";

/**
 * @file BiasEthicsGauge.tsx
 * @description Toxicity & Bias Neutrality Gauge — HCQ 2.0 Telemetry Component
 *
 * Implements C054 Task 4.
 * Renders a half-arc SVG gauge showing the AI response's neutrality score (0–100).
 * Integrates into the HCQ Trust Score telemetry panel.
 *
 * Score interpretation:
 *   85–100: Neutral (emerald)
 *   60–84:  Low Bias (blue)
 *   40–59:  Moderate Bias (yellow) — flagged
 *   0–39:   High Bias / Toxic (red) — blocked
 */

interface BiasEthicsGaugeProps {
  neutralityScore: number;   // 0–100
  toxicityScore?: number;    // 0–100 (optional breakdown)
  biasScore?: number;        // 0–100 (optional breakdown)
  showBreakdown?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

interface ScoreThreshold {
  label: string;
  color: string;
  bg: string;
  min: number;
}

const THRESHOLDS: ScoreThreshold[] = [
  { min: 85, label: "NEUTRAL",       color: "#10b981", bg: "rgba(16,185,129,0.08)" },
  { min: 60, label: "LOW BIAS",      color: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
  { min: 40, label: "MODERATE BIAS", color: "#facc15", bg: "rgba(250,204,21,0.08)" },
  { min:  0, label: "HIGH BIAS",     color: "#ef4444", bg: "rgba(239,68,68,0.08)"  },
];

function getThreshold(score: number): ScoreThreshold {
  return THRESHOLDS.find(t => score >= t.min) ?? THRESHOLDS[THRESHOLDS.length - 1];
}

function scoreToAngle(score: number): number {
  // Maps 0→180° and 100→0° (half circle, left to right)
  return 180 - (score / 100) * 180;
}

function BiasEthicsGauge({
  neutralityScore,
  toxicityScore,
  biasScore,
  showBreakdown = false,
  size = "md",
  className = "",
}: BiasEthicsGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const score = Math.max(0, Math.min(100, neutralityScore));
  const threshold = getThreshold(score);

  const dimensions = { sm: 120, md: 160, lg: 200 };
  const dim = dimensions[size];
  const cx = dim / 2;
  const cy = dim / 2;
  const radius = dim * 0.38;
  const strokeWidth = dim * 0.07;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dim, dim);

    // Track (background arc)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Colored segments: red → yellow → blue → emerald
    const segments = [
      { from: 0,  to: 40,  color: "#ef444440" },
      { from: 40, to: 60,  color: "#facc1540" },
      { from: 60, to: 85,  color: "#60a5fa40" },
      { from: 85, to: 100, color: "#10b98140" },
    ];

    segments.forEach(seg => {
      const startAngle = Math.PI + (seg.from / 100) * Math.PI;
      const endAngle   = Math.PI + (seg.to   / 100) * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "butt";
      ctx.stroke();
    });

    // Value arc (filled up to score)
    const startAngle = Math.PI;
    const endAngle = Math.PI + (score / 100) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = threshold.color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Needle
    const needleAngle = Math.PI + (score / 100) * Math.PI;
    const needleLen = radius - strokeWidth / 2;
    const nx = cx + needleLen * Math.cos(needleAngle);
    const ny = cy + needleLen * Math.sin(needleAngle);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, strokeWidth * 0.4, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();

  }, [score, dim, cx, cy, radius, strokeWidth, threshold.color]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: dim, height: dim / 2 + 16 }}>
        <canvas
          ref={canvasRef}
          width={dim}
          height={dim}
          style={{ marginTop: -(dim / 2) }}
        />
        {/* Score label */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-2xl font-mono font-black tabular-nums" style={{ color: threshold.color }}>
            {score}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "#555" }}>
            /100
          </span>
        </div>
      </div>

      {/* Verdict pill */}
      <div className="mt-2 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest"
           style={{ background: threshold.bg, color: threshold.color, border: `1px solid ${threshold.color}33` }}>
        {threshold.label}
      </div>

      {/* Breakdown */}
      {showBreakdown && (
        <div className="mt-3 space-y-1.5 w-full text-left">
          {toxicityScore !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono" style={{ color: "#555" }}>Toxicity</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 rounded-full" style={{ background: "#111" }}>
                  <div className="h-1 rounded-full" style={{ width: `${toxicityScore}%`, background: "#ef4444" }} />
                </div>
                <span className="text-[10px] font-mono text-white w-8 text-right">{toxicityScore}%</span>
              </div>
            </div>
          )}
          {biasScore !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono" style={{ color: "#555" }}>Bias</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 rounded-full" style={{ background: "#111" }}>
                  <div className="h-1 rounded-full" style={{ width: `${biasScore}%`, background: "#facc15" }} />
                </div>
                <span className="text-[10px] font-mono text-white w-8 text-right">{biasScore}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ================================================================
// DEMO PAGE — shows the gauge at multiple score levels
// ================================================================
export default function BiasEthicsPage() {
  const demoScores = [
    { score: 96, tox: 2,  bias: 3,  label: "Financial Risk Audit — Output" },
    { score: 78, tox: 8,  bias: 18, label: "External News Summary — Output" },
    { score: 52, tox: 22, bias: 35, label: "Unfiltered User Chat — Output" },
    { score: 18, tox: 68, bias: 52, label: "Adversarial Jailbreak Attempt ⛔" },
  ];

  return (
    <div className="min-h-screen p-6 font-sans" style={{ background: "#050505", color: "#fff" }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">Bias & Ethics Monitor</h1>
          <p className="text-sm" style={{ color: "#888" }}>
            HCQ 2.0 Telemetry — Real-time Toxicity & Neutrality gauge for every AI response.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {demoScores.map(({ score, tox, bias, label }) => (
            <div key={label} className="rounded-2xl p-5 flex flex-col items-center"
                 style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
              <BiasEthicsGauge
                neutralityScore={score}
                toxicityScore={tox}
                biasScore={bias}
                showBreakdown
                size="md"
              />
              <p className="text-[10px] font-mono text-center mt-3 leading-snug" style={{ color: "#555" }}>{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 p-5 rounded-2xl" style={{ background: "#0a0a0a", border: "1px solid #111" }}>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "#555" }}>Score Reference</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { range: "85–100", label: "Neutral", color: "#10b981" },
              { range: "60–84",  label: "Low Bias",       color: "#60a5fa" },
              { range: "40–59",  label: "Moderate Bias",  color: "#facc15" },
              { range: "0–39",   label: "High Bias / Toxic", color: "#ef4444" },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</p>
                  <p className="text-[10px] font-mono" style={{ color: "#444" }}>{t.range}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
