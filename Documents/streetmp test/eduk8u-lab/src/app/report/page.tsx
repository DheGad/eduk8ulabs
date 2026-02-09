"use client";

import { GlowingButton } from "@/components/ui/GlowingButton";
import { Download, FileText, Printer, CheckCircle } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function ReportPage() {
    const { profile, ipoScore, capitalValue } = useSimulation();

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen pt-24 px-6 pb-12 max-w-5xl mx-auto space-y-8 print:pt-0 print:px-0 print:bg-white print:text-black">
            <div className="flex justify-between items-center print:hidden">
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <FileText className="text-accent-glow" /> Valuation Report
                </h1>
                <div className="flex gap-3">
                    <GlowingButton variant="secondary" onClick={handlePrint}>
                        <Printer size={16} className="mr-2" /> Print
                    </GlowingButton>
                    <GlowingButton variant="primary" onClick={handlePrint}>
                        <Download size={16} className="mr-2" /> Download PDF
                    </GlowingButton>
                </div>
            </div>

            <div className="bg-white text-black p-12 rounded-lg shadow-2xl print:shadow-none print:p-0 min-h-[800px] flex flex-col">
                {/* Report Header */}
                <div className="border-b-4 border-black pb-8 mb-8 flex justify-between items-start">
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight">Human Capital Valuation</h2>
                        <p className="text-gray-500 uppercase tracking-widest font-mono text-sm">Strictly Confidential • Authorized by Eduk8u Lab</p>
                    </div>
                    <div className="text-right">
                        <div className="inline-block bg-black text-white px-3 py-1 text-xs font-bold uppercase mb-2">Verified</div>
                        <h3 className="text-3xl font-bold text-emerald-600">IPO Score: {ipoScore.toFixed(1)}</h3>
                        <p className="text-sm text-gray-500 font-mono">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Executive Summary */}
                <div className="mb-12 bg-gray-50 p-6 border-l-4 border-emerald-500">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Executive Summary</h3>
                    <p className="text-gray-800 leading-relaxed text-lg font-medium">
                        Based on the analysis of verified skills, career trajectory, and market demand, <span className="font-bold underline"> {profile.name || "The Candidate"} </span> demonstrates a strong potential for capital appreciation.
                        Current market valuation stands at <span className="font-bold text-emerald-600">${capitalValue}M</span> with a projected positive CAGR over the next 5 years.
                        The candidate is currently rated as <span className="font-bold">{ipoScore > 80 ? 'Grade A (Investment Grade)' : ipoScore > 50 ? 'Grade B (Growth)' : 'Grade C (High Rating)'}</span>.
                    </p>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-3 gap-8 mb-12">
                    <div className="bg-gray-100 p-6 rounded-none border border-gray-200 text-center">
                        <span className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Market Cap</span>
                        <span className="block text-4xl font-black text-gray-900">${capitalValue}M</span>
                    </div>
                    <div className="bg-gray-100 p-6 rounded-none border border-gray-200 text-center">
                        <span className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Risk Rating</span>
                        <span className="block text-4xl font-black text-gray-900">{ipoScore > 80 ? 'LOW' : ipoScore > 50 ? 'MED' : 'HIGH'}</span>
                    </div>
                    <div className="bg-gray-100 p-6 rounded-none border border-gray-200 text-center">
                        <span className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Verified Proof</span>
                        <span className="block text-4xl font-black text-gray-900">{profile.evidence.verifiedProjects} <span className="text-sm text-gray-400 font-normal">Items</span></span>
                    </div>
                </div>

                {/* Valuation Factors */}
                <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                        <h3 className="text-lg font-bold uppercase border-b-2 border-gray-200 pb-2 mb-4">Strength Factors</h3>
                        <ul className="space-y-3">
                            <li className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                <span className="text-gray-600">Experience Alpha</span>
                                <span className="font-bold">{profile.resume.totalExperienceYears} Years</span>
                            </li>
                            <li className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                <span className="text-gray-600">Education Level</span>
                                <span className="font-bold">NQF {profile.resume.educationLevelNQF}</span>
                            </li>
                            <li className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                <span className="text-gray-600">Migration Intent</span>
                                <span className="font-bold">{profile.sliders.migrationIntent}%</span>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold uppercase border-b-2 border-gray-200 pb-2 mb-4">Risk Factors</h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            Risk tolerance is self-assessed at <span className="font-bold">{profile.sliders.riskTolerance}/10</span>.
                            Regulatory alignment requires ongoing monitoring.
                        </p>
                        <div className="bg-gray-100 p-4 text-xs text-gray-500 italic">
                            *Valuation is subject to market volatility and accuracy of provided data.
                        </div>
                    </div>
                </div>

                {/* Verification Factors */}
                <div className="mt-auto border-t-4 border-black pt-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Verification Standards</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            "Identity Verification",
                            "Academic Credentials",
                            "Professional History",
                            "Skill Assessment",
                            "Market Demand Analysis",
                            "Background Check"
                        ].map((factor) => (
                            <div key={factor} className="flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500" />
                                <span className="text-gray-700 font-medium text-xs uppercase">{factor}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
