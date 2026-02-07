import { create } from 'zustand';

type ViewState = 'hero' | 'grid' | 'insights' | 'contact' | 'report-preview' | 'lab';

interface UIState {
    currentView: ViewState;
    setCurrentView: (view: ViewState) => void;
    isMenuOpen: boolean;
    toggleMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    currentView: 'hero',
    setCurrentView: (view) => set({ currentView: view }),
    isMenuOpen: false,
    toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
}));
