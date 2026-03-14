package expo.modules.wallpapersetter

import android.app.WallpaperManager
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.net.URL

class WallpaperSetterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WallpaperSetter")

    AsyncFunction("setWallpaper") { imageUri: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: run {
          promise.reject("ERR_NO_CONTEXT", "React context is not available", null)
          return@AsyncFunction
        }

        val wallpaperManager = WallpaperManager.getInstance(context)
        val uri = Uri.parse(imageUri)

        val inputStream = when (uri.scheme) {
          "content" -> context.contentResolver.openInputStream(uri)
          "file" -> java.io.FileInputStream(uri.path)
          else -> {
            promise.reject("ERR_INVALID_URI", "Unsupported URI scheme: ${uri.scheme}", null)
            return@AsyncFunction
          }
        }

        if (inputStream == null) {
          promise.reject("ERR_OPEN_FILE", "Could not open image file", null)
          return@AsyncFunction
        }

        val bitmap = BitmapFactory.decodeStream(inputStream)
        inputStream.close()

        if (bitmap == null) {
          promise.reject("ERR_DECODE", "Could not decode image", null)
          return@AsyncFunction
        }

        wallpaperManager.setBitmap(bitmap)
        bitmap.recycle()

        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERR_SET_WALLPAPER", "Failed to set wallpaper: ${e.message}", e)
      }
    }
  }
}
