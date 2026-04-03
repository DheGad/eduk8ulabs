"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

interface PluginMeta {
  id: string;
  name: string;
  description: string;
  price: number;
  author: string;
  category: string;
  icon: string;
}

const SAMPLE_PLUGINS: PluginMeta[] = [
  {
    id: "plugin-legal-01",
    name: "Legal Contract Analyzer",
    description: "Detects liability exposure and compliance gaps in legal prose. Trained on 1M+ precedents.",
    price: 15.00,
    author: "LegalAI Corp",
    category: "Legal",
    icon: "⚖️",
  },
  {
    id: "plugin-health-02",
    name: "Healthcare PII Detector",
    description: "Deep scanner for HIPAA violations in clinical notes. Isolates PHI automatically.",
    price: 25.00,
    author: "HealthShield",
    category: "Healthcare",
    icon: "🏥",
  },
  {
    id: "plugin-compliant-03",
    name: "Bahasa Malaysia Compliance",
    description: "Validates local language regulatory alignment for SEA operations.",
    price: 10.00,
    author: "RegionalGov Solutions",
    category: "Compliance",
    icon: "🇲🇾",
  }
];

export default function PluginMarketplacePage() {
  const [activePlugins, setActivePlugins] = useState<Set<string>>(new Set());
  const [installingId, setInstallingId] = useState<string | null>(null);

  const handleInstall = async (pluginId: string) => {
    setInstallingId(pluginId);
    // Simulate network delay for UI feedback
    await new Promise(res => setTimeout(res, 800));
    setActivePlugins(prev => {
      const next = new Set(prev);
      next.add(pluginId);
      return next;
    });
    setInstallingId(null);
  };

  const activePluginsList = SAMPLE_PLUGINS.filter(p => activePlugins.has(p.id));
  const availablePluginsList = SAMPLE_PLUGINS.filter(p => !activePlugins.has(p.id));

  return (
    <div className="min-h-screen bg-[#000000] p-8 text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex justify-between items-end border-b border-white/10 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
              Plugin Marketplace
            </h1>
            <p className="text-gray-400 text-sm">
              Extend your OS capabilities. Verified secure integrations executing strictly inside the V67 Sandboxed Perimeter.
            </p>
          </div>
          <Link href="/dashboard/developer/publish" className="px-5 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all font-semibold text-emerald-400 shadow-[0_0_15px_rgba(0,229,153,0.05)] text-sm">
            Publish a Plugin
          </Link>
        </header>

        {/* Workspace Active Plugins */}
        {activePluginsList.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white/90">Installed on Workspace</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {activePluginsList.map(plugin => (
                <div key={plugin.id} className="relative p-6 rounded-2xl bg-[#0A0A0A]/90 backdrop-blur-xl border border-emerald-500/30 shadow-[0_0_40px_rgba(0,229,153,0.1)] transition-transform hover:-translate-y-1">
                  <div className="absolute top-4 right-4 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded">
                    ACTIVE
                  </div>
                  <div className="flex gap-4 items-center mb-4">
                    <div className="text-4xl">{plugin.icon}</div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{plugin.name}</h3>
                      <p className="text-xs text-gray-400">by {plugin.author}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    {plugin.description}
                  </p>
                  <button className="w-full py-2 bg-[#111] border border-white/10 rounded-lg text-sm font-semibold text-gray-400 hover:text-white transition-colors">
                    Configure Settings
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Marketplace Explorer */}
        <section className="flex flex-col gap-4 mt-8">
          <h2 className="text-xl font-bold text-white/90">Available Plugins</h2>
          
          {availablePluginsList.length === 0 ? (
             <EmptyState
            icon="grid"
            headline="All Plugins Installed"
            description="You've installed everything in the marketplace. Check back soon — new verified plugins are added every sprint."
            action={{ label: "Publish a Plugin", href: "/dashboard/developer/publish", id: "empty-marketplace-publish" }}
          />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availablePluginsList.map(plugin => (
                <div key={plugin.id} className="group p-6 rounded-2xl bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 hover:border-white/20 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl">{plugin.icon}</div>
                    <span className="text-emerald-400 font-mono font-bold text-lg">
                      ${plugin.price.toFixed(2)}<span className="text-xs text-gray-500 font-sans">/mo</span>
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">{plugin.name}</h3>
                    <p className="text-xs text-emerald-500/70 mb-2 font-mono">{plugin.category}</p>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6 min-h-[60px]">
                      {plugin.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-gray-500">by {plugin.author}</span>
                    <button 
                      onClick={() => handleInstall(plugin.id)}
                      disabled={installingId === plugin.id}
                      className="px-6 py-2 bg-white text-black font-bold rounded-lg text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
                    >
                      {installingId === plugin.id ? "Installing..." : "Install"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
