"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlowingButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
    variant?: "primary" | "secondary";
    gradient?: boolean;
    children: React.ReactNode;
}

export const GlowingButton = ({
    children,
    className,
    variant = "primary",
    gradient = false,
    ...props
}: GlowingButtonProps) => {
    return (
        <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(106, 90, 205, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            className={cn(
                "relative rounded-full px-8 py-3 font-semibold tracking-wide transition-all overflow-hidden",
                variant === "primary"
                    ? "bg-white/10 text-white border border-accent-glow/30 hover:border-accent-glow"
                    : "bg-transparent text-gray-300 border border-white/10 hover:bg-white/5",
                gradient && "bg-gradient-to-r from-indigo-500 to-purple-600 border-none",
                className
            )}
            {...props}
        >
            <span className="relative z-10 flex items-center gap-2">
                {children}
            </span>
            {variant === "primary" && (
                <div className="absolute inset-0 bg-accent-glow/20 blur-xl opacity-0 hover:opacity-100 transition-opacity duration-300" />
            )}
        </motion.button>
    );
};
