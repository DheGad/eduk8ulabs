import React from 'react';
import { ROIEngine } from '../../components/roi-engine';

export default function EnterpriseLandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30 font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700">
            <span className="text-black font-black text-xl">S</span>
          </div>
          <span className="text-xl font-bold tracking-tighter">StreetMP Enterprise</span>
        </div>
        <button className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors font-medium">
          Executive Portal
        </button>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-sm mb-8 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Zero-Liability Architecture Live
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
          AI WITHOUT<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-zinc-400 to-zinc-700">THE LIABILITY</span>
        </h1>
        
        <p className="max-w-2xl text-xl text-zinc-400 font-medium mb-12 leading-relaxed">
          The first Mathematically Proven Sovereign OS for Fortune 500 banks. Deploy the entire infrastructure inside your own isolated AWS Nitro Enclaves. You hold the keys.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <button className="px-8 py-4 rounded-xl font-bold text-lg bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-3">
            Book a Private Node Consultation <span className="text-xl">→</span>
          </button>
          <a href="/docs/STREETMP_WHITEPAPER.md" className="px-8 py-4 rounded-xl font-bold text-lg bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center">
            Read the Whitepaper
          </a>
        </div>
      </section>

      {/* ROI Engine Section */}
      <section className="border-t border-white/5 bg-[#080808] py-32">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Financial Autonomy</h2>
            <p className="text-zinc-400 text-lg">Calculate your immediate return on investment with the StreetMP Memory Kernel.</p>
          </div>
          <ROIEngine />
        </div>
      </section>

    </div>
  );
}
