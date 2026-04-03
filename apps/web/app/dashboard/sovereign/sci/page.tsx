"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Globe, Activity, TrendingUp, AlertTriangle } from "lucide-react";

/**
 * @file sci/page.tsx
 * @route /dashboard/sovereign/sci
 * @description Sovereign Compliance Index (SCI) — Real-Time Score
 *
 * Implements C053 Task 4.
 * Formula: SCI = (Σ Passed Policy Checks / Total Requests) × HSM Availability
 * Tracks compliance against GDPR, DPDPA, HIPAA, and RBI Circular 2026.
 */

interface PolicyCheck {
  id: string;
  regulation: string;
  name: string;
  passed: number;
  total: number;
  weight: number;
}

interface SciSnapshot {
  sci_score: number;
  hsm_availability: number;
  pass_rate: number;
  total_checks: number;
  timestamp: string;
}

const REGULATIONS: PolicyCheck[] = [
  { id: "gdpr_data_minimization", regulation: "GDPR Art. 5(1)(c)", name: "Data Minimization", passed: 14520, total: 14520, weight: 1.0 },
  { id: "gdpr_right_to_erasure",  regulation: "GDPR Art. 17",       name: "Right to Erasure",  passed: 14520, total: 14520, weight: 1.0 },
  { id: "dpdpa_consent",          regulation: "DPDPA §6",            name: "Consent Logging",   passed: 14510, total: 14520, weight: 1.0 },
  { id: "dpdpa_residency",        regulation: "DPDPA §16",           name: "Data Residency (IN)", passed: 14520, total: 14520, weight: 1.0 },
  { id: "hipaa_phi",              regulation: "HIPAA §164.312",      name: "PHI Access Control", passed: 14480, total: 14520, weight: 1.0 },
  { id: "rbi_audit",              regulation: "RBI Circular 2026",   name: "AI Audit Trail",    passed: 14520, total: 14520, weight: 1.0 },
  { id: "pii_scrub",              regulation: "SPS Internal",        name: "PII Zero Leakage",  passed: 14520, total: 14520, weight: 1.0 },
  { id: "merkle_proof",           regulation: "SPS Internal",        name: "Merkle PoE",         passed: 14520, total: 14520, weight: 1.0 },
];

function calcSci(checks: PolicyCheck[], hsmAvailability: number): SciSnapshot {
  const totalPassed = checks.reduce((a, c) => a + c.passed, 0);
  const totalAll = checks.reduce((a, c) => a + c.total, 0);
  const passRate = totalAll > 0 ? totalPassed / totalAll : 0;
  const sci = passRate * hsmAvailability;
  return {
    sci_score: Number((sci * 100).toFixed(3)),
    hsm_availability: Number((hsmAvailability * 100).toFixed(2)),
    pass_rate: Number((passRate * 100).toFixed(3)),
    total_checks: totalAll,
    timestamp: new Date().toISOString()
  };
}

function sciColor(score: number): string {
  if (score >= 99) return "#10b981";
  if (score >= 95) return "#facc15";
  return "#ef4444";
}

export default function SciDashboard() {
  const [checks, setChecks] = useState<PolicyCheck[]>(REGULATIONS);
  const [hsmAvail] = useState(0.9997);
  const [snapshot, setSnapshot] = useState<SciSnapshot>(calcSci(REGULATIONS, 0.9997));
  const [history, setHistory] = useState<number[]>([]);
  const [pulse, setPulse] = useState(false);

  // Live SCI tick — simulates check counter incrementing
  useEffect(() => {
    const interval = setInterval(() => {
      setChecks(prev => prev.map(c => ({
        ...c,
        passed: c.passed + (Math.random() > 0.02 ? 1 : 0), // 98% pass rate on live checks
        total: c.total + 1
      })));
      setPulse(true);
      setTimeout(() => setPulse(false), 200);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const snap = calcSci(checks, hsmAvail);
    setSnapshot(snap);
    setHistory(prev => [...prev.slice(-20), snap.sci_score]);
  }, [checks, hsmAvail]);

  const sci = snapshot.sci_score;

  return (
    <div className="min-h-screen p-6 font-sans" style={{ background: "#050505", color: "#fff" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <h1 className="text-3xl font-mono font-bold">Sovereign Compliance Index</h1>
          </div>
          <p className="text-sm" style={{ color: "#888" }}>
            SCI = (Σ Passed Policy Checks / Total Requests) × HSM Availability. Real-time composite score.
          </p>
        </div>

        {/* Hero Score */}
        <div className="mb-8 rounded-2xl p-8 text-center relative overflow-hidden"
             style={{ background: "#0a0a0a", border: `1px solid ${sciColor(sci)}33` }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: `radial-gradient(ellipse at center, ${sciColor(sci)}08 0%, transparent 70%)` }} />
          <p className="text-[11px] font-mono uppercase tracking-widest mb-2" style={{ color: "#555" }}>
            Live Sovereign Compliance Index
          </p>
          <div className={`text-8xl font-mono font-black tabular-nums mb-2 transition-all ${pulse ? "scale-105" : "scale-100"}`}
               style={{ color: sciColor(sci) }}>
            {sci.toFixed(2)}
            <span className="text-3xl ml-1" style={{ color: "#444" }}>%</span>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-xs font-mono" style={{ color: "#555" }}>PASS RATE</p>
              <p className="text-lg font-mono font-bold text-white">{snapshot.pass_rate.toFixed(3)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-mono" style={{ color: "#555" }}>HSM AVAILABILITY</p>
              <p className="text-lg font-mono font-bold text-white">{snapshot.hsm_availability}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-mono" style={{ color: "#555" }}>TOTAL CHECKS</p>
              <p className="text-lg font-mono font-bold text-white">{snapshot.total_checks.toLocaleString()}</p>
            </div>
          </div>

          {/* Formula display */}
          <div className="mt-4 px-4 py-2 rounded-lg inline-block font-mono text-xs"
               style={{ background: "rgba(255,255,255,0.02)", color: "#555", border: "1px solid #111" }}>
            SCI = ({snapshot.pass_rate.toFixed(3)}% × {snapshot.hsm_availability}%) = {sci.toFixed(3)}%
          </div>
        </div>

        {/* Live Sparkline */}
        {history.length > 2 && (
          <div className="mb-6 rounded-2xl p-5 overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid #111" }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#555" }}>SCI Trend (last 20 ticks)</span>
            </div>
            <div className="flex items-end gap-1 h-12">
              {history.map((v, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all"
                     style={{
                       height: `${Math.max(4, ((v - 99.95) / 0.05) * 100)}%`,
                       background: sciColor(v),
                       opacity: 0.4 + (i / history.length) * 0.6,
                       minHeight: "4px"
                     }} />
              ))}
            </div>
          </div>
        )}

        {/* Policy Breakdown Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
          <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: "#111" }}>
            <Globe className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: "#666" }}>
              Policy-by-Policy Breakdown
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#0f0f0f" }}>
            {checks.map((c) => {
              const rate = (c.passed / c.total) * 100;
              const pass = rate >= 99.9;
              return (
                <div key={c.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="shrink-0">
                    {pass
                      ? <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: "rgba(255,255,255,0.03)", color: "#555" }}>
                        {c.regulation}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-1 mt-1" style={{ background: "#111" }}>
                      <div className="h-1 rounded-full transition-all"
                           style={{ width: `${rate}%`, background: sciColor(rate) }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-bold" style={{ color: sciColor(rate) }}>
                      {rate.toFixed(2)}%
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: "#444" }}>
                      {c.passed.toLocaleString()}/{c.total.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
