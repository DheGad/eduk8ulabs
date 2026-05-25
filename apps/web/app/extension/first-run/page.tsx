"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, ArrowRight, Play, CheckCircle2, Lock, Activity, FileText, Loader2 } from "lucide-react";

export default function FirstRunExperiencePage() {
  const [step, setStep] = useState(0);

  const runSimulation = () => {
    setStep(1);
    setTimeout(() => setStep(2), 2000); // Pasted data
    setTimeout(() => setStep(3), 3500); // Intercepted
    setTimeout(() => setStep(4), 5000); // Sanitized
    setTimeout(() => setStep(5), 6500); // Logged
  };

  // Auto-play on mount after a brief orientation pause
  useEffect(() => {
    const t = setTimeout(runSimulation, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto w-full">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
        <Shield size={32} className="text-emerald-400" />
      </div>

      <h1 className="text-3xl font-black text-white tracking-tight mb-3 text-center">
        See It In Action
      </h1>
      <p className="text-sm text-zinc-400 text-center max-w-lg mb-10 leading-relaxed">
        Watch how StreetMP seamlessly intercepts and sanitizes sensitive data before it reaches ChatGPT.
      </p>

      <div className="w-full grid lg:grid-cols-2 gap-8">
        {/* Simulation Window */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#08080e] overflow-hidden shadow-2xl flex flex-col h-[400px]">
          <div className="h-10 bg-white/[0.02] border-b border-white/[0.04] flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <div className="mx-auto text-[10px] text-zinc-500 font-mono bg-white/[0.05] rounded px-3 py-1">chat.openai.com</div>
          </div>
          
          <div className="flex-1 p-6 flex flex-col justify-end relative">
            {step === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 size={14} className="animate-spin" /> Loading simulation…
                </div>
              </div>
            )}

            {step >= 2 && (
              <div className="self-end max-w-[80%] bg-zinc-800 rounded-2xl rounded-tr-sm p-4 mb-4 animate-in slide-in-from-bottom-2 fade-in">
                <p className="text-sm text-zinc-200">
                  Can you summarize this patient file?
                  <br/><br/>
                  Name: John Doe<br/>
                  SSN: 123-45-6789<br/>
                  Diagnosis: Type 2 Diabetes
                </p>
              </div>
            )}

            {step >= 4 && (
              <div className="self-start max-w-[80%] bg-white/[0.05] border border-emerald-500/20 rounded-2xl rounded-tl-sm p-4 animate-in slide-in-from-bottom-2 fade-in">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-400">
                  <Shield size={14} /> StreetMP Intercepted
                </div>
                <p className="text-sm text-zinc-300">
                  The data was sanitized before reaching ChatGPT:
                  <br/><br/>
                  Name: [REDACTED_NAME]<br/>
                  SSN: [REDACTED_SSN]<br/>
                  Diagnosis: Type 2 Diabetes
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex flex-col justify-center space-y-6">
          <TimelineItem 
            active={step >= 1} 
            done={step > 1}
            icon={Activity} 
            title="User types in ChatGPT" 
            desc="Employee pastes sensitive patient data into the chat window." 
          />
          <TimelineItem 
            active={step >= 3} 
            done={step > 3}
            icon={Lock} 
            title="StreetMP Intercepts" 
            desc="Extension catches the request in <25ms before it leaves the browser." 
          />
          <TimelineItem 
            active={step >= 4} 
            done={step > 4}
            icon={Shield} 
            title="Data Sanitized" 
            desc="SSN and Name are redacted based on healthcare compliance policies." 
          />
          <TimelineItem 
            active={step >= 5} 
            done={step >= 5}
            icon={FileText} 
            title="Audit Logged" 
            desc="A cryptographic proof of the redaction is logged to the enterprise dashboard." 
          />

          {step >= 5 && (
            <div className="pt-6 animate-in fade-in zoom-in">
              <Link
                href="/dashboard/admin/onboarding"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black hover:bg-emerald-400 transition-all"
              >
                Go to Dashboard <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ active, done, icon: Icon, title, desc }: any) {
  return (
    <div className={`flex gap-4 transition-all duration-500 ${active ? "opacity-100" : "opacity-40"}`}>
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${done ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : active ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/10 text-zinc-600"}`}>
          {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
        </div>
        <div className={`w-px h-12 my-1 ${done ? "bg-emerald-500/30" : "bg-white/10"}`} />
      </div>
      <div className="pt-1">
        <h4 className={`text-sm font-bold mb-1 ${done ? "text-emerald-400" : active ? "text-white" : "text-zinc-500"}`}>{title}</h4>
        <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
