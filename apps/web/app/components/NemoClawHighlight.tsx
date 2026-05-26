"use client";

import { Cpu, ShieldCheck, Zap, Lock, BarChart3, Database, Globe, Layers } from "lucide-react";
import { useState, useEffect } from "react";

const PIPELINE_STAGES = [
  { id: "edge", label: "Edge Gateway", icon: <Globe className="h-4 w-4" /> },
  { id: "semantic", label: "Semantic Inspection", icon: <Layers className="h-4 w-4" /> },
  { id: "policy", label: "Policy Routing", icon: <Zap className="h-4 w-4" /> },
  { id: "enforcement", label: "Runtime Enforcement", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "audit", label: "Cryptographic Receipt", icon: <BarChart3 className="h-4 w-4" /> },
];

const FEATURES = [
  { title: "Semantic Caching", icon: <Database />, desc: "Sub-millisecond cache hits for identical semantic intents." },
  { title: "Sovereign Inference", icon: <Lock />, desc: "Execute lightweight models locally without cloud exposure." },
  { title: "Threat Fingerprinting", icon: <ShieldCheck />, desc: "Deterministic detection of known and zero-day prompt attacks." },
  { title: "Multilingual Detection", icon: <Globe />, desc: "Native support for Hindi, Thai, Mandarin, and 40+ languages." },
  { title: "Edge Isolation", icon: <Cpu />, desc: "Traffic is terminated at the edge, never entering internal networks." },
  { title: "Policy Enforcement", icon: <Zap />, desc: "Regex, semantic, and identity-based dynamic rulesets." },
  { title: "Cryptographic Receipts", icon: <BarChart3 />, desc: "HMAC-signed audit logs for non-repudiation." },
  { title: "Zero Retention Mode", icon: <Lock />, desc: "Raw prompts are dropped immediately post-scan." },
];

export function NemoClawHighlight() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage(prev => (prev + 1) % PIPELINE_STAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative py-24 lg:py-32 px-6 border-t border-white/[0.04] bg-[#070707] overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl relative z-10">
        <div className="text-center mb-16 lg:mb-24">
          <p className="text-[11px] font-bold text-emerald-500 tracking-[0.3em] uppercase mb-4">Core Technology Moat</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-6">
            NeMo CLAW Runtime
          </h2>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            The beating heart of StreetMP OS. A sovereign, local-first execution engine that semantically intercepts, classifies, and enforces security policies in under 50 milliseconds.
          </p>
        </div>

        {/* Interactive Pipeline Visualization */}
        <div className="mb-24 rounded-3xl border border-emerald-500/20 bg-zinc-950/80 backdrop-blur-xl p-8 lg:p-12 shadow-[0_0_80px_rgba(16,185,129,0.05)]">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-0.5 bg-white/5 -translate-y-1/2 z-0" />
            
            {PIPELINE_STAGES.map((stage, i) => {
              const isActive = i === activeStage;
              const isPast = i < activeStage;
              
              return (
                <div key={stage.id} className="relative z-10 flex flex-col items-center gap-4 w-full lg:w-48 transition-all duration-500">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500 ${
                    isActive 
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-110" 
                      : isPast
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                        : "border-white/10 bg-white/5 text-zinc-500"
                  }`}>
                    {stage.icon}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold uppercase tracking-widest mb-1 transition-colors ${isActive ? "text-emerald-400" : isPast ? "text-emerald-500/80" : "text-zinc-500"}`}>
                      Step 0{i + 1}
                    </div>
                    <div className={`text-sm font-semibold transition-colors ${isActive ? "text-white" : "text-zinc-400"}`}>
                      {stage.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-6 hover:bg-zinc-900/70 hover:border-emerald-500/30 transition-all group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-emerald-400 mb-5 group-hover:bg-emerald-500/10 group-hover:scale-110 transition-all">
                {feature.icon}
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-2 group-hover:text-white">{feature.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
