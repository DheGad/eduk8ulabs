"use client";

import { motion } from "framer-motion";
import { CheckCircle, Clock, TrendingUp, Zap } from "lucide-react";

export const ActivityFeed = () => {
    const activities = [
        { id: 1, type: "score", title: "AI Assessment Complete", points: "+2.5", time: "2m ago" },
        { id: 2, type: "resume", title: "Resume Updated", points: "+5.0", time: "1h ago" },
        { id: 3, type: "portfolio", title: "Project Verified", points: "+10.0", time: "3h ago" },
        { id: 4, type: "market", title: "Investor Viewed Profile", points: "+0.5", time: "1d ago" },
    ];

    const getIcon = (type: string) => {
        switch (type) {
            case "score": return <Zap size={16} className="text-indigo-400" />;
            case "resume": return <CheckCircle size={16} className="text-blue-400" />;
            case "portfolio": return <TrendingUp size={16} className="text-purple-400" />;
            case "market": return <Clock size={16} className="text-green-400" />;
            default: return <Clock size={16} />;
        }
    };

    const getBg = (type: string) => {
        switch (type) {
            case "score": return "bg-indigo-500/20";
            case "resume": return "bg-blue-500/20";
            case "portfolio": return "bg-purple-500/20";
            case "market": return "bg-green-500/20";
            default: return "bg-gray-500/20";
        }
    };

    return (
        <div className="space-y-4">
            {activities.map((activity, index) => (
                <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 cursor-pointer group"
                >
                    <div className={`p-2 rounded-full ${getBg(activity.type)} group-hover:scale-110 transition-transform`}>
                        {getIcon(activity.type)}
                    </div>

                    <div className="flex-1">
                        <h4 className="text-sm font-medium text-white">{activity.title}</h4>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>

                    <div className="font-mono text-accent-glow font-bold text-sm">
                        {activity.points}
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
