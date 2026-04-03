"use client";

import React, { useState } from "react";
import { Plus, Play, Pause, Save, LayoutGrid, CheckCircle2, AlertTriangle, Workflow, Shield, CreditCard, Activity, Copy, CornerRightDown, GitMerge, Blocks, Settings, Database, ShieldCheck, ArrowRight } from "lucide-react";

/**
 * @file workflows/builder/page.tsx
 * @route /dashboard/sovereign/workflows/builder
 * @description The DAG Builder UI
 */

export default function DAGBuilder() {
  const [nodes, setNodes] = useState([
    { id: "node_1", title: "Ingestion / Parsing", model: "claude-3-haiku", schema: "ParsedDocSchema" },
    { id: "node_2", title: "Compliance Check", model: "gpt-4o", schema: "RiskReportSchema" }
  ]);

  const addNode = () => {
    setNodes([...nodes, { id: `node_${nodes.length + 1}`, title: "New AI Agent Node", model: "gpt-4o-mini", schema: "UnknownSchema" }]);
  };

  return (
    <div className="min-h-screen font-sans bg-[#050505] text-[#fff] flex flex-col">
      {/* Topbar */}
      <div className="border-b border-[#1a1a1a] p-4 flex items-center justify-between bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <GitMerge className="w-5 h-5 text-indigo-400" />
          <h1 className="font-mono font-bold tracking-tight">Workflow Studio</h1>
          <span className="text-[#444]">/</span>
          <input 
            type="text" 
            defaultValue="Untitled Compliance DAG" 
            className="bg-transparent border-none text-white focus:outline-none focus:ring-0 text-sm font-semibold w-64"
          />
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm font-bold bg-[#111] hover:bg-[#222] text-white rounded-lg transition-colors border border-[#222]">
            Save Draft
          </button>
          <button className="px-4 py-2 text-sm font-bold bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2">
            <Play className="w-4 h-4 fill-current" /> Deploy DAG
          </button>
        </div>
      </div>

      {/* Main Builder Canvas */}
      <div className="flex-1 overflow-hidden relative" style={{ backgroundImage: 'radial-gradient(#222 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        
        {/* Canvas Area */}
        <div className="absolute inset-0 p-8 overflow-auto flex items-start gap-12">
          
          {nodes.map((node, i) => (
            <React.Fragment key={node.id}>
              {/* Node Card */}
              <div className="w-80 flex-shrink-0 bg-[#0c0c0c] border border-[#222] rounded-xl shadow-2xl overflow-hidden relative group">
                {/* Shield Glow Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-emerald-400" />
                
                <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#111]">
                  <div className="flex items-center gap-2">
                    <Blocks className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold">{node.title}</h3>
                  </div>
                  <Settings className="w-4 h-4 text-[#666] hover:text-white cursor-pointer" />
                </div>
                
                <div className="p-4 space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#666] tracking-widest block mb-1">AI Model</span>
                    <select className="w-full bg-[#050505] border border-[#222] rounded p-2 text-sm text-[#ccc] focus:border-indigo-500 focus:outline-none appearance-none">
                      <option>{node.model}</option>
                      <option>claude-3-opus</option>
                      <option>gpt-4o-mini</option>
                    </select>
                  </div>
                  
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#666] tracking-widest block mb-1">Required Schema</span>
                    <div className="flex items-center gap-2 bg-[#050505] border border-[#222] rounded p-2 text-sm text-emerald-400">
                      <Database className="w-3 h-3" />
                      <span className="font-mono">{node.schema}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Enforcer Protected</span>
                  </div>
                </div>
              </div>

              {/* Edge/Connection */}
              {i < nodes.length - 1 && (
                <div className="flex items-center gap-2 text-[#444] self-center">
                  <div className="w-16 h-[2px] bg-[#333]" />
                  <ArrowRight className="w-5 h-5" />
                  <div className="w-16 h-[2px] bg-[#333]" />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Add Node Button */}
          <div className="self-center">
            <button 
              onClick={addNode}
              className="w-16 h-16 rounded-full border-2 border-dashed border-[#444] text-[#666] hover:border-indigo-500 hover:text-indigo-400 flex items-center justify-center transition-colors bg-[#0a0a0a]">
              <Plus className="w-6 h-6" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
