"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowingButton } from "@/components/ui/GlowingButton";
import { TrendingUp, Globe, Users, Briefcase, GraduationCap, ArrowRight, Zap, Target, DollarSign, X, Check, Brain, Calculator, Building, Scale, Plane, Shield, Anchor, Heart, Lock, Activity, FileText, Download, Share2 } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";
import { motion, AnimatePresence } from "framer-motion";

// Simulation Types
type SimulationType = 'career' | 'global' | 'workforce' | 'finance';
type HubMode = 'personal' | 'report';

interface SimulationCard {
    id: string;
    title: string;
    description: string;
    icon: any;
    type: SimulationType;
    baseValue: number;
    multiplier: number;
    calculatorType?: 'design_future' | 'workforce_roi' | 'simple';
    outcome?: string;
    delta?: string;
}

export default function SimulationHubPage() {
    const { ipoScore, capitalValue, profile } = useSimulation();
    const [activeMode, setActiveMode] = useState<HubMode>('personal');
    const [activeType, setActiveType] = useState<SimulationType | 'all'>('all');
    const [selectedSim, setSelectedSim] = useState<SimulationCard | null>(null);

    // Advanced Calculator States (Design Your Future)
    const [currentRole, setCurrentRole] = useState(profile.role === "Student" ? "Undergraduate" : "Junior Associate");
    const [targetRole, setTargetRole] = useState("Chief Architect");
    const [yearsToGoal, setYearsToGoal] = useState(5);
    const [skillGap, setSkillGap] = useState(30);
    const [marketDemand, setMarketDemand] = useState(85);

    // Advanced Calculator States (Workforce ROI)
    const [educationCost, setEducationCost] = useState(25000);
    const [expectedSalary, setExpectedSalary] = useState(85000);
    const [retentionRate, setRetentionRate] = useState(3); // Years
    const [trainingCost, setTrainingCost] = useState(5000);

    const simulations: SimulationCard[] = [
        // Career
        { id: "c1", title: "Design Your Future", description: "Algorithmic Career Mapping™ centered on your skills.", icon: Target, type: "career", baseValue: 50000, multiplier: 1.5, calculatorType: 'design_future', outcome: "Career Map", delta: "+150%" },
        { id: "c2", title: "MBA / Masters ROI", description: "Projected valuation impact of advanced degrees.", icon: GraduationCap, type: "career", baseValue: 120000, multiplier: 1.2, calculatorType: 'simple', outcome: "+$1.2M LTV", delta: "+15%" },
        { id: "c3", title: "Micro-Credential Stack", description: "Value accumulation via rapid skill acquisition.", icon: Zap, type: "career", baseValue: 15000, multiplier: 1.1, calculatorType: 'simple', outcome: "+$400k LTV", delta: "+5%" },
        { id: "c4", title: "DBA / PhD Path", description: "Long-term academic capitalization model.", icon: Brain, type: "career", baseValue: 200000, multiplier: 1.4, calculatorType: 'simple', outcome: "+$2.5M LTV", delta: "+22%" },

        // Global
        { id: "g1", title: "WorkReady Migration", description: "Probability of successful visa sponsorship.", icon: Plane, type: "global", baseValue: 0, multiplier: 2.0, calculatorType: 'simple', outcome: "High Prob", delta: "+40%" },
        { id: "g2", title: "Global Nomad Visa", description: "Remote work capital efficiency index.", icon: Anchor, type: "global", baseValue: 0, multiplier: 1.3, calculatorType: 'simple', outcome: "Tax Opt", delta: "+12%" },
        { id: "g3", title: "Relocation Arbitrage", description: "Cost of living vs. Income optimization.", icon: DollarSign, type: "global", baseValue: 0, multiplier: 1.2, calculatorType: 'simple', outcome: "2.5x Mult", delta: "+150%" },

        // Workforce
        { id: "w1", title: "Workforce ROI", description: "The Transactional Engine™: Cost vs Outcome.", icon: Calculator, type: "workforce", baseValue: 0, multiplier: 1.0, calculatorType: 'workforce_roi', outcome: "ROI Calc", delta: "Dynamic" },
        { id: "w2", title: "Talent Bonds", description: "Employer-sponsored education agreements.", icon: Lock, type: "workforce", baseValue: 0, multiplier: 1.5, calculatorType: 'simple', outcome: "Bond Issued", delta: "+$50k" },
        { id: "w3", title: "ICQA Placement", description: "Industry Certified Quality Assurance role fit.", icon: Briefcase, type: "workforce", baseValue: 0, multiplier: 1.2, calculatorType: 'simple', outcome: "Placed", delta: "+18%" },
        { id: "w4", title: "Corporate Sponsorship", description: "Enterprise-backed human capital investment.", icon: Building, type: "workforce", baseValue: 0, multiplier: 1.8, calculatorType: 'simple', outcome: "Funded", delta: "+$60k" },

        // Finance
        { id: "f1", title: "Lifestyle Reverse", description: "Reverse engineer career from lifestyle goals.", icon: DollarSign, type: "finance", baseValue: 0, multiplier: 1.0, calculatorType: 'simple', outcome: "$120k Req", delta: "Gap -$20k" },
    ];

    const filteredSims = activeType === 'all' ? simulations : simulations.filter(s => s.type === activeType);

    // Derived Calculations for Modals (Advanced Logic)
    // Design Your Future Logic
    const careerGapScore = Math.max(0, 100 - (ipoScore * 0.8) - (skillGap * 0.5));
    const probabilitySuccess = Math.min(99, (ipoScore * 0.4) + (marketDemand * 0.4) + (100 - skillGap) * 0.2);

    // Workforce ROI Logic
    const projectedSalary = expectedSalary * (1 + (ipoScore / 100));
    const totalInvestment = educationCost + trainingCost;
    const totalReturn = (projectedSalary * retentionRate) - totalInvestment;
    const roiPercentage = (totalReturn / totalInvestment) * 100;
    const breakevenYears = totalInvestment / (projectedSalary - 40000); // Assuming 40k base living cost

    const handlePrintReport = () => {
        window.print();
    };

    const handleApplyToProfile = () => {
        // Mock application logic - update context
        if (selectedSim) {
            alert(`Applied ${selectedSim.title} to your profile! Valuation updated.`);
            setSelectedSim(null);
        }
    };

    return (
        <div className="min-h-screen pt-24 px-4 sm:px-6 pb-24 max-w-7xl mx-auto overflow-x-hidden">
            <style jsx global>{`
                @media print {
                    @page { size: auto; margin: 20mm; }
                    body { visibility: hidden; }
                    .print-section { visibility: visible; position: absolute; top: 0; left: 0; width: 100%; color: black !important; }
                    .print-section * { color: black !important; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Header & Mode Switcher */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 no-print">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center justify-center sm:justify-start gap-3">
                        <Brain className="text-indigo-400 hidden sm:block" /> Simulation Hub
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto sm:mx-0">
                        Run deterministic models to project your future capital value.
                    </p>
                </div>

                {/* Mode Toggles */}
                <div className="bg-white/5 p-1 rounded-xl flex self-center md:self-auto border border-white/10">
                    <button
                        onClick={() => setActiveMode('personal')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeMode === 'personal' ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <UserIcon /> Personal Sim
                    </button>
                    <button
                        onClick={() => setActiveMode('report')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeMode === 'report' ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <FileText size={16} /> Generate Report
                    </button>
                </div>
            </div>

            {activeMode === 'personal' ? (
                <>
                    {/* Filter Tabs - Mobile Optimized */}
                    <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:pb-0 hide-scrollbar mb-8 no-print">
                        <div className="flex gap-2 min-w-max">
                            <button onClick={() => setActiveType('all')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeType === 'all' ? 'bg-white text-black' : 'bg-white/5 text-gray-400'}`}>ALL MODULES</button>
                            <button onClick={() => setActiveType('career')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeType === 'career' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400'}`}>CAREER PATH</button>
                            <button onClick={() => setActiveType('global')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeType === 'global' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}`}>GLOBAL MOBILITY</button>
                            <button onClick={() => setActiveType('workforce')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeType === 'workforce' ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400'}`}>WORKFORCE ROI</button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 no-print">
                        {filteredSims.map((sim) => (
                            <GlassCard
                                key={sim.id}
                                className="cursor-pointer hover:border-accent-glow/50 transition-all active:scale-95 touch-manipulation group min-h-[160px] flex flex-col"
                                onClick={() => setSelectedSim(sim)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-xl bg-white/5 text-white group-hover:bg-accent-glow/20 group-hover:text-accent-glow transition-colors`}>
                                        <sim.icon size={24} />
                                    </div>
                                    <div className="text-[10px] font-bold tracking-wider text-gray-500 bg-black/20 px-2 py-1 rounded border border-white/5">
                                        {sim.type.toUpperCase()}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1 leading-tight group-hover:text-accent-glow transition-colors">{sim.title}</h3>
                                <p className="text-xs text-gray-400 line-clamp-2">{sim.description}</p>

                                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">{sim.outcome || 'Projected'}</span>
                                    <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                        {sim.delta}
                                    </span>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </>
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 print-section">
                    <GlassCard className="p-8 text-center space-y-6 border-2 border-white/10 print:border-black print:bg-white print:text-black">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto border border-indigo-500/40 print:hidden">
                            <FileText size={40} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2 print:text-black">Human Capital Valuation Report</h2>
                            <p className="text-gray-400 max-w-md mx-auto print:text-gray-600">
                                Official valuation report of Human IPO profile: <strong>{profile.name}</strong>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto bg-black/20 p-6 rounded-xl border border-white/5 print:bg-gray-100 print:border-gray-300">
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Current Valuation</div>
                                <div className="text-xl font-bold text-white print:text-black">${capitalValue.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Risk Score</div>
                                <div className="text-xl font-bold text-emerald-400 print:text-emerald-700">LOW ({(100 - ipoScore) / 10}/10)</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Growth Index</div>
                                <div className="text-xl font-bold text-indigo-400 print:text-indigo-700">AA+</div>
                            </div>
                        </div>

                        {/* Print Only Footer */}
                        <div className="hidden print:block text-xs text-center text-gray-400 pt-8 mt-8 border-t border-gray-300">
                            Generated by EDUK8U LAB • Powered by Algorithmic Career Mapping™ • {new Date().toLocaleDateString()}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 no-print">
                            <GlowingButton variant="primary" className="flex items-center gap-2" onClick={handlePrintReport}>
                                <Download size={18} /> Download / Print PDF
                            </GlowingButton>
                            <GlowingButton variant="secondary" className="flex items-center gap-2">
                                <Share2 size={18} /> Share with Employer
                            </GlowingButton>
                        </div>
                    </GlassCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
                        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Briefcase size={16} /> For Employers</h3>
                            <p className="text-sm text-gray-400 mb-4">Validate this candidate's ROI for specific roles. Unlock detailed "Workforce Transactional Engine" data.</p>
                            <button className="text-xs text-accent-glow font-bold uppercase tracking-widest hover:underline">View Employer Mode &rarr;</button>
                        </div>
                        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Building size={16} /> For Lenders</h3>
                            <p className="text-sm text-gray-400 mb-4">Assess credit-worthiness based on future earning potential (Human Capital LTV) rather than just credit score.</p>
                            <button className="text-xs text-accent-glow font-bold uppercase tracking-widest hover:underline">View Lender Mode &rarr;</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Modal */}
            <AnimatePresence>
                {selectedSim && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setSelectedSim(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative bg-gray-900 border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* ... Modal Header ... */}
                            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <selectedSim.icon className="text-accent-glow" />
                                        {selectedSim.title}
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1">{selectedSim.description}</p>
                                </div>
                                <button onClick={() => setSelectedSim(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                {selectedSim.calculatorType === 'design_future' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Current Role</label>
                                                <input type="text" value={currentRole} onChange={e => setCurrentRole(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Target Role / Goal</label>
                                                <input type="text" value={targetRole} onChange={e => setTargetRole(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Market Demand Index (0-100)</label>
                                                <input type="range" min="0" max="100" value={marketDemand} onChange={e => setMarketDemand(Number(e.target.value))} className="w-full accent-accent-glow" />
                                                <div className="flex justify-between text-xs text-gray-500"><span>Low</span><span>High ({marketDemand})</span></div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Est. Skill Gap (%)</label>
                                                <input type="number" min="0" max="100" value={skillGap} onChange={e => setSkillGap(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                                <Brain size={18} className="text-indigo-400" /> Algorithmic Analysis
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span>Success Probability</span>
                                                        <span className="font-mono font-bold text-emerald-400">{probabilitySuccess.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${probabilitySuccess}%` }} className={`h-full ${probabilitySuccess > 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-black/20 p-3 rounded-lg text-center">
                                                        <div className="text-[10px] text-gray-500 uppercase">Years to Goal</div>
                                                        <div className="text-xl font-bold text-white">{yearsToGoal} Yrs</div>
                                                    </div>
                                                    <div className="bg-black/20 p-3 rounded-lg text-center">
                                                        <div className="text-[10px] text-gray-500 uppercase">Input Required</div>
                                                        <div className="text-xl font-bold text-white">{skillGap > 40 ? 'High' : 'Moderate'}</div>
                                                    </div>
                                                </div>

                                                <p className="text-xs text-gray-400 italic">
                                                    "Based on your current IPO Score containing {profile.evidence.verifiedProjects} verified projects, you are positioned in the top {100 - ipoScore}% of candidates for {targetRole}."
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedSim.calculatorType === 'workforce_roi' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Cost of Education ($)</label>
                                                <input type="number" value={educationCost} onChange={e => setEducationCost(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                            {/* ... other inputs ... */}
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Addt. Training Cost ($)</label>
                                                <input type="number" value={trainingCost} onChange={e => setTrainingCost(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Exp. Annual Salary ($)</label>
                                                <input type="number" value={expectedSalary} onChange={e => setExpectedSalary(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 uppercase font-bold">Proj. Retention (Years)</label>
                                                <input type="number" value={retentionRate} onChange={e => setRetentionRate(Number(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-accent-glow outline-none" />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl p-5 border border-white/10">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Transactional Engine Results</h4>
                                            <div className="grid grid-cols-2 gap-6 text-center">
                                                <div>
                                                    <div className="text-xs text-gray-400 mb-1">Total ROI %</div>
                                                    <div className={`text-3xl font-bold ${roiPercentage > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roiPercentage.toFixed(0)}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-400 mb-1">Net Value Created</div>
                                                    <div className="text-3xl font-bold text-white">${totalReturn.toLocaleString()}</div>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5 text-center">
                                                <div className="text-xs text-gray-400 mb-1">Break-even Horizon</div>
                                                <div className="font-mono text-lg text-accent-glow">{breakevenYears.toFixed(1)} Years</div>
                                            </div>
                                        </div>

                                        <p className="text-xs text-center text-gray-500">
                                            *Includes User IPO Multiplier of <strong>{(1 + ipoScore / 100).toFixed(2)}x</strong> applied to output velocity.
                                        </p>
                                    </div>
                                )}

                                {selectedSim.calculatorType === 'simple' && (
                                    <div className="text-center py-10 space-y-6">
                                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                            <selectedSim.icon size={40} className="text-gray-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">Simulating Scenario...</h3>
                                            <p className="text-gray-400">Projecting impact on your current valuation of <span className="text-white font-mono">${capitalValue.toLocaleString()}</span>.</p>
                                        </div>
                                        <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-xl">
                                            <span className="block text-xs text-emerald-400 uppercase tracking-widest mb-1">Potential Uplift</span>
                                            <span className="text-3xl font-bold text-emerald-400">+${(selectedSim.baseValue * selectedSim.multiplier).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
                                <GlowingButton variant="primary" className="w-full flex justify-center items-center gap-2" onClick={handleApplyToProfile}>
                                    <Check size={18} /> Apply to Profile
                                </GlowingButton>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function UserIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    )
}
