"use client";

import React, { useState, useEffect } from "react";

export default function ComplianceAuditPage() {
  const [healthScore, setHealthScore] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);

  // Animate the health gauge on load
  useEffect(() => {
    const timer = setTimeout(() => {
      setHealthScore(99.99);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleGenerate = () => {
    setGenerating(true);
    setCertificate(null);

    // Simulate generation delay
    setTimeout(() => {
      setGenerating(false);
      
      // Mocked certificate mapping the V35 AuditEngine output
      setCertificate({
        certificate_id: "SMP-CERT-" + Math.random().toString(16).slice(2, 10).toUpperCase(),
        tenant_id: "ENT-GLOBAL-091",
        timeframe: "Last 30 Days",
        generated_at: new Date().toISOString(),
        metrics: {
          total_executions_audited: 84392,
          average_trust_integrity: 98.4,
          cryptographic_chain_consistency: "100% VERIFIED",
          data_residency_compliance: ["AWS_EU_WEST", "STREETMP_ENCLAVE"],
          zero_knowledge_leakage: "0 BYTES",
        },
        signatures: {
          issuer: "StreetMP Sovereign Kernel",
          merkle_root_hash: "0x" + Math.random().toString(16).slice(2, 64),
          zk_proof_hash: "zkp_" + Math.random().toString(16).slice(2, 32),
        }
      });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-8 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Regulatory Audit Engine</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          V35 Sovereign Compliance Command Center. Aggregate V25 Trust Scores and V14 ZK-Proofs into exportable regulatory certificates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Health Gauge & Actions */}
        <div className="col-span-1 space-y-6">
          
          {/* Feature 1: Live Regulatory Health Gauge */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center justify-center text-center shadow-lg">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Live Regulatory Health</h3>
            
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Spinning background rings */}
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div 
                className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent transition-transform duration-[2000ms] ease-out"
                style={{ transform: `rotate(${healthScore > 0 ? 360 : 0}deg)` }}
              />
              <div className="absolute inset-2 rounded-full border border-emerald-500/20" />
              
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-white">{healthScore.toFixed(2)}<span className="text-2xl text-emerald-500">%</span></span>
                <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase mt-2">Fully Compliant</span>
              </div>
            </div>
            
            <p className="mt-6 text-xs text-slate-400 leading-relaxed">
              Continuous monitoring across 14 global jurisdictions including GDPR, HIPAA, and SOC2.
            </p>
          </div>

          {/* Action Card */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-blue-100 mb-1">Generate Verified Audit</h3>
              <p className="text-xs text-slate-400">Compile cryptographic proof of execution integrity for external auditors.</p>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2
                ${generating 
                  ? "bg-slate-800 text-slate-400 cursor-wait border border-slate-700" 
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"}`}
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  Generating ZK-Verified Certificate...
                </>
              ) : (
                "Generate Certified Audit"
              )}
            </button>
          </div>
        </div>

        {/* Right Column: The Certificate Display */}
        <div className="col-span-2">
          {certificate ? (
            <div className="h-full rounded-2xl border border-slate-700 bg-white p-8 relative overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4">
              {/* Print-ready Template Styling inside the dark dashboard */}
              
              {/* Voids watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <span className="text-[150px] font-black tracking-tighter text-slate-900 rotate-[-30deg]">STREETMP</span>
              </div>

              {/* Certificate Header */}
              <div className="border-b-2 border-slate-200 pb-6 mb-8 flex items-start justify-between relative z-10">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "Times New Roman, serif" }}>
                    Sovereign Compliance Certificate
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-2 tracking-wide">Issued by the StreetMP OS Enclave kernel.</p>
                </div>
                {/* Official Seal Mockup */}
                <div className="w-20 h-20 rounded-full border-4 border-slate-900 flex items-center justify-center relative shadow-sm">
                  <div className="absolute inset-1 rounded-full border py-1 border-slate-900 border-dashed" />
                  <span className="text-xl font-black text-slate-900">SMP</span>
                </div>
              </div>

              {/* Certificate Body details */}
              <div className="grid grid-cols-2 gap-8 text-sm text-slate-800 relative z-10 mb-8 border-b border-slate-100 pb-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Certificate ID</p>
                  <p className="font-mono font-medium text-slate-900">{certificate.certificate_id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Timeframe</p>
                  <p className="font-medium text-slate-900">{certificate.timeframe}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Generated At</p>
                  <p className="font-medium text-slate-900">{new Date(certificate.generated_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tenant ID</p>
                  <p className="font-mono font-medium text-slate-900">{certificate.tenant_id}</p>
                </div>
              </div>

              {/* Metrics Table */}
              <div className="space-y-4 relative z-10 mb-10">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">Audited Metrics</h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                    <span className="text-slate-500">Executions Audited</span>
                    <span className="font-bold text-slate-900">{certificate.metrics.total_executions_audited.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                    <span className="text-slate-500">Average Trust Integrity (V25)</span>
                    <span className="font-bold text-emerald-600">{certificate.metrics.average_trust_integrity}%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                    <span className="text-slate-500">Chain Consistency (V14)</span>
                    <span className="font-bold text-slate-900">{certificate.metrics.cryptographic_chain_consistency}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                    <span className="text-slate-500">ZK Data Leakage (V32)</span>
                    <span className="font-bold text-emerald-600">{certificate.metrics.zero_knowledge_leakage}</span>
                  </div>
                  <div className="col-span-2 flex justify-between border-b border-slate-100 pb-2 text-sm">
                    <span className="text-slate-500">Data Residency (V23)</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{certificate.metrics.data_residency_compliance.join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Cryptographic Footers */}
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 relative z-10 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cryptographic Signatures</h3>
                
                <div>
                  <p className="text-[10px] font-medium text-slate-500 mb-0.5">Merkle Root Hash</p>
                  <p className="text-[11px] font-mono text-slate-800 break-all">{certificate.signatures.merkle_root_hash}</p>
                </div>
                
                <div>
                  <p className="text-[10px] font-medium text-slate-500 mb-0.5">ZK-Proof Validation Hash</p>
                  <p className="text-[11px] font-mono text-emerald-700 bg-emerald-50 inline-block px-1 break-all border border-emerald-100">{certificate.signatures.zk_proof_hash}</p>
                </div>
              </div>

              <button className="absolute bottom-6 right-8 rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 shadow-sm hover:bg-slate-50 transition-colors z-20">
                Print / PDF
              </button>
            </div>
          ) : (
            <div className="h-full rounded-2xl border border-dashed border-slate-700 bg-slate-800/20 p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl mb-4 border border-slate-700">📜</div>
              <h3 className="text-lg font-bold text-slate-300 mb-2">No Certificate Generated</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Click the Generate button to compile the cryptographic chain and issue a formal compliance certificate for this tenant.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
