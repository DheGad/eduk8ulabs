"use client";

import React, { useState } from "react";
import { GitMerge, Plus, Play, Clock, AlertCircle, CheckCircle2, ChevronRight, Settings } from "lucide-react";
import Link from 'next/link';

/**
 * @file workflows/page.tsx
 * @route /dashboard/sovereign/workflows
 * @description Autonomous Workflows Registry UI
 */

const MOCK_WORKFLOWS = [
  {
    id: "wf-1",
    name: "KYC Analyst Pipeline",
    description: "Extracts PII from passport images, verifies entities, and generates a risk compliance report.",
    status: "active",
    nodesCount: 4,
    lastRun: "2 mins ago",
    costSaved: "$1.40"
  },
  {
    id: "wf-2",
    name: "Daily Fraud Sweep",
    description: "Scans transaction logs and flags anomalies using the Anthropic Opus evaluation node.",
    status: "active",
    nodesCount: 2,
    lastRun: "12 hours ago",
    costSaved: "$0.85"
  }
];

export default function WorkflowsRegistry() {
  return (
    <div className="min-h-screen p-6 font-sans bg-[#050505] text-[#fff]">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <GitMerge className="w-7 h-7 text-indigo-400" />
              <h1 className="text-3xl font-mono font-bold tracking-tight">Agentic Workflows</h1>
            </div>
            <p className="text-sm text-[#888] max-w-xl">
              Create and manage multi-agent Directed Acyclic Graphs (DAGs). All execution nodes are cryptographically verified by the Fortress Shield before data progresses.
            </p>
          </div>
          <Link href="/dashboard/sovereign/workflows/builder"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Plus className="w-5 h-5" /> Build New DAG
          </Link>
        </div>

        {/* Workflows List */}
        <div className="grid grid-cols-1 gap-4">
          {MOCK_WORKFLOWS.map((wf) => (
            <div key={wf.id} className="group relative rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 hover:border-[#333] transition-colors overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/50 group-hover:bg-indigo-500 transition-colors" />
              <div className="flex items-center gap-6">
                
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-white">{wf.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIVE</span>
                  </div>
                  <p className="text-sm text-[#888]">{wf.description}</p>
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-6 text-sm text-[#666]">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-mono mb-1">Nodes</span>
                    <span className="font-bold text-indigo-400">{wf.nodesCount}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-mono mb-1 text-[#888]">Last Executed</span>
                    <span className="text-[#ccc] flex items-center gap-1"><Clock className="w-3 h-3"/> {wf.lastRun}</span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="pl-6 border-l border-[#222] flex items-center gap-3">
                  <button className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 flex items-center justify-center transition-colors">
                    <Play className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 rounded-xl bg-[#111] text-[#888] hover:bg-[#222] hover:text-white flex items-center justify-center transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
