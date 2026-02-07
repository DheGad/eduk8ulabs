"use client";
import { motion } from "framer-motion";
import { ExternalLink, Database, Users, FileText } from "lucide-react";

const tiles = [
    {
        id: "attend-care",
        title: "Attend Care Pty Ltd (Aus)",
        desc: "Full Acquisition Completed 2025. Strengthening Regional Allied Healthcare.",
        icon: Users,
        color: "bg-blue-500",
        colSpan: "col-span-1 md:col-span-2",
        link: "https://www.eduk8u.com/" // User asked for this link for Transactional Engine, assuming relate context or generic
    },
    {
        id: "eduk8u",
        title: "EDUK8U",
        desc: "Upskilling for the $13B Data Center Rush. ISO 9001 Certified.",
        icon: Database,
        color: "bg-purple-500",
        colSpan: "col-span-1",
        link: "https://www.eduk8u.com/"
    },
    {
        id: "workready",
        title: "Workready Asia",
        desc: "Sourcing Talent for NDIS & Aged Care. Lic: VICLHL07926.",
        icon: Users,
        color: "bg-orange-500",
        colSpan: "col-span-1",
        link: "https://www.workreadyasia.com/"
    },
    {
        id: "patents",
        title: "The Transactional Engine",
        desc: "Patent NZ 560974. AI-Driven Labour Management System.",
        icon: FileText,
        color: "bg-emerald-500",
        colSpan: "col-span-1 md:col-span-2",
        link: "https://www.eduk8u.com/"
    },
];

export default function EcosystemGrid() {
    return (
        <section className="container mx-auto px-4 py-20">
            <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-white mb-12 text-center text-glow"
            >
                The Impact Ecosystem
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {tiles.map((tile, i) => (
                    <motion.div
                        key={tile.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`${tile.colSpan} glass-card rounded-3xl p-8 relative overflow-hidden group hover:bg-white/10 transition-colors duration-500 cursor-pointer`}
                        onClick={() => window.open(tile.link, '_blank')}
                    >
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className={`w-12 h-12 rounded-xl ${tile.color}/20 flex items-center justify-center mb-6 text-white`}>
                                    <tile.icon size={24} className="text-white" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">{tile.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{tile.desc}</p>
                            </div>

                            <div className="mt-8 flex items-center gap-2 text-sm text-white/50 group-hover:text-white transition-colors">
                                <span>Explore Entity</span>
                                <ExternalLink size={14} />
                            </div>
                        </div>

                        {/* Background Gradient */}
                        <div className={`absolute -right-10 -bottom-10 w-64 h-64 ${tile.color}/10 rounded-full blur-[80px] group-hover:${tile.color}/20 transition-all duration-700`} />
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
