import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system/legacy';
import { setWallpaper, FLAG_BOTH } from '../../modules/wallpaper-setter';
import { useWallpaperStore } from './store';
import { Platform } from 'react-native';

const WALLPAPER_UPDATE_TASK = 'WALLPAPER_DAILY_UPDATE';

// Define the background task
TaskManager.defineTask(WALLPAPER_UPDATE_TASK, async () => {
  try {
    const { config } = useWallpaperStore.getState();
    if (!config.wallpaperAutoUpdate) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const cachedPath = config.cachedWallpaperPath;
    if (cachedPath) {
      const fileInfo = await FileSystem.getInfoAsync(cachedPath);
      if (fileInfo.exists) {
        const fileUri = cachedPath.startsWith('file://') ? cachedPath : `file://${cachedPath}`;
        await setWallpaper(fileUri, FLAG_BOTH);
        console.log('[WallpaperTask] Set cached wallpaper successfully');
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }

    console.log('[WallpaperTask] No cached wallpaper available');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[WallpaperTask] Failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerWallpaperTask(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(WALLPAPER_UPDATE_TASK);
    if (isRegistered) {
      console.log('[WallpaperTask] Already registered');
      return true;
    }

    await BackgroundFetch.registerTaskAsync(WALLPAPER_UPDATE_TASK, {
      minimumInterval: 60 * 60, // 1 hour minimum (OS decides actual frequency)
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[WallpaperTask] Registered successfully');
    return true;
  } catch (error) {
    console.error('[WallpaperTask] Registration failed:', error);
    return false;
  }
}

export async function unregisterWallpaperTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(WALLPAPER_UPDATE_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(WALLPAPER_UPDATE_TASK);
      console.log('[WallpaperTask] Unregistered');
    }
  } catch (error) {
    console.error('[WallpaperTask] Unregister failed:', error);
  }
}

export async function isWallpaperTaskRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(WALLPAPER_UPDATE_TASK);
  } catch {
    return false;
  }
}

// Cache the wallpaper image for background task use
export async function cacheWallpaperForBackground(sourceUri: string): Promise<string | null> {
  try {
    const cacheDir = FileSystem.documentDirectory + 'wallpaper/';
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    const destPath = cacheDir + 'cached_wallpaper.png';

    // Normalize source URI
    const normalizedSource = sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`;

    await FileSystem.copyAsync({
      from: normalizedSource,
      to: destPath,
    });

    console.log('[WallpaperTask] Cached wallpaper at:', destPath);
    return destPath;
  } catch (error) {
    console.error('[WallpaperTask] Cache failed:', error);
    return null;
  }
}
