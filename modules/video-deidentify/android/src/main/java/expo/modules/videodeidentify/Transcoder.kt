package expo.modules.videodeidentify

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class TranscodeResult(val durationMs: Long)

/** Stage A: trim to [maxSeconds] and scale the short side to [shortSide], as H.264. */
class Transcoder(private val context: Context) {
  suspend fun run(
    src: Uri,
    out: File,
    maxSeconds: Double,
    shortSide: Int,
    removeAudio: Boolean,
    onProgress: (Double) -> Unit,
  ): TranscodeResult = withContext(Dispatchers.Main) {
    val mediaItem = MediaItem.Builder()
      .setUri(src)
      .setClippingConfiguration(
        MediaItem.ClippingConfiguration.Builder()
          .setEndPositionMs((maxSeconds * 1000).toLong())
          .build()
      )
      .build()
    val edited = EditedMediaItem.Builder(mediaItem)
      .setRemoveAudio(removeAudio)
      .setEffects(Effects(listOf(), listOf(Presentation.createForShortSide(shortSide))))
      .build()

    suspendCancellableCoroutine { cont ->
      val handler = Handler(Looper.getMainLooper())
      val holder = ProgressHolder()
      lateinit var transformer: Transformer
      val poll = object : Runnable {
        override fun run() {
          if (transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) {
            onProgress(holder.progress / 100.0)
          }
          handler.postDelayed(this, 250)
        }
      }
      transformer = Transformer.Builder(context)
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .addListener(object : Transformer.Listener {
          override fun onCompleted(composition: Composition, result: ExportResult) {
            handler.removeCallbacks(poll)
            onProgress(1.0)
            cont.resume(TranscodeResult(result.durationMs))
          }

          override fun onError(
            composition: Composition,
            result: ExportResult,
            exception: ExportException,
          ) {
            handler.removeCallbacks(poll)
            cont.resumeWithException(exception)
          }
        })
        .build()
      cont.invokeOnCancellation {
        handler.post {
          handler.removeCallbacks(poll)
          transformer.cancel()
        }
      }
      transformer.start(edited, out.absolutePath)
      handler.post(poll)
    }
  }
}
