"use client";
import { useSimulationStore } from "@/store/simulationStore";
import { motion } from "framer-motion";
import { Lightbulb, Rocket, Target } from "lucide-react";

export default function InnovationScore() {
    const { innovation, setInnovation } = useSimulationStore();

    const score = innovation.marketSize * innovation.feasibility; // Max 100
    const isViable = score > 60;

    return (
        <div className="p-6 h-full flex flex-col relative bg-gradient-to-br from-purple-900/20 to-black/40">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Rocket size={100} />
            </div>

            <div className="relative z-10">
                <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <Lightbulb className="text-purple-400" size={20} />
                    Innovation Assessment
                </h3>
                <p className="text-xs text-purple-200/70 mb-6 uppercase tracking-wider">Newcastle Principles™</p>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-gray-400 uppercase tracking-widest">Market Size (TAM)</label>
                            <span className="text-sm font-bold text-white">{innovation.marketSize}/10</span>
                        </div>
                        <div className="flex gap-1 h-2">
                            {[...Array(10)].map((_, i) => (
                                <div
                                    key={i}
                                    onClick={() => setInnovation({ marketSize: i + 1 })}
                                    className={`flex-1 rounded-sm cursor-pointer transition-colors ${i < innovation.marketSize ? 'bg-purple-500' : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-gray-400 uppercase tracking-widest">Feasibility</label>
                            <span className="text-sm font-bold text-white">{innovation.feasibility}/10</span>
                        </div>
                        <div className="flex gap-1 h-2">
                            {[...Array(10)].map((_, i) => (
                                <div
                                    key={i}
                                    onClick={() => setInnovation({ feasibility: i + 1 })}
                                    className={`flex-1 rounded-sm cursor-pointer transition-colors ${i < innovation.feasibility ? 'bg-pink-500' : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 px-2">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-4xl font-bold text-white mb-1">{score}</div>
                        <div className="text-[10px] text-gray-400">COMMERCIAL VIABILITY SCORE</div>
                    </div>
                    <div className={`px-4 py-2 rounded-lg border ${isViable ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-orange-500/20 border-orange-500/50 text-orange-400'}`}>
                        <div className="text-xs font-bold uppercase flex items-center gap-2">
                            <Target size={14} />
                            {isViable ? "Market Ready" : "Incubate"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
