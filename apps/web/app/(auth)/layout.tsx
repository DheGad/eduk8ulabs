import { LegalFooter } from "@/components/LegalFooter";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen flex bg-[#0A0A0A]">
        {/* Left Panel: Enterprise Trust Shield */}
        <div className="hidden lg:flex flex-1 flex-col justify-between border-r border-white/5 bg-[#080808] relative overflow-hidden">
          {/* Background Mesh & Glow */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-12 flex flex-col h-full justify-between">
            <a href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-8 h-8 rounded border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <span className="text-emerald-400 text-xs font-black">S</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                StreetMP<span className="text-emerald-400"> OS</span>
              </span>
            </a>

            <div className="max-w-md">
              {/* Glowing Emerald Lock Icon */}
              <div className="w-16 h-16 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
                 <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-pulse blur-xl" />
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                 </svg>
              </div>
              
              <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
                Zero-Trust <br /> Sovereign Authentication.
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Access restricted to cryptographically verified personnel. Your session is protected by hardware-enclave containment and complete multi-tenant isolation.
              </p>

              <div className="mt-12 flex flex-col gap-4 border-t border-white/5 pt-8">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono text-emerald-500/80 uppercase tracking-widest">Live Boundary Heartbeat</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Attestation: Nominal</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Auth Form */}
        <div className="w-full lg:w-fit lg:min-w-[500px] flex-1 flex flex-col items-center justify-center relative px-6 py-12 lg:px-12">
          <div className="absolute inset-0 pointer-events-none overflow-hidden lg:hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[300px] rounded-full bg-emerald-600/[0.03] blur-[100px]" />
          </div>

          <div className="w-full max-w-[400px] animate-slide-up relative z-10">
            <a href="/" className="flex items-center gap-2.5 mb-8 group w-fit lg:hidden mx-auto">
              <div className="w-8 h-8 rounded border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <span className="text-emerald-400 text-xs font-black">S</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                StreetMP<span className="text-emerald-400"> OS</span>
              </span>
            </a>
            
            {children}
          </div>
        </div>
      </div>
      <LegalFooter variant="auth" />
    </>
  );
}
