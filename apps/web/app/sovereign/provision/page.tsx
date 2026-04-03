"use client";

import React, { useState } from "react";
import { Server, ShieldCheck, MapPin, Zap, CircleDashed } from "lucide-react";
import Link from "next/link";

export default function SovereignProvisioningWizard() {
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);

  const [config, setConfig] = useState({
    infrastructure: "",
    securityTier: "",
    region: ""
  });

  const handleDeploy = () => {
    setIsDeploying(true);
    // In production, this POSTs to the Node Configurator API to generate the docker-compose YAML.
    setTimeout(() => {
      // Simulate deployment completion
      alert("Deployment generated. Check your enterprise email for the cryptographically signed `docker-compose.sovereign.yml`.");
      setIsDeploying(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
      
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">Initialize Sovereign Node</h1>
          <p className="text-[#888] text-sm">Deploy StreetMP OS to your private perimeter in one click.</p>
        </div>

        {/* Wizard Progress */}
        <div className="flex items-center justify-between mb-8 px-12 relative">
          <div className="absolute top-1/2 left-16 right-16 h-px bg-[#222] -z-10" />
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-sm transition-colors bg-[#050505] ${step >= s ? "border-emerald-500 text-emerald-500" : "border-[#333] text-[#555]"}`}>
              {s}
            </div>
          ))}
        </div>

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 shadow-2xl">
          
          {/* STEP 1: INFRASTRUCTURE */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Server className="w-5 h-5 text-emerald-500" /> Infrastructure Target</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["AWS VPC", "Azure VNet", "On-Prem Bare Metal"].map(infra => (
                  <button 
                    key={infra}
                    onClick={() => setConfig({ ...config, infrastructure: infra })}
                    className={`p-6 border rounded-xl text-left transition-all ${config.infrastructure === infra ? "border-emerald-500 bg-emerald-500/10" : "border-[#222] hover:border-[#444] hover:bg-[#111]"}`}
                  >
                    <p className="font-mono text-sm font-bold">{infra}</p>
                    <p className="text-xs text-[#666] mt-2">Dedicated single-tenant execution.</p>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <button 
                  disabled={!config.infrastructure}
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-white text-black font-medium rounded-lg disabled:opacity-50 transition-opacity"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SECURITY TIER */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Security Layer</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: "standard", title: "Standard Encryption", desc: "TLS 1.3 & AES-256 at rest." },
                  { id: "hyok", title: "Sovereign HSM (SYOK)", desc: "Air-gapped Key Management. StreetMP cannot decrypt your weights." }
                ].map(tier => (
                  <button 
                    key={tier.id}
                    onClick={() => setConfig({ ...config, securityTier: tier.id })}
                    className={`p-6 border rounded-xl text-left transition-all ${config.securityTier === tier.id ? "border-emerald-500 bg-emerald-500/10" : "border-[#222] hover:border-[#444] hover:bg-[#111]"}`}
                  >
                    <p className="font-mono text-sm font-bold">{tier.title}</p>
                    <p className="text-xs text-[#666] mt-2">{tier.desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep(1)} className="px-6 py-2 border border-[#333] text-white font-medium rounded-lg hover:bg-[#111] transition-colors">
                  ← Back
                </button>
                <button 
                  disabled={!config.securityTier}
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-white text-black font-medium rounded-lg disabled:opacity-50 transition-opacity"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REGION PINNING */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><MapPin className="w-5 h-5 text-emerald-500" /> Data Residency Pinning</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Mumbai (ap-south-1)", "Frankfurt (eu-central-1)", "Sydney (ap-southeast-2)", "N. Virginia (us-east-1)"].map(region => (
                  <button 
                    key={region}
                    onClick={() => setConfig({ ...config, region })}
                    className={`p-4 border rounded-xl text-center transition-all ${config.region === region ? "border-emerald-500 bg-emerald-500/10" : "border-[#222] hover:border-[#444] hover:bg-[#111]"}`}
                  >
                    <p className="text-[11px] font-mono font-bold tracking-tight">{region}</p>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex flex-col pt-6 border-t border-[#222]">
                <div className="flex justify-between items-center mb-6 px-4 py-3 bg-[#111] border border-[#222] rounded-lg">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-mono text-[#888]">FINAL SPECIFICATION</span>
                    <span className="text-sm font-medium">{config.infrastructure} | {config.securityTier.toUpperCase()} | {config.region}</span>
                  </div>
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>

                <div className="flex justify-between items-center">
                  <button onClick={() => setStep(2)} className="px-6 py-2 border border-[#333] text-white font-medium rounded-lg hover:bg-[#111] transition-colors">
                    ← Back
                  </button>
                  <button 
                    disabled={!config.region || isDeploying}
                    onClick={handleDeploy}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    {isDeploying && <CircleDashed className="w-4 h-4 animate-spin" />}
                    {isDeploying ? "ORCHESTRATING NODE..." : "PROVISION PRIVATE NODE"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-xs font-mono text-[#666] hover:text-[#aaa] transition-colors">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
