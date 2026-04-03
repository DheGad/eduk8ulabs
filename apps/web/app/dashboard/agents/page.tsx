"use client";

import React, { useState, useEffect, useRef } from "react";

type AgentEvent = 
  | { type: "THOUGHT"; content: string }
  | { type: "ACTION"; tool: string; input: string }
  | { type: "SECURITY_CHECK"; component: string; status: "PASSED" | "FAILED"; detail: string }
  | { type: "OBSERVATION"; content: string }
  | { type: "FINAL_ANSWER"; content: string }
  | { type: "ERROR"; content: string };

export default function AgentTerminalPage() {
  const [prompt, setPrompt] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const simulateRun = async (inputPrompt: string) => {
    setIsRunning(true);
    setEvents([]);
    
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    
    // Simulating the backend SovereignAgent generator
    const sequence: AgentEvent[] = [
      { type: "THOUGHT", content: `I need to analyze the prompt: "${inputPrompt}" and select the right tool.` },
      { type: "THOUGHT", content: `I will use the ${inputPrompt.toLowerCase().includes("vault") ? "VaultQuery" : "WebSearch"} tool to process the request.` },
      { type: "ACTION", tool: inputPrompt.toLowerCase().includes("vault") ? "VaultQuery" : "WebSearch", input: inputPrompt },
      { type: "SECURITY_CHECK", component: "V81 NeMo Guardrails", status: "PASSED", detail: "Validating intent" },
    ];
    
    for (const ev of sequence) {
      await delay(Math.random() * 800 + 400);
      setEvents(e => [...e, ev]);
    }
    
    // Simulate DLP Check
    await delay(600);
    const hasPII = inputPrompt.match(/\\b\\d{3}-\\d{2}-\\d{4}\\b/); // SSN simulation
    
    if (hasPII) {
      setEvents(e => [...e, { type: "SECURITY_CHECK", component: "V67 DLP Scrubber", status: "FAILED", detail: "Detected 1 PII entity (SSN)" }]);
      await delay(300);
      setEvents(e => [...e, { type: "ERROR", content: "KILL SWITCH ENGAGED: DLP Scrubber intercepted sensitive data in tool input." }]);
      setIsRunning(false);
      return;
    } else {
      setEvents(e => [...e, { type: "SECURITY_CHECK", component: "V67 DLP Scrubber", status: "PASSED", detail: "Scanning for PII" }]);
    }

    await delay(1000);
    setEvents(e => [...e, { type: "OBSERVATION", content: `[Simulated Result] Executed tool successfully for "${inputPrompt}".` }]);
    
    await delay(800);
    setEvents(e => [...e, { type: "THOUGHT", content: `I have the information I need.` }]);
    
    await delay(500);
    setEvents(e => [...e, { type: "FINAL_ANSWER", content: `Based on the tools, the result has been processed and anchored.` }]);
    
    setIsRunning(false);
  };

  const renderEvent = (ev: AgentEvent, idx: number) => {
    switch (ev.type) {
      case "THOUGHT":
        return <div key={idx} className="text-gray-400 font-mono text-sm">[AGENT THOUGHT] <span className="text-gray-200">-&gt; {ev.content}</span></div>;
      case "ACTION":
        return <div key={idx} className="text-[#00E599] font-mono text-sm">[TOOL EXECUTION] <span className="font-bold">{ev.tool}</span>(input: "{ev.input}")</div>;
      case "SECURITY_CHECK":
        return (
          <div key={idx} className="font-mono text-sm inline-flex items-center gap-2 mt-1 mb-1">
            <span className="text-blue-400">[SECURITY CHECK]</span>
            <span className="text-gray-300">-&gt; {ev.component}:</span>
            <span className={ev.status === "PASSED" ? "bg-green-900/40 text-green-400 px-1 rounded" : "bg-red-900/40 text-red-400 px-1 rounded font-bold"}>
              {ev.status}
            </span>
            <span className="text-gray-500 text-xs ml-2">({ev.detail})</span>
          </div>
        );
      case "OBSERVATION":
        return <div key={idx} className="text-purple-400 font-mono text-sm">[OBSERVATION] <span className="text-purple-200">{ev.content}</span></div>;
      case "FINAL_ANSWER":
        return <div key={idx} className="text-yellow-400 font-mono text-md mt-2 mb-4 font-bold">» {ev.content}</div>;
      case "ERROR":
        return <div key={idx} className="text-red-500 font-mono text-md mt-2 mb-4 font-bold border border-red-500/30 p-2 bg-red-950/20 rounded-md">⛔ {ev.content}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] p-8 text-white font-sans">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Sovereign Agent Swarm</h1>
          <p className="text-gray-400 text-sm">V98 Embedded ReAct Loop within the V81/V85 Security Perimeter.</p>
        </header>

        {/* Input Form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); simulateRun(prompt); setPrompt(""); }} 
          className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isRunning}
            placeholder="Command the OS Agent..."
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 font-mono text-sm"
          />
          <button 
            type="submit" 
            disabled={isRunning || !prompt.trim()}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-black font-bold text-sm tracking-wide disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
          >
            EXECUTE
          </button>
        </form>

        {/* Streaming Terminal */}
        <div className="flex-1 min-h-[500px] border border-emerald-500/20 rounded-xl bg-[#0A0A0A]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,229,153,0.05)] p-6 overflow-y-auto flex flex-col gap-1 relative">
          
          <div className="absolute top-0 right-0 p-4 opacity-30 select-none pointer-events-none">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#00E599" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="#00E599" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#00E599" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="text-xs text-gray-500 font-mono border-b border-white/10 pb-2 mb-4">
            STREETMP_OS KERNEL &gt; /bin/sovereign-agent --secure-mode
          </div>

          {events.length === 0 && !isRunning && (
            <div className="text-gray-600 font-mono text-sm h-full flex items-center justify-center animate-pulse">
              [ Awaiting Command ]
            </div>
          )}

          {events.map((ev, i) => renderEvent(ev, i))}
          
          {isRunning && (
            <div className="mt-2 text-[#00E599] font-mono text-xl animate-pulse">
              _
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
