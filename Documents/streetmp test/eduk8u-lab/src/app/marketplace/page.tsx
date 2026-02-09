"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { Search, BarChart3, ArrowUpRight } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";
import { useState, useMemo } from "react";

export default function MarketplacePage() {
    const { ipoScore, capitalValue } = useSimulation();
    const [filter, setFilter] = useState("");
    const [activeView, setActiveView] = useState<'market' | 'portfolio'>('market');

    // Mock Portfolio Data
    const myPortfolio = {
        totalValue: 1250000,
        dayChange: +2.4,
        holdings: [
            { id: "C-8X92", shares: 50, avgPrice: 110, currentPrice: 125, name: "Quantum Eng." },
            { id: "C-7A41", shares: 200, avgPrice: 85, currentPrice: 82, name: "AI Ethicist" },
        ]
    };

    // Generate static candidates but mix in the Real User Profile
    const rawCandidates = useMemo(() => [
        { id: "YOU", role: "Current User", ipo: ipoScore, assetClass: ipoScore > 90 ? "AAA" : ipoScore > 80 ? "AA" : "B+", funding: `$${capitalValue}M`, status: "Active", isUser: true, price: (ipoScore * 10).toFixed(2), change: "+0.5%", volume: "42.5k" },
        { id: "C-8X92", role: "Quantum Engineer", ipo: 98.4, assetClass: "AAA", funding: "$12.0M", status: "Open", isUser: false, price: "984.00", change: "+1.2%", volume: "12.1k" },
        { id: "C-7A41", role: "AI Ethicist", ipo: 92.1, assetClass: "AA+", funding: "$8.5M", status: "Negotiating", isUser: false, price: "921.50", change: "-0.8%", volume: "8.4k" },
        { id: "C-3B19", role: "Full Stack Architect", ipo: 89.5, assetClass: "A", funding: "$6.0M", status: "Open", isUser: false, price: "895.00", change: "+0.2%", volume: "15.2k" },
        { id: "C-9Z04", role: "Data Scientist", ipo: 88.0, assetClass: "A-", funding: "$5.5M", status: "Funded", isUser: false, price: "880.25", change: "+3.5%", volume: "22.8k" },
        { id: "C-1X55", role: "Product Owner", ipo: 84.3, assetClass: "B+", funding: "$4.0M", status: "Open", isUser: false, price: "843.10", change: "-1.1%", volume: "5.6k" },
    ], [ipoScore, capitalValue]);

    const candidates = useMemo(() => {
        return rawCandidates
            .filter(c => c.assetClass.includes(filter) || c.role.toLowerCase().includes(filter.toLowerCase()) || filter === "")
            .sort((a, b) => b.ipo - a.ipo);
    }, [rawCandidates, filter]);

    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-7xl mx-auto space-y-8">
            {/* Header / Stats Ticker */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-300 flex items-center gap-3">
                        <BarChart3 className="text-cyan-300" /> Talent Exchange
                    </h1>
                    <p className="text-gray-400 font-mono text-sm mt-1">
                        MARKET STATUS: <span className="text-emerald-400">OPEN</span> • VOL: $42.5M
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setActiveView('market')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeView === 'market' ? "bg-white/10 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                        >
                            Market
                        </button>
                        <button
                            onClick={() => setActiveView('portfolio')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeView === 'portfolio' ? "bg-white/10 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                        >
                            Portfolio
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="p-4 flex flex-col justify-between h-24 relative overflow-hidden group">
                    <span className="text-xs text-gray-500 uppercase tracking-widest relative z-10">Human Capital Index</span>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-2xl font-bold text-white">4,281.42</span>
                        <span className="text-xs text-emerald-400 font-mono mb-1 flex items-center">
                            <ArrowUpRight size={10} /> +12%
                        </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
                </GlassCard>
                <GlassCard className="p-4 flex flex-col justify-between h-24 relative overflow-hidden group">
                    <span className="text-xs text-gray-500 uppercase tracking-widest relative z-10">My Holdings</span>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-2xl font-bold text-white">${(myPortfolio.totalValue / 1000).toFixed(1)}k</span>
                        <span className="text-xs text-emerald-400 font-mono mb-1 flex items-center">
                            <ArrowUpRight size={10} /> +2.4%
                        </span>
                    </div>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col justify-between h-24 relative overflow-hidden group">
                    <span className="text-xs text-gray-500 uppercase tracking-widest relative z-10">Active Contracts</span>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-2xl font-bold text-white">12</span>
                        <span className="text-xs text-gray-400 font-mono mb-1">Open</span>
                    </div>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col justify-between h-24 relative overflow-hidden group border-indigo-500/30 bg-indigo-500/5">
                    <span className="text-xs text-indigo-300 uppercase tracking-widest relative z-10">My Valuation</span>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-2xl font-bold text-white">${capitalValue}M</span>
                        <span className="text-xs text-indigo-400 font-mono mb-1">IPO</span>
                    </div>
                </GlassCard>
            </div>

            {/* Trading Interface */}
            <GlassCard className="p-0 overflow-hidden min-h-[500px] flex flex-col">
                <div className="p-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 bg-black/20 border border-white/5 rounded-lg px-4 py-2 w-full md:w-96">
                        <Search className="text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="SEARCH TICKER OR ROLE..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-transparent border-none focus:outline-none text-xs w-full uppercase placeholder:text-gray-600 font-mono"
                        />
                    </div>
                    <div className="flex gap-2">
                        <GlowingButton variant="secondary" className="px-3 py-1 text-xs">Filter: All</GlowingButton>
                        <GlowingButton variant="secondary" className="px-3 py-1 text-xs">Filter: AAA Only</GlowingButton>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/20 border-b border-white/5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                                <th className="p-4">Ticker / ID</th>
                                <th className="p-4">Asset Name</th>
                                <th className="p-4">Class</th>
                                <th className="p-4 text-right">Price</th>
                                <th className="p-4 text-right">24h Change</th>
                                <th className="p-4 text-right">Market Cap</th>
                                <th className="p-4 text-right">Volume</th>
                                <th className="p-4 text-center">Trade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {candidates.map((candidate, index) => (
                                <motion.tr
                                    key={candidate.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`group hover:bg-white/5 transition-colors ${candidate.isUser ? 'bg-indigo-900/10' : ''}`}
                                >
                                    <td className="p-4 font-mono font-bold text-indigo-300">
                                        {candidate.isUser ? "YOU" : candidate.id}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">{candidate.role}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{candidate.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${candidate.assetClass.startsWith('A') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                            candidate.assetClass.startsWith('B') ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                                'bg-red-500/10 border-red-500/30 text-red-400'
                                            }`}>
                                            {candidate.assetClass}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono text-white">${candidate.price}</td>
                                    <td className={`p-4 text-right font-mono ${candidate.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {candidate.change}
                                    </td>
                                    <td className="p-4 text-right font-mono text-gray-400">{candidate.funding}</td>
                                    <td className="p-4 text-right font-mono text-gray-500">{candidate.volume}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] font-bold rounded uppercase transition-colors">Buy</button>
                                            <button className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[10px] font-bold rounded uppercase transition-colors">Sell</button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}
