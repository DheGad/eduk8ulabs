"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { TrendingUp, ArrowUpRight } from "lucide-react";

export const CareerMomentum = () => {
    return (
        <GlassCard className="flex flex-col justify-between h-full min-h-[160px]">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm text-gray-400 font-mono uppercase tracking-wider">Career Momentum</h3>
                    <div className="text-3xl font-bold text-white mt-1 flex items-end gap-2">
                        <span>84.2</span>
                        <span className="text-sm text-emerald-400 font-mono mb-1 flex items-center">
                            <ArrowUpRight size={14} /> +2.4%
                        </span>
                    </div>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <TrendingUp size={20} className="text-emerald-400" />
                </div>
            </div>

            <div className="relative h-16 w-full mt-4">
                {/* Simple Sparkline SVG */}
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <motion.path
                        d="M0 35 Q 20 30, 40 20 T 100 5"
                        fill="none"
                        stroke="url(#momentumGradient)"
                        strokeWidth="3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                    />
                    <defs>
                        <linearGradient id="momentumGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
                            <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        </GlassCard>
    );
};
