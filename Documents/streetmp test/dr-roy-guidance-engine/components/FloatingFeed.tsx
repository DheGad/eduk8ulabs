"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { client, insightsQuery } from "@/lib/sanity";

export default function FloatingFeed() {
    const [insights, setInsights] = useState<any[]>([]);

    useEffect(() => {
        // Fetch insights using the stub client
        client.fetch(insightsQuery).then((data) => setInsights(data));
    }, []);

    return (
        <div className="absolute top-20 right-0 w-[300px] h-[60px] overflow-hidden pointer-events-none z-20">
            <motion.div
                animate={{ x: [300, -600] }}
                transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                className="flex space-x-8 whitespace-nowrap"
            >
                {insights.map((insight) => (
                    <div
                        key={insight._id}
                        className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-xs text-blue-200"
                    >
                        {insight.title}
                    </div>
                ))}
                {/* Duplicate for seamless loop effect (basic implementation) */}
                {insights.map((insight) => (
                    <div
                        key={`${insight._id}-dup`}
                        className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-xs text-blue-200"
                    >
                        {insight.title}
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
