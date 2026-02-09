"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { Users, BarChart2, BookOpen, AlertCircle, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const performanceData = [
    { name: 'Engineering', current: 85, target: 90 },
    { name: 'Design', current: 92, target: 95 },
    { name: 'Product', current: 78, target: 85 },
    { name: 'Marketing', current: 65, target: 80 },
    { name: 'Sales', current: 70, target: 85 },
];

export default function CorporateOSPage() {
    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                        <Users className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Petronas Internal</h1>
                        <p className="text-gray-400 text-sm">Corporate Workforce OS • Pro Plan</p>
                    </div>
                </div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    <div className="text-right">
                        <span className="block text-xs text-gray-500 uppercase">Total Employees</span>
                        <span className="block text-xl font-bold text-white">4,285</span>
                    </div>
                    <div className="h-10 w-px bg-white/10" />
                    <div className="text-right">
                        <span className="block text-xs text-gray-500 uppercase">Skill Gap</span>
                        <span className="block text-xl font-bold text-red-400">-12%</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Skill Gap Analysis */}
                <GlassCard className="h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <BarChart2 className="text-indigo-400" /> Department Skill Analysis
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData}>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                                <Bar dataKey="current" name="Current Proficiency" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="target" name="Target Goal" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* Actionable Insights */}
                <div className="space-y-6">
                    <GlassCard className="border-l-4 border-l-red-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                                    <AlertCircle size={18} className="text-red-500" /> Critical Gap: Marketing AI
                                </h4>
                                <p className="text-gray-400 text-sm mt-1">
                                    Marketing team is 15% below industry standard in GenAI proficiency.
                                </p>
                            </div>
                            <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded font-bold uppercase">High Priority</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <BookOpen size={16} className="text-indigo-400" />
                                Recommended: "AI for CMOS" (4 Weeks)
                            </div>
                            <GlowingButton variant="secondary" className="px-4 py-1 text-xs h-8">
                                Deploy Course +
                            </GlowingButton>
                        </div>
                    </GlassCard>

                    <GlassCard className="border-l-4 border-l-amber-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                                    <TrendingUp size={18} className="text-amber-500" /> Retention Risk: Engineering
                                </h4>
                                <p className="text-gray-400 text-sm mt-1">
                                    High burnout detected in Senior React Developers.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Users size={16} className="text-indigo-400" />
                                Suggested: "Deep Work Retreat" Simulation
                            </div>
                            <GlowingButton variant="secondary" className="px-4 py-1 text-xs h-8">
                                View Solution +
                            </GlowingButton>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
