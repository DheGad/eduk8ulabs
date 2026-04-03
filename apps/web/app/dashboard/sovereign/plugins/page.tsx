"use client";

import React, { useState } from "react";
import { Link2, MessageSquare, Database, GitMerge, Search, ShieldCheck } from "lucide-react";

export default function PluginGallery() {
  const [installed, setInstalled] = useState<string[]>(["slack"]); // Default mock install

  const plugins = [
    {
      id: "slack",
      name: "Slack",
      category: "Communication",
      icon: <MessageSquare className="w-8 h-8 text-[#E01E5A]" />,
      desc: "Connect your enterprise Slack workspace. PII is automatically sanitized before hitting LLMs.",
      verified: true
    },
    {
      id: "salesforce",
      name: "Salesforce CRM",
      category: "Data Source",
      icon: <Database className="w-8 h-8 text-[#00A1E0]" />,
      desc: "Ingest Sales Cloud objects directly into RAG 4.0 vectors. SYOK encrypted at rest.",
      verified: true
    },
    {
      id: "github",
      name: "GitHub Enterprise",
      category: "Version Control",
      icon: <GitMerge className="w-8 h-8 text-white" />,
      desc: "Code-Sovereign repo analysis. Read-only permissions with deterministic outputs.",
      verified: true
    },
    {
      id: "confluence",
      name: "Confluence",
      category: "Data Source",
      icon: <Search className="w-8 h-8 text-[#2684FF]" />,
      desc: "Internal wiki ingestion. Enforces zero-knowledge boundaries for specific spaces.",
      verified: false
    }
  ];

  const toggleInstall = (id: string) => {
    setInstalled(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-[#222]">
        <div>
          <h1 className="text-3xl font-mono font-bold text-white tracking-tight mb-2">Integrations Gallery</h1>
          <p className="text-[#888] text-sm">Deploy secure data pipelines into your private OS kernel.</p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase">SYOK Enforced</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => {
          const isInstalled = installed.includes(plugin.id);
          
          return (
            <div key={plugin.id} className="bg-[#050505] border border-[#1a1a1a] rounded-2xl p-6 transition-all hover:border-[#333] flex flex-col h-full group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center group-hover:scale-105 transition-transform">
                  {plugin.icon}
                </div>
                {plugin.verified && (
                  <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    Audited
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-white mb-1">{plugin.name}</h3>
              <p className="text-xs text-[#555] font-mono uppercase tracking-widest mb-3">{plugin.category}</p>
              
              <p className="text-sm text-[#888] mb-8 leading-relaxed flex-grow">
                {plugin.desc}
              </p>
              
              <button 
                onClick={() => toggleInstall(plugin.id)}
                className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                  isInstalled 
                    ? "bg-[#111] border border-[#333] text-white hover:bg-[#222]" 
                    : "bg-white text-black hover:bg-gray-200"
                }`}
              >
                {isInstalled ? (
                  <>Manage Connection</>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" /> Install Plugin
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
