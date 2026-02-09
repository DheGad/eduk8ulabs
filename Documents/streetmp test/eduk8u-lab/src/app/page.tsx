"use client";

import { useState, useEffect, ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Key, Lock, Globe, Cpu, Rocket, ShieldCheck, Database, Check, TrendingUp, Zap, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";

export default function LandingPage() {
  const { setApiKey, isSystemOnline } = useSimulation();
  const [keyInput, setKeyInput] = useState("");
  const [isWarping, setIsWarping] = useState(false);
  const [googleStep, setGoogleStep] = useState(0); // 0: Initial, 1: Loading, 2: Account Created (Show BYOK)
  const [activeMobileTab, setActiveMobileTab] = useState<'features' | 'how-it-works'>('features');
  const router = useRouter();

  useEffect(() => {
    if (isSystemOnline) {
      router.push("/dashboard");
    }
  }, [isSystemOnline, router]);

  const handleInitialize = () => {
    if (keyInput.length < 5) return; // Basic check

    // Set key in global context (persists to localStorage)
    setApiKey(keyInput);

    setIsWarping(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  const handleGoogleSignIn = () => {
    setGoogleStep(1);
    setTimeout(() => {
      setGoogleStep(2);
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative bg-background text-white selection:bg-accent-glow selection:text-black overflow-x-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-background z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-nebula-500/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-glow/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]" />

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <AnimatePresence>
        {!isWarping ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 3, filter: "blur(20px)" }}
            transition={{ duration: 0.8 }}
            className="z-10 flex flex-col items-center gap-10 max-w-6xl w-full px-6 py-12"
          >
            {/* Live Ticker */}
            <div className="absolute top-0 left-0 w-full overflow-hidden bg-black/40 border-b border-white/5 backdrop-blur-sm py-2 z-20">
              <div className="flex animate-marquee whitespace-nowrap gap-12 text-[10px] md:text-xs font-mono text-gray-400 uppercase tracking-widest">
                <span className="flex items-center gap-2"><span className="text-green-500">●</span> System: Online</span>
                <span className="flex items-center gap-2"><Zap size={10} className="text-amber-400" /> Intelligence: Active</span>
                <span className="flex items-center gap-2"><TrendingUp size={10} className="text-emerald-400" /> Market: Bullish</span>
                <span className="flex items-center gap-2"><Globe size={10} className="text-blue-400" /> Global Nodes: 12,402</span>
                <span className="flex items-center gap-2 text-accent-glow">POWERED BY EDUK8U GROUP</span>
                {/* Repeat for marquee effect */}
                <span className="flex items-center gap-2"><span className="text-green-500">●</span> System: Online</span>
                <span className="flex items-center gap-2"><Zap size={10} className="text-amber-400" /> Intelligence: Active</span>
                <span className="flex items-center gap-2"><TrendingUp size={10} className="text-emerald-400" /> Market: Bullish</span>
                <span className="flex items-center gap-2"><Globe size={10} className="text-blue-400" /> Global Nodes: 12,402</span>
              </div>
            </div>

            {/* Header Section */}
            <div className="text-center space-y-4 relative mt-16 md:mt-24">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4 hover:bg-white/10 transition-colors cursor-default"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono tracking-widest text-emerald-400">ENGINE V2.0 LIVE</span>
              </motion.div>

              <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                EDUK8U LAB
              </h1>
              <p className="text-lg md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed px-4">
                The <span className="text-white font-medium">Operating System</span> for Human Capital.
                <br />
                <span className="text-accent-glow bg-accent-glow/5 px-3 py-1 rounded-full text-xs md:text-sm mt-4 inline-block border border-accent-glow/20">
                  Algorithmic Career Mapping™
                </span>
              </p>
            </div>

            {/* Main Action Card */}
            <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden group mx-4">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

              {/* Google Login Simulation */}
              {googleStep === 0 && (
                <button
                  className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.2)] relative z-10"
                  onClick={handleGoogleSignIn}
                >
                  <Globe size={20} className="text-blue-600" />
                  <span>Connect Identity</span>
                </button>
              )}

              {googleStep === 1 && (
                <div className="w-full py-3.5 bg-gray-200 rounded-xl flex items-center justify-center gap-3 animate-pulse relative z-10">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-800 font-medium">Verifying Credentials...</span>
                </div>
              )}

              {googleStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-3 relative z-10"
                >
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check size={14} className="text-green-500" />
                  </div>
                  <div className="text-sm">
                    <p className="text-white font-bold">Identity Secured</p>
                    <p className="text-xs text-gray-400">Initialize engine with your API Key.</p>
                  </div>
                </motion.div>
              )}

              {(googleStep === 0 || googleStep === 2) && (
                <>
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                      {googleStep === 0 ? "Or Manual Access" : "System Access"}
                    </span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-2 relative z-10">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                      <div className="relative bg-black/60 border border-white/10 rounded-xl flex items-center overflow-hidden focus-within:border-accent-glow/50 transition-colors">
                        <div className="pl-4 text-gray-500">
                          <Key size={18} />
                        </div>
                        <input
                          type="password"
                          placeholder="Gemini / ChatGPT / Claude Key"
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 py-3.5 px-4 font-mono text-sm"
                          autoFocus={googleStep === 2}
                        />
                        <div className="pr-2">
                          <button
                            onClick={handleInitialize}
                            disabled={keyInput.length < 5}
                            className={`p-2 rounded-lg transition-all ${keyInput.length >= 5 ? 'bg-accent-glow text-black hover:scale-105 shadow-[0_0_15px_rgba(56,189,248,0.5)]' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                          >
                            <ArrowRight size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 text-center flex flex-col items-center justify-center gap-1 pt-2 font-mono leading-tight">
                      <span className="flex items-center gap-1"><Lock size={10} /> END-TO-END ENCRYPTED</span>
                      <span className="opacity-70">Bring your own keys (BYOK) for maximum privacy.</span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Tabs for Info */}
            <div className="w-full max-w-5xl mt-8">
              {/* Desktop View */}
              <div className="hidden md:grid grid-cols-3 gap-6">
                <InfoCard
                  icon={Database}
                  color="text-indigo-400"
                  title="Private Vault"
                  desc="Your career data lives in your browser. BYOK architecture ensures total privacy."
                />
                <InfoCard
                  icon={Rocket}
                  color="text-purple-400"
                  title="Deterministic"
                  desc="Zero hallucinations. Our IPO Engine uses pure math to calculate capital value."
                />
                <InfoCard
                  icon={ShieldCheck}
                  color="text-emerald-400"
                  title="Verified Proof"
                  desc="Upload evidence to your Portfolio Locker. Verified assets increase valuation."
                />
              </div>

              {/* Mobile Tab View */}
              <div className="md:hidden">
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 hide-scrollbar">
                  <button
                    onClick={() => setActiveMobileTab('features')}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeMobileTab === 'features' ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}
                  >
                    Key Features
                  </button>
                  <button
                    onClick={() => setActiveMobileTab('how-it-works')}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeMobileTab === 'how-it-works' ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}
                  >
                    How It Works
                  </button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  {activeMobileTab === 'features' ? (
                    <div className="space-y-6">
                      <InfoRow icon={Database} title="Private Vault" desc="Local storage only. No data leaves your device." color="text-indigo-400" />
                      <InfoRow icon={Rocket} title="Deterministic" desc="Math-based scoring. No AI guesses." color="text-purple-400" />
                      <InfoRow icon={ShieldCheck} title="Verified Proof" desc="Evidence-based valuation growth." color="text-emerald-400" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <InfoRow icon={Layers} title="1. Input Data" desc="Upload resume & verify skills." color="text-blue-400" />
                      <InfoRow icon={Cpu} title="2. Run Engine" desc="Calculate Human IPO Value." color="text-purple-400" />
                      <InfoRow icon={TrendingUp} title="3. Simulate" desc="Project future value with sliders." color="text-amber-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop How It Works (Hidden on Mobile as it's in tabs) */}
            <div className="hidden md:block max-w-6xl mx-auto w-full pt-20 pb-20 border-t border-white/5 mt-10">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-500">
                  Open Source Platform
                </h2>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-accent-glow animate-pulse" />
                  <span className="text-xs font-mono text-gray-400">POWERED BY EDUK8U GROUP</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-8">
                <HowItWorksStep icon={Layers} title="1. Input Data" desc="Upload your resume, verify your skills, and adjust your privacy settings locally." color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" />
                <HowItWorksStep icon={Cpu} title="2. Run Engine" desc='Our deterministic algorithms calculate your "Human IPO" value without AI hallucinations.' color="text-purple-400" bg="bg-purple-500/10" border="border-purple-500/20" />
                <HowItWorksStep icon={TrendingUp} title="3. Simulate" desc="Use the Slider Engine to project future value based on migration, education, and career shifts." color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" />
                <HowItWorksStep icon={ShieldCheck} title="4. Verify & Earn" desc="Join the community, verified by your IPO score, to unlock bounties and mentorship." color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" />
              </div>
            </div>

            {/* Footer */}
            <div className="w-full text-center pb-8 text-[10px] text-gray-600 font-mono">
              © 2026 EDUK8U GROUP • SYSTEM V2.0.4 • SINGAPORE
            </div>

          </motion.div>
        ) : (
          <motion.div
            className="z-10 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-40 h-40 relative">
              <div className="absolute inset-0 rounded-full border-4 border-t-accent-glow border-r-transparent border-b-accent-glow border-l-transparent animate-spin" />
              <div className="absolute inset-4 rounded-full border-4 border-t-purple-500 border-r-transparent border-b-purple-500 border-l-transparent animate-spin-slow" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu size={40} className="text-white animate-pulse" />
              </div>
            </div>

            <h2 className="mt-8 text-3xl font-bold tracking-[0.2em] text-white animate-pulse">
              INITIALIZING
            </h2>
            <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent-glow/10 rounded-full border border-accent-glow/20">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-accent-glow font-mono text-sm tracking-widest">SYSTEM ONLINE</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper Components
interface HelperProps {
  icon: ElementType;
  color: string;
  title: string;
  desc: string;
  bg?: string;
  border?: string;
}

function InfoCard({ icon: Icon, color, title, desc }: HelperProps) {
  return (
    <div className="p-6 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
      <Icon className={`${color} mb-3 group-hover:scale-110 transition-transform`} size={24} />
      <h3 className="font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, color, title, desc }: HelperProps) {
  return (
    <div className="flex items-start gap-4">
      <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function HowItWorksStep({ icon: Icon, title, desc, color, bg, border }: HelperProps) {
  return (
    <div className="space-y-4">
      <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center border ${border}`}>
        <Icon className={color} />
      </div>
      <h3 className="font-bold text-lg text-white">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}
