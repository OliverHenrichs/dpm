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
  /** Trim window in the source; a negative end means "to the end of the clip". */
  @Field val startSeconds: Double = 0.0
  @Field val endSeconds: Double = -1.0
  /** Hard cap on the processed length, applied after the window. */
  @Field val maxSeconds: Double = 30.0
  /** Target short side in pixels; 0 keeps the source's size. */
  @Field val height: Int = 720
  /** "passthrough" (trim + downscale only) or "silhouette". */
  @Field val mode: String = "passthrough"
  /**
   * "pose" (MediaPipe PoseLandmarker, per person), "multiclass" (selfie multiclass segmenter),
   * "deeplab" (DeepLab-v3, general-scene person class) or "edgetam" (EdgeTAM tracking from
   * [prompts]).
   */
  @Field val segmenter: String = "pose"

  /** EdgeTAM: one normalised [x, y] point per dancer on the first frame. */
  @Field val prompts: List<List<Double>> = listOf(listOf(0.4, 0.55), listOf(0.6, 0.55))

  /** Stop after this many frames (0 = whole clip) — for benchmarks. */
  @Field val maxFrames: Int = 0

  /** EdgeTAM graphs to force onto the CPU ("encode", "memcond", ...) — for diagnosis. */
  @Field val cpuGraphs: List<String> = emptyList()

  /** EdgeTAM mask upscaling: "bilinear" or "guided" (edges snapped to the frame's contours). */
  @Field val refine: String = "guided"

  /**
   * EdgeTAM graphs to compute in fp32 on the GPU. Default: the image encoder. With it in fp16
   * the phone's features drifted from the desktop's and a dancer shrank early at a crossing
   * (clip 1: 614 vs ~1500 px at frame 114); fp32 there brought it to ~1400. fp32 for the
   * tracking graphs made no difference and cost +0.7 s/frame.
   */
  @Field val fp32Graphs: List<String> = listOf("encode")

  /** EdgeTAM: track every n-th frame and interpolate the frames between (1 = every frame). */
  @Field val trackEvery: Int = 1

  /** Keep the transcoded intermediate (source footage!) for replaying on a desktop — debug only. */
  @Field val keepTranscoded: Boolean = false
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
          startSeconds = options.startSeconds,
          endSeconds = options.endSeconds,
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
      EdgeTamSegmenter.DUMP_ENCODER_INPUT = options.keepTranscoded
      val stats = try {
        withContext(Dispatchers.Default) {
          val points = options.prompts.map { android.graphics.PointF(it[0].toFloat(), it[1].toFloat()) }
          SilhouetteRenderer(
            context, options.segmenter, points, options.maxFrames, options.cpuGraphs.toSet(),
            options.refine, options.fp32Graphs.toSet(), options.trackEvery.coerceAtLeast(1),
          )
            .render(transcoded, silhouetteFile) {
            progress("silhouette", it)
          }
        }
      } catch (e: Exception) {
        throw DeidentifyException("Silhouette render failed: ${e.message}", e)
      } finally {
        if (!options.keepTranscoded) transcoded.delete()
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
        "transcodedFile" to if (options.keepTranscoded) transcoded.name else "",
      ) + stats.extra
    }
  }
}
