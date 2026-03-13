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

export const useWallpaperStore = create<WallpaperStore>()(
  persist(
    (set, get) => ({
      config: {
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
        preset: 'full' as const,
      },
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
      version: 1,
      migrate: (persisted: any, version: number) => {
        if (version === 0 || !version) {
          const state = persisted as { config?: any };
          const config = state.config || {};
          return {
            ...state,
            config: {
              enabled: config.enabled ?? true,
              dotSize: config.dotSize ?? 6,
              spacing: config.spacing ?? 14,
              opacity: config.opacity ?? 1,
              showQuote: config.showQuote ?? true,
              showDayCount: config.showDayCount ?? true,
              showStreak: config.showStreak ?? true,
              cols: config.cols ?? 25,
              goalTitle: config.goalTitle ?? '20',
              goalDate: config.goalDate ?? '2028-01-12',
              showDaysLeft: config.showDaysLeft ?? true,
              wallpaperEnabled: config.wallpaperEnabled ?? false,
              lastWallpaperDate: config.lastWallpaperDate ?? null,
              preset: config.preset ?? 'full',
            },
          };
        }
        return persisted as WallpaperStore;
      },
    }
  )
);
