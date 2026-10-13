package expo.modules.videoanonymize

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PointF
import android.media.MediaMetadataRetriever
import java.io.File

data class SilhouetteStats(
  val frames: Int,
  val fps: Double,
  val width: Int,
  val height: Int,
  val workWidth: Int,
  val workHeight: Int,
  val segmenter: String,
  val delegate: String,
  val avgSegmentMs: Double,
  val avgEncodeMs: Double,
  /** Frames keyed by how many of the tracked dancers they showed — the "lost dancer" count. */
  val framesByPeopleFound: Map<Int, Int>,
  val extra: Map<String, Any> = emptyMap(),
)

/**
 * Stage B: decode frames, track the dancers, and encode a new video drawn in [style].
 *
 * Silhouettes are fail-closed: no pixel of the source frame is ever copied into the output, so a
 * segmentation miss shows up as a missing limb on a flat background, never as a face. Faces copy
 * the tracked dancers' pixels and cover their heads; see [FaceDrawer] for what keeps faces out.
 *
 * EdgeTAM resizes its input to 1024x1024 whatever it gets, so frames are segmented and drawn at
 * the output resolution.
 */
class SilhouetteRenderer(
  private val context: Context,
  private val segmenterKind: String,
  private val prompts: List<PointF> = emptyList(),
  private val style: RenderStyle = RenderStyle.SILHOUETTE,
) {
  fun render(src: File, out: File, onProgress: (Double) -> Unit): SilhouetteStats {
    val retriever = MediaMetadataRetriever()
    retriever.setDataSource(src.absolutePath)
    try {
      val totalFrames = retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)
      val frameCount = totalFrames
      val durationMs = retriever.meta(MediaMetadataRetriever.METADATA_KEY_DURATION)
      val rotation = retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
      val rawWidth = retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
      require(frameCount > 0 && durationMs > 0) { "No video frames in transcoded file" }
      val fps = totalFrames * 1000.0 / durationMs

      val params = MediaMetadataRetriever.BitmapParams().apply {
        preferredConfig = Bitmap.Config.ARGB_8888
      }
      val segmenter = createSegmenter(context, segmenterKind, prompts, style)
      var encoder: SurfaceEncoder? = null
      var workW = 0
      var workH = 0
      var outW = 0
      var outH = 0
      var pixels = IntArray(0)
      var drawn: Bitmap? = null
      var segmentNs = 0L
      var encodeNs = 0L
      val histogram = sortedMapOf<Int, Int>()

      fun emit(people: Int) {
        val t0 = System.nanoTime()
        drawn!!.setPixels(pixels, 0, workW, 0, 0, workW, workH)
        encoder!!.encode(drawn!!)
        encodeNs += System.nanoTime() - t0
        histogram[people] = (histogram[people] ?: 0) + 1
      }

      try {
        var index = 0
        while (index < frameCount) {
          val count = minOf(BATCH, frameCount - index)
          val batch = retriever.getFramesAtIndex(index, count, params)
          for (frame in batch) {
            if (encoder == null) {
              outW = frame.width and 1.inv()
              outH = frame.height and 1.inv()
              workW = frame.width
              workH = frame.height
              // Frames come back either already rotated or raw; only re-apply the
              // rotation as a container hint when they are raw.
              val hint = if (rotation != 0 && frame.width == rawWidth) rotation else 0
              encoder = SurfaceEncoder(out, outW, outH, fps, hint)
              pixels = IntArray(workW * workH)
              drawn = Bitmap.createBitmap(workW, workH, Bitmap.Config.ARGB_8888)
            }
            val t0 = System.nanoTime()
            val found = segmenter.segment(frame, (index * 1000.0 / fps).toLong(), pixels)
            segmentNs += System.nanoTime() - t0
            frame.recycle()

            // Negative: the segmenter is looking ahead; this frame comes out later.
            if (found >= 0) emit(found)
            index++
            // Every frame, not every batch: a batch is 5–10 s of waiting on a Pixel, longer on a
            // slower phone, and a half-second preview is only ~15 frames.
            onProgress(index.toDouble() / frameCount)
          }
        }
        while (true) {
          val found = segmenter.drain(pixels)
          if (found < 0) break
          emit(found)
        }
        encoder?.finish()
      } finally {
        encoder?.release()
        segmenter.close()
        drawn?.recycle()
      }

      return SilhouetteStats(
        frames = frameCount,
        fps = fps,
        width = outW,
        height = outH,
        workWidth = workW,
        workHeight = workH,
        segmenter = segmenter.name,
        delegate = segmenter.delegate,
        avgSegmentMs = segmentNs / 1_000_000.0 / frameCount,
        avgEncodeMs = encodeNs / 1_000_000.0 / frameCount,
        framesByPeopleFound = histogram,
        extra = segmenter.extraStats,
      )
    } finally {
      retriever.release()
    }
  }

  private fun MediaMetadataRetriever.meta(key: Int): Int =
    extractMetadata(key)?.toIntOrNull() ?: 0

  companion object {
    private const val BATCH = 10
  }
}
