"use client";

import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { ArrowRight } from "lucide-react";

export default function Hero() {
    const { setCurrentView } = useUIStore();

    return (
        <div className="relative h-screen w-full flex items-center justify-center overflow-hidden">
            <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                {/* Left: Portrait (Placeholder for now, will replace with Dr. Roy's image) */}
                {/* Left: Cinematic Portrait with Credential Network */}
                <motion.div
                    initial={{ opacity: 0, x: -50, filter: "blur(10px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="relative h-[600px] w-full flex items-center justify-center group"
                >
                    <div className="relative w-[450px] h-[550px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]">
                        <img
                            src="/assets/dr_roy_real.jpg"
                            alt="Dr. Roy Prasad"
                            className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity duration-700"
                        />

                        {/* Glass Overlay/Reflection */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 via-transparent to-white/10 opacity-60" />

                        {/* Credential Network Graph Overlay */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            {/* Nodes */}
                            {[
                                { top: '15%', right: '10%', label: 'IBAS (DBA)' },
                                { top: '50%', left: '5%', label: 'Patent NZ 560974' },
                                { bottom: '20%', right: '15%', label: 'Attend Care' },
                                { bottom: '10%', left: '20%', label: 'EDUK8U' }
                            ].map((node, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 2 + (i * 0.2), duration: 0.5 }}
                                    className="absolute flex items-center gap-2"
                                    style={{ ...node }}
                                >
                                    <div className="w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                                    <span className="text-[10px] text-blue-200 bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/5">{node.label}</span>
                                </motion.div>
                            ))}

                            {/* Connecting Lines (Simplified as SVG) */}
                            <svg className="absolute inset-0 w-full h-full opacity-30">
                                <motion.path
                                    d="M 50 120 L 350 100 L 400 450 L 100 500 L 30 300 Z"
                                    fill="none"
                                    stroke="url(#gradient-line)"
                                    strokeWidth="1"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 2.5, duration: 2, ease: "easeInOut" }}
                                />
                                <defs>
                                    <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
                                        <stop offset="50%" stopColor="#60a5fa" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute -z-10 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse" />
                </motion.div>

                {/* Right: Text & Action */}
                <div className="flex flex-col order-2 lg:order-1 space-y-8 mt-20 relative z-10 text-left">

                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ staggerChildren: 0.1, delayChildren: 0.5 }}
                        className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white/50 leading-tight"
                    >
                        {"Dr. Roy Prasad’s Vision for the 2026 Workforce".split("").map((char, index) => (
                            <motion.span
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.02 }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5, duration: 0.8 }}
                        className="space-y-6"
                    >
                        <div>
                            <p className="text-4xl text-white font-semibold tracking-wide drop-shadow-md mb-2">
                                Roy (Rohitesh) Prasad Dr.
                            </p>
                            <p className="text-xl text-blue-200/80 font-light italic">
                                “A Vision to Transform Education into Execution.”
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3 text-lg text-blue-300 font-medium">
                            <span className="bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">Group MD</span>
                            <span className="bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">CHRO</span>
                            <span className="bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">DBA</span>
                            <span className="bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">Innovator</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 2, duration: 0.5 }}
                    >
                        <button
                            onClick={() => setCurrentView('grid')}
                            className="group relative px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 flex items-center gap-3 overflow-hidden shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-10px_rgba(37,99,235,0.7)]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            <span className="relative flex items-center gap-3">
                                Start Simulation
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                    </motion.div>

                </div>
            </div>
        </div>
    );
}
