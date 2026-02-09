"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, X, CheckCircle } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

export function SliderSection() {
    const { profile, updateSlider, ipoScore } = useSimulation();
    const [isOpen, setIsOpen] = useState(false);

    const sliders = [
        { key: "experience", label: "Experience (Years)", min: 0, max: 40, step: 1, unit: "yrs" },
        { key: "educationLevel", label: "Education Level (NQF)", min: 1, max: 10, step: 1, unit: "NQF" },
        { key: "migrationIntent", label: "Migration Intent", min: 0, max: 100, step: 5, unit: "%" },
        { key: "riskTolerance", label: "Risk Tolerance", min: 1, max: 10, step: 1, unit: "/10" },
        { key: "targetIncome", label: "Target Income", min: 30000, max: 500000, step: 5000, unit: "USD" },
        { key: "timeHorizon", label: "Time Travel (2026-2035)", min: 1, max: 10, step: 1, unit: "yrs" },
        { key: "geographicFlexibility", label: "Geographic Flexibility", min: 0, max: 100, step: 10, unit: "%" },
        { key: "industryMobility", label: "Industry Mobility", min: 0, max: 100, step: 10, unit: "%" },
        { key: "lifestyleBalance", label: "Lifestyle Balance vs Income", min: 0, max: 100, step: 10, unit: "%" },
        { key: "globalNomad", label: "Global Nomad", min: 0, max: 100, step: 10, unit: "%" },
    ];

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for mobile/desktop to close on click outside */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />

                        <motion.div
                            initial={{ opacity: 0, x: "100%" }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-black/95 backdrop-blur-xl border-l border-white/10 z-[100] p-6 overflow-y-auto shadow-2xl custom-scrollbar flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-black/90 py-4 z-10 border-b border-white/5 shrink-0">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                    <Sliders className="text-accent-glow" /> Slider Engine
                                </h2>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-8 pb-12 flex-1">
                                {sliders.map((slider) => (
                                    <div key={slider.key} className="space-y-3 group">
                                        <div className="flex justify-between items-end">
                                            <label className="text-sm text-gray-400 font-medium group-hover:text-white transition-colors">
                                                {slider.label}
                                            </label>
                                            <span className="text-accent-glow font-mono text-xs bg-accent-glow/10 px-2 py-1 rounded">
                                                {slider.key === 'targetIncome' ? '$' : ''}
                                                {profile.sliders[slider.key as keyof typeof profile.sliders]?.toLocaleString()}
                                                {slider.unit}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={slider.min}
                                            max={slider.max}
                                            step={slider.step}
                                            value={profile.sliders[slider.key as keyof typeof profile.sliders] || 0}
                                            onChange={(e) => updateSlider(slider.key as keyof typeof profile.sliders, Number(e.target.value))}
                                            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-accent-glow hover:accent-indigo-400 transition-all touch-none"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="sticky bottom-0 p-4 bg-gray-900/90 backdrop-blur border-t border-white/10 -mx-6 mb-0 mt-auto shrink-0 space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-400 uppercase tracking-widest">Projected IPO Score</span>
                                    <span className="text-3xl font-black text-white">{ipoScore}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono text-center">
                                    LIVE SIMULATION ACTIVE • {new Date().getFullYear() + (profile.sliders.timeHorizon || 0)} PROJECTION
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 sm:hidden"
                                >
                                    <CheckCircle size={18} /> Apply & Close
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Float Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-30 bg-accent-glow hover:bg-white text-black font-bold py-3 px-6 rounded-full shadow-[0_0_30px_rgba(56,189,248,0.3)] flex items-center gap-2 border border-white/20 transition-colors"
            >
                <Sliders size={20} />
                <span className="hidden md:inline font-mono uppercase tracking-tight text-sm">Adjust Simulation</span>
            </motion.button>
        </>
    );
}
