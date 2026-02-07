import { create } from 'zustand';

interface SimulationState {
    // 1. Migration Readiness
    migration: {
        ieltsScore: number; // 0-9
        educationLevel: number; // 1-5 (Levels)
        gapYears: number; // 0-10
    };
    setMigration: (data: Partial<SimulationState['migration']>) => void;

    // 2. Data Center Salary Projector
    salary: {
        currentSkillLevel: number; // 1-5 (Novice to Expert)
        certificationLevel: number; // 1-5
    };
    setSalary: (data: Partial<SimulationState['salary']>) => void;

    // 3. Workforce ROI
    roi: {
        staffCount: number;
        turnoverRate: number; // %
    };
    setRoi: (data: Partial<SimulationState['roi']>) => void;

    // 4. Innovation Score
    innovation: {
        marketSize: number; // 1-10 scale
        feasibility: number; // 1-10 scale
    };
    setInnovation: (data: Partial<SimulationState['innovation']>) => void;

    // 5. Future Design (Algorithmic Career Mapping)
    futureDesign: {
        role: string;
        country: string;
        currentEducation: string;
    };
    setFutureDesign: (data: Partial<SimulationState['futureDesign']>) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
    migration: { ieltsScore: 6.0, educationLevel: 3, gapYears: 1 },
    setMigration: (data) => set((state) => ({ migration: { ...state.migration, ...data } })),

    salary: { currentSkillLevel: 1, certificationLevel: 1 },
    setSalary: (data) => set((state) => ({ salary: { ...state.salary, ...data } })),

    roi: { staffCount: 50, turnoverRate: 20 },
    setRoi: (data) => set((state) => ({ roi: { ...state.roi, ...data } })),

    innovation: { marketSize: 5, feasibility: 5 },
    setInnovation: (data) => set((state) => ({ innovation: { ...state.innovation, ...data } })),

    futureDesign: { role: 'Software Engineer', country: 'USA', currentEducation: 'High School' },
    setFutureDesign: (data) => set((state) => ({ futureDesign: { ...state.futureDesign, ...data } })),
}));
