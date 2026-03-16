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
  wallpaperStyle: 'minimal',
  startDate: '2026-03-10',
  headingMode: 'remaining_first',
  wallpaperAutoUpdate: false,
  cachedWallpaperPath: null,
  topPadding: 60,
  bottomPadding: 210,
  sidePadding: 16,
  gridPosition: 'center',
  glowIntensity: 1,
  todayGlowSize: 2.8,
  todayMarkerStyle: 'glow',
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
      version: 7,
      migrate: (persisted: any, version: number) => {
        try {
          const state = (persisted || {}) as { config?: any };
          const config = (state.config && typeof state.config === 'object') ? state.config : {};
          return {
            ...state,
            config: {
              ...DEFAULT_CONFIG,
              ...config,
              colorTheme: config.colorTheme ?? 'classic',
              customQuote: typeof config.customQuote === 'string' ? config.customQuote : '',
              preset: config.preset ?? 'full',
              wallpaperStyle: config.wallpaperStyle ?? 'minimal',
              startDate: config.startDate ?? '2026-03-10',
              headingMode: config.headingMode ?? 'remaining_first',
              wallpaperAutoUpdate: config.wallpaperAutoUpdate ?? false,
              cachedWallpaperPath: config.cachedWallpaperPath ?? null,
              topPadding: config.topPadding ?? 60,
              bottomPadding: config.bottomPadding ?? 210,
              sidePadding: config.sidePadding ?? 16,
              gridPosition: config.gridPosition ?? 'center',
              glowIntensity: config.glowIntensity ?? 1,
              todayGlowSize: config.todayGlowSize ?? 2.8,
              todayMarkerStyle: config.todayMarkerStyle ?? 'glow',
            },
          };
        } catch {
          return { config: { ...DEFAULT_CONFIG } };
        }
      },
    }
  )
);
