"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { Eye, Share2, ShieldCheck, Upload, Award, FileText, Lock, CheckCircle, Clock } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

type EvidenceType = "Projects" | "Certifications" | "IP";

interface PortfolioItem {
    id: number;
    title: string;
    image: string | null;
    verified: boolean;
    type: EvidenceType;
    category: string;
}

export default function PortfolioHubPage() {
    const { updateEvidenceData, profile, ipoScore } = useSimulation();
    const [activeTab, setActiveTab] = useState<EvidenceType>("Projects");

    const [items, setItems] = useState<PortfolioItem[]>([
        { id: 1, title: "EDUK8U System Architecture", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80", verified: true, type: "Projects", category: "Architecture" },
        { id: 2, title: "Neural Interface Design", image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=800&q=80", verified: false, type: "Projects", category: "UX/UI" },
        { id: 3, title: "ICQA Gold Standard", image: null, verified: true, type: "Certifications", category: "Quality Assurance" },
        { id: 4, title: "WorkReady Global", image: null, verified: true, type: "Certifications", category: "Soft Skills" },
        { id: 5, title: "Algorithm Patent #2204", image: null, verified: false, type: "IP", category: "Patent" },
    ]);

    const handleUpload = () => {
        const newItem: PortfolioItem = {
            id: Date.now(),
            title: `New ${activeTab} Entry`,
            image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80",
            verified: false,
            type: activeTab,
            category: "Pending"
        };
        setItems([newItem, ...items]);
    };

    const handleVerify = (id: number) => {
        // Simulate verification process
        const updatedItems = items.map(item => item.id === id ? { ...item, verified: true } : item);
        setItems(updatedItems);
        updateEvidenceData({ verifiedProjects: profile.evidence.verifiedProjects + 1 });
    };

    const filteredItems = items.filter(item => item.type === activeTab);

    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300 flex items-center gap-3">
                        <Lock className="text-pink-300" /> Evidence Locker
                    </h1>
                    <p className="text-gray-400">
                        Immutable proof of work. <span className="text-accent-glow font-mono">Total Verified Value: ${(profile.evidence.verifiedProjects * 15000 + ipoScore * 100).toLocaleString()}</span>
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                        {(["Projects", "Certifications", "IP"] as EvidenceType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab ? "bg-white/10 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <GlowingButton variant="primary" onClick={handleUpload}>
                        <Upload size={16} className="mr-2" /> Upload {activeTab.slice(0, -1)}
                    </GlowingButton>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredItems.map((item) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <GlassCard className="h-full flex flex-col p-0 overflow-hidden group hover:border-accent-glow/50 transition-colors">
                                {item.image ? (
                                    <div className="relative h-48 w-full overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
                                        {item.verified && (
                                            <div className="absolute top-3 right-3 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-2 py-1 rounded-full flex items-center gap-1 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                                <ShieldCheck size={12} className="text-blue-400 fill-current" />
                                                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">VERIFIED</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-48 w-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center relative">
                                        {item.type === "Certifications" ? <Award size={48} className="text-gray-600 group-hover:text-yellow-400 transition-colors" /> : <FileText size={48} className="text-gray-600 group-hover:text-pink-400 transition-colors" />}
                                        {item.verified && (
                                            <div className="absolute top-3 right-3 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 px-2 py-1 rounded-full flex items-center gap-1">
                                                <CheckCircle size={12} className="text-emerald-400" />
                                                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">VALID</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-mono text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded">{item.category}</span>
                                    </div>
                                    <h3 className="font-bold text-lg leading-tight mb-4 group-hover:text-accent-glow transition-colors">
                                        {item.title}
                                    </h3>

                                    <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                                        {!item.verified ? (
                                            <button
                                                onClick={() => handleVerify(item.id)}
                                                className="text-xs flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors"
                                            >
                                                <Clock size={12} /> Request Verification
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <ShieldCheck size={12} /> Blockchain Secured
                                            </span>
                                        )}

                                        <div className="flex gap-3">
                                            <Eye size={16} className="text-gray-500 hover:text-white cursor-pointer transition-colors" />
                                            <Share2 size={16} className="text-gray-500 hover:text-white cursor-pointer transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
