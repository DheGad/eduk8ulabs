"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Cpu, FileText, Terminal, Sparkles, ShieldCheck, CheckCircle, EyeOff, ShieldAlert, FileSearch, Bot } from "lucide-react";

// --- Data ---
const APPS = [
  { id: 'chatgpt', label: 'ChatGPT', Icon: Bot },
  { id: 'claude', label: 'Claude', Icon: Cpu },
  { id: 'gemini', label: 'Gemini', Icon: Sparkles },
  { id: 'slack', label: 'Slack AI', Icon: MessageSquare },
  { id: 'copilot', label: 'Copilot', Icon: Terminal },
  { id: 'docs', label: 'Docs AI', Icon: FileText },
];

const OUTCOMES = [
  { id: 'safe', label: 'Safe AI', Icon: CheckCircle, color: 'emerald' },
  { id: 'sanitized', label: 'Data Removed', Icon: EyeOff, color: 'amber' },
  { id: 'blocked', label: 'Threat Blocked', Icon: ShieldAlert, color: 'red' },
  { id: 'audit', label: 'Audit Logged', Icon: FileSearch, color: 'blue' },
];

const OUTCOME_COLORS = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'rgba(52,211,153,0.6)' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   glow: 'rgba(251,191,36,0.6)' },
  red:     { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     glow: 'rgba(248,113,113,0.6)' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    glow: 'rgba(96,165,250,0.6)' },
};

const SCENARIOS = [
  {
    appId: 'chatgpt',
    outcomeIds: ['sanitized', 'safe'],
    step1: "Employee pastes customer spreadsheet into ChatGPT",
    step2: "Sensitive data detected and masked instantly",
    step3: "Safe response returned to employee",
    color: 'amber'
  },
  {
    appId: 'claude',
    outcomeIds: ['safe', 'audit'],
    step1: "Claude receives HR payroll document",
    step2: "Employee identifiers removed at the edge",
    step3: "Policy enforced safely",
    color: 'emerald'
  },
  {
    appId: 'slack',
    outcomeIds: ['blocked', 'audit'],
    step1: "Slack AI request contains confidential roadmap",
    step2: "Zero-trust routing identifies data leak",
    step3: "Threat blocked and audit logged",
    color: 'red'
  }
];

const METRICS = [
  { label: "BLOCKED", value: "14,243", color: "text-rose-400" },
  { label: "SANITIZED", value: "9.4 GB", color: "text-amber-400" },
  { label: "LATENCY", value: "12ms", color: "text-emerald-400" },
  { label: "FLEET", value: "99.9%", color: "text-emerald-400" },
];

export function CinematicRuntimeTheater() {
  const [tick, setTick] = useState(0);

  // Measure SVG paths safely
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const appRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const outRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [appPaths, setAppPaths] = useState<{id: string, d: string}[]>([]);
  const [outPaths, setOutPaths] = useState<{id: string, d: string}[]>([]);

  const measurePaths = useCallback(() => {
    if (!containerRef.current || !coreRef.current) return;
    const cb = containerRef.current.getBoundingClientRect();
    const coreB = coreRef.current.getBoundingClientRect();
    const cx = coreB.left - cb.left + coreB.width / 2;
    const cy = coreB.top - cb.top + coreB.height / 2;

    const newAppPaths: {id: string, d: string}[] = [];
    Object.entries(appRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const rb = el.getBoundingClientRect();
      const ax = rb.left - cb.left + rb.width;
      const ay = rb.top - cb.top + rb.height / 2;
      const mx = ax + (cx - ax) * 0.4;
      newAppPaths.push({ id, d: `M ${ax} ${ay} C ${mx} ${ay} ${mx} ${cy} ${cx} ${cy}` });
    });
    setAppPaths(newAppPaths);

    const newOutPaths: {id: string, d: string}[] = [];
    Object.entries(outRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const rb = el.getBoundingClientRect();
      const ox = rb.left - cb.left;
      const oy = rb.top - cb.top + rb.height / 2;
      const mx = cx + (ox - cx) * 0.6;
      newOutPaths.push({ id, d: `M ${cx} ${cy} C ${mx} ${cy} ${mx} ${oy} ${ox} ${oy}` });
    });
    setOutPaths(newOutPaths);
  }, []);

  useEffect(() => {
    const t = setTimeout(measurePaths, 150); // slight delay to ensure render
    window.addEventListener("resize", measurePaths);
    return () => { clearTimeout(t); window.removeEventListener("resize", measurePaths); };
  }, [measurePaths]);

  // Tick logic
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500); 
    return () => clearInterval(id);
  }, []);

  const scenarioIdx = Math.floor(tick / 18) % SCENARIOS.length;
  const tickWithinScenario = tick % 18;

  let phase = -1; 
  if (tickWithinScenario >= 1 && tickWithinScenario < 6) phase = 0; 
  else if (tickWithinScenario >= 6 && tickWithinScenario < 11) phase = 1; 
  else if (tickWithinScenario >= 11 && tickWithinScenario < 17) phase = 2; 

  const scenario = SCENARIOS[scenarioIdx];
  
  let currentText = "";
  if (phase === 0) currentText = scenario.step1;
  else if (phase === 1) currentText = scenario.step2;
  else if (phase === 2) currentText = scenario.step3;

  const currentScenarioColor = OUTCOME_COLORS[scenario.color as keyof typeof OUTCOME_COLORS];

  return (
    <div ref={containerRef} className="relative w-full max-w-[900px] min-h-[600px] md:min-h-[680px] flex flex-col justify-between rounded-3xl border border-white/10 bg-[#06070a]/90 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden">
      
      {/* Top Metrics Rail */}
      <div className="flex flex-wrap items-center justify-between px-6 md:px-8 py-4 border-b border-white/[0.06] bg-white/[0.02] relative z-20">
        <div className="flex items-center gap-6 md:gap-10">
          {METRICS.map(m => (
            <div key={m.label} className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-zinc-500">{m.label}</span>
              <span className={`text-xs md:text-sm font-black tracking-wide ${m.color} mt-0.5`}>{m.value}</span>
            </div>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-400 tracking-widest uppercase">Operational</span>
        </div>
      </div>

      {/* --- ADVANCED BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Animated Aurora */}
        <motion.div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px]"
          animate={{ x: [-40, 40, -40], y: [-20, 30, -20] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]"
          animate={{ x: [50, -30, 50], y: [40, -20, 40] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
        
        {/* Tech Grid */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* SVG Connections Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
           <filter id="svgGlow">
             <feGaussianBlur stdDeviation="3" result="b"/>
             <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
           </filter>
        </defs>
        {appPaths.map(p => {
           const isActive = scenario.appId === p.id && phase >= 0;
           return (
             <g key={p.id}>
               <path d={p.d} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
               {isActive && (
                 <>
                   <motion.path d={p.d} fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="2" filter="url(#svgGlow)"
                     initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
                   <motion.circle r="3" fill="#fff" filter="url(#svgGlow)"
                     style={{ offsetPath: `path('${p.d}')` } as any}
                     animate={{ offsetDistance: ["0%", "100%"] } as any}
                     transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
                 </>
               )}
             </g>
           );
        })}
        {outPaths.map(p => {
           const isActive = scenario.outcomeIds.includes(p.id) && phase >= 2;
           return (
             <g key={p.id}>
               <path d={p.d} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
               {isActive && (
                 <>
                   <motion.path d={p.d} fill="none" stroke={currentScenarioColor.text} strokeWidth="2" filter="url(#svgGlow)"
                     initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
                   <motion.circle r="3" fill="#fff" filter="url(#svgGlow)"
                     style={{ offsetPath: `path('${p.d}')` } as any}
                     animate={{ offsetDistance: ["0%", "100%"] } as any}
                     transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
                 </>
               )}
             </g>
           );
        })}
      </svg>

      {/* 3-Column Ecosystem */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 relative z-20 w-full px-6 md:px-12 py-8">
        
        {/* LEFT: Floating Apps */}
        <div className="w-full md:w-[200px] flex flex-row flex-wrap justify-center md:flex-col md:justify-center gap-3 shrink-0">
          {APPS.map(app => {
            const isActive = scenario.appId === app.id && phase >= 0;
            const isFaded = phase >= 0 && !isActive;

            return (
              <div key={app.id} ref={el => { appRefs.current[app.id] = el; }}
                   className={`flex items-center gap-3 px-3 py-2 md:px-4 md:py-2.5 rounded-full transition-all duration-700 ${
                     isActive ? 'bg-white/10 border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-105 backdrop-blur-xl' 
                     : isFaded ? 'opacity-30 border border-transparent' 
                     : 'bg-white/[0.02] border border-white/[0.04] backdrop-blur-md'
                   }`}>
                <app.Icon className={`w-4 h-4 md:w-5 md:h-5 transition-colors duration-700 ${isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-zinc-500'}`} strokeWidth={isActive ? 2 : 1.5} />
                <span className={`text-[10px] md:text-xs font-semibold tracking-wide transition-colors duration-700 ${isActive ? 'text-white' : 'text-zinc-400'}`}>{app.label}</span>
              </div>
            );
          })}
        </div>

        {/* CENTER: Intelligence Core */}
        <div className="flex-1 flex items-center justify-center relative my-4 md:my-0 h-[140px] md:h-auto" ref={coreRef}>
          
          {/* Advanced Technical Rings */}
          <motion.svg className="absolute w-[180px] h-[180px] md:w-[260px] md:h-[260px] pointer-events-none opacity-30" viewBox="0 0 100 100"
            animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}>
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(52,211,153,0.6)" strokeWidth="0.4" strokeDasharray="2 4" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(52,211,153,0.3)" strokeWidth="0.2" strokeDasharray="10 5" />
          </motion.svg>

          {/* Sonar Ripples */}
          <motion.div className="absolute rounded-full border border-emerald-500/15 pointer-events-none"
            initial={{ width: '80px', height: '80px', opacity: 0.8 }} animate={{ width: '500px', height: '500px', opacity: 0 }} transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }} />

          {/* Breathing Organic Glow */}
          <div className={`absolute rounded-full transition-all duration-[1500ms] ease-out pointer-events-none`}
               style={{ width: phase >= 1 ? '300px' : '150px', height: phase >= 1 ? '300px' : '150px', opacity: phase >= 1 ? 0.7 : 0.1, background: `radial-gradient(circle, ${phase >= 1 ? currentScenarioColor.glow : 'rgba(52,211,153,0.1)'} 0%, transparent 65%)`, filter: 'blur(30px)' }} />

          {/* Frosted Glass Orb */}
          <div className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-[1000ms] ease-out shadow-[0_0_80px_rgba(0,0,0,0.6)]`}
               style={{ background: phase >= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)', border: phase >= 1 ? `1px solid ${currentScenarioColor.glow.replace('0.4', '0.6')}` : '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', transform: phase >= 1 ? 'scale(1.1)' : 'scale(1)' }}>
            <ShieldCheck className={`w-8 h-8 md:w-12 md:h-12 transition-colors duration-[1000ms] drop-shadow-lg ${phase >= 1 ? 'text-white' : 'text-zinc-500'}`} strokeWidth={1} />
            <div className="absolute -bottom-8 whitespace-nowrap text-center opacity-90 pointer-events-none">
              <span className={`block text-[9px] font-bold tracking-[0.3em] uppercase transition-colors duration-1000 ${phase >= 1 ? 'text-white' : 'text-zinc-500'}`}>StreetMP</span>
              <span className={`block text-[9px] font-bold tracking-[0.3em] uppercase transition-colors duration-1000 ${phase >= 1 ? currentScenarioColor.text : 'text-zinc-600'} mt-1`}>Intelligence</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Floating Outcomes */}
        <div className="w-full md:w-[200px] flex flex-row flex-wrap justify-center md:flex-col md:items-end gap-3 shrink-0">
          {OUTCOMES.map(out => {
            const isActive = scenario.outcomeIds.includes(out.id) && phase >= 2;
            const isFaded = phase >= 2 && !isActive;
            const outColor = OUTCOME_COLORS[out.color as keyof typeof OUTCOME_COLORS];

            return (
              <div key={out.id} ref={el => { outRefs.current[out.id] = el; }}
                   className={`flex items-center gap-3 px-3 py-2 md:px-4 md:py-2.5 rounded-full transition-all duration-700 ${
                     isActive ? `${outColor.bg} ${outColor.border} border shadow-[0_0_20px_rgba(0,0,0,0.4)] scale-105 backdrop-blur-xl` 
                     : isFaded ? 'opacity-30 border border-transparent' 
                     : 'bg-white/[0.01] border border-white/[0.03] backdrop-blur-sm'
                   }`}>
                <out.Icon className={`w-4 h-4 md:w-5 md:h-5 transition-colors duration-700 ${isActive ? outColor.text : 'text-zinc-600'}`} strokeWidth={isActive ? 2 : 1.5} />
                <span className={`text-[10px] md:text-xs font-semibold tracking-wide transition-colors duration-700 whitespace-nowrap ${isActive ? outColor.text : 'text-zinc-500'}`}>{out.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM: Event Console Box */}
      <div className="mx-4 md:mx-8 mb-6 md:mb-8 h-24 md:h-28 rounded-2xl border border-white/[0.08] bg-[#0A0B10]/80 backdrop-blur-3xl flex flex-col justify-center px-4 md:px-6 relative overflow-hidden z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        {/* Colored ambient glow behind text inside the box */}
        <div className={`absolute inset-0 opacity-10 transition-colors duration-[1500ms] ${phase >= 1 ? currentScenarioColor.bg : 'bg-transparent'}`} />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center border shadow-lg transition-all duration-1000 ${
            phase >= 1 ? `${currentScenarioColor.bg} ${currentScenarioColor.border}` : 'bg-white/[0.02] border-white/5'
          }`}>
             <ShieldCheck className={`w-6 h-6 md:w-7 md:h-7 transition-colors duration-1000 ${phase >= 1 ? currentScenarioColor.text : 'text-zinc-600'}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1">
               {phase === 0 ? "Detecting Request..." : phase === 1 ? "Intercepted & Processing" : "Action Taken"}
            </span>
            <div className="h-6 md:h-8 flex items-center">
              <AnimatePresence mode="wait">
                {phase >= 0 && (
                  <motion.div key={`${scenarioIdx}-${phase}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.3 }}>
                    <h3 className={`text-sm md:text-lg font-semibold tracking-wide ${phase === 2 ? currentScenarioColor.text : 'text-white'}`}>
                      {currentText}
                    </h3>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
