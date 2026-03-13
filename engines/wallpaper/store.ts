import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WallpaperConfig } from './types';
import { useUserStore } from '../user/store';
import { syncWallpaperConfigToFirestore } from '../../lib/firebase-sync';

interface WallpaperStore {
  config: WallpaperConfig;
  updateConfig: (updates: Partial<WallpaperConfig>) => void;
}

const DEFAULT_CONFIG: WallpaperConfig = {
  enabled: true,
  dotSize: 6,
  spacing: 14,
  opacity: 1,
  showQuote: true,
  showDayCount: true,
  showStreak: true,
  cols: 25,
  goalTitle: '20',
  goalDate: '2028-01-12',
  showDaysLeft: true,
  wallpaperEnabled: false,
  lastWallpaperDate: null,
  preset: 'full',
  colorTheme: 'classic',
  customQuote: '',
};

export const useWallpaperStore = create<WallpaperStore>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      updateConfig: (updates) => {
        set((s) => ({ config: { ...s.config, ...updates } }));
        const username = useUserStore.getState().username;
        if (username) {
          syncWallpaperConfigToFirestore(username, get().config).catch(() => {});
        }
      },
    }),
    {
      name: 'untodo-wallpaper',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted: any, version: number) => {
        const state = persisted as { config?: any };
        const config = state.config || {};
        return {
          ...state,
          config: {
            ...DEFAULT_CONFIG,
            ...config,
            colorTheme: config.colorTheme ?? 'classic',
            customQuote: config.customQuote ?? '',
            preset: config.preset ?? 'full',
          },
        };
      },
    }
  )
);
