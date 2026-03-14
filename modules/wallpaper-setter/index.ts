import { requireNativeModule } from 'expo-modules-core';

const WallpaperSetterModule = requireNativeModule('WallpaperSetter');

export async function setWallpaper(imageUri: string): Promise<boolean> {
  return await WallpaperSetterModule.setWallpaper(imageUri);
}
