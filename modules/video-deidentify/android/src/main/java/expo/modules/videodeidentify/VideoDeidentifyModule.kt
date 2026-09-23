package expo.modules.videodeidentify

import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class DeidentifyOptions : Record {
  @Field val maxSeconds: Double = 30.0
  @Field val height: Int = 720
  /** "passthrough" (trim + downscale only) or "silhouette". */
  @Field val mode: String = "passthrough"
  /**
   * "pose" (MediaPipe PoseLandmarker, per person), "multiclass" (selfie multiclass segmenter)
   * or "deeplab" (DeepLab-v3, general-scene person class).
   */
  @Field val segmenter: String = "pose"
}

class DeidentifyException(message: String, cause: Throwable? = null) :
  CodedException("ERR_DEIDENTIFY", message, cause)

/**
 * Spike for L3 (AGENT_TASKS.md): trim + downscale a clip with Media3 Transformer, then
 * optionally re-render it as silhouettes built only from a segmentation mask.
 */
class VideoDeidentifyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoDeidentify")

    Events("onProgress")

    AsyncFunction("deidentify") Coroutine { srcUri: String, options: DeidentifyOptions ->
      val context = appContext.reactContext ?: throw DeidentifyException("React context lost")
      val outDir = File(context.cacheDir, "deidentify").apply { mkdirs() }
      val stamp = System.currentTimeMillis()
      val transcoded = File(outDir, "$stamp-transcoded.mp4")

      val progress = { stage: String, fraction: Double ->
        sendEvent("onProgress", mapOf("stage" to stage, "progress" to fraction))
      }

      val started = System.nanoTime()
      val transcode = try {
        Transcoder(context).run(
          Uri.parse(srcUri),
          transcoded,
          maxSeconds = options.maxSeconds,
          shortSide = options.height,
          removeAudio = options.mode == "silhouette",
        ) { progress("transcode", it) }
      } catch (e: Exception) {
        throw DeidentifyException("Transcode failed: ${e.message}", e)
      }
      val transcodeMs = (System.nanoTime() - started) / 1_000_000

      if (options.mode != "silhouette") {
        return@Coroutine mapOf(
          "uri" to Uri.fromFile(transcoded).toString(),
          "ms" to transcodeMs,
          "transcodeMs" to transcodeMs,
          "durationMs" to transcode.durationMs,
        )
      }

      val silhouetteFile = File(outDir, "$stamp-silhouette.mp4")
      val stats = try {
        withContext(Dispatchers.Default) {
          SilhouetteRenderer(context, options.segmenter).render(transcoded, silhouetteFile) {
            progress("silhouette", it)
          }
        }
      } catch (e: Exception) {
        throw DeidentifyException("Silhouette render failed: ${e.message}", e)
      } finally {
        transcoded.delete()
      }
      val totalMs = (System.nanoTime() - started) / 1_000_000

      mapOf(
        "uri" to Uri.fromFile(silhouetteFile).toString(),
        "ms" to totalMs,
        "transcodeMs" to transcodeMs,
        "durationMs" to transcode.durationMs,
        "frames" to stats.frames,
        "fps" to stats.fps,
        "width" to stats.width,
        "height" to stats.height,
        "segmenter" to stats.segmenter,
        "delegate" to stats.delegate,
        "workWidth" to stats.workWidth,
        "workHeight" to stats.workHeight,
        "avgSegmentMs" to stats.avgSegmentMs,
        "avgCleanupMs" to stats.avgCleanupMs,
        "avgEncodeMs" to stats.avgEncodeMs,
        "framesByPeopleFound" to stats.framesByPeopleFound.mapKeys { it.key.toString() },
      )
    }
  }
}
