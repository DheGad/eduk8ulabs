"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { Users, Shield, Crown, Zap, CheckCircle, Lock, Briefcase, GraduationCap, DollarSign, Search, TrendingUp } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: number;
    user: string;
    text: string;
    time: string;
    avatar: string;
    role: string;
}

export default function CommunityPage() {
    const { ipoScore } = useSimulation();
    const [activeTab, setActiveTab] = useState<'tiers' | 'bounties' | 'mentors' | 'chat' | 'insights'>('tiers');
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, user: "Dr. Elena Volt", text: "Has anyone modeled the impact of the new 'Global Nomad' visa on their IPO score?", time: "2m ago", avatar: "E", role: "Visionary" },
        { id: 2, user: "Marcus Chen", text: "Yes, it added about 12% to my projected LTV. Highly recommend looking into it.", time: "1m ago", avatar: "M", role: "Visionary" },
    ]);
    const [newMessage, setNewMessage] = useState("");

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        setMessages([...messages, {
            id: Date.now(),
            user: "You",
            text: newMessage,
            time: "Just now",
            avatar: "Y",
            role: "Architect"
        }]);
        setNewMessage("");

        // Simulate reply
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                user: "Sarah O'Connor",
                text: "Great point! That aligns with the latest market demand data.",
                time: "Just now",
                avatar: "S",
                role: "Architect"
            }]);
        }, 2000);
    };

    const tabs = ['tiers', 'insights', 'bounties', 'mentors', 'chat'];
    const memberCount = 1240; // Placeholder for member count

    // ... (tiers, bounties, mentors arrays remain)
    const tiers = [
        {
            name: "Explorer",
            icon: Users,
            color: "text-blue-400",
            minScore: 0,
            active: ipoScore >= 0 && ipoScore < 25,
            benefits: [
                "Basic Community Access",
                "Public Forums",
                "Weekly Newsletter"
            ]
        },
        {
            name: "Architect",
            icon: Shield,
            color: "text-purple-400",
            minScore: 25,
            active: ipoScore >= 25 && ipoScore < 50,
            benefits: [
                "All Explorer Benefits",
                "Private Channels",
                "Early Access to Bounties",
                "Monthly AMA with Visionaries"
            ]
        },
        {
            name: "Strategist",
            icon: Crown,
            color: "text-pink-400",
            minScore: 50,
            active: ipoScore >= 50 && ipoScore < 75,
            benefits: [
                "All Architect Benefits",
                "Exclusive Workshops",
                "Direct Mentor Match",
                "Voting Rights on Community Proposals"
            ]
        },
        {
            name: "Visionary",
            icon: Zap,
            color: "text-accent-glow",
            minScore: 75,
            active: ipoScore >= 75,
            benefits: [
                "All Strategist Benefits",
                "Access to Capital Network",
                "Personalized Growth Roadmap",
                "Influence on Platform Development"
            ]
        }
    ];

    const bounties = [
        {
            id: 1,
            title: "Decentralized Identity Protocol",
            company: "VeriChain Labs",
            reward: "$15,000",
            tags: ["Blockchain", "Security", "Web3"],
            difficulty: "High",
            ipoCurrent: 60
        },
        {
            id: 2,
            title: "AI-Powered Market Sentiment Analysis",
            company: "QuantEdge AI",
            reward: "$10,000",
            tags: ["AI/ML", "Data Science", "FinTech"],
            difficulty: "Expert",
            ipoCurrent: 70
        },
        {
            id: 3,
            title: "Sustainable Energy Grid Optimization",
            company: "EcoWatt Solutions",
            reward: "$12,000",
            tags: ["IoT", "Green Tech", "Optimization"],
            difficulty: "Moderate",
            ipoCurrent: 45
        },
        {
            id: 4,
            title: "Gamified Learning Platform UX/UI",
            company: "Eduk8u",
            reward: "$8,000",
            tags: ["UX/UI", "EdTech", "Product Design"],
            difficulty: "Medium",
            ipoCurrent: 30
        }
    ];

    const mentors = [
        {
            id: 1,
            name: "Dr. Anya Sharma",
            role: "AI Ethics Lead",
            company: "Cognito Corp",
            ipoScore: 92,
            expertise: ["AI/ML", "Ethics", "Product Strategy"]
        },
        {
            id: 2,
            name: "Marcus Thorne",
            role: "Blockchain Architect",
            company: "Nexus Chain",
            ipoScore: 88,
            expertise: ["Web3", "DeFi", "Smart Contracts"]
        },
        {
            id: 3,
            name: "Sophia Lee",
            role: "Growth Hacker",
            company: "ScaleUp Ventures",
            ipoScore: 95,
            expertise: ["Marketing", "Fundraising", "Market Entry"]
        }
    ];

    return (
        <div className="min-h-screen pt-24 px-4 sm:px-6 pb-20 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Users className="text-blue-400" /> Community Nodes
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Connect with {memberCount.toLocaleString()} verified high-value peers.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-black/20 border border-white/10 px-4 py-2 rounded-lg text-center">
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Network Value</div>
                        <div className="text-lg font-bold text-emerald-400">$4.2B</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Scrollable on mobile */}
            <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:pb-0 hide-scrollbar">
                <div className="flex sm:justify-center gap-2 sm:gap-4 border-b border-white/10 pb-4 min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            {tab === 'rows' ? 'Access Tiers' : tab === 'chat' ? 'Inner Circle' : tab === 'insights' ? 'Market Insights' : tab.replace('mentors', 'Mentor Match').replace('bounties', 'Bounty Board')}
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* Insights Tab Content */}
                {activeTab === 'insights' && (
                    <motion.div
                        key="insights"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:col-span-3 space-y-6"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <GlassCard className="p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-emerald-400" /> Top Skill Risers
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        { skill: "Prompt Engineering", growth: "+142%", demand: "High" },
                                        { skill: "Ethical AI Compliance", growth: "+89%", demand: "Very High" },
                                        { skill: "Quantum Cryptography", growth: "+56%", demand: "Moderate" }
                                    ].map((item, i) => (
                                        <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 hover:bg-white/5 p-2 rounded transition-colors">
                                            <div>
                                                <div className="text-white font-medium">{item.skill}</div>
                                                <div className="text-xs text-gray-500">Global Demand: {item.demand}</div>
                                            </div>
                                            <div className="text-emerald-400 font-mono font-bold">{item.growth}</div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Briefcase size={20} className="text-blue-400" /> Role Velocity
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        { role: "Chief AI Officer", salary: "$250k - $400k", trend: "up" },
                                        { role: "Sustainability Lead", salary: "$120k - $180k", trend: "up" },
                                        { role: "Legacy Sys Admin", salary: "$80k - $110k", trend: "down" }
                                    ].map((item, i) => (
                                        <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 hover:bg-white/5 p-2 rounded transition-colors">
                                            <div>
                                                <div className="text-white font-medium">{item.role}</div>
                                                <div className="text-xs text-gray-500">Base Range: {item.salary}</div>
                                            </div>
                                            <div>
                                                {item.trend === 'up' ?
                                                    <TrendingUp size={16} className="text-emerald-400" /> :
                                                    <TrendingUp size={16} className="text-red-400 rotate-180" />
                                                }
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        </div>

                        <GlassCard className="p-8 text-center bg-gradient-to-r from-indigo-900/20 to-purple-900/20">
                            <h2 className="text-2xl font-bold text-white mb-2">Unlock Deep Market Intelligence</h2>
                            <p className="text-gray-400 max-w-xl mx-auto mb-6">
                                Upgrade to <strong>Pro Member</strong> to access real-time salary data, employer demand heatmaps, and personalized skill gap analysis.
                            </p>
                            <button className="px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform">
                                Unlock Pro Insights
                            </button>
                        </GlassCard>
                    </motion.div>
                )}

                {activeTab === 'tiers' && (
                    <motion.div
                        key="tiers"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                        {tiers.map((tier) => (
                            <GlassCard
                                key={tier.name}
                                className={`relative overflow-hidden flex flex-col h-full transition-transform duration-300 ${tier.active ? 'ring-2 ring-accent-glow scale-105 z-10' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                            >
                                {tier.active && (
                                    <div className="absolute top-0 inset-x-0 h-1 bg-accent-glow shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                )}

                                <div className="flex justify-between items-start mb-6">
                                    <tier.icon size={32} className={tier.color} />
                                    {tier.active ? (
                                        <span className="text-[10px] font-bold bg-accent-glow/20 text-accent-glow px-2 py-1 rounded-full border border-accent-glow/50">CURRENT</span>
                                    ) : ipoScore < tier.minScore ? (
                                        <Lock size={16} className="text-gray-600" />
                                    ) : (
                                        <CheckCircle size={16} className="text-emerald-500" />
                                    )}
                                </div>

                                <h3 className={`text-2xl font-bold mb-1 ${tier.color}`}>{tier.name}</h3>
                                <p className="text-xs font-mono text-gray-500 mb-6">REQ. SCORE: {tier.minScore}+</p>

                                <ul className="space-y-3 mb-8 flex-1">
                                    {tier.benefits.map((benefit, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                            <CheckCircle size={14} className="text-gray-600 mt-0.5 shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>

                                <GlowingButton
                                    variant={tier.active ? "primary" : "secondary"}
                                    className="w-full mt-auto"
                                    disabled={ipoScore < tier.minScore}
                                >
                                    {tier.active ? "Manage Access" : ipoScore < tier.minScore ? "Locked" : "Unlocked"}
                                </GlowingButton>
                            </GlassCard>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'bounties' && (
                    <motion.div
                        key="bounties"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 p-4 rounded-xl border border-white/10 gap-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Briefcase className="text-accent-glow" /> Real-World Bounties
                            </h2>
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input type="text" placeholder="Search challenges..." className="w-full sm:w-64 bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent-glow" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {bounties.map(bounty => (
                                <GlassCard key={bounty.id} className="hover:border-accent-glow/50 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-white group-hover:text-accent-glow transition-colors">{bounty.title}</h3>
                                            <p className="text-sm text-gray-400">{bounty.company}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-emerald-400 font-bold font-mono text-lg">{bounty.reward}</div>
                                            <div className="text-[10px] text-gray-500">REWARD</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-4">
                                        {bounty.tags.map(tag => (
                                            <span key={tag} className="text-xs bg-white/5 px-2 py-1 rounded text-gray-300">{tag}</span>
                                        ))}
                                        <span className={`text-xs px-2 py-1 rounded ${bounty.difficulty === 'High' || bounty.difficulty === 'Expert' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                            {bounty.difficulty}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-white/5 pt-4">
                                        <div className="text-xs text-gray-500">
                                            Min IPO Score: <span className="text-white">{bounty.ipoCurrent}</span>
                                        </div>
                                        <button className="text-sm font-bold text-accent-glow hover:underline">Apply Now &rarr;</button>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'mentors' && (
                    <motion.div
                        key="mentors"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2">90+ Club Mentorship</h2>
                            <p className="text-gray-400 max-w-xl mx-auto">
                                Exclusive access to Visionaries with an IPO score of 90+. Connect, learn, and accelerate your valuation.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {mentors.map(mentor => (
                                <GlassCard key={mentor.id} className="text-center hover:scale-105 transition-transform duration-300">
                                    <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-accent-glow">
                                        {/* Mock Avatar */}
                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                                            {mentor.name.charAt(0)}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-lg text-white">{mentor.name}</h3>
                                    <p className="text-sm text-accent-glow mb-1">{mentor.role}</p>
                                    <p className="text-xs text-gray-400 mb-4">{mentor.company}</p>

                                    <div className="inline-block bg-white/5 px-3 py-1 rounded-full text-xs font-mono text-emerald-400 mb-4 border border-emerald-500/20">
                                        IPO SCORE: {mentor.ipoScore}
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                                        {mentor.expertise.map(exp => (
                                            <span key={exp} className="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400">{exp}</span>
                                        ))}
                                    </div>

                                    <GlowingButton variant="secondary" className="w-full text-sm">
                                        Request Session
                                    </GlowingButton>
                                </GlassCard>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'chat' && (
                    <motion.div
                        key="chat"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="h-[600px] flex flex-col"
                    >
                        <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Inner Circle - Global
                                    </h3>
                                    <p className="text-xs text-gray-400">1,240 Members Online • Topic: Future of Work</p>
                                </div>
                                <Users size={18} className="text-gray-400" />
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex gap-3 ${msg.user === 'You' ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                            {msg.avatar}
                                        </div>
                                        <div className={`max-w-[80%] ${msg.user === 'You' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-200'} p-3 rounded-2xl ${msg.user === 'You' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                                            <div className="flex justify-between items-baseline mb-1 gap-4">
                                                <span className="text-xs font-bold opacity-80">{msg.user}</span>
                                                <span className="text-[10px] opacity-50">{msg.time}</span>
                                            </div>
                                            <p className="text-sm">{msg.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-black/20 border-t border-white/10">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type your message..."
                                        className="flex-1 bg-black/20 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-accent-glow text-white"
                                    />
                                    <GlowingButton variant="primary" className="rounded-full px-6" onClick={handleSendMessage}>
                                        Send
                                    </GlowingButton>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
