"use client";
import { useSimulationStore } from "@/store/simulationStore";
import { motion } from "framer-motion";
import { Users, TrendingUp, DollarSign, ShieldCheck } from "lucide-react";

export default function WorkforceROI() {
    const { roi, setRoi } = useSimulationStore();

    // Logic: 
    // Cost of Turnover = Staff * TurnoverRate * AvgSalary($60k) * CostMultiplier(0.5)
    // Savings with Dr. Roy's Engine = Cost of Turnover * 0.4 (40% reduction)
    const avgSalary = 60000;
    const turnoverCost = roi.staffCount * (roi.turnoverRate / 100) * avgSalary * 0.5;
    const potentialSavings = turnoverCost * 0.40;

    return (
        <div className="p-6 h-full flex flex-col relative bg-gradient-to-br from-emerald-900/20 to-black/40">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck size={100} />
            </div>

            <div className="relative z-10">
                <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <Users className="text-emerald-400" size={20} />
                    Workforce ROI
                </h3>
                <p className="text-xs text-emerald-200/70 mb-6 uppercase tracking-wider">The Transactional Engine™</p>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-gray-400 uppercase tracking-widest">Organization Size</label>
                            <span className="text-sm font-bold text-white">{roi.staffCount} Staff</span>
                        </div>
                        <input
                            type="range" min="10" max="1000" step="10"
                            value={roi.staffCount}
                            onChange={(e) => setRoi({ staffCount: parseInt(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-gray-400 uppercase tracking-widest">Current Turnover</label>
                            <span className="text-sm font-bold text-red-400">{roi.turnoverRate}%</span>
                        </div>
                        <input
                            type="range" min="0" max="100" step="1"
                            value={roi.turnoverRate}
                            onChange={(e) => setRoi({ turnoverRate: parseInt(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                        <div className="text-[10px] text-red-300 uppercase">Annual Loss</div>
                        <div className="text-lg font-bold text-white">-${(turnoverCost / 1000).toFixed(1)}k</div>
                    </div>
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                        <div className="text-[10px] text-emerald-300 uppercase">Engine Savings</div>
                        <div className="text-xl font-bold text-emerald-400">+${(potentialSavings / 1000).toFixed(1)}k</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
