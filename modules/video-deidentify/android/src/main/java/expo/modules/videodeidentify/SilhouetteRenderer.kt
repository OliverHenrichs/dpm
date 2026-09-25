package expo.modules.videodeidentify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PointF
import android.media.MediaMetadataRetriever
import java.io.File
import kotlin.math.roundToInt

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
  val avgCleanupMs: Double,
  val avgEncodeMs: Double,
  /**
   * Frames keyed by how many people (pose) or kept blobs (multiclass, after cleanup) they had —
   * the "lost dancer" count.
   */
  val framesByPeopleFound: Map<Int, Int>,
  val extra: Map<String, Any> = emptyMap(),
)

/**
 * Stage B: decode frames, segment them, and encode a new video drawn **only** from the labels.
 *
 * Fail-closed: no pixel of the source frame is ever copied into the output. A segmentation
 * miss shows up as a missing limb on a flat background, never as a face.
 *
 * Segmentation, cleanup and drawing all run at a working resolution (short side
 * [WORK_SHORT_SIDE]); the models work at 256×256 internally, so full 720p only cost time.
 * The encoder scales the drawn frame up with filtering, which blends palette colours at the
 * edges — still no source pixels.
 */
class SilhouetteRenderer(
  private val context: Context,
  private val segmenterKind: String,
  private val prompts: List<PointF> = emptyList(),
  /** Stop after this many frames (0 = all) — for quick benchmarks. */
  private val maxFrames: Int = 0,
  private val cpuGraphs: Set<String> = emptySet(),
  private val refine: String = "guided",
  private val fp32Graphs: Set<String> = emptySet(),
) {
  fun render(src: File, out: File, onProgress: (Double) -> Unit): SilhouetteStats {
    val retriever = MediaMetadataRetriever()
    retriever.setDataSource(src.absolutePath)
    try {
      val totalFrames = retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)
      val frameCount = if (maxFrames > 0) minOf(maxFrames, totalFrames) else totalFrames
      val durationMs = retriever.meta(MediaMetadataRetriever.METADATA_KEY_DURATION)
      val rotation = retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
      val rawWidth = retriever.meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
      require(frameCount > 0 && durationMs > 0) { "No video frames in transcoded file" }
      val fps = totalFrames * 1000.0 / durationMs

      val params = MediaMetadataRetriever.BitmapParams().apply {
        preferredConfig = Bitmap.Config.ARGB_8888
      }
      val segmenter = createSegmenter(context, segmenterKind, prompts, cpuGraphs, refine, fp32Graphs)
      val structured = segmenter is CategorySegmenter
      var encoder: SurfaceEncoder? = null
      var cleanup: MaskCleanup? = null
      var workW = 0
      var workH = 0
      var outW = 0
      var outH = 0
      var labels = ByteArray(0)
      var pixels = IntArray(0)
      var drawn: Bitmap? = null
      var segmentNs = 0L
      var cleanupNs = 0L
      var encodeNs = 0L
      val histogram = sortedMapOf<Int, Int>()

      fun emit(frameLabels: ByteArray, people: Int) {
        val t0 = System.nanoTime()
        if (structured) drawStructured(frameLabels, pixels, workW) else drawSlots(frameLabels, pixels)
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
              // EdgeTAM resizes its input to 1024x1024 whatever it gets, so it can draw at the
              // output resolution for free; the per-frame segmenters work smaller for speed.
              val workShort = if (segmenter is EdgeTamSegmenter) minOf(frame.width, frame.height) else WORK_SHORT_SIDE
              val scale = workShort.toDouble() / minOf(frame.width, frame.height)
              workW = (frame.width * scale).roundToInt()
              workH = (frame.height * scale).roundToInt()
              // Frames come back either already rotated or raw; only re-apply the
              // rotation as a container hint when they are raw.
              val hint = if (rotation != 0 && frame.width == rawWidth) rotation else 0
              encoder = SurfaceEncoder(out, outW, outH, fps, hint)
              labels = ByteArray(workW * workH)
              pixels = IntArray(workW * workH)
              drawn = Bitmap.createBitmap(workW, workH, Bitmap.Config.ARGB_8888)
              if (structured) cleanup = MaskCleanup(workW, workH)
            }
            val small = Bitmap.createScaledBitmap(frame, workW, workH, true)
            frame.recycle()

            val t0 = System.nanoTime()
            val found = segmenter.segment(small, (index * 1000.0 / fps).toLong(), labels)
            segmentNs += System.nanoTime() - t0
            small.recycle()

            val c = cleanup
            if (found < 0) {
              // the segmenter is looking ahead; this frame's labels come out later
            } else if (c == null) {
              emit(labels, found)
            } else {
              val t1 = System.nanoTime()
              val ready = c.push(labels)
              cleanupNs += System.nanoTime() - t1
              for (cleaned in ready) emit(cleaned.labels, cleaned.keptBlobs)
            }
            index++
          }
          onProgress(index.toDouble() / frameCount)
        }
        while (true) {
          val found = segmenter.drain(labels)
          if (found < 0) break
          emit(labels, found)
        }
        cleanup?.let { c ->
          val t1 = System.nanoTime()
          val rest = c.flush()
          cleanupNs += System.nanoTime() - t1
          for (cleaned in rest) emit(cleaned.labels, cleaned.keptBlobs)
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
        avgCleanupMs = cleanupNs / 1_000_000.0 / frameCount,
        avgEncodeMs = encodeNs / 1_000_000.0 / frameCount,
        framesByPeopleFound = histogram,
        extra = segmenter.extraStats,
      )
    } finally {
      retriever.release()
    }
  }

  /** Pose slots: background, dancer 1, dancer 2. */
  private fun drawSlots(labels: ByteArray, pixels: IntArray) {
    for (p in labels.indices) pixels[p] = SLOT_PALETTE[labels[p].toInt().coerceIn(0, SLOT_PALETTE.lastIndex)]
  }

  /**
   * Multiclass categories in shades of one colour, with a dark line wherever two different
   * body categories meet, so an arm across a partner's back stays visible in closed position.
   * Face skin is drawn like body skin, so the face is not singled out.
   */
  private fun drawStructured(labels: ByteArray, pixels: IntArray, width: Int) {
    for (p in labels.indices) {
      val c = labels[p].toInt()
      if (c == 0) {
        pixels[p] = BACKGROUND
        continue
      }
      val x = p % width
      val right = if (x < width - 1) labels[p + 1].toInt() else c
      val below = if (p + width < labels.size) labels[p + width].toInt() else c
      val boundary = (right != 0 && group(right) != group(c)) || (below != 0 && group(below) != group(c))
      pixels[p] = if (boundary) CONTOUR else CATEGORY_PALETTE[c.coerceIn(0, CATEGORY_PALETTE.lastIndex)]
    }
  }

  /** Categories drawn alike count as one for contours (face skin == body skin). */
  private fun group(category: Int) =
    if (category == MulticlassCategory.FACE_SKIN) MulticlassCategory.BODY_SKIN else category

  private fun MediaMetadataRetriever.meta(key: Int): Int =
    extractMetadata(key)?.toIntOrNull() ?: 0

  companion object {
    private const val BATCH = 10
    private const val WORK_SHORT_SIDE = 360

    private const val BACKGROUND = 0xFF1E1E24.toInt()
    private const val CONTOUR = 0xFF451A03.toInt()

    /**
     * Index = label: background, dancer 1, dancer 2, then their outlines (EdgeTamSegmenter
     * OUTLINE_BASE + dancer) in light shades — dark shades were barely visible on the phone,
     * against both the dark background and the partner's fill. Opaque ARGB.
     */
    private val SLOT_PALETTE = intArrayOf(
      BACKGROUND,
      0xFFF59E0B.toInt(), // dancer 1, amber
      0xFF14B8A6.toInt(), // dancer 2, teal
      0xFFFDE68A.toInt(), // dancer 1 outline, pale amber
      0xFF99F6E4.toInt(), // dancer 2 outline, pale teal
    )

    /** Index = MulticlassCategory. */
    private val CATEGORY_PALETTE = intArrayOf(
      BACKGROUND,
      0xFF92400E.toInt(), // hair
      0xFFFCD34D.toInt(), // body skin
      0xFFFCD34D.toInt(), // face skin — same as body skin on purpose
      0xFFF59E0B.toInt(), // clothes
      0xFFD97706.toInt(), // others (accessories)
    )
  }
}
