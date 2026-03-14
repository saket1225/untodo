package expo.modules.wallpapersetter

import android.app.WallpaperManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.File

class WallpaperSetterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WallpaperSetter")

    AsyncFunction("setWallpaper") { imageUri: String, flags: Int, promise: Promise ->
      try {
        Log.d("WallpaperSetter", "setWallpaper called with URI: $imageUri, flags: $flags")

        val context = appContext.reactContext ?: run {
          Log.e("WallpaperSetter", "React context is not available")
          promise.reject("ERR_NO_CONTEXT", "React context is not available", null)
          return@AsyncFunction
        }

        val wallpaperManager = WallpaperManager.getInstance(context)
        val uri = Uri.parse(imageUri)
        Log.d("WallpaperSetter", "Parsed URI scheme: ${uri.scheme}, path: ${uri.path}")

        val inputStream = when (uri.scheme) {
          "content" -> {
            Log.d("WallpaperSetter", "Opening content URI via contentResolver")
            context.contentResolver.openInputStream(uri)
          }
          "file" -> {
            val filePath = uri.path
            Log.d("WallpaperSetter", "Opening file path: $filePath")
            if (filePath == null) {
              promise.reject("ERR_INVALID_PATH", "File path is null", null)
              return@AsyncFunction
            }
            val file = File(filePath)
            if (!file.exists()) {
              Log.e("WallpaperSetter", "File does not exist: $filePath")
              promise.reject("ERR_FILE_NOT_FOUND", "File does not exist: $filePath", null)
              return@AsyncFunction
            }
            Log.d("WallpaperSetter", "File exists, size: ${file.length()} bytes")
            file.inputStream()
          }
          else -> {
            // Try as raw file path (no scheme)
            val file = File(imageUri)
            if (file.exists()) {
              Log.d("WallpaperSetter", "Opening raw file path: $imageUri, size: ${file.length()}")
              file.inputStream()
            } else {
              Log.e("WallpaperSetter", "Unsupported URI scheme: ${uri.scheme}")
              promise.reject("ERR_INVALID_URI", "Unsupported URI scheme: ${uri.scheme}", null)
              return@AsyncFunction
            }
          }
        }

        if (inputStream == null) {
          Log.e("WallpaperSetter", "inputStream is null")
          promise.reject("ERR_OPEN_FILE", "Could not open image file", null)
          return@AsyncFunction
        }

        val bitmap = BitmapFactory.decodeStream(inputStream)
        inputStream.close()

        if (bitmap == null) {
          Log.e("WallpaperSetter", "BitmapFactory.decodeStream returned null")
          promise.reject("ERR_DECODE", "Could not decode image", null)
          return@AsyncFunction
        }

        Log.d("WallpaperSetter", "Bitmap decoded: ${bitmap.width}x${bitmap.height}")

        val wallpaperFlags = if (flags > 0) flags else (WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK)
        wallpaperManager.setBitmap(bitmap, null, true, wallpaperFlags)
        val screenDesc = when (wallpaperFlags) {
          WallpaperManager.FLAG_SYSTEM -> "home screen"
          WallpaperManager.FLAG_LOCK -> "lock screen"
          else -> "home + lock screen"
        }
        Log.d("WallpaperSetter", "Wallpaper set successfully ($screenDesc)")
        bitmap.recycle()

        promise.resolve(true)
      } catch (e: Exception) {
        Log.e("WallpaperSetter", "Failed to set wallpaper", e)
        promise.reject("ERR_SET_WALLPAPER", "Failed to set wallpaper: ${e.message}", e)
      }
    }
  }
}
