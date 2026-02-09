"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateIPOScore, getCapitalValue } from '@/lib/engines/ipo-engine';
import { HumanIPOProfile } from '@/lib/types';

const defaultHumanIPOProfile: HumanIPOProfile = {
    name: "Guest User",
    role: "Student",
    avatarUrl: "",
    resume: {
        completeness: 0,
        sections: {
            summary: false,
            experience: false,
            education: false,
            skills: false,
            projects: false,
        },
        totalExperienceYears: 0,
        educationLevelNQF: 0, // 0 = Incomplete
    },
    evidence: {
        verifiedProjects: 0,
        certifications: 0,
        recommendations: 0,
    },
    market: {
        skillScarcity: 0.5,
        demandFactor: 0.5,
    },
    sliders: {
        experience: 0,
        educationLevel: 0,
        migrationIntent: 20, // Default low
        riskTolerance: 3, // Default conservative
        targetIncome: 50000,
        timeHorizon: 10,
        geographicFlexibility: 20,
        industryMobility: 20,
        lifestyleBalance: 50,
        globalNomad: 10,
    }
};

interface SimulationContextType {
    profile: HumanIPOProfile;
    ipoScore: number;
    capitalValue: number;
    apiKey: string | null;
    isSystemOnline: boolean;
    setApiKey: (key: string) => void;
    updateSlider: (key: keyof HumanIPOProfile['sliders'], value: number) => void;
    updateProfile: (data: Partial<HumanIPOProfile>) => void;
    updateResumeData: (data: Partial<HumanIPOProfile['resume']>) => void;
    updateEvidenceData: (data: Partial<HumanIPOProfile['evidence']>) => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<HumanIPOProfile>(defaultHumanIPOProfile);
    const [apiKey, setApiKeyState] = useState<string | null>(null);
    const [isSystemOnline, setIsSystemOnline] = useState(false);

    // Load state from localStorage on mount
    useEffect(() => {
        const storedKey = localStorage.getItem('eduk8u_api_key');
        if (storedKey) {
            setApiKeyState(storedKey);
            setIsSystemOnline(true);
        }

        const storedProfile = localStorage.getItem('eduk8u_profile');
        if (storedProfile) {
            try {
                setProfile(JSON.parse(storedProfile));
            } catch (e) {
                console.error("Failed to load profile", e);
            }
        }
    }, []);

    // Save profile on change
    useEffect(() => {
        localStorage.setItem('eduk8u_profile', JSON.stringify(profile));
    }, [profile]);

    const setApiKey = (key: string) => {
        // Basic validation
        if (key.length > 5) {
            localStorage.setItem('eduk8u_api_key', key);
            setApiKeyState(key);
            setIsSystemOnline(true);
        }
    };

    const { ipoScore, capitalValue } = React.useMemo(() => {
        if (!isSystemOnline) return { ipoScore: 0, capitalValue: 0 };
        const score = calculateIPOScore(profile);
        const value = getCapitalValue(score);
        return { ipoScore: score, capitalValue: value };
    }, [profile, isSystemOnline]);

    const updateSlider = React.useCallback((key: keyof HumanIPOProfile['sliders'], value: number) => {
        setProfile(prev => ({
            ...prev,
            sliders: {
                ...prev.sliders,
                [key]: value
            }
        }));
    }, []);

    const updateProfile = React.useCallback((data: Partial<HumanIPOProfile>) => {
        setProfile(prev => ({ ...prev, ...data }));
    }, []);

    const updateResumeData = React.useCallback((data: Partial<HumanIPOProfile['resume']>) => {
        setProfile(prev => ({
            ...prev,
            resume: { ...prev.resume, ...data }
        }));
    }, []);

    const updateEvidenceData = React.useCallback((data: Partial<HumanIPOProfile['evidence']>) => {
        setProfile(prev => ({
            ...prev,
            evidence: { ...prev.evidence, ...data }
        }));
    }, []);

    const apiKeyValue = React.useMemo(() => ({
        profile,
        ipoScore,
        capitalValue,
        apiKey,
        isSystemOnline,
        setApiKey,
        updateSlider,
        updateProfile,
        updateResumeData,
        updateEvidenceData
    }), [profile, ipoScore, capitalValue, apiKey, isSystemOnline, setApiKey, updateSlider, updateProfile, updateResumeData, updateEvidenceData]);

    return (
        <SimulationContext.Provider value={apiKeyValue}>
            {children}
        </SimulationContext.Provider>
    );
}

export function useSimulation() {
    const context = useContext(SimulationContext);
    if (context === undefined) {
        throw new Error('useSimulation must be used within a SimulationProvider');
    }
    return context;
}
