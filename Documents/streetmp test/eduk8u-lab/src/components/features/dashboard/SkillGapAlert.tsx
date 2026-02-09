"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";

export const SkillGapAlert = () => {
    const [gaps, setGaps] = useState([
        { id: 1, name: "Generative AI Prompting", status: 'open', impact: "+$85k" },
        { id: 2, name: "ESG Data Reporting", status: 'open', impact: "+$45k" },
    ]);

    const handleAddressGap = (id: number) => {
        setGaps(prev => prev.map(gap =>
            gap.id === id ? { ...gap, status: 'in_progress' } : gap
        ));

        // Simulate "Enrollment" delay
        setTimeout(() => {
            setGaps(prev => prev.map(gap =>
                gap.id === id ? { ...gap, status: 'closing' } : gap
            ));
        }, 1500);
    };

    return (
        <GlassCard className="h-full min-h-[160px] border-amber-500/20 bg-amber-500/5 relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={14} /> Skill Capital Gaps
                </h3>
            </div>

            <div className="space-y-3">
                {gaps.map((gap) => (
                    <div key={gap.id} className="p-3 bg-black/40 rounded-lg flex items-center justify-between border border-white/5 relative overflow-hidden group">
                        {gap.status === 'closing' && (
                            <motion.div
                                className="absolute inset-0 bg-emerald-500/20 z-0"
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 1.5 }}
                            />
                        )}

                        <div className="relative z-10">
                            <span className="text-sm font-medium text-gray-200 block">{gap.name}</span>
                            <span className="text-[10px] text-amber-500/80">{gap.impact} Valuation Impact</span>
                        </div>

                        <div className="relative z-10">
                            {gap.status === 'open' && (
                                <button
                                    onClick={() => handleAddressGap(gap.id)}
                                    className="text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                                >
                                    Close Gap
                                </button>
                            )}
                            {gap.status === 'in_progress' && (
                                <Loader2 size={16} className="text-amber-500 animate-spin" />
                            )}
                            {gap.status === 'closing' && (
                                <CheckCircle size={16} className="text-emerald-500" />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-amber-500/10 flex justify-between items-center">
                <span className="text-[10px] text-amber-500/60">AI Detected • Market Real-time</span>
                <span className="text-[10px] font-mono text-amber-500">
                    {gaps.every(g => g.status === 'closing') ? 'OPTIMIZED' : 'ACTION REQ.'}
                </span>
            </div>
        </GlassCard>
    );
};
