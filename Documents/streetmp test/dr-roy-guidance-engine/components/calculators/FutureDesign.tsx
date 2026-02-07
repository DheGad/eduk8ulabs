"use client";
import { useSimulationStore } from "@/store/simulationStore";
import { Globe, Briefcase, GraduationCap } from "lucide-react";

export default function FutureDesign() {
    const { futureDesign, setFutureDesign } = useSimulationStore();

    // Mock Logic for prototype
    const roles = ["Software Engineer", "Data Scientist", "Nurse", "Chef", "Construction Manager"];
    const countries = ["USA", "Australia", "UK", "Canada", "Germany"];
    const education = ["High School", "Diploma", "Bachelors", "Masters", "PhD"];

    // Dynamic Result Generation
    const getResult = () => {
        if (futureDesign.country === "Australia" && futureDesign.role === "Nurse") return { demand: "Critical", roi: "High", years: 2 };
        if (futureDesign.country === "USA" && futureDesign.role === "Software Engineer") return { demand: "Very High", roi: "Elite", years: 4 };
        return { demand: "High", roi: "Moderate", years: 3 };
    };

    const result = getResult();

    return (
        <div className="p-6 h-full flex flex-col relative bg-gradient-to-br from-indigo-900/20 to-black/40">
            <div className="relative z-10">
                <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <Globe className="text-indigo-400" size={20} />
                    Design Your Future
                </h3>
                <p className="text-xs text-indigo-200/70 mb-6 uppercase tracking-wider">Algorithmic Career Mapping™</p>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Briefcase size={10} /> Career Aspiration
                        </label>
                        <select
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            value={futureDesign.role}
                            onChange={(e) => setFutureDesign({ role: e.target.value })}
                        >
                            {roles.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Globe size={10} /> Target Country
                        </label>
                        <select
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            value={futureDesign.country}
                            onChange={(e) => setFutureDesign({ country: e.target.value })}
                        >
                            {countries.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <GraduationCap size={10} /> Current Education
                        </label>
                        <select
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            value={futureDesign.currentEducation}
                            onChange={(e) => setFutureDesign({ currentEducation: e.target.value })}
                        >
                            {education.map(e => <option key={e} value={e} className="bg-slate-900">{e}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 relative z-10">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Global Demand</div>
                        <div className="text-lg font-bold text-white flex items-center gap-2">
                            {result.demand}
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Human Capital ROI</div>
                        <div className="text-lg font-bold text-indigo-400">{result.roi}</div>
                    </div>
                </div>

                <div className="mt-4 bg-white/5 rounded-lg p-2 flex items-center justify-between text-xs text-gray-300">
                    <span>Estimated Path:</span>
                    <span className="font-bold text-white">{result.years} Years to {futureDesign.role}</span>
                </div>
            </div>
        </div>
    );
}
