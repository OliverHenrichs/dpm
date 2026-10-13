package expo.modules.videoanonymize

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.PointF
import android.media.MediaMetadataRetriever
import android.net.Uri
import java.io.File
import kotlin.math.roundToInt

data class OutlineStats(
  val width: Int,
  val height: Int,
  /** Per tap: whether EdgeTAM found anyone there. */
  val found: List<Boolean>,
)

/**
 * Shows the user who a tap picked, before the minutes-long render: the frame at [atSeconds] with
 * each tapped dancer's first-frame mask blended in, in the colour their silhouette will get, and
 * everything else dimmed. The masks come from [EdgeTamTracker.start] with all the taps, so they are
 * the ones tracking starts from (a couple's taps exclude each other, see `exclusiveCandidate`).
 *
 * Unlike the silhouette render, the output is the source frame itself, a temporary file for the
 * editor only; the caller deletes it as soon as it is no longer shown.
 */
class DancerOutline(private val context: Context) {
  fun render(src: Uri, atSeconds: Double, points: List<PointF>, out: File): OutlineStats {
    val frame = frameAt(src, atSeconds)
    try {
      val masks = EdgeTamTracker(context).use { it.start(frame, points) }
      val w = frame.width
      val h = frame.height
      // Same scale-up as the drawer's plain path: logits at frame size, > 0 = dancer.
      val up = Bilinear(256, 256, w, h)
      val scores = masks.map { m -> FloatArray(w * h).also { up.resample(m, it) } }
      val labels = IntArray(w * h) { -1 }
      parallelFor(h) { y ->
        for (x in 0 until w) {
          val p = y * w + x
          var best = 0f
          for (i in scores.indices) if (scores[i][p] > best) { best = scores[i][p]; labels[p] = i }
        }
      }
      val pixels = IntArray(w * h)
      frame.getPixels(pixels, 0, w, 0, 0, w, h)
      parallelFor(h) { y ->
        for (x in 0 until w) {
          val p = y * w + x
          val d = labels[p]
          pixels[p] = when {
            d < 0 -> scale(pixels[p], DIM)
            isEdge(labels, w, h, x, y, d) -> OUTLINE[d % OUTLINE.size]
            else -> blend(pixels[p], FILL[d % FILL.size], TINT)
          }
        }
      }
      val drawn = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
      try {
        out.outputStream().use { drawn.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }
      } finally {
        drawn.recycle()
      }
      return OutlineStats(w, h, masks.map { m -> m.any { it > 0f } })
    } finally {
      frame.recycle()
    }
  }

  /**
   * The frame shown at [atSeconds], upright and scaled so its short side is at most [SHORT_SIDE]
   * (what the silhouette render tracks at). Frames come back either already rotated or raw; a
   * raw one is turned the way the player shows it.
   */
  private fun frameAt(src: Uri, atSeconds: Double): Bitmap {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, src)
      val raw = retriever.getFrameAtTime(
        (atSeconds * 1_000_000).toLong(),
        MediaMetadataRetriever.OPTION_CLOSEST,
      ) ?: throw IllegalStateException("No frame at $atSeconds s")
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        ?.toIntOrNull() ?: 0
      val rawWidth = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        ?.toIntOrNull() ?: 0
      val turn = if ((rotation == 90 || rotation == 270) && raw.width == rawWidth) rotation else 0
      val shortSide = minOf(raw.width, raw.height)
      val s = if (shortSide > SHORT_SIDE) SHORT_SIDE.toFloat() / shortSide else 1f
      if (turn == 0 && s == 1f) return raw
      val matrix = Matrix().apply {
        postScale(s, s)
        postRotate(turn.toFloat())
      }
      return Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true).also {
        if (it !== raw) raw.recycle()
      }
    } finally {
      retriever.release()
    }
  }

  private fun isEdge(labels: IntArray, w: Int, h: Int, x: Int, y: Int, d: Int): Boolean {
    for (r in 1..OUTLINE_WIDTH) {
      if (x - r < 0 || labels[y * w + x - r] != d) return true
      if (x + r >= w || labels[y * w + x + r] != d) return true
      if (y - r < 0 || labels[(y - r) * w + x] != d) return true
      if (y + r >= h || labels[(y + r) * w + x] != d) return true
    }
    return false
  }

  private fun scale(c: Int, f: Float): Int {
    val r = (((c shr 16) and 0xFF) * f).roundToInt()
    val g = (((c shr 8) and 0xFF) * f).roundToInt()
    val b = ((c and 0xFF) * f).roundToInt()
    return (0xFF shl 24) or (r shl 16) or (g shl 8) or b
  }

  private fun blend(c: Int, tint: Int, a: Float): Int {
    fun ch(shift: Int) =
      (((c shr shift) and 0xFF) * (1 - a) + ((tint shr shift) and 0xFF) * a).roundToInt()
    return (0xFF shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
  }

  companion object {
    private const val SHORT_SIDE = 720
    private const val JPEG_QUALITY = 85
    /** Brightness left outside the dancers, and how strongly a dancer takes their colour. */
    private const val DIM = 0.4f
    private const val TINT = 0.35f
    private const val OUTLINE_WIDTH = 3
    /** The silhouette's colours (SilhouetteRenderer's palette): fill, then outline, per dancer. */
    private val FILL = intArrayOf(0xFFF59E0B.toInt(), 0xFF14B8A6.toInt())
    private val OUTLINE = intArrayOf(0xFFFDE68A.toInt(), 0xFF99F6E4.toInt())
  }
}
