import { requireNativeModule } from 'expo-modules-core';

const WallpaperSetterModule = requireNativeModule('WallpaperSetter');

// Flags match Android WallpaperManager constants
export const FLAG_SYSTEM = 1; // Home screen
export const FLAG_LOCK = 2;   // Lock screen
export const FLAG_BOTH = 3;   // Both screens (FLAG_SYSTEM | FLAG_LOCK)

export async function setWallpaper(imageUri: string, flags: number = FLAG_BOTH): Promise<boolean> {
  return await WallpaperSetterModule.setWallpaper(imageUri, flags);
}
