"use client";
import { motion } from "framer-motion";
import { Atom, Dna } from "lucide-react";

export default function Lab() {
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-black">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
                className="relative z-10 text-center p-8 max-w-2xl"
            >
                <div className="flex justify-center mb-8 gap-6">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="p-4 bg-white/5 rounded-full border border-white/10 backdrop-blur-xl"
                    >
                        <Atom size={48} className="text-cyan-400" />
                    </motion.div>
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="p-4 bg-white/5 rounded-full border border-white/10 backdrop-blur-xl"
                    >
                        <Dna size={48} className="text-purple-400" />
                    </motion.div>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-white/50 mb-6 tracking-tight">
                    Dr. Roy Lab
                </h1>

                <p className="text-xl md:text-2xl text-blue-200/80 mb-8 font-light">
                    The Future for Next Generation People and Investors
                </p>

                <div className="inline-block px-6 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-mono text-cyan-400 tracking-widest uppercase">
                    Coming Soon
                </div>

                {/* Grid of future concepts */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 opacity-50">
                    <div className="h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse"></div>
                    <div className="h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse delay-75"></div>
                    <div className="h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse delay-150"></div>
                    <div className="h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse delay-300"></div>
                </div>
            </motion.div>
        </div>
    );
}
