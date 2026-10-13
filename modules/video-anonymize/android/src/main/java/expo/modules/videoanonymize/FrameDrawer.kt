package expo.modules.videoanonymize

import android.graphics.Bitmap

/** How the tracked dancers are hidden: as silhouettes, or as filmed with their faces covered. */
enum class RenderStyle { SILHOUETTE, FACES }

/** One frame of the smoothing window: its weight, masks (256x256 logits) and joints. */
class WindowEntry(val weight: Float, val masks: List<FloatArray>, val joints: List<FloatArray?>)

/** A drawn frame waiting for the encoder; [found] is how many dancers it shows. */
abstract class DrawnFrame(val found: Int) {
  /** Writes the frame's ARGB pixels into [out] (width * height). */
  abstract fun writeTo(out: IntArray)
}

/**
 * Draws one output frame from the tracked masks and joints of its smoothing window, on the
 * drawing worker thread (see [EdgeTamSegmenter]): nothing a drawer holds is touched by the
 * tracking thread, so the GPU can track the next frame while this draws the last.
 */
interface FrameDrawer {
  /**
   * Draws the frame whose luminance is [guide], whose pixels are [source] (only for a drawer
   * that shows footage) and whose window is given; [current] is its index in [window]. Writes
   * the pixels per dancer into [drawnPx].
   */
  fun draw(window: List<WindowEntry>, current: Int, guide: FloatArray, source: Bitmap?, drawnPx: IntArray): DrawnFrame
}

/**
 * Brings each dancer's 256x256 mask up to the frame: shared by both styles, so a dancer covers
 * the same pixels whichever is drawn.
 *
 * EdgeTAM's masks are 256x256 over the whole frame — a dancer is ~40 mask pixels wide — so how
 * they are brought up to the frame decides how the result looks. The logits are interpolated
 * bilinearly at the frame's resolution, as SAM 2 itself does (nearest-neighbour sampling gave
 * 2–3 px staircases), and a guided filter (He et al.) with the frame's luminance as guide pulls
 * the edges onto the real contours — fingers, hems, gaps between legs. It can only add to the
 * plain mask, never remove from it, so thin limbs survive.
 */
class MaskScores(private val w: Int, private val h: Int, objects: Int) {
  /** Per dancer and pixel: > 0 is the dancer, in (-0.5, 0.5). */
  val score = Array(objects) { FloatArray(w * h) }
  private val filter = GuidedFilter(w, h, RADIUS, EPS)
  private val upsampler = Bilinear(MASK, MASK, w, h)
  private val plain = FloatArray(w * h)

  /**
   * Fills [score] for the frame whose [guide] (luminance) and window are given. Masks are
   * averaged over the window (the caller weights 1-2-3-2-1 over ±2 frames): masks near the
   * threshold flickered frame to frame, and the clip is processed offline.
   */
  fun compute(window: List<WindowEntry>, guide: FloatArray) {
    val smoothed = List(score.size) { FloatArray(MASK * MASK) }
    var weightSum = 0f
    for (e in window) {
      weightSum += e.weight
      e.masks.forEachIndexed { i, m ->
        val out = smoothed[i]
        for (p in out.indices) out[p] += e.weight * m[p]
      }
    }
    for (out in smoothed) for (p in out.indices) out[p] /= weightSum

    filter.setGuide(guide)
    smoothed.forEachIndexed { i, mask ->
      val s = score[i]
      // The filter may only add, never remove: it averaged thin limbs (a raised forearm, a few
      // px wide) with the background below the threshold and erased them. So a pixel is body if
      // the guided result or the plain mask says so — the filter still adds detail.
      upsampler.resample(mask, s, Bilinear.Out.SIGMOID)
      System.arraycopy(s, 0, plain, 0, s.size)
      filter.apply(s)
      val pl = plain
      parallelFor(h) { y -> for (x in 0 until w) { val q = y * w + x; s[q] = maxOf(s[q], pl[q]) - 0.5f } }
    }
  }

  /**
   * Dancer [i]'s joints averaged over the window, in output pixels as [x, y, visibility] x 33.
   * With [requireCurrent], null when the drawn frame itself has no pose (neighbours only steady,
   * never invent); without, any frame of the window will do, null only when none has a pose.
   */
  fun joints(window: List<WindowEntry>, current: Int, i: Int, requireCurrent: Boolean): FloatArray? {
    if (requireCurrent && window[current].joints[i] == null) return null
    val sum = FloatArray(33 * 3)
    val weights = FloatArray(33)
    for (e in window) {
      val joints = e.joints[i] ?: continue
      for (n in 0 until 33) {
        sum[n * 3] += e.weight * joints[n * 3]
        sum[n * 3 + 1] += e.weight * joints[n * 3 + 1]
        sum[n * 3 + 2] += e.weight * joints[n * 3 + 2]
        weights[n] += e.weight
      }
    }
    if (weights[0] == 0f) return null
    return FloatArray(33 * 3) { idx ->
      val n = idx / 3
      val v = sum[idx] / weights[n]
      when (idx % 3) { 0 -> v * w; 1 -> v * h; else -> v }
    }
  }

  companion object {
    private const val MASK = 256
    /** Guided-filter window radius and regularisation, at 720p. */
    private const val RADIUS = 8
    private const val EPS = 1e-3f
  }
}
