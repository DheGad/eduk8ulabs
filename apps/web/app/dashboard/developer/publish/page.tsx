"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function PluginPublishPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API submission delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#000000] p-8 text-white font-sans selection:bg-emerald-500/30 flex items-center justify-center">
      <div className="max-w-xl w-full flex flex-col gap-6">
        
        {/* Navigation Breadcrumb */}
        <Link href="/dashboard/marketplace" className="text-sm font-mono text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-2">
          <span>&larr;</span> Back to Marketplace
        </Link>
        
        {/* Header */}
        <header className="flex flex-col gap-2 border-b border-white/10 pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
            Publish an OS Plugin
          </h1>
          <p className="text-gray-400 text-sm">
            Deploy your intellectual property natively inside StreetMP OS. Our sandboxed runtime enforces your token bounds while ensuring zero data leakage.
          </p>
        </header>

        {isSubmitted ? (
          <div className="p-8 rounded-2xl bg-[#0A0A0A]/90 backdrop-blur-xl border border-emerald-500/30 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950/50 flex items-center justify-center border border-emerald-500/50">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-2xl font-bold text-white">In Review Queue</h3>
            <p className="text-gray-400 text-sm max-w-sm">
              Your plugin source has been accepted for manual verification. Our security team will audit your code repository for zero-trust compliance within 48 hours.
            </p>
            <Link href="/dashboard/marketplace" className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-lg text-sm hover:bg-emerald-400 transition-colors">
              Return to Ecosystem
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-8 rounded-2xl bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            
            <div className="flex flex-col gap-2">
              <label htmlFor="pluginName" className="text-xs font-mono font-bold text-emerald-500/70 tracking-wider">PLUGIN NAME</label>
              <input
                id="pluginName"
                type="text"
                required
                disabled={isSubmitting}
                placeholder="e.g. EU GDPR Data Auditor"
                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="pluginDesc" className="text-xs font-mono font-bold text-emerald-500/70 tracking-wider">DESCRIPTION</label>
              <textarea
                id="pluginDesc"
                required
                disabled={isSubmitting}
                placeholder="Describe your plugin capabilities and execution mechanics..."
                rows={3}
                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="repoUrl" className="text-xs font-mono font-bold text-emerald-500/70 tracking-wider">SOURCE REPOSITORY URL</label>
              <input
                id="repoUrl"
                type="url"
                required
                disabled={isSubmitting}
                placeholder="https://github.com/your-org/streetmp-plugin"
                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be a valid repository harboring the Plugin implementation module.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="pricingTier" className="text-xs font-mono font-bold text-emerald-500/70 tracking-wider">MONTHLY LICENSE (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500">$</span>
                  <input
                    id="pricingTier"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    disabled={isSubmitting}
                    placeholder="0.00"
                    className="w-full bg-[#111] border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="category" className="text-xs font-mono font-bold text-emerald-500/70 tracking-wider">CATEGORY</label>
                <select
                  id="category"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                >
                  <option value="" disabled selected>Select Category</option>
                  <option value="security">Security & RedTeaming</option>
                  <option value="compliance">Compliance & Law</option>
                  <option value="finance">Financial Analytics</option>
                  <option value="hr">HR & Operations</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="mt-6 w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-black font-extrabold text-sm tracking-wide disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,153,0.2)]"
            >
              {isSubmitting ? "PACKAGING FOR REVIEW..." : "SUBMIT FOR REVIEW"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
