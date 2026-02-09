"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { HumanIPOGauge } from "@/components/features/dashboard/HumanIPOGauge";
import { ActivityFeed } from "@/components/features/dashboard/ActivityFeed";
import { CareerMomentum } from "@/components/features/dashboard/CareerMomentum";
import { MarketDemandHeat } from "@/components/features/dashboard/MarketDemandHeat";
import { SkillGapAlert } from "@/components/features/dashboard/SkillGapAlert";
import { SliderSection } from "@/components/features/dashboard/SliderSection";
import { TrendingUp, Users, Award, ShieldCheck, Zap } from "lucide-react";

export default function DashboardPage() {
    const { profile, ipoScore, isSystemOnline, updateProfile } = useSimulation();
    const router = useRouter();

    useEffect(() => {
        if (!isSystemOnline) {
            router.push("/");
        }
    }, [isSystemOnline, router]);

    if (!isSystemOnline) return null;

    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-7xl mx-auto space-y-8 relative">
            {/* Header with Profile 2.0 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    {/* Profile Picture Upload */}
                    <div className="relative group">
                        <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center cursor-pointer hover:border-accent-glow transition-colors">
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <Users size={24} className="text-gray-400" />
                            )}
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            updateProfile({ avatarUrl: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-gray-900 rounded-full p-1 border border-white/10">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        </div>
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            {profile.name || "Guest User"}
                            <span className="text-xs bg-accent-glow/20 text-accent-glow px-2 py-0.5 rounded border border-accent-glow/30">
                                {profile.role || "Student"}
                            </span>
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <select
                                value={profile.role}
                                onChange={(e) => updateProfile({ role: e.target.value as any })}
                                className="bg-transparent border-b border-gray-600 focus:border-accent-glow outline-none text-xs py-0.5"
                            >
                                <option value="Student">Student</option>
                                <option value="Teacher">Teacher</option>
                                <option value="Professional">Professional</option>
                            </select>
                            <span>•</span>
                            <span>Level {Math.floor(ipoScore / 10) + 1}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 items-center">
                    <div className="hidden sm:flex bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-mono text-accent-glow items-center gap-2">
                        <Zap size={10} className="fill-current" />
                        SYSTEM ONLINE
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem('eduk8u_api_key');
                            window.location.reload();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-full text-red-500 hover:text-red-400 border border-red-500/20 transition-colors"
                        title="Secure Logout"
                    >
                        <ShieldCheck size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Logout</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Gauge & Metrics - Spans 2 cols on large */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <GlassCard className="flex flex-col items-center justify-center min-h-[400px] md:col-span-2 relative">
                            <h2 className="absolute top-6 left-6 text-lg font-medium text-gray-300 flex items-center gap-2">
                                <TrendingUp size={18} className="text-accent-glow" />
                                Human IPO Valuation
                            </h2>
                            <HumanIPOGauge />
                            <div className="absolute bottom-6 w-full px-12 flex justify-between text-xs font-mono text-gray-500">
                                <span>SECTOR: TECHNOLOGY</span>
                                <span>RISK: {profile.sliders.riskTolerance > 7 ? 'HIGH' : 'LOW'}</span>
                                <span>VOLATILITY: {ipoScore > 50 ? 'STABLE' : 'HIGH'}</span>
                            </div>
                        </GlassCard>
                    </div>

                    {/* New Intelligence Layer Widgets - Role Based */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {profile.role === 'Student' && (
                            <>
                                <GlassCard className="p-4 flex flex-col justify-between h-32">
                                    <div className="text-xs text-gray-500 uppercase font-bold">GPA Projection</div>
                                    <div className="text-3xl font-bold text-white">3.8<span className="text-sm text-gray-500">/4.0</span></div>
                                    <div className="text-xs text-emerald-400">+0.2 vs Avg</div>
                                </GlassCard>
                                <GlassCard className="p-4 flex flex-col justify-between h-32">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Study Hours</div>
                                    <div className="text-3xl font-bold text-white">42<span className="text-sm text-gray-500">hrs</span></div>
                                    <div className="text-xs text-gray-400">Past 7 Days</div>
                                </GlassCard>
                            </>
                        )}
                        {profile.role === 'Teacher' && (
                            <>
                                <GlassCard className="p-4 flex flex-col justify-between h-32">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Students Active</div>
                                    <div className="text-3xl font-bold text-white">124</div>
                                    <div className="text-xs text-emerald-400">+12 this week</div>
                                </GlassCard>
                                <GlassCard className="p-4 flex flex-col justify-between h-32">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Course Rating</div>
                                    <div className="text-3xl font-bold text-white">4.9<span className="text-sm text-gray-500">/5</span></div>
                                    <div className="text-xs text-gray-400">Top 1%</div>
                                </GlassCard>
                            </>
                        )}
                        {/* Common Widgets */}
                        <CareerMomentum />
                        {profile.role === 'Professional' && <MarketDemandHeat />}
                        <SkillGapAlert />
                    </div>

                    {/* Quick Stats Grid (Connected to Real Data) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <GlassCard className="flex flex-col items-center justify-center p-4 gap-2">
                            <Users className="text-blue-400" size={24} />
                            <span className="text-2xl font-bold">{profile.resume.completeness}%</span>
                            <span className="text-xs text-gray-500 uppercase">Profile</span>
                        </GlassCard>
                        <GlassCard className="flex flex-col items-center justify-center p-4 gap-2">
                            <Award className="text-purple-400" size={24} />
                            <span className="text-2xl font-bold">{Object.values(profile.resume.sections).filter(Boolean).length}</span>
                            <span className="text-xs text-gray-500 uppercase">Sections</span>
                        </GlassCard>
                        <GlassCard className="flex flex-col items-center justify-center p-4 gap-2">
                            <ShieldCheck className="text-green-400" size={24} />
                            <span className="text-2xl font-bold">{profile.evidence.verifiedProjects}</span>
                            <span className="text-xs text-gray-500 uppercase">Verified</span>
                        </GlassCard>
                        <GlassCard className="flex flex-col items-center justify-center p-4 gap-2">
                            <TrendingUp className="text-amber-400" size={24} />
                            <span className="text-2xl font-bold">#{ipoScore > 0 ? Math.floor(10000 / ipoScore) : '-'}</span>
                            <span className="text-xs text-gray-500 uppercase">Global Rank</span>
                        </GlassCard>
                    </div>
                </div>

                {/* Right Column: Activity & Notifications */}
                <div className="space-y-6">
                    <GlassCard className="h-full min-h-[500px]">
                        <h3 className="text-lg font-medium text-gray-300 mb-6 flex items-center gap-2">
                            <ShieldCheck size={18} className="text-indigo-400" />
                            Live Activity
                        </h3>
                        <ActivityFeed />

                        <div className="mt-8 pt-6 border-t border-white/5">
                            <h4 className="text-sm font-medium text-gray-400 mb-4">Pending Actions</h4>
                            <div className="space-y-3">
                                {profile.resume.completeness < 100 && (
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-sm flex justify-between items-center group cursor-pointer hover:border-accent-glow/30 transition-colors">
                                        <span>Complete Resume Profile</span>
                                        <span className="text-accent-glow text-xs group-hover:underline">Start &rarr;</span>
                                    </div>
                                )}
                                <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-sm flex justify-between items-center group cursor-pointer hover:border-accent-glow/30 transition-colors">
                                    <span>Verify Education (NQF)</span>
                                    <span className="text-accent-glow text-xs group-hover:underline">Verify &rarr;</span>
                                </div>
                                <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-sm flex justify-between items-center group cursor-pointer hover:border-accent-glow/30 transition-colors">
                                    <span>Add Recent Project</span>
                                    <span className="text-accent-glow text-xs group-hover:underline">Add &rarr;</span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>

            <SliderSection />
        </div>
    );
}
