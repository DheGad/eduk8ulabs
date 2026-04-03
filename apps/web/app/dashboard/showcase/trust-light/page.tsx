"use client";

import { useState, useEffect, useRef } from "react";
import { TrustLight, type TrustSignalColor } from "@/components/public/TrustLight";

type Scenario = "banking" | "medical" | "legal";

interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  signal?:   TrustSignalColor;
  score?:    number;
  latency?:  number;
  policy?:   string;
  flags?:    string[];
}

const SCENARIO_CONFIG: Record<Scenario, {
  label:      string;
  icon:       string;
  name:       string;
  subtitle:   string;
  color:      string;
  borderColor:string;
  messages:   Omit<ChatMessage, "id">[];
}> = {
  banking: {
    label:       "Banking",
    icon:        "🏦",
    name:        "Apex Financial AI",
    subtitle:    "Secure Corporate Banking Assistant",
    color:       "text-blue-300",
    borderColor: "border-blue-500/20",
    messages: [
      { role: "user",      content: "What's the balance on account 47821?" },
      { role: "assistant", content: "Account ****821 balance: $2,847,392.14 USD as of today. Transfers above $50k require dual authorization under your current policy.", signal: "GREEN",  score: 98, latency: 142, policy: "FINANCE_STRICT_MODE", flags: ["PII_MASKED"] },
      { role: "user",      content: "Can you send the full account details to my personal email?" },
      { role: "assistant", content: "⛔ This request was blocked. Exporting account data to external email addresses violates your FINANCE_STRICT_MODE policy (Rule 4.2). This action has been logged.", signal: "RED",    score: 22, latency: 38,  policy: "FINANCE_STRICT_MODE", flags: ["POLICY_VIOLATION", "DATA_EXFILTRATION_ATTEMPT"] },
      { role: "user",      content: "Show me Q3 spending trends for the operations department." },
      { role: "assistant", content: "Q3 Operations Spend: $14.2M total. Top categories: Infrastructure (34%), Personnel (41%), Vendor Contracts (25%). YoY increase: +8.2%. Full report available in the analytics portal.", signal: "GREEN",  score: 96, latency: 218, policy: "FINANCE_STRICT_MODE", flags: [] },
    ],
  },
  medical: {
    label:       "Medical",
    icon:        "🏥",
    name:        "MediCore Clinical AI",
    subtitle:    "NHS-Compliant Patient Intelligence",
    color:       "text-emerald-300",
    borderColor: "border-emerald-500/20",
    messages: [
      { role: "user",      content: "Summarise patient Dheeraj G., DOB 1990-03-15, last admission." },
      { role: "assistant", content: "Patient [REDACTED — HIPAA §164.514]. Last admission: 2026-01-22. Diagnosis category: Cardiac. Discharge: 2026-01-25. Next review: 2026-04-10. Full record accessible to authorised clinicians only.", signal: "YELLOW", score: 81, latency: 197, policy: "NHS_HIPAA_STRICT",   flags: ["PII_REDACTED"] },
      { role: "user",      content: "What is the recommended treatment protocol for Type 2 Diabetes?" },
      { role: "assistant", content: "First-line treatment: Metformin 500mg twice daily with meals, lifestyle modification (diet + 150min/week activity). Monitor HbA1c every 3 months. Escalate to GLP-1 agonist if HbA1c > 7.5% after 3 months.", signal: "GREEN",  score: 99, latency: 161, policy: "NHS_HIPAA_STRICT",   flags: [] },
    ],
  },
  legal: {
    label:       "Legal",
    icon:        "⚖️",
    name:        "LexAI Enterprise",
    subtitle:    "Sovereign Legal Research Assistant",
    color:       "text-violet-300",
    borderColor: "border-violet-500/20",
    messages: [
      { role: "user",      content: "Draft an NDA amendment for the Klust acquisition." },
      { role: "assistant", content: "Draft NDA Amendment (Klust Acquisition):\n\n§1. Parties: [CLIENT_CORP] and Klust Technologies Ltd.\n§2. Duration extended to 5 years from execution date.\n§3. Carve-outs added for regulatory disclosures.\n\nThis draft is advisory only. Review by qualified counsel required.", signal: "GREEN",  score: 94, latency: 312, policy: "LEGAL_ENTERPRISE_MODE", flags: [] },
      { role: "user",      content: "Share this draft with external@competitor.com" },
      { role: "assistant", content: "⛔ Action blocked. Routing attorney-client privileged material to unverified external addresses violates LEGAL_ENTERPRISE_MODE policy. This attempt has been logged for your compliance officer.", signal: "RED",    score: 18, latency: 29,  policy: "LEGAL_ENTERPRISE_MODE", flags: ["POLICY_VIOLATION"] },
    ],
  },
};

function makeid() { return Math.random().toString(36).slice(2, 8); }

export default function TrustLightShowcase() {
  const [scenario, setScenario] = useState<Scenario>("banking");
  const [displayed, setDisplayed] = useState<ChatMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalSignal, setGlobalSignal] = useState<TrustSignalColor>("GREEN");
  const bottomRef = useRef<HTMLDivElement>(null);
  const cfg = SCENARIO_CONFIG[scenario];

  // Reset when scenario changes
  useEffect(() => {
    setDisplayed([]);
    setIsPlaying(false);
    setGlobalSignal("GREEN");
  }, [scenario]);

  // Auto-play messages with delay
  useEffect(() => {
    if (!isPlaying) return;
    const msgs = cfg.messages;
    if (displayed.length >= msgs.length) { setIsPlaying(false); return; }

    const next = msgs[displayed.length]!;
    const delay = next.role === "assistant" ? 900 : 400;

    const t = setTimeout(() => {
      const msg: ChatMessage = { ...next, id: makeid() };
      setDisplayed(prev => [...prev, msg]);
      if (msg.signal) setGlobalSignal(msg.signal);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, delay);

    return () => clearTimeout(t);
  }, [isPlaying, displayed, cfg]);

  const latestAssistant = [...displayed].reverse().find(m => m.role === "assistant");

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-8 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Trust Light — Live Showcase</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Investor demo: the TrustLight embedded inside a real enterprise application. One glowing dot. Instant cryptographic proof.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* LEFT: Controls */}
        <div className="col-span-2 space-y-5">
          {/* Scenario picker */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Select Industry Scenario</p>
            <div className="flex flex-col gap-2">
              {(["banking", "medical", "legal"] as Scenario[]).map(s => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all text-left
                    ${scenario === s
                      ? `${SCENARIO_CONFIG[s].borderColor} bg-slate-800 text-white`
                      : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"}`}
                >
                  <span className="text-xl">{SCENARIO_CONFIG[s].icon}</span>
                  <div>
                    <p className="text-xs font-bold">{SCENARIO_CONFIG[s].name}</p>
                    <p className="text-[10px] text-slate-500">{SCENARIO_CONFIG[s].subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Playback controls */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Demo Controls</p>
            <button
              onClick={() => { setDisplayed([]); setGlobalSignal("GREEN"); setIsPlaying(true); }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest transition-all"
            >
              ▶ Play Demo
            </button>
            <button
              onClick={() => { setDisplayed([]); setGlobalSignal("GREEN"); setIsPlaying(false); }}
              className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
            >
              ↺ Reset
            </button>
          </div>

          {/* Trust Light Standalone Preview */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Trust Signal</p>
            <TrustLight
              signal={globalSignal}
              trustScore={latestAssistant?.score ?? 100}
              executionId={`exec_${makeid()}`}
              fingerprint={`${makeid().toUpperCase().slice(0,12)}`}
              activePolicy={latestAssistant?.policy ?? "DEFAULT_SAFE_MODE"}
              model="streetmp-auto"
              latencyMs={latestAssistant?.latency ?? 0}
              dataExposure="0% — Fragmented"
              complianceFlags={latestAssistant?.flags ?? []}
            />
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Click the badge above to inspect the full V36 execution certificate.
            </p>
          </div>
        </div>

        {/* RIGHT: Fake Enterprise Chat Interface */}
        <div className="col-span-3">
          <div className={`rounded-2xl border overflow-hidden shadow-2xl h-full flex flex-col bg-[#0d1117] ${cfg.borderColor}`}>
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cfg.icon}</span>
                <div>
                  <p className={`text-sm font-bold ${cfg.color}`}>{cfg.name}</p>
                  <p className="text-[10px] text-slate-500">{cfg.subtitle}</p>
                </div>
              </div>
              {/* TrustLight embedded in chat header */}
              <TrustLight
                signal={globalSignal}
                trustScore={latestAssistant?.score ?? 100}
                executionId={`exec_${makeid()}`}
                fingerprint={`${makeid().toUpperCase().slice(0, 12)}`}
                activePolicy={latestAssistant?.policy ?? "DEFAULT_SAFE_MODE"}
                model="streetmp-auto"
                latencyMs={latestAssistant?.latency ?? 0}
                dataExposure="0% — Fragmented"
                complianceFlags={latestAssistant?.flags ?? []}
              />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[360px]">
              {displayed.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                  Press ▶ Play Demo to begin
                </div>
              )}
              {displayed.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
                  {msg.role === "assistant" && (
                    <span className="text-lg mr-2 mt-0.5 shrink-0">{cfg.icon}</span>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : msg.signal === "RED"
                        ? "bg-red-950/60 border border-red-500/30 text-red-200 rounded-bl-sm"
                        : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-sm"}`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && msg.signal && (
                      <div className={`flex items-center gap-2 mt-2 pt-2 border-t text-[10px] font-mono
                        ${msg.signal === "RED" ? "border-red-500/20 text-red-400" : "border-slate-700 text-slate-500"}`}>
                        <span>{msg.signal === "GREEN" ? "🟢" : msg.signal === "YELLOW" ? "🟡" : "🔴"}</span>
                        <span>Trust {msg.score}/100 · {msg.latency}ms · {msg.policy}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isPlaying && displayed.length < cfg.messages.length && displayed[displayed.length - 1]?.role === "user" && (
                <div className="flex justify-start animate-in fade-in">
                  <span className="text-lg mr-2 mt-0.5">{cfg.icon}</span>
                  <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar (decorative) */}
            <div className="px-5 py-4 border-t border-slate-800 flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-xs text-slate-600">
                Type a message...
              </div>
              <button className="w-9 h-9 rounded-xl bg-blue-600/80 flex items-center justify-center text-white text-sm">→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
