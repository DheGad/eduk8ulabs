import { HumanIPOProfile } from "@/lib/types";

export interface SimulationResult {
    year: number;
    [key: string]: number; // dynamic keys for different paths
}

export function simulateCareerPath(
    profile: HumanIPOProfile,
    years: number = 10
): SimulationResult[] {
    const data: SimulationResult[] = [];
    const baseSalary = 80000; // Starting baseline
    const currentGrowthRate = 0.03;

    for (let i = 0; i <= years; i++) {
        const year = 2026 + i;
        const yearData: SimulationResult = { year };

        // 1. Status Quo Path (3% growth)
        yearData["Status Quo"] = Math.round(baseSalary * Math.pow(1 + currentGrowthRate, i));

        // 2. EDUK8U MBA ROI (+20% after 1.5 years)
        const mbaBoost = i > 1 ? 1.2 : 1;
        yearData["EDUK8U MBA"] = Math.round(yearData["Status Quo"] * mbaBoost);

        // 3. WorkReady Migration (+200% bump if Intent > 80)
        // Requires migration intent > 80 to unlock fully
        const migrationChance = profile.sliders.migrationIntent / 100;
        const migrationBoost = i > 2 ? (1 + (2.0 * migrationChance)) : 1;
        yearData["Global Migration"] = Math.round(baseSalary * Math.pow(1.05, i) * migrationBoost);

        // 4. Micro-Credential Stack (+5% per cert, max 3)
        const certCount = Math.min(profile.evidence.certifications, 3);
        const certBoost = 1 + (certCount * 0.05);
        yearData["Skill Stack"] = Math.round(yearData["Status Quo"] * certBoost);

        // 5. ICQA Education (Baseline for Global)
        // If Education Level < 7, Global is capped
        if (profile.resume.educationLevelNQF < 7) {
            yearData["Global Migration"] = Math.round(yearData["Global Migration"] * 0.6);
        }

        // 6. Visa Probability Model (Probability * Value)
        // Visualized as a separate scale often, but here as 'Risk Adjusted Value'
        const visaProb = (profile.resume.educationLevelNQF * 10) + (profile.sliders.migrationIntent * 0.5); // Max 150-ish
        const visaProbNorm = Math.min(visaProb, 100) / 100;
        yearData["Visa Probability"] = Math.round(visaProbNorm * 100); // 0-100 scale

        // 7. Leadership Track (Experience > 5 years boosts growth to 8%)
        const leadershipGrowth = profile.resume.totalExperienceYears > 5 ? 0.08 : 0.04;
        yearData["Leadership Track"] = Math.round(baseSalary * Math.pow(1 + leadershipGrowth, i));

        // 8. Capital Growth (Aggregated Wealth) - Simple accumulation
        // Assuming 20% savings rate
        const savingsRate = 0.2;
        const prevCapital = i > 0 ? data[i - 1]["Net Worth"] : 0;
        yearData["Net Worth"] = Math.round(prevCapital + (yearData["Status Quo"] * savingsRate));

        data.push(yearData);
    }

    return data;
}

export const SIMULATION_COLORS = {
    "Status Quo": "#94a3b8", // Gray
    "EDUK8U MBA": "#fbbf24", // Amber
    "Global Migration": "#34d399", // Emerald
    "Skill Stack": "#a78bfa", // Purple
    "Visa Probability": "#f43f5e", // Rose (on separate axis usually)
    "Leadership Track": "#60a5fa", // Blue
};
