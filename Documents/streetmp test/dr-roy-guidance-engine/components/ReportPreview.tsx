"use client";
import { useSimulationStore } from "@/store/simulationStore";
import { motion } from "framer-motion";
import { FileText, Download, TrendingUp, ShieldCheck, Globe, CheckCircle } from "lucide-react";

export default function ReportPreview() {
    const { migration, salary, roi, innovation, futureDesign } = useSimulationStore();

    const handleConfirmDownload = async () => {
        // Visual feedback
        const btn = document.getElementById('download-btn');
        if (btn) btn.innerText = "Generating...";

        // Dynamically import logic
        const { pdf } = await import('@react-pdf/renderer');
        const { PDFDocument } = await import('./layout/Dock');

        const blob = await pdf(
            <PDFDocument data={{ migration, salary, roi, innovation, futureDesign }} />
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Dr_Roy_Strategic_Report.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (btn) btn.innerText = "Download Complete";
        setTimeout(() => { if (btn) btn.innerText = "Download Full Report"; }, 2000);
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 flex justify-center overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl w-full glass-card p-8 rounded-3xl border border-white/10 relative"
            >
                <div className="absolute top-0 right-0 p-6 opacity-20">
                    <FileText size={120} />
                </div>

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold text-white mb-2">Executive Strategy Report</h2>
                    <p className="text-blue-300 mb-8">Preview of your generated workforce intelligence.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Migration Card */}
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Globe size={18} className="text-blue-400" /> Migration Readiness
                            </h3>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between"><span>IELTS Score:</span> <span className="text-white font-mono">{migration.ieltsScore}</span></div>
                                <div className="flex justify-between"><span>Education Level:</span> <span className="text-white font-mono">{migration.educationLevel}</span></div>
                                <div className="flex justify-between"><span>Technician Gap:</span> <span className="text-white font-mono">{migration.gapYears} Years</span></div>
                            </div>
                        </div>

                        {/* Salary Card */}
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={18} className="text-green-400" /> Salary Projection
                            </h3>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between"><span>Skill Level:</span> <span className="text-white font-mono">{salary.currentSkillLevel}/5</span></div>
                                <div className="flex justify-between"><span>Certification:</span> <span className="text-white font-mono">{salary.certificationLevel}/5</span></div>
                                <div className="flex justify-between"><span>Est. Growth:</span> <span className="text-green-400 font-bold">+{(salary.currentSkillLevel * 10 + salary.certificationLevel * 5)}%</span></div>
                            </div>
                        </div>

                        {/* ROI Card */}
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <ShieldCheck size={18} className="text-purple-400" /> Workforce ROI
                            </h3>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between"><span>Staff Count:</span> <span className="text-white font-mono">{roi.staffCount}</span></div>
                                <div className="flex justify-between"><span>Turnover Rate:</span> <span className="text-red-400 font-mono">{roi.turnoverRate}%</span></div>
                                <div className="text-xs text-purple-300 mt-2">Optimization Strategy Included</div>
                            </div>
                        </div>

                        {/* Future Design Card */}
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <CheckCircle size={18} className="text-orange-400" /> Future Design
                            </h3>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between"><span>Role:</span> <span className="text-white">{futureDesign.role}</span></div>
                                <div className="flex justify-between"><span>Target:</span> <span className="text-white">{futureDesign.country}</span></div>
                                <div className="flex justify-between"><span>Current:</span> <span className="text-white">{futureDesign.currentEducation}</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button
                            id="download-btn"
                            onClick={handleConfirmDownload}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/40 flex items-center gap-2"
                        >
                            <Download size={20} />
                            Download Full Report
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
