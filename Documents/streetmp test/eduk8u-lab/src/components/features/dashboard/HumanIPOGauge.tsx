"use client";

import { motion } from "framer-motion";
import { useSimulation } from "@/context/SimulationContext";
import { TrendingUp, DollarSign } from "lucide-react";

export const HumanIPOGauge = () => {
    const { ipoScore, capitalValue } = useSimulation();

    // Calculate stroke dashoffset for the circle
    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (ipoScore / 100) * circumference;

    return (
        <div className="relative flex flex-col items-center justify-center p-10">
            {/* Outer Glow Ring */}
            <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

            <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="160"
                        cy="160"
                        r={radius}
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="20"
                        fill="transparent"
                    />
                    {/* Animated Progress Circle */}
                    <motion.circle
                        cx="160"
                        cy="160"
                        r={radius}
                        stroke="url(#gradient)"
                        strokeWidth="20"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 2, ease: "easeOut" }}
                    />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#00ff9d" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-col items-center"
                    >
                        <div className="text-sm font-mono text-gray-400 mb-2 uppercase tracking-widest">
                            IPO Score
                        </div>
                        <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                            {ipoScore.toFixed(1)}
                        </div>

                        {/* Capital Value Ticker */}
                        <div className="mt-4 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                            <div className="bg-green-500/20 p-1 rounded-full">
                                <DollarSign size={14} className="text-green-400" />
                            </div>
                            <span className="text-xl font-bold text-green-400 font-mono">
                                ${capitalValue}M
                            </span>
                            <TrendingUp size={16} className="text-green-400" />
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};
