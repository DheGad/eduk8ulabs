"use client";

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { useEffect } from "react";

export default function LiquidBackground() {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };

        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [mouseX, mouseY]);

    // Gradient orbs following mouse
    const background = useMotionTemplate`
    radial-gradient(
      600px circle at ${mouseX}px ${mouseY}px,
      rgba(29, 78, 216, 0.15),
      transparent 80%
    )
  `;

    return (
        <div className="fixed inset-0 -z-10 h-full w-full overflow-hidden bg-[#0F1115] bg-noise">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#0F1115] to-[#0F1115]" />

            {/* Ecosystem Background Asset */}
            <div
                className="absolute inset-0 opacity-40 mix-blend-screen bg-cover bg-center transition-opacity duration-1000"
                style={{ backgroundImage: 'url(/assets/background.png)' }}
            />

            {/* Interactive mouse follower */}
            <motion.div
                className="absolute inset-0 opacity-50"
                style={{
                    background: background,
                }}
            />

            {/* Decorative floating orbs */}
            <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[100px] animate-pulse delimiter-slow" />
        </div>
    );
}
