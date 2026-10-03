package expo.modules.videoanonymize

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

class AnonymizeOptions : Record {
  /** Trim window in the source; a negative end means "to the end of the clip". */
  @Field val startSeconds: Double = 0.0
  @Field val endSeconds: Double = -1.0
  /** Hard cap on the processed length, applied after the window. */
  @Field val maxSeconds: Double = 30.0
  /** Target short side in pixels; 0 keeps the source's size. */
  @Field val height: Int = 720
  /** "passthrough" (trim + downscale only) or "silhouette". */
  @Field val mode: String = "passthrough"
  /** "edgetam" (EdgeTAM tracking from [prompts]) — the only one left; see Segmenters.kt. */
  @Field val segmenter: String = "edgetam"

  /** Silhouette mode: one normalised [x, y] point per dancer on the first frame. */
  @Field val prompts: List<List<Double>> = emptyList()
}

class AnonymizeException(message: String, cause: Throwable? = null) :
  CodedException("ERR_ANONYMIZE", message, cause)

/**
 * L3 (AGENT_TASKS.md): trim — and for silhouettes, downscale — a clip with Media3 Transformer,
 * then optionally re-render it as silhouettes built only from tracked masks (fail-closed). The
 * tuning found on the Pixel (fp32 encoder, guided edges, 15 fps tracking) is fixed in the
 * pipeline, not exposed here.
 */
class VideoAnonymizeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoAnonymize")

    Events("onProgress")

    AsyncFunction("anonymize") Coroutine { srcUri: String, options: AnonymizeOptions ->
      val context = appContext.reactContext ?: throw AnonymizeException("React context lost")
      val outDir = File(context.cacheDir, "anonymize").apply { mkdirs() }
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
          startSeconds = options.startSeconds,
          endSeconds = options.endSeconds,
          maxSeconds = options.maxSeconds,
          shortSide = options.height,
          removeAudio = options.mode == "silhouette",
        ) { progress("transcode", it) }
      } catch (e: Exception) {
        throw AnonymizeException("Transcode failed: ${e.message}", e)
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
      if (options.prompts.isEmpty()) {
        transcoded.delete()
        throw AnonymizeException("Silhouettes need one tapped point per dancer")
      }
      val stats = try {
        withContext(Dispatchers.Default) {
          val points = options.prompts.map { android.graphics.PointF(it[0].toFloat(), it[1].toFloat()) }
          SilhouetteRenderer(context, options.segmenter, points)
            .render(transcoded, silhouetteFile) {
            progress("silhouette", it)
          }
        }
      } catch (e: Exception) {
        throw AnonymizeException("Silhouette render failed: ${e.message}", e)
      } finally {
        transcoded.delete() // source footage: never left in the cache
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
        "avgEncodeMs" to stats.avgEncodeMs,
        "framesByPeopleFound" to stats.framesByPeopleFound.mapKeys { it.key.toString() },
      ) + stats.extra
    }
  }
}
