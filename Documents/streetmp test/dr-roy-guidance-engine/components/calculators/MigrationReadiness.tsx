"use client";
import { useSimulationStore } from "@/store/simulationStore";
import { motion } from "framer-motion";
import { GraduationCap, Map } from "lucide-react";

export default function MigrationReadiness() {
    const { migration, setMigration } = useSimulationStore();

    // Logic: IF (IELTS < 6.0) return "Risk". IF (IELTS >= 6 + Level >= 4) return "Success Likely."
    const isRisk = migration.ieltsScore < 6.0;
    const isSuccess = !isRisk && migration.educationLevel >= 4;

    const status = isRisk ? "High Visa Risk" : isSuccess ? "Success Likely (Subclass 485/186)" : "Moderate (Study Pathway Required)";
    const statusColor = isRisk ? "text-red-400" : isSuccess ? "text-green-400" : "text-yellow-400";

    // Gauge calculation
    const gaugeValue = isRisk ? 30 : isSuccess ? 90 : 60;

    return (
        <div className="p-6 h-full flex flex-col relative overflow-hidden">
            {/* Background Map Graphic (Simplified) */}
            <div className="absolute -right-4 -top-4 text-white/5 opacity-10">
                <Map size={160} />
            </div>

            <div className="relative z-10 font-sans">
                <div className="flex items-center gap-2 mb-1">
                    <GraduationCap className="text-blue-400" size={24} />
                    <h3 className="text-xl font-bold text-white">Migration Readiness</h3>
                </div>
                <p className="text-xs text-gray-400 mb-6 uppercase tracking-wider pl-8">Visa Eligibility Engine</p>

                <div className="space-y-6 pl-2">
                    {/* IELTS Slider */}
                    <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                        <div className="flex justify-between mb-2 items-end">
                            <label className="text-xs text-blue-200 uppercase tracking-widest font-semibold">IELTS Score</label>
                            <span className={`text-xl font-mono font-bold ${migration.ieltsScore >= 6 ? 'text-green-400' : 'text-red-400'}`}>
                                {migration.ieltsScore.toFixed(1)}
                            </span>
                        </div>
                        <input
                            type="range" min="0" max="9" step="0.5"
                            value={migration.ieltsScore}
                            onChange={(e) => setMigration({ ieltsScore: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Education Level Slider */}
                    <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                        <div className="flex justify-between mb-2 items-end">
                            <label className="text-xs text-blue-200 uppercase tracking-widest font-semibold">Education Level</label>
                            <span className="text-sm font-mono text-blue-400">Lvl {migration.educationLevel}</span>
                        </div>
                        <input
                            type="range" min="1" max="5" step="1"
                            value={migration.educationLevel}
                            onChange={(e) => setMigration({ educationLevel: parseInt(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-gray-500 mt-2 uppercase tracking-wider font-mono">
                            <span>Cert III</span>
                            <span>Diploma</span>
                            <span>Deg</span>
                            <span>PhD</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Result Panel */}
            <div className="mt-auto px-2 relative z-10 pt-4 border-t border-white/5">
                <div className="flex items-center gap-4">
                    {/* Circular Progress SVG */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                            <path className="text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <motion.path
                                initial={{ strokeDasharray: "0, 100" }}
                                animate={{ strokeDasharray: `${gaugeValue}, 100` }}
                                transition={{ duration: 1 }}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={isRisk ? "#ef4444" : isSuccess ? "#22c55e" : "#eab308"}
                                strokeWidth="3"
                            />
                        </svg>
                        <span className={`absolute text-sm font-bold ${statusColor}`}>{gaugeValue}%</span>
                    </div>

                    <div className="flex-1">
                        <div className={`text-sm font-bold ${statusColor} mb-1`}>{status}</div>
                        <div className="text-[10px] text-gray-400 leading-tight">
                            {isRisk ? "Recommendation: Start with English Upskilling @ EDUK8U" : "Recommendation: Ready for Skilled Migration Assessment"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
