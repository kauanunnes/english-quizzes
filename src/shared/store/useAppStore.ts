import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CefrLevel } from '@shared/types/quiz';

export const APP_STORE_KEY = 'st:storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export const DEFAULT_THEME: ThemePreference = 'dark';

// Código que a versão 1 deixava pré-preenchido no aparelho; a migração o remove
const LEGACY_DEFAULT_ACCESS_CODE = 'segunda-tela-2026';

export interface QuizAttempt {
  id: string;
  episodeKey: string;
  seriesId: number;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  date: string;
  level: CefrLevel;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
}

export interface AppState {
  // Settings
  level: CefrLevel;
  includeNeighborLevels: boolean;
  noSpoilerMode: boolean;
  theme: ThemePreference;
  ptExplanationDefault: boolean;
  keepScreenAwake: boolean;

  // Device & Auth
  deviceId: string;
  accessCode: string;

  // History & Recent Searches
  recentSearches: string[];
  attempts: QuizAttempt[];

  // Actions
  setLevel: (level: CefrLevel) => void;
  setIncludeNeighborLevels: (val: boolean) => void;
  setNoSpoilerMode: (val: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
  setPtExplanationDefault: (val: boolean) => void;
  setKeepScreenAwake: (val: boolean) => void;
  setAccessCode: (code: string) => void;
  addRecentSearch: (query: string) => void;
  saveAttempt: (attempt: Omit<QuizAttempt, 'id' | 'date'>) => void;
  clearHistory: () => void;
  resetAllData: () => void;
}

function newDeviceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}`;
}

function initialData() {
  return {
    level: 'B1' as CefrLevel,
    includeNeighborLevels: false,
    noSpoilerMode: true,
    theme: DEFAULT_THEME,
    ptExplanationDefault: true,
    keepScreenAwake: true,
    deviceId: newDeviceId(),
    accessCode: '',
    recentSearches: [] as string[],
    attempts: [] as QuizAttempt[],
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      setLevel: (level) => set({ level }),
      setIncludeNeighborLevels: (includeNeighborLevels) => set({ includeNeighborLevels }),
      setNoSpoilerMode: (noSpoilerMode) => set({ noSpoilerMode }),
      setTheme: (theme) => set({ theme }),
      setPtExplanationDefault: (ptExplanationDefault) => set({ ptExplanationDefault }),
      setKeepScreenAwake: (keepScreenAwake) => set({ keepScreenAwake }),
      setAccessCode: (accessCode) => set({ accessCode: accessCode.trim() }),

      addRecentSearch: (query) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const current = get().recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
        set({ recentSearches: [trimmed, ...current].slice(0, 8) });
      },

      saveAttempt: (attemptData) => {
        const attempt: QuizAttempt = {
          ...attemptData,
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          date: new Date().toISOString(),
        };
        const attempts = [attempt, ...get().attempts].slice(0, 500);
        set({ attempts });
      },

      clearHistory: () => set({ attempts: [], recentSearches: [] }),

      resetAllData: () => set(initialData()),
    }),
    {
      name: APP_STORE_KEY,
      version: 2,
      // O servidor não lê o localStorage: a reidratação acontece no cliente, depois da hidratação (PreferencesSync)
      skipHydration: true,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AppState>;
        if (version < 2 && state.accessCode === LEGACY_DEFAULT_ACCESS_CODE) {
          state.accessCode = '';
        }
        return state as AppState;
      },
    }
  )
);
