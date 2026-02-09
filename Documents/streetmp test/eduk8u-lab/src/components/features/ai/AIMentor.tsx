"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSimulation } from "@/context/SimulationContext";
import { Sparkles, X } from "lucide-react";

export const AIMentor = () => {
    const { profile, ipoScore } = useSimulation();
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkContext = () => {
            // Logic to determine suggestion based on state
            if (profile.resume.completeness < 50) {
                setSuggestion("Your resume is looking thin. Add at least 3 sections to boost your IPO Score.");
                setIsVisible(true);
            } else if (profile.sliders.migrationIntent > 70 && profile.resume.educationLevelNQF < 7) {
                setSuggestion("High migration intent detected. Consider upgrading your education to NQF Level 7 to improve visa probability.");
                setIsVisible(true);
            } else if (ipoScore > 80 && ipoScore < 90) {
                setSuggestion("You are close to 'AAA' status. Verify one more project in the Evidence Locker to cross the threshold.");
                setIsVisible(true);
            }
        };

        // Check every 10 seconds or on mount
        const timer = setTimeout(checkContext, 3000);
        return () => clearTimeout(timer);
    }, [profile, ipoScore]);

    if (!suggestion) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 max-w-sm z-50"
                >
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 p-4 rounded-2xl shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 pointer-events-none" />

                        <div className="flex gap-4">
                            <div className="bg-indigo-500/20 p-2 rounded-full h-fit">
                                <Sparkles size={18} className="text-indigo-400 animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-white mb-1 flex justify-between items-center">
                                    AI Insight
                                </h4>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    {suggestion}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsVisible(false)}
                                className="text-gray-500 hover:text-white transition-colors h-fit"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
