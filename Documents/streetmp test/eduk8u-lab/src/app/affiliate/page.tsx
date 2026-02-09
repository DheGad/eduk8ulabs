"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { DollarSign, FileText, Download, UserPlus, TrendingUp } from "lucide-react";

export default function AffiliateDashboardPage() {
    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-300">
                Agent Command
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Commission Ticker */}
                <GlassCard className="col-span-1 md:col-span-3 flex justify-between items-center bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 animate-pulse-slow">
                            <DollarSign size={32} className="text-amber-400" />
                        </div>
                        <div>
                            <span className="text-sm font-mono text-amber-300 uppercase tracking-widest">Live Commission</span>
                            <div className="text-4xl font-black text-white">$12,450.00</div>
                        </div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <span className="block text-green-400 font-bold flex items-center justify-end gap-1">
                            <TrendingUp size={16} /> +15.4%
                        </span>
                        <span className="text-xs text-gray-500">vs Last Month</span>
                    </div>
                </GlassCard>

                {/* Tools */}
                <GlassCard className="md:col-span-2 space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="text-indigo-400" /> Client Report Generator
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Client Name / ID"
                            className="glass-input w-full"
                        />
                        <select className="glass-input w-full bg-black/20 text-gray-300">
                            <option>Full Career Audit (15 Pages)</option>
                            <option>Migration Feasibility (5 Pages)</option>
                            <option>Skill Gap Analysis (3 Pages)</option>
                        </select>
                    </div>
                    <GlowingButton variant="primary" className="w-full">
                        <Download size={16} className="mr-2" /> Generate Branded PDF
                    </GlowingButton>
                    <p className="text-xs text-gray-500 text-center">
                        *Reports are white-labeled with your agency branding automatically.
                    </p>
                </GlassCard>

                <GlassCard className="flex flex-col justify-center items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <UserPlus size={32} className="text-blue-400" />
                    </div>
                    <h3 className="font-bold text-lg">New Client Onboarding</h3>
                    <p className="text-sm text-gray-400">Send an invite link to track their progress.</p>
                    <GlowingButton variant="secondary" className="w-full">
                        Copy Invite Link
                    </GlowingButton>
                </GlassCard>
            </div>
        </div>
    );
}
