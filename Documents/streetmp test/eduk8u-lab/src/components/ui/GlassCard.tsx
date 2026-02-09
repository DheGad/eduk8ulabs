"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard = ({ children, className, hoverEffect = true, ...props }: GlassCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={hoverEffect ? { scale: 1.02, y: -5 } : {}}
            className={cn(
                "glass-card p-6 relative overflow-hidden group",
                "border border-white/10 shadow-lg backdrop-blur-xl bg-white/5",
                className
            )}
            {...new Object(props)} // Explicit cast to avoid type issues with motion.div vs HTMLDivElement attributes if not careful, but framer usually works fine.
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="relative z-10">{children}</div>
        </motion.div>
    );
};
