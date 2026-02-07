"use client";
import { useSimulationStore } from "@/store/simulationStore";
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Server, TrendingUp } from "lucide-react";

export default function DataCenterSalary() {
    const { salary, setSalary } = useSimulationStore();

    // Data Logic: Base $80k. Skill adds up to $50k. Cert adds multiplier.
    const baseCurve = [80, 85, 95, 110, 130];
    const skillBonus = salary.currentSkillLevel * 10;
    const certMultiplier = 1 + (salary.certificationLevel * 0.1);

    const data = baseCurve.map((base, index) => ({
        year: `Year ${index + 1}`,
        salary: Math.round((base + skillBonus) * certMultiplier),
        marketAvg: Math.round(base * 1.05) // Comparative line
    }));

    return (
        <div className="p-6 h-full flex flex-col relative bg-gradient-to-br from-blue-900/20 to-black/40">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Server className="text-blue-400" size={20} />
                        Data Center Salary Projector
                    </h3>
                    <p className="text-xs text-blue-200 uppercase tracking-widest pl-7">$13B Market Opportunity</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">${data[4].salary}k</div>
                    <div className="text-[10px] text-gray-400">Yr 5 Potential</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                    <label className="text-xs text-gray-400">Current Skill Level</label>
                    <select
                        className="w-full bg-transparent text-white text-sm font-bold focus:outline-none mt-1"
                        value={salary.currentSkillLevel}
                        onChange={(e) => setSalary({ currentSkillLevel: parseInt(e.target.value) })}
                    >
                        <option value={1} className="bg-slate-900">Novice</option>
                        <option value={2} className="bg-slate-900">Competent</option>
                        <option value={3} className="bg-slate-900">Proficient</option>
                        <option value={4} className="bg-slate-900">Expert</option>
                        <option value={5} className="bg-slate-900">Master</option>
                    </select>
                </div>

                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                    <label className="text-xs text-gray-400">Certification</label>
                    <select
                        className="w-full bg-transparent text-white text-sm font-bold focus:outline-none mt-1"
                        value={salary.certificationLevel}
                        onChange={(e) => setSalary({ certificationLevel: parseInt(e.target.value) })}
                    >
                        <option value={1} className="bg-slate-900">None</option>
                        <option value={2} className="bg-slate-900">Basic (CDCP)</option>
                        <option value={3} className="bg-slate-900">Pro (CDCS)</option>
                        <option value={4} className="bg-slate-900">Expert (CDCE)</option>
                        <option value={5} className="bg-slate-900">Uptime ATD</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 w-full min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorSalary" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="year" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}k`} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="salary" stroke="#60a5fa" strokeWidth={3} fillOpacity={1} fill="url(#colorSalary)" />
                        <Line type="monotone" dataKey="marketAvg" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 text-center">
                <p className="text-[10px] text-gray-500 flex items-center justify-center gap-2">
                    <TrendingUp size={12} />
                    Projected growth vs Market Average (Grey)
                </p>
            </div>
        </div>
    );
}
