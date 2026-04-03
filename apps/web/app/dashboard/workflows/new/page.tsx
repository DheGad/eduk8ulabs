"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createAutonomousWorkflow } from "@/lib/apiClient";

type NodeType = "Extract Data" | "Sanitize PII" | "Enforce JSON" | "Analyze";

interface NodeData {
  id: string;
  type: NodeType;
  prompt: string;
  model: string;
  schema: string;
}

export default function WorkflowStudio() {
  const router = useRouter();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [workflowName, setWorkflowName] = useState("My Autonomous Pipeline");
  const [isSaving, setIsSaving] = useState(false);

  const addNode = (type: NodeType) => {
    const newNode: NodeData = {
      id: `step_${nodes.length + 1}_${Date.now()}`,
      type,
      prompt: `System prompt for ${type}...`,
      model: "gpt-4o",
      schema: "{\n  \"required_keys\": []\n}"
    };
    setNodes([...nodes, newNode]);
  };

  const updateNode = (id: string, field: keyof NodeData, value: string) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
  };

  const handleSave = async () => {
    if (nodes.length === 0) return alert("Add at least one node to save.");
    try {
      setIsSaving(true);
      // Construct sequences linearly for simplicity
      const edges = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({ from: nodes[i].id, to: nodes[i+1].id });
      }

      // Parse JSON schemas safely
      const formattedNodes = nodes.map(n => {
         let parsedSchema = {};
         try { parsedSchema = JSON.parse(n.schema); } catch(e) {}
         return { ...n, schema: parsedSchema };
      });

      const res = await createAutonomousWorkflow({
        name: workflowName,
        organization_id: "org_default_123",
        nodes: formattedNodes,
        edges
      });

      if (res.success && res.workflow_id) {
        router.push("/dashboard/workflows/" + res.workflow_id + "/execute");
      }
    } catch (e: any) {
      alert("Error saving pipeline: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold tracking-tight text-white/90">Agentic Orchestrator</h1>
          <div className="h-4 w-px bg-neutral-700"></div>
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent border-none text-neutral-300 focus:outline-none focus:ring-0 text-sm w-64"
            placeholder="Pipeline Name..."
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-2 disabled:opacity-50"
        >
          {isSaving ? (
            <span className="animate-pulse">Saving...</span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              <span>Save Pipeline</span>
            </>
          )}
        </button>
      </header>

      {/* Main Studio Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pallet */}
        <aside className="w-64 border-r border-neutral-800 bg-neutral-900/40 p-4 flex flex-col">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Node Components</h2>
          <div className="flex flex-col space-y-2">
            {[ "Extract Data", "Sanitize PII", "Enforce JSON", "Analyze" ].map((type) => (
              <button
                key={type}
                onClick={() => addNode(type as NodeType)}
                className="flex items-center justify-between p-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm text-neutral-300 transition-colors cursor-pointer group"
              >
                <span>{type}</span>
                <span className="text-neutral-500 group-hover:text-indigo-400">+</span>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-6">
            <div className="p-3 rounded bg-indigo-900/20 border border-indigo-500/20 text-indigo-300 text-xs leading-relaxed">
              Drag nodes to the canvas to construct your autonomous DAG sequence.
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 overflow-y-auto bg-neutral-950 p-8 relative">
          <div className="max-w-3xl mx-auto space-y-6">
            {nodes.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-xl text-neutral-500">
                <svg className="w-12 h-12 mb-3 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <p>Click a component to add it to the sequence.</p>
              </div>
            ) : (
              nodes.map((node, index) => (
                <div key={node.id} className="relative group">
                  {/* Sequence Connector Line */}
                  {index !== 0 && (
                     <div className="absolute -top-6 left-1/2 w-0.5 h-6 bg-neutral-800 flex items-center justify-center pointer-events-none">
                       <div className="w-2 h-2 rounded-full border border-neutral-700 bg-neutral-900"></div>
                     </div>
                  )}
                  
                  {/* Node Card */}
                  <div className="bg-neutral-900 border border-neutral-700/60 rounded-xl shadow-2xl p-5 transition-all focus-within:border-indigo-500/50">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-md border border-indigo-500/20">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-md font-semibold text-white/90">{node.type}</h3>
                      </div>
                      <button onClick={() => removeNode(node.id)} className="text-neutral-500 hover:text-red-400 transition-colors p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 md:col-span-1 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-400 mb-1">Model Selection</label>
                          <select 
                            value={node.model}
                            onChange={(e) => updateNode(node.id, 'model', e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 rounded-md p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          >
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                            <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-400 mb-1">Prompt Template</label>
                          <textarea 
                            value={node.prompt}
                            onChange={(e) => updateNode(node.id, 'prompt', e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 rounded-md p-2 min-h-[100px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono resize-y"
                            placeholder="Use {{step_1.output}} to inject dependencies..."
                          />
                        </div>
                      </div>

                      <div className="col-span-2 md:col-span-1 flex flex-col h-full">
                        <label className="block text-xs font-medium text-neutral-400 mb-1">Enforced JSON Schema (Output)</label>
                        <textarea 
                          value={node.schema}
                          onChange={(e) => updateNode(node.id, 'schema', e.target.value)}
                          className="flex-1 w-full bg-neutral-950 border border-neutral-800 text-sm text-amber-400/90 rounded-md p-2 min-h-[160px] focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none font-mono resize-y"
                          placeholder='{ "type": "object", "properties": {} }'
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
