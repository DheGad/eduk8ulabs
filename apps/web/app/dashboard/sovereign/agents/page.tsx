"use client";

import React, { useState } from "react";
import { Server, Shield, Database, Terminal, Settings2, Trash2, KeyRound, PlayCircle } from "lucide-react";

/**
 * @file agents/page.tsx
 * @route /dashboard/sovereign/agents
 * @description Agent Toolbox Registry — MCP Gateway Management
 *
 * Implements C055 Task 2.
 * UI for managing Agent Permissions. Dictates exactly what external agents
 * (Google Antigravity, Cursor) are allowed to access via the MCP server.
 * Toggle access to "Read Docs", "Execute Tools", and the critical "See PII".
 */

// Basic interface for connected agent configurations
interface ConnectedAgent {
  id: string;
  name: string;
  vendor: string;
  status: "ONLINE" | "OFFLINE" | "BLOCKED";
  tokenStart: string;
  lastConnected: string;
  permissions: {
    can_read_docs: boolean;
    can_execute_tools: boolean;
    can_view_pii: boolean;
  };
  allowedResources: string[];
}

const DEMO_AGENTS: ConnectedAgent[] = [
  {
    id: "agt_antigravity",
    name: "Internal R&D Agent",
    vendor: "Google Antigravity / Gemini",
    status: "ONLINE",
    tokenStart: "antigravity_dev_token",
    lastConnected: "2 mins ago",
    permissions: {
      can_read_docs: true,
      can_execute_tools: true,
      can_view_pii: false, // Critical sovereign setting
    },
    allowedResources: ["cloud://streetmp/docs/*", "db://vault/metadata"]
  },
  {
    id: "agt_cursor",
    name: "Cursor IDE Global",
    vendor: "Cursor / Claude",
    status: "OFFLINE",
    tokenStart: "cur_ide_88f2...",
    lastConnected: "14 hrs ago",
    permissions: {
      can_read_docs: true,
      can_execute_tools: false,
      can_view_pii: false,
    },
    allowedResources: ["file:///compliance/rbi_guidelines.md"]
  }
];

export default function AgentRegistry() {
  const [agents, setAgents] = useState<ConnectedAgent[]>(DEMO_AGENTS);
  const [generating, setGenerating] = useState(false);

  const togglePermission = (id: string, perm: keyof ConnectedAgent["permissions"]) => {
    setAgents(agents.map(a => {
      if (a.id === id) {
        // Enforce Sovereign rule: If enabling PII, issue an alert (handled silently here for demo)
        const newPerms = { ...a.permissions, [perm]: !a.permissions[perm] };
        return { ...a, permissions: newPerms };
      }
      return a;
    }));
  };

  const removeAgent = (id: string) => {
    if (confirm("Revoke access for this agent? Active connections will be instantly terminated.")) {
      setAgents(agents.filter(a => a.id !== id));
    }
  };

  async function generateNewToken() {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 800));
    const token = `mcp_live_${Math.random().toString(36).slice(2, 10)}`;
    alert(`New Sovereign Agent Token generated:\n\n${token}\n\nCopy this. It will only be shown once.`);
    setGenerating(false);
  }

  return (
    <div className="min-h-screen p-6 font-sans" style={{ background: "#050505", color: "#fff" }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Server className="w-6 h-6 text-blue-500" />
              <h1 className="text-3xl font-mono font-bold tracking-tight">Sovereign MCP Gateway</h1>
            </div>
            <p className="text-sm max-w-2xl" style={{ color: "#888" }}>
              The Agent Tooling Hub. Connect external IDEs and orchestrators via the Model Context Protocol. All communication is routed through the ZK Sanitizer by default.
            </p>
          </div>
          <button 
            onClick={generateNewToken}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: "#3b82f6", color: "#fff", boxShadow: "0 0 15px rgba(59,130,246,0.25)" }}>
            <KeyRound className="w-4 h-4" />
            {generating ? "Generating..." : "Issue Agent Token"}
          </button>
        </div>

        {/* Global Agent Config / Ghost Proxy Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl p-5 border" style={{ background: "#0a0a0a", borderColor: "rgba(16,185,129,0.2)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-mono uppercase tracking-widest text-emerald-500">ZK Shield active</p>
            </div>
            <p className="text-[11px]" style={{ color: "#aaa" }}>
              By default, all docs sent to agents are stripped of [PII]. Agents receive masked <code>[PERSON_X1]</code> tokens.
            </p>
          </div>
          <div className="rounded-2xl p-5 border" style={{ background: "#0a0a0a", borderColor: "rgba(168,85,247,0.2)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-purple-500" />
              <p className="text-xs font-mono uppercase tracking-widest text-purple-500">Recursive Caching</p>
            </div>
            <p className="text-[11px]" style={{ color: "#aaa" }}>
              Ghost proxy intercepts repetitive agent loops. Tree-hashing saves an estimated 48% on LLM token costs.
            </p>
          </div>
          <div className="rounded-2xl p-5 flex flex-col justify-center border" style={{ background: "#0a0a0a", borderColor: "#222" }}>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] font-mono" style={{ color: "#666" }}>ACTIVE MCP CONNECTIONS</p>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="text-3xl font-mono font-bold text-white">
              {agents.filter(a => a.status === "ONLINE").length}
            </p>
          </div>
        </div>

        {/* Connected Agents Registry */}
        <div className="rounded-2xl overflow-hidden border" style={{ background: "#0a0a0a", borderColor: "#1a1a1a" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#111" }}>
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: "#888" }}>Connected Agents Registry</h2>
            </div>
          </div>
          
          <div className="divide-y" style={{ borderColor: "#111" }}>
            {agents.map(agent => (
              <div key={agent.id} className="p-6">
                {/* Agent Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #222" }}>
                      <Server className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {agent.name}
                        {agent.status === "ONLINE" && <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">Online</span>}
                      </h3>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "#666" }}>
                        {agent.vendor} · Token: <span className="text-gray-400">{agent.tokenStart}</span> · Last seen: {agent.lastConnected}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded hover:bg-white/5 text-gray-500 transition-colors">
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeAgent(agent.id)} className="p-2 rounded hover:bg-red-500/10 text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Read Docs */}
                  <div className="rounded-xl p-3 flex items-center justify-between border transition-colors"
                       style={{ background: "#050505", borderColor: agent.permissions.can_read_docs ? "rgba(16,185,129,0.3)" : "#222" }}>
                    <div>
                      <p className="text-xs font-semibold text-white">Read Context</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">mcp.resources.read</p>
                    </div>
                    <button onClick={() => togglePermission(agent.id, "can_read_docs")}
                            className="w-10 h-5 rounded-full relative transition-colors"
                            style={{ background: agent.permissions.can_read_docs ? "#10b981" : "#333" }}>
                      <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all"
                           style={{ left: agent.permissions.can_read_docs ? "22px" : "2px" }} />
                    </button>
                  </div>
                  
                  {/* Execute Tools */}
                  <div className="rounded-xl p-3 flex items-center justify-between border transition-colors"
                       style={{ background: "#050505", borderColor: agent.permissions.can_execute_tools ? "rgba(59,130,246,0.3)" : "#222" }}>
                    <div>
                      <p className="text-xs font-semibold text-white">Execute Tools</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">mcp.tools.execute</p>
                    </div>
                    <button onClick={() => togglePermission(agent.id, "can_execute_tools")}
                            className="w-10 h-5 rounded-full relative transition-colors"
                            style={{ background: agent.permissions.can_execute_tools ? "#3b82f6" : "#333" }}>
                      <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all"
                           style={{ left: agent.permissions.can_execute_tools ? "22px" : "2px" }} />
                    </button>
                  </div>

                  {/* See PII (Dangerous) */}
                  <div className="rounded-xl p-3 flex items-center justify-between border transition-colors"
                       style={{ background: "#050505", borderColor: agent.permissions.can_view_pii ? "rgba(239,68,68,0.3)" : "#222" }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: agent.permissions.can_view_pii ? "#ef4444" : "#fff" }}>Bypass ZK Sanitizer</p>
                      <p className="text-[10px] text-red-500 mt-0.5">See raw PII data</p>
                    </div>
                    <button onClick={() => togglePermission(agent.id, "can_view_pii")}
                            className="w-10 h-5 rounded-full relative transition-colors"
                            style={{ background: agent.permissions.can_view_pii ? "#ef4444" : "#333" }}>
                      <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all"
                           style={{ left: agent.permissions.can_view_pii ? "22px" : "2px" }} />
                    </button>
                  </div>
                </div>

                {/* Scoped Access */}
                <div className="rounded-xl p-3 border" style={{ background: "#050505", borderColor: "#111" }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-2">Scoped Resource Access</p>
                  <div className="flex flex-wrap gap-2">
                    {agent.allowedResources.map(res => (
                      <span key={res} className="px-2 py-1 rounded text-[10px] font-mono border"
                            style={{ background: "rgba(255,255,255,0.02)", borderColor: "#222", color: "#aaa" }}>
                        {res}
                      </span>
                    ))}
                    <button className="px-2 py-1 rounded text-[10px] font-mono border border-dashed hover:text-white transition-colors"
                            style={{ borderColor: "#333", color: "#666" }}>
                      + Add URI Scope
                    </button>
                  </div>
                </div>

              </div>
            ))}
            {agents.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No agents are currently registered.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
