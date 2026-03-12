import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WallpaperConfig } from './types';

interface WallpaperStore {
  config: WallpaperConfig;
  updateConfig: (updates: Partial<WallpaperConfig>) => void;
}

export const useWallpaperStore = create<WallpaperStore>()(
  persist(
    (set) => ({
      config: {
        enabled: true,
        dotSize: 6,
        spacing: 14,
        opacity: 1,
        showQuote: true,
        showDayCount: true,
        showStreak: true,
        cols: 25,
      },
      updateConfig: (updates) => set((s) => ({ config: { ...s.config, ...updates } })),
    }),
    {
      name: 'untodo-wallpaper',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
