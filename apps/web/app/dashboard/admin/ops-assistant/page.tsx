"use client";

import React, { useState } from "react";
import Link from "next/link";

type ChatMessage = {
  role: "user" | "ops-agent";
  content: string;
};

type SupportTicket = {
  id: string;
  tenant: string;
  subject: string;
  body: string;
  status: "open" | "drafted" | "resolved";
  aiDraft?: string;
};

const MOCK_TICKETS: SupportTicket[] = [
  {
    id: "TK-9021",
    tenant: "Acme Corp",
    subject: "API Blocked - Quorum errors",
    body: "All of our requests since 3 AM are failing with a 502 bft_quorum_failed error. Please advise.",
    status: "open"
  },
  {
    id: "TK-9022",
    tenant: "Global Finance",
    subject: "Quota Reached Warning",
    body: "We received a webhook that our token burn is at 95% capacity. We need an emergency lift.",
    status: "open"
  }
];

export default function OpsAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ops-agent", content: "Ops Agent operational. Connected to routing mesh, V47 Vault, and Telemetry layers. How can I assist the execution protocol today?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>(MOCK_TICKETS);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [draftingTicketId, setDraftingTicketId] = useState<string | null>(null);

  const QUICK_QUERIES = [
    "Show client health summary",
    "List recent errors",
    "Usage by client this month"
  ];

  const handleQuery = async (query: string) => {
    if (!query.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: query }]);
    setInput("");
    setIsTyping(true);

    let response = "Agent offline or unreachable.";
    
    try {
      const res = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const json = await res.json();
      if (json.success && json.data) {
        response = json.data;
      } else {
        response = `[SYSTEM ERROR] ${json.error || "Internal Agent Error"}`;
      }
    } catch (e: any) {
      response = `[NETWORK OFFLINE] Connection to Matrix lost. ${e.message}`;
    }

    setMessages(prev => [...prev, { role: "ops-agent", content: response }]);
    setIsTyping(false);
  };

  const handleDraftResolution = async (ticket: SupportTicket) => {
    setDraftingTicketId(ticket.id);
    
    let draft = "Resolving...";
    try {
      const res = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketContent: ticket.body })
      });
      const json = await res.json();
      if (json.success && json.data) {
        draft = json.data;
      } else {
        draft = `[ERROR] ${json.error || "Failed to generate summary"}`;
      }
    } catch (e: any) {
      draft = `[NETWORK ERROR] Could not reach Ops Agent: ${e.message}`;
    }

    setTickets(prev => prev.map(t => 
      t.id === ticket.id ? { ...t, status: "drafted", aiDraft: draft } : t
    ));
    setDraftingTicketId(null);
  };

  return (
    <div className="flex h-screen bg-[#000000] text-white font-sans selection:bg-emerald-500/30">
      
      {/* LEFT PANEL: Chat Interface */}
      <div className="flex-1 flex flex-col border-r border-white/10 relative overflow-hidden bg-[#0A0A0A]/80 backdrop-blur-3xl">
        <header className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
              V98 Ops Assistant
            </h1>
            <p className="text-gray-500 text-xs font-mono uppercase tracking-widest mt-1 shadow-sm">
              Clearance: FOUNDER / ADMIN
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono text-emerald-500">SYSTEM ONLINE</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl p-4 font-mono text-sm leading-relaxed ${
                msg.role === "user" 
                  ? "bg-white/10 text-white rounded-tr-sm border border-white/5" 
                  : "bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 rounded-tl-sm shadow-[0_0_15px_rgba(0,229,153,0.05)]"
              }`}>
                {msg.content.split('\\n').map((line, j) => <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>)}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-emerald-950/20 border border-emerald-500/20 px-4 py-3 rounded-2xl rounded-tl-sm text-emerald-500 flex gap-1">
                <span className="animate-bounce">•</span><span className="animate-bounce" style={{animationDelay: "0.2s"}}>•</span><span className="animate-bounce" style={{animationDelay: "0.4s"}}>•</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-black/40">
          <div className="flex flex-wrap gap-2 mb-4">
            {QUICK_QUERIES.map(q => (
              <button 
                key={q}
                onClick={() => handleQuery(q)}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleQuery(input); }}
            className="flex gap-4"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query internal OS logs..."
              className="flex-1 bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono text-sm"
              disabled={isTyping}
            />
            <button 
              type="submit"
              disabled={!(typeof input === "string" ? input.trim() : "") || isTyping}
              className="px-6 py-3 bg-white text-black font-bold rounded-lg text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 tracking-wider"
            >
              EXECUTE
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT PANEL: Ticket Triage Queue */}
      <div className="w-1/3 flex flex-col bg-[#050505] overflow-y-auto">
        <header className="p-6 border-b border-white/5 bg-black/60 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-white/90">Support Triage Queue</h2>
          <p className="text-xs text-gray-500 mt-1">AI-Augmented Log Resolution</p>
        </header>

        <div className="p-6 flex flex-col gap-4">
          {tickets.map(ticket => (
            <div 
              key={ticket.id} 
              className={`p-5 rounded-xl border transition-all cursor-pointer ${
                activeTicket?.id === ticket.id ? "bg-white/5 border-emerald-500/50 shadow-[0_0_20px_rgba(0,229,153,0.1)]" : "bg-[#0A0A0A] border-white/5 hover:border-white/20"
              }`}
              onClick={() => setActiveTicket(ticket)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono font-bold text-gray-500">{ticket.id}</span>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                  ticket.status === "open" ? "bg-yellow-900/40 text-yellow-500" :
                  ticket.status === "drafted" ? "bg-blue-900/40 text-blue-400" :
                  "bg-green-900/40 text-green-400"
                }`}>
                  {ticket.status}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{ticket.subject}</h3>
              <p className="text-xs text-emerald-500/70 font-mono">{ticket.tenant}</p>
              
              {activeTicket?.id === ticket.id && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{ticket.body}</p>
                  
                  {ticket.status === "open" ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDraftResolution(ticket); }}
                      disabled={draftingTicketId === ticket.id}
                      className="w-full py-2 bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:text-emerald-400 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                    >
                      {draftingTicketId === ticket.id ? "SCANNING RAG KNOWLEDGE BASE..." : "GENERATE AI DRAFT"}
                    </button>
                  ) : ticket.status === "drafted" && ticket.aiDraft ? (
                    <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-lg">
                      <p className="text-xs font-mono text-blue-400 mb-2">AI CAPSULE DRAFT:</p>
                      <div className="text-xs text-blue-200/80 font-mono leading-relaxed whitespace-pre-wrap mb-3">
                        {ticket.aiDraft.split('\\n').map((line, idx) => <p key={idx}>{line}</p>)}
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 bg-emerald-500 text-black font-bold py-1.5 rounded text-xs hover:bg-emerald-400 transition-colors">APPROVE & SEND</button>
                        <button className="flex-1 bg-white/5 text-white font-bold py-1.5 rounded text-xs hover:bg-white/10 transition-colors">EDIT</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
