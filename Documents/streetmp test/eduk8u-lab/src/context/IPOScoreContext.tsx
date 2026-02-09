"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type IPOScoreContextType = {
    score: number;
    updateScore: (amount: number) => void;
    setScore: (score: number) => void;
    capitalValue: number; // in Millions
};

const IPOScoreContext = createContext<IPOScoreContextType | undefined>(undefined);

export function IPOScoreProvider({ children }: { children: React.ReactNode }) {
    const [score, setScoreState] = useState(0);

    // Initialize with animation
    useEffect(() => {
        // Simulate initial load calculation
        const timer = setTimeout(() => {
            setScoreState(42); // Seed score
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Derived state, no need for effect
    const capitalValue = parseFloat(((score / 100) * 5).toFixed(2));

    const updateScore = (amount: number) => {
        setScoreState((prev) => Math.min(100, Math.max(0, prev + amount)));
    };

    const setScore = (val: number) => {
        setScoreState(Math.min(100, Math.max(0, val)));
    };

    return (
        <IPOScoreContext.Provider value={{ score, updateScore, setScore, capitalValue }}>
            {children}
        </IPOScoreContext.Provider>
    );
}

export function useIPOScore() {
    const context = useContext(IPOScoreContext);
    if (context === undefined) {
        throw new Error('useIPOScore must be used within an IPOScoreProvider');
    }
    return context;
}
