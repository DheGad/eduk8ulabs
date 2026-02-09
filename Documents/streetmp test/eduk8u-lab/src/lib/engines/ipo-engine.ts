import { HumanIPOProfile } from "@/lib/types";

/**
 * Calculates the Human IPO Score based strictly on inputs.
 * NO HALLUCINATIONS: If data is missing (incomplete resume/profile), score is 0.
 */
export function calculateIPOScore(profile: HumanIPOProfile): number {
    // 0. Zero Hallucination Gate
    // If resume is not at least partially complete, you get a 0.
    const filledSections = Object.values(profile.resume.sections).filter(Boolean).length;
    if (filledSections < 3) {
        return 0;
    }

    let score = 0;

    // 1. Resume Completeness (Max 30 pts)
    // weighted by completeness %
    score += (profile.resume.completeness / 100) * 30;

    // 2. Education Level (Max 20 pts)
    // NQF 1-10. 10 = PhD (20pts). 7 = Bachelor (14pts).
    score += Math.min(profile.resume.educationLevelNQF * 2, 20);

    // 3. Experience (Max 20 pts)
    // 1 year = 2pts. Cap at 10 years (20pts).
    // Use the greater of resume derived OR slider override (if user is projecting).
    const years = Math.max(profile.resume.totalExperienceYears, profile.sliders.experience || 0);
    score += Math.min(years * 2, 20);

    // 4. Evidence (Max 10 pts)
    // Verified project = 3pts. Certification = 1pt.
    const evidenceScore = (profile.evidence.verifiedProjects * 3) + profile.evidence.certifications;
    score += Math.min(evidenceScore, 10);

    // 5. Market Factors (Max 10 pts)
    // (Scarcity + Demand) / 2 * 10
    const marketVal = (profile.market.skillScarcity + profile.market.demandFactor) / 2;
    score += marketVal * 10;

    // 6. Sliders / Behavioral (Max 10 pts)
    // Risk, Migration, Mobility, etc.
    let behavioralScore = 0;

    // Risk Tolerance (1-10): High risk = higher IPO potential (but higher volatility)
    behavioralScore += (profile.sliders.riskTolerance / 10) * 3;

    // Migration Intent (0-100): Willingness to move = larger market access
    behavioralScore += (profile.sliders.migrationIntent / 100) * 3;

    // Global Nomad / Geo Flexibility
    behavioralScore += (profile.sliders.geographicFlexibility / 100) * 2;

    // Industry Mobility
    behavioralScore += (profile.sliders.industryMobility / 100) * 2;

    score += Math.min(behavioralScore, 10);

    return Math.min(Math.round(score * 10) / 10, 100);
}

export function getCapitalValue(score: number): number {
    // 0 score = $0 value
    if (score === 0) return 0;

    // Base valuation logic: Score * Multiplier
    // e.g. Score 50 -> $2.5M
    // Non-linear scaling for high scores (Star talent premium)
    let value = (score / 100) * 5;

    if (score > 80) {
        value *= 1.2; // 20% premium for top tier
    }
    if (score > 90) {
        value *= 1.5; // 50% premium for elite
    }

    return parseFloat(value.toFixed(2));
}
