"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, Zap, LayoutGrid, FileText, Briefcase, Globe, TrendingUp, Printer } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { name: "Resume", href: "/resume", icon: FileText },
    { name: "Portfolio", href: "/portfolio", icon: Briefcase },
    { name: "Simulation", href: "/simulation", icon: TrendingUp },
    { name: "Marketplace", href: "/marketplace", icon: Globe },
    { name: "Report", href: "/report", icon: Printer },
];

export const Navbar = () => {
    const pathname = usePathname();
    const { ipoScore } = useSimulation();

    if (pathname === "/") return null; // Hide on Landing Page

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-md border-b border-white/5 flex items-center px-4 md:px-6 justify-between text-white">
            <div className="flex items-center gap-4 md:gap-8">
                <Link href="/dashboard" className="text-lg md:text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 shrink-0">
                    EDUK8U LAB
                </Link>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right pr-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href}>
                                <div className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg flex items-center gap-2 transition-colors shrink-0 ${isActive ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                                    <item.icon size={16} />
                                    <span className="text-xs md:text-sm font-medium hidden sm:block">{item.name}</span>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-6 shrink-0">
                {/* Global Search - Hidden on Mobile */}
                <div className="relative hidden lg:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm w-48 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                </div>

                {/* AI Status - Icon only on mobile */}
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-glow animate-pulse" />
                    <span className="text-xs text-accent-glow font-mono tracking-widest hidden md:block">AI ACTIVE</span>
                </div>

                {/* User Profile / IPO Widget */}
                <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-white/10">
                    <div className="flex flex-col items-end hidden md:flex">
                        <span className="text-xs text-gray-400">IPO SCORE</span>
                        <span className="font-mono font-bold text-accent-gold">{ipoScore.toFixed(1)}</span>
                    </div>
                    {/* Mobile Score */}
                    <div className="flex flex-col items-end md:hidden">
                        <span className="font-mono font-bold text-accent-gold text-sm">{ipoScore.toFixed(0)}</span>
                    </div>

                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center relative shadow-lg shadow-indigo-500/20">
                        <User size={16} className="text-white" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-blue-500 rounded-full flex items-center justify-center border border-background">
                            <Zap size={8} className="text-white fill-current" />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};
