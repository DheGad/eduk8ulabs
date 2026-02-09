"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface HapticSliderProps {
    label: string;
    min: number;
    max: number;
    step?: number;
    defaultValue?: number;
    onChange: (value: number) => void;
    unit?: string;
}

export const HapticSlider = ({ label, min, max, step = 1, defaultValue, onChange, unit = "" }: HapticSliderProps) => {
    const [value, setValue] = useState(defaultValue || min);

    return (
        <div className="w-full space-y-2 group">
            <div className="flex justify-between text-sm font-medium text-gray-300">
                <span>{label}</span>
                <span className="text-accent-glow font-mono font-bold">{value}{unit}</span>
            </div>
            <div className="relative h-6 w-full flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        setValue(val);
                        onChange(val);
                        if (navigator.vibrate) navigator.vibrate(5);
                    }}
                    className="w-full absolute z-20 opacity-0 cursor-pointer h-full"
                />
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden absolute z-10">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 to-accent-glow shadow-[0_0_15px_rgba(0,255,157,0.5)]"
                        style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                        layoutId={`slider-fill-${label}`}
                    />
                </div>
                <motion.div
                    className="h-6 w-6 bg-white rounded-full shadow-lg absolute z-10 pointer-events-none border-2 border-accent-glow"
                    style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 12px)` }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.2 }}
                />
            </div>
        </div>
    );
};
