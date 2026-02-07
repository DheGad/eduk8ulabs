"use client";

import { Award } from "lucide-react";

export default function Footer() {
    return (
        <footer className="w-full py-12 border-t border-white/5 bg-black/20 backdrop-blur-md">
            <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">

                <div className="text-center md:text-left">
                    <h4 className="text-white font-bold text-lg">Dr. Roy Prasad</h4>
                    <p className="text-sm text-gray-500">Architect of Human Capital</p>
                </div>

                <div className="flex flex-wrap gap-4 justify-center">
                    {[
                        "HRDC Certified Trainer",
                        "RCSA Member",
                        "MABC Member",
                        "SBAA Member"
                    ].map((badge, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
                            <Award size={14} className="text-blue-400" />
                            <span className="text-xs text-blue-100 font-mono tracking-wide">{badge}</span>
                        </div>
                    ))}
                </div>

                <div className="text-xs text-gray-600 font-mono">
                    © 2026 Guidance Engine. All Rights Reserved.
                </div>
            </div>
        </footer>
    );
}
