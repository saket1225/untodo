package expo.modules.wallpapersetter

import android.app.WallpaperManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Log
import java.io.File

/**
 * BroadcastReceiver that sets wallpaper from a file path.
 * Triggered via ADB:
 *   adb shell am broadcast -a com.untodo.SET_WALLPAPER --es path /sdcard/Download/wallpaper.png -n com.untodo.app/.SetWallpaperReceiver
 */
class SetWallpaperReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SetWallpaperReceiver"
        private const val DEFAULT_PATH = "/sdcard/Download/wallpaper.png"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val path = intent.getStringExtra("path") ?: DEFAULT_PATH
        Log.d(TAG, "Setting wallpaper from: $path")

        try {
            val file = File(path)
            if (!file.exists()) {
                Log.e(TAG, "File not found: $path")
                resultCode = 1
                resultData = "File not found: $path"
                return
            }

            val bitmap = BitmapFactory.decodeFile(path)
            if (bitmap == null) {
                Log.e(TAG, "Failed to decode bitmap from: $path")
                resultCode = 2
                resultData = "Failed to decode image"
                return
            }

            val wallpaperManager = WallpaperManager.getInstance(context)
            wallpaperManager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM)
            bitmap.recycle()

            Log.d(TAG, "Wallpaper set successfully from: $path")
            resultCode = 0
            resultData = "Wallpaper set successfully"
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set wallpaper", e)
            resultCode = 3
            resultData = "Error: ${e.message}"
        }
    }
}
