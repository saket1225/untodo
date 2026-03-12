import { create } from 'zustand';
import { WallpaperConfig } from './types';

interface WallpaperStore {
  config: WallpaperConfig;
}

export const useWallpaperStore = create<WallpaperStore>(() => ({
  config: {
    style: 'dots',
    showTasks: false,
    showQuote: true,
  },
}));
