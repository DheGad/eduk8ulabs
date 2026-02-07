"use client";

import { motion } from "framer-motion";
import MigrationReadiness from "./calculators/MigrationReadiness";
import DataCenterSalary from "./calculators/DataCenterSalary";
import WorkforceROI from "./calculators/WorkforceROI";
import InnovationScore from "./calculators/InnovationScore";
import FutureDesign from "./calculators/FutureDesign";

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.5,
            ease: "easeOut"
        }
    })
};

export default function ToolGrid() {
    return (
        <div className="container mx-auto px-4 py-8 relative">
            <h2 className="text-3xl font-bold text-white mb-8 text-center text-glow">Dr. Roy&apos;s Future Tools</h2>

            <motion.div
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {/* 1. Migration Readiness */}
                <motion.div
                    custom={0}
                    variants={cardVariants as any}
                    className="glass-card rounded-3xl overflow-hidden hover:border-white/20 transition-colors h-[420px]"
                >
                    <MigrationReadiness />
                </motion.div>

                {/* 2. Future Design (New) - Center Feature */}
                <motion.div
                    custom={1}
                    variants={cardVariants as any}
                    className="glass-card rounded-3xl overflow-hidden hover:border-white/20 transition-colors h-[420px] lg:col-span-1 border-indigo-500/30"
                >
                    <FutureDesign />
                </motion.div>

                {/* 3. Data Center Salary */}
                <motion.div
                    custom={2}
                    variants={cardVariants as any}
                    className="glass-card rounded-3xl overflow-hidden hover:border-white/20 transition-colors h-[420px]"
                >
                    <DataCenterSalary />
                </motion.div>

                {/* 4. Workforce ROI */}
                <motion.div
                    custom={3}
                    variants={cardVariants as any}
                    className="glass-card rounded-3xl overflow-hidden hover:border-white/20 transition-colors h-[350px] md:col-span-1 lg:col-span-2 xl:col-span-1"
                >
                    <WorkforceROI />
                </motion.div>

                {/* 5. Innovation Score */}
                <motion.div
                    custom={4}
                    variants={cardVariants as any}
                    className="glass-card rounded-3xl overflow-hidden hover:border-white/20 transition-colors h-[350px] md:col-span-1 lg:col-span-1 xl:col-span-2"
                >
                    <InnovationScore />
                </motion.div>

            </motion.div>
        </div>
    );
}
