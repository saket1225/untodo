import { Platform } from 'react-native';

let WallpaperSetterModule: any = null;
if (Platform.OS === 'android') {
  const { requireNativeModule } = require('expo-modules-core');
  WallpaperSetterModule = requireNativeModule('WallpaperSetter');
}

// Flags match Android WallpaperManager constants
export const FLAG_SYSTEM = 1; // Home screen
export const FLAG_LOCK = 2;   // Lock screen
export const FLAG_BOTH = 3;   // Both screens (FLAG_SYSTEM | FLAG_LOCK)

export async function setWallpaper(imageUri: string, flags: number = FLAG_BOTH): Promise<boolean> {
  if (Platform.OS !== 'android' || !WallpaperSetterModule) {
    return false;
  }
  return await WallpaperSetterModule.setWallpaper(imageUri, flags);
}
