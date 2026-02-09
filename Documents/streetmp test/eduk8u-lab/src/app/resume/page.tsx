"use client";

import { useState, useEffect } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { FileText, Wand2, Download, ExternalLink, GripVertical, Fingerprint, TrendingUp, AlertCircle, CheckCircle, Plus, Trash2, Globe } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

export default function ResumeStudioPage() {
    const { profile, updateResumeData, ipoScore } = useSimulation();
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [isPublished, setIsPublished] = useState(false);
    const [showInsight, setShowInsight] = useState(true);

    // We maintain local state for the editor, but sync to context on changes
    const [sections, setSections] = useState([
        { id: "summary", title: "Professional Summary", content: "Visionary Architect with 10+ years of experience in designing sustainable urban ecosystems. Proven track record of leading cross-functional teams and delivering multi-million dollar projects on time and under budget.", ipoWeight: 5, heat: 95, filled: true },
        { id: "experience", title: "Work Experience", content: "Senior Lead Engineer at Tekton Global (2018-Present)\n- Led a team of 15 engineers to develop the core infrastructure.\n- Reduced system latency by 40% through optimized algorithms.\n- Spearheaded the migration to cloud-native architecture.", ipoWeight: 8, heat: 88, filled: true },
        { id: "education", title: "Education", content: "Master of Architecture, minimal University (2015)\nBachelor of Science in Civil Engineering, Tech Institute (2013)", ipoWeight: 7, heat: 72, filled: true },
        { id: "skills", title: "Key Skills", content: "React, Next.js, Node.js, Python, AWS, Docker, Kubernetes, System Design, Agile Methodologies", ipoWeight: 5, heat: 98, filled: true },
        { id: "projects", title: "Projects", content: "Smart City Grid: Designed the initial blueprint for a self-sustaining energy grid.\nAI Traffic Control: Developed a prototype for real-time traffic flow optimization.", ipoWeight: 5, heat: 85, filled: true },
    ]);

    // Sync completeness to context
    useEffect(() => {
        const filledCount = sections.filter(s => s.content.length > 10).length;
        const total = sections.length;
        const completeness = Math.round((filledCount / total) * 100);

        // Update the boolean flags for the engine
        updateResumeData({
            completeness,
            sections: {
                summary: (sections.find(s => s.id === "summary")?.content.length ?? 0) > 10,
                experience: (sections.find(s => s.id === "experience")?.content.length ?? 0) > 10,
                education: (sections.find(s => s.id === "education")?.content.length ?? 0) > 10,
                skills: (sections.find(s => s.id === "skills")?.content.length ?? 0) > 10,
                projects: (sections.find(s => s.id === "projects")?.content.length ?? 0) > 10,
            },
            // Estimate years of experience based on length of experience section (Mock)
            totalExperienceYears: (sections.find(s => s.id === "experience")?.content.length ?? 0) > 50 ? 5 : 0 // Simple mock logic
        });
    }, [sections, updateResumeData]);

    const handleContentChange = (id: string, newContent: string) => {
        setSections(sections.map(s => s.id === id ? { ...s, content: newContent, filled: newContent.length > 10 } : s));
    };

    const handleAIRewrite = (id: string) => {
        const newContent = sections.find(s => s.id === id)?.content + " (Enhanced by AI)";
        handleContentChange(id, newContent);
    };

    const handleAddSection = () => {
        const newId = `custom-${Date.now()}`;
        setSections([...sections, {
            id: newId,
            title: "New Section",
            content: "",
            ipoWeight: 3,
            heat: 0,
            filled: false
        }]);
    };

    const handleDeleteSection = (id: string) => {
        setSections(sections.filter(s => s.id !== id));
    };

    const handleTitleChange = (id: string, newTitle: string) => {
        setSections(sections.map(s => s.id === id ? { ...s, title: newTitle } : s));
    };


    const getHeatColor = (score: number) => {
        if (score > 90) return "bg-green-500/20 border-green-500/50";
        if (score > 70) return "bg-yellow-500/20 border-yellow-500/50";
        return "bg-red-500/20 border-red-500/50";
    };

    const handlePublish = () => {
        setIsPublished(true);
        setTimeout(() => setIsPublished(false), 3000);
    };

    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

    return (
        <div className="min-h-screen pt-24 px-4 sm:px-6 pb-12 max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-80px)] h-auto overflow-y-auto lg:overflow-hidden">

            {/* Mobile Tab Switcher */}
            <div className="lg:hidden w-full flex bg-white/5 p-1 rounded-xl border border-white/10 mb-4 shrink-0">
                <button
                    onClick={() => setActiveTab('editor')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'editor' ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <FileText size={16} /> Editor
                </button>
                <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'preview' ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <TrendingUp size={16} /> Preview (A4)
                </button>
            </div>

            {/* Editor Panel */}
            <div className={`${activeTab === 'editor' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 flex-col gap-6 h-full transition-all`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                        <FileText className="text-indigo-400" /> Resume Studio
                    </h1>
                    <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <button
                            onClick={() => setShowHeatmap(!showHeatmap)}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] sm:text-xs font-mono flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${showHeatmap ? "bg-accent-glow/20 border-accent-glow text-accent-glow" : "bg-white/5 border-white/10 text-gray-400"}`}
                        >
                            <Fingerprint size={14} /> <span className="hidden sm:inline">ATS HEATMAP</span>
                        </button>
                        <GlowingButton variant="secondary" className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm whitespace-nowrap shrink-0">
                            <Download size={14} className="mr-0 sm:mr-2" /> <span className="hidden sm:inline">PDF</span>
                        </GlowingButton>
                        <GlowingButton variant="primary" className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm whitespace-nowrap shrink-0" onClick={handlePublish}>
                            {isPublished ? <CheckCircle size={14} className="mr-2" /> : <ExternalLink size={14} className="mr-0 sm:mr-2" />}
                            <span className="hidden sm:inline">{isPublished ? "Shared!" : "Publish"}</span>
                        </GlowingButton>
                    </div>
                </div>

                {/* AI Insight Banner */}
                <AnimatePresence>
                    {showInsight && sections.length < 6 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-accent-glow/10 border border-accent-glow/30 rounded-lg p-3 flex items-start gap-3 shrink-0"
                        >
                            <div className="p-1.5 bg-accent-glow/20 rounded-full mt-0.5">
                                <Wand2 size={14} className="text-accent-glow" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-white mb-1">AI Insight: Boost Your IPO Score</h4>
                                <p className="text-xs text-gray-300 mb-2">Your resume feels incomplete. Adding at least <span className="font-bold text-white">3 more sections</span> (e.g., Certifications, Languages, Volunteering) could increase your valuation by <span className="text-emerald-400 font-bold">+$250k</span>.</p>
                                <button
                                    onClick={handleAddSection}
                                    className="text-xs font-bold text-black bg-accent-glow px-3 py-1.5 rounded hover:bg-white transition-colors flex items-center gap-1"
                                >
                                    <Plus size={12} /> Add Section Now
                                </button>
                            </div>
                            <button onClick={() => setShowInsight(false)} className="text-gray-500 hover:text-white">
                                <span className="sr-only">Dismiss</span>
                                ×
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-20 custom-scrollbar">
                    <Reorder.Group axis="y" values={sections} onReorder={setSections} className="space-y-4">
                        {sections.map((section) => (
                            <Reorder.Item key={section.id} value={section}>
                                <GlassCard
                                    className={`group cursor-grab active:cursor-grabbing transition-all duration-500 ${showHeatmap ? getHeatColor(section.heat) : ""} ${!section.filled ? "border-l-4 border-l-red-500" : "border-l-4 border-l-green-500"}`}
                                    hoverEffect={!showHeatmap}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <GripVertical size={16} className="text-gray-600 shrink-0" />
                                            <input
                                                type="text"
                                                value={section.title}
                                                onChange={(e) => handleTitleChange(section.id, e.target.value)}
                                                className="bg-transparent text-gray-300 font-semibold focus:outline-none focus:border-b border-indigo-500 w-full mr-2"
                                            />

                                            {/* IPO Badge */}
                                            <div className="hidden sm:flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px] font-mono border border-white/5 text-gray-400 shrink-0">
                                                <TrendingUp size={10} className="text-indigo-400" />
                                                <span>IPO: +{section.ipoWeight}</span>
                                            </div>
                                            {!section.filled && (
                                                <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold animate-pulse shrink-0">
                                                    <AlertCircle size={10} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleAIRewrite(section.id)}
                                                className="text-xs flex items-center gap-1 text-accent-glow hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="AI Rewrite"
                                            >
                                                <Wand2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSection(section.id)}
                                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete Section"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        className="w-full h-32 bg-black/20 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none font-mono leading-relaxed"
                                        value={section.content}
                                        onChange={(e) => handleContentChange(section.id, e.target.value)}
                                        placeholder={`Enter content for ${section.title}...`}
                                    />
                                    {showHeatmap && (
                                        <div className="mt-2 flex justify-between items-center text-[10px] uppercase font-mono tracking-widest">
                                            <span className="text-gray-500">ATS Match Rate</span>
                                            <span className={section.heat > 80 ? "text-green-400" : "text-orange-400"}>{section.heat}%</span>
                                        </div>
                                    )}
                                </GlassCard>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    <GlowingButton
                        variant="secondary"
                        onClick={handleAddSection}
                        className="w-full border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 py-3 flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Add Section
                    </GlowingButton>
                </div>
            </div>

            {/* Live Preview Panel - Hidden on Mobile unless tab active */}
            <div className={`${activeTab === 'preview' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 bg-gray-900/50 rounded-2xl overflow-hidden border border-white/5 relative items-center justify-center p-4 sm:p-8 sticky top-24 h-full`}>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

                {/* A4 Paper Simulation - Scaled for mobile */}
                <motion.div
                    layout
                    className="bg-white text-black w-full max-w-[500px] h-full shadow-2xl rounded-sm p-6 sm:p-10 overflow-y-auto relative custom-scrollbar-light"
                    style={{ fontFamily: 'Times New Roman, serif' }}
                >
                    {/* Watermark overlay */}
                    <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center opacity-[0.03] overflow-hidden">
                        <h1 className="text-6xl font-black -rotate-45 text-black whitespace-nowrap">EDUK8U LAB VERIFIED</h1>
                    </div>

                    {/* Heatmap Overlay */}
                    {showHeatmap && (
                        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-10">
                            <h1 className="text-9xl font-black -rotate-45">ATS SCAN</h1>
                        </div>
                    )}

                    <div className="border-b-2 border-black pb-6 mb-8 relative z-10">
                        <h2 className="text-2xl sm:text-4xl font-bold uppercase tracking-wider mb-2">{profile.name || "YOUR NAME"}</h2>
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <p className="text-xs sm:text-sm text-gray-600 font-sans tracking-widest uppercase">Architect • Engineer • Designer</p>
                            <div className="text-xs font-mono text-gray-500 flex items-center gap-1">
                                <TrendingUp size={10} /> IPO: {ipoScore}
                            </div>
                        </div>
                        {isPublished && (
                            <div className="mt-2 text-xs text-blue-500 font-sans flex items-center gap-1 bg-blue-50 px-2 py-1 rounded w-fit">
                                <Globe size={10} />
                                <span className="font-bold">eduk8u.lab/u/{profile.name?.toLowerCase().replace(/\s/g, '-') || 'user'}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 sm:space-y-8 relative z-10">
                        {sections.map((section) => (
                            <div key={section.id} className="relative">
                                <h3 className="text-base sm:text-lg font-bold uppercase border-b border-gray-300 mb-2 sm:mb-3 flex justify-between">
                                    {section.title}
                                    {showHeatmap && <span className="text-[10px] text-red-500 font-mono">KEYWORD DENSITY: {Math.max(10, Math.floor(section.heat / 10))}%</span>}
                                </h3>
                                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-justify opacity-90">{section.content}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
