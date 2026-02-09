"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { Shield, Key, EyeOff, Copy } from "lucide-react";

export default function SettingsPage() {
    const [zeroKnowledge, setZeroKnowledge] = useState(false);
    const [apiKey, setApiKey] = useState("sk-antigravity-xxxxxxxxxxxxxxxx");
    const trustToken = "eduk8u_live_8f92a3c1d4e";

    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-400">
                System Configuration
            </h1>

            {/* Trust Token */}
            <GlassCard className="space-y-4 border-l-4 border-l-emerald-500">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Shield className="text-emerald-400" /> Trust API Token
                </h3>
                <p className="text-gray-400 text-sm">
                    This token verifies your Human IPO Score on third-party platforms (LinkedIn, Indeed, Gov.au).
                </p>
                <div className="flex items-center gap-4 bg-black/30 p-4 rounded-lg font-mono text-emerald-300 border border-emerald-500/20">
                    <span className="flex-1 truncate">{trustToken}</span>
                    <button className="text-gray-500 hover:text-white transition-colors">
                        <Copy size={16} />
                    </button>
                </div>
            </GlassCard>

            {/* BYOK */}
            <GlassCard className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Key className="text-amber-400" /> Intelligence Core (BYOK)
                </h3>
                <p className="text-gray-400 text-sm mt-1">Simulate a data breach to test your resume&apos;s resilience.</p>
                <p className="text-gray-400 text-sm">
                    Connect your own LLM API key. We do not store your key on our servers.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">OpenAI / Claude / Gemini Key</label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="glass-input w-full"
                            />
                            <GlowingButton variant="secondary">Save</GlowingButton>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Zero Knowledge */}
            <GlassCard className="flex items-center justify-between border-red-500/20 bg-red-900/5">
                <div className="space-y-1">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-red-200">
                        <EyeOff className="text-red-400" /> Zero-Knowledge Mode
                    </h3>
                    <p className="text-red-300/50 text-sm max-w-md">
                        When enabled, all data is stored strictly in your browser&apos;s LocalStorage. Nothing is synced to the cloud.
                    </p>
                </div>
                <div
                    className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors ${zeroKnowledge ? 'bg-red-500' : 'bg-gray-600'}`}
                    onClick={() => setZeroKnowledge(!zeroKnowledge)}
                >
                    <motion.div
                        className="w-6 h-6 bg-white rounded-full shadow-md"
                        layout
                        animate={{ x: zeroKnowledge ? 24 : 0 }}
                    />
                </div>
            </GlassCard>

            <div className="pt-8 border-t border-white/5 flex justify-end">
                <span className="text-xs text-gray-600 font-mono">EDUK8U LAB v1.0.0 • BUILD 2026.02.09</span>
            </div>
        </div>
    );
}
