export interface HumanIPOProfile {
    name?: string;
    role?: 'Student' | 'Teacher' | 'Professional';
    avatarUrl?: string;
    resume: {
        completeness: number; // 0-100
        sections: {
            summary: boolean;
            experience: boolean;
            education: boolean;
            skills: boolean;
            projects: boolean;
        };
        totalExperienceYears: number; // calculated from resume data
        educationLevelNQF: number; // 1-10 (1=Cert, 7=Bach, 9=Masters, 10=PhD)
    };
    evidence: {
        verifiedProjects: number; // Count of verified projects
        certifications: number; // Count of active certs
        recommendations: number;
        publicPortfolioUrl?: string;
    };
    market: {
        skillScarcity: number; // 0-1 multiplier (derived from market data)
        demandFactor: number; // 0-1 multiplier (derived from market data)
    };
    sliders: {
        experience: number; // Years manual override
        educationLevel: number; // NQF manual override
        migrationIntent: number; // 0-100%
        riskTolerance: number; // 1-10
        targetIncome: number; // Annual in USD
        timeHorizon: number; // Years (2026-2035)
        geographicFlexibility: number; // 0-100%
        industryMobility: number; // 0-100%
        lifestyleBalance: number; // 0-100% (Income vs Life)
        globalNomad: number; // 0-100% (Remote readiness)
    };
}

export interface SimulationParams {
    currentAge: number;
    retirementAge: number;
    inflationRate: number;
}
