import React from 'react';
import Link from 'next/link';
import { Shield, Cpu, Cloud, BrainCircuit, Lock } from "lucide-react";

export default function VendorNeutralityPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white py-24 px-6 md:px-12 max-w-7xl mx-auto space-y-24">
      {/* ── Hero Section ──────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto text-center space-y-8 mt-12">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.3)]">
            <Shield className="w-10 h-10 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight text-white gap-2">
          Absolute <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
            Vendor Neutrality
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-zinc-400 leading-relaxed max-w-3xl mx-auto font-medium">
          StreetMP OS isn't tied to any single provider. We build an unbreakable cryptographic wall between your enterprise data and the world’s most powerful AI models, no matter where they are hosted.
        </p>
      </div>

      {/* ── The 3 Agnostic Pillars ────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-8 pb-12">
        
        {/* Hardware Agnostic */}
        <div className="bg-zinc-950 border border-white/10 p-10 rounded-3xl hover:border-emerald-500/30 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] group-hover:bg-purple-500/20 transition-all" />
          <Cpu className="w-12 h-12 text-purple-400 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Hardware Agnostic</h2>
          <p className="text-zinc-400 leading-relaxed">
            Deploy your secure enclaves on any modern trusted execution environment (TEE). Whether it's AWS Nitro Enclaves, AMD SEV, or Intel TDX, StreetMP OS adapts seamlessly to secure your computation at the hardware level.
          </p>
        </div>

        {/* Model Agnostic */}
        <div className="bg-zinc-950 border border-white/10 p-10 rounded-3xl hover:border-emerald-500/30 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/20 transition-all" />
          <BrainCircuit className="w-12 h-12 text-emerald-400 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Model Agnostic</h2>
          <p className="text-zinc-400 leading-relaxed">
            Don't get locked into a single AI provider's ecosystem. StreetMP securely proxies traffic to OpenAI, Anthropic, Google Gemini, or open-source models (Llama 3, Mixtral) with identical zero-knowledge guarantees.
          </p>
        </div>

        {/* Cloud Agnostic */}
        <div className="bg-zinc-950 border border-white/10 p-10 rounded-3xl hover:border-emerald-500/30 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[60px] group-hover:bg-cyan-500/20 transition-all" />
          <Cloud className="w-12 h-12 text-cyan-400 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Cloud Agnostic</h2>
          <p className="text-zinc-400 leading-relaxed">
            Host the sovereign router wherever you prefer. From a strict on-premise Kubernetes cluster to multi-cloud architectures across GCP, Azure, or AWS — your data sovereignty boundary remains entirely under your control.
          </p>
        </div>

      </div>

      {/* ── Simulated Live Certificate Signature Block ──────────────────────── */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-[#050505] border-2 border-emerald-500/20 rounded-3xl p-8 md:p-12 shadow-[0_0_60px_rgba(16,185,129,0.05)] relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Live Certificate Signature</h3>
                <p className="text-zinc-500 text-sm font-mono mt-1">Mathematical proof of neutrality.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 block">System Status</span>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  AGNOSTIC_ENFORCEMENT_ACTIVE
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Cryptographic Binding</span>
                <div className="bg-black/50 border border-white/5 rounded-xl p-4 font-mono text-sm text-zinc-400 leading-relaxed break-all">
                  <span className="text-purple-400">HARDWARE_TEE</span>: VERIFIED_INDEPENDENT<br />
                  <span className="text-emerald-400">MODEL_ROUTING</span>: ZERO_TRUST_PROXY_ENABLED<br />
                  <span className="text-cyan-400">CLOUD_HOSTING</span>: MULTI_REGION_ACTIVE<br /><br />
                  <span className="text-zinc-600">-- BEGIN SIGNATURE --</span><br />
                  <span className="text-emerald-500">
                    3f9a7b2c0e8d1f4a6b5c9e2d8a1f4b7c<br/>
                    9d2e5a8b1c4f7d0e3a6b9c2d5e8f1a4b<br/>
                    c7d0e3a6b9c2d5e8f1a4b7c0d3e6a9b2
                  </span><br />
                  <span className="text-zinc-600">-- END SIGNATURE --</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/10 flex justify-end">
               <Link href="/verify">
                 <button className="bg-white text-black hover:bg-zinc-200 transition-colors font-bold px-6 py-3 rounded-xl shadow-lg">
                   Verify Policy Strictness →
                 </button>
               </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
