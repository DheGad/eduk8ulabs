"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Flame } from "lucide-react";

export const MarketDemandHeat = () => {
    const skills = [
        { name: "AI Strategy", heat: 95 },
        { name: "Change Mgmt", heat: 88 },
        { name: "Data Ops", heat: 72 },
        { name: "Legacy Sys", heat: 40 },
    ];

    return (
        <GlassCard className="h-full min-h-[160px] space-y-4">
            <div className="flex justify-between items-start">
                <h3 className="text-sm text-gray-400 font-mono uppercase tracking-wider">Market Demand Heat</h3>
                <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Flame size={20} className="text-orange-400" />
                </div>
            </div>

            <div className="space-y-3">
                {skills.map((skill) => (
                    <div key={skill.name} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{skill.name}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${skill.heat > 90 ? "bg-red-500" :
                                            skill.heat > 70 ? "bg-orange-400" : "bg-blue-400"
                                        }`}
                                    style={{ width: `${skill.heat}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
};
