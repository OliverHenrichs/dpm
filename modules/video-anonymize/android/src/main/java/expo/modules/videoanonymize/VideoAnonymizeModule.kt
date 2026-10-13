package expo.modules.videoanonymize

import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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
  /**
   * "passthrough" (trim + downscale only), "silhouette" (the dancers as silhouettes) or "faces"
   * (the dancers as filmed, their heads covered, the room blurred).
   */
  @Field val mode: String = "passthrough"
  /** "edgetam" (EdgeTAM tracking from [prompts]) — the only one left; see Segmenters.kt. */
  @Field val segmenter: String = "edgetam"

  /** Silhouette and faces: one normalised [x, y] point per dancer on the first frame. */
  @Field val prompts: List<List<Double>> = emptyList()
}

class OutlineOptions : Record {
  /** Where in the source the tap frame is, in seconds. */
  @Field val atSeconds: Double = 0.0

  /** One normalised [x, y] point per dancer, as for silhouettes. */
  @Field val prompts: List<List<Double>> = emptyList()
}

class AnonymizeException(message: String, cause: Throwable? = null) :
  CodedException("ERR_ANONYMIZE", message, cause)

/**
 * L3 (AGENT_TASKS.md): trim — and to anonymize, downscale — a clip with Media3 Transformer,
 * then optionally re-render it from tracked masks: as silhouettes (fail-closed), or as filmed
 * with the dancers' heads covered and the room blurred (FaceDrawer). The
 * tuning found on the Pixel (fp32 encoder, guided edges, 15 fps tracking) is fixed in the
 * pipeline, not exposed here.
 */
class VideoAnonymizeModule : Module() {
  /** The warm tap-frame outline, if the editor is on its tap step (see DancerOutline). */
  private var outline: DancerOutline? = null
  private val outlineLock = Mutex()

  private fun closeOutline() {
    outline?.close()
    outline = null
  }

  override fun definition() = ModuleDefinition {
    Name("VideoAnonymize")

    OnDestroy { closeOutline() }

    Events("onProgress")

    // The tapped dancers' first-frame masks over the tap frame (DancerOutline), so the user can
    // check who each tap picked before the render. The session stays warm between taps:
    // prepareOutline as the tap frame opens, outline per tap, releaseOutline when done.
    AsyncFunction("prepareOutline") Coroutine { srcUri: String, options: OutlineOptions ->
      val context = appContext.reactContext ?: throw AnonymizeException("React context lost")
      val started = System.nanoTime()
      outlineLock.withLock {
        try {
          withContext(Dispatchers.Default) {
            val session = outline ?: DancerOutline(context).also { outline = it }
            session.prepare(srcUri, options.atSeconds)
          }
        } catch (e: Exception) {
          closeOutline()
          throw AnonymizeException("Outline failed: ${e.message}", e)
        }
      }
      mapOf("ms" to (System.nanoTime() - started) / 1_000_000)
    }

    AsyncFunction("outline") Coroutine { srcUri: String, options: OutlineOptions ->
      val context = appContext.reactContext ?: throw AnonymizeException("React context lost")
      if (options.prompts.isEmpty()) throw AnonymizeException("An outline needs a tapped point")
      val outDir = File(context.cacheDir, "anonymize").apply { mkdirs() }
      val out = File(outDir, "${System.currentTimeMillis()}-outline.jpg")
      val started = System.nanoTime()
      val stats = outlineLock.withLock {
        try {
          withContext(Dispatchers.Default) {
            val points = options.prompts.map { android.graphics.PointF(it[0].toFloat(), it[1].toFloat()) }
            val session = outline ?: DancerOutline(context).also { outline = it }
            session.render(srcUri, options.atSeconds, points, out)
          }
        } catch (e: Exception) {
          out.delete()
          closeOutline()
          throw AnonymizeException("Outline failed: ${e.message}", e)
        }
      }
      mapOf(
        "uri" to Uri.fromFile(out).toString(),
        "width" to stats.width,
        "height" to stats.height,
        "found" to stats.found,
        "ms" to (System.nanoTime() - started) / 1_000_000,
      ) + stats.timing
    }

    AsyncFunction("releaseOutline") Coroutine { ->
      outlineLock.withLock { closeOutline() }
    }

    AsyncFunction("anonymize") Coroutine { srcUri: String, options: AnonymizeOptions ->
      val context = appContext.reactContext ?: throw AnonymizeException("React context lost")
      val outDir = File(context.cacheDir, "anonymize").apply { mkdirs() }
      // The phone cannot hold the outline's graphs and the full tracker at once.
      outlineLock.withLock { closeOutline() }
      val stamp = System.currentTimeMillis()
      val transcoded = File(outDir, "$stamp-transcoded.mp4")
      val style = when (options.mode) {
        "silhouette" -> RenderStyle.SILHOUETTE
        "faces" -> RenderStyle.FACES
        else -> null
      }

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
          // Voices identify people too.
          removeAudio = style != null,
        ) { progress("transcode", it) }
      } catch (e: Exception) {
        throw AnonymizeException("Transcode failed: ${e.message}", e)
      }
      val transcodeMs = (System.nanoTime() - started) / 1_000_000

      if (style == null) {
        return@Coroutine mapOf(
          "uri" to Uri.fromFile(transcoded).toString(),
          "ms" to transcodeMs,
          "transcodeMs" to transcodeMs,
          "durationMs" to transcode.durationMs,
        )
      }

      val silhouetteFile = File(outDir, "$stamp-${options.mode}.mp4")
      if (options.prompts.isEmpty()) {
        transcoded.delete()
        throw AnonymizeException("Anonymizing needs one tapped point per dancer")
      }
      val stats = try {
        withContext(Dispatchers.Default) {
          val points = options.prompts.map { android.graphics.PointF(it[0].toFloat(), it[1].toFloat()) }
          // One progress stage for both styles: the JS side weighs stages, not styles.
          SilhouetteRenderer(context, options.segmenter, points, style)
            .render(transcoded, silhouetteFile) {
            progress("silhouette", it)
          }
        }
      } catch (e: Exception) {
        silhouetteFile.delete()
        val what = if (style == RenderStyle.FACES) "Face cover" else "Silhouette"
        throw AnonymizeException("$what render failed: ${e.message}", e)
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
