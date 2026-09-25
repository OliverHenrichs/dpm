package expo.modules.videodeidentify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PointF
import kotlin.math.exp

/**
 * [EdgeTamTracker] behind the [Segmenter] seam: the first frame starts tracking from [prompts]
 * (normalised points, one per dancer), every later frame is tracked from memory. Labels are the
 * dancer's slot (1-based), so the renderer's two-colour palette applies.
 *
 * EdgeTAM's masks are 256x256 over the whole frame — a dancer is ~40 mask pixels wide — so how
 * they are brought up to the frame decides how the silhouette looks:
 *  - "bilinear": the logits are interpolated and thresholded at the frame's resolution, as SAM 2
 *    itself does (nearest-neighbour sampling gave 2–3 px staircases);
 *  - "guided": additionally a guided filter (He et al.) with the frame's luminance as guide pulls
 *    the edges onto the real contours — fingers, hems, gaps between legs.
 * The frame only steers where the mask boundary lies; the output is still drawn from the mask
 * alone, so the fail-closed guarantee holds.
 */
class EdgeTamSegmenter(
  context: Context,
  private val prompts: List<PointF>,
  cpuGraphs: Set<String> = emptySet(),
  private val refine: String = "guided",
  fp32Graphs: Set<String> = emptySet(),
) : Segmenter {
  override val name = "edgetam"
  private val tracker = EdgeTamTracker(context, cpuGraphs, fp32Graphs).also {
    if (DUMP_ENCODER_INPUT) {
      it.dumpDir = java.io.File(context.cacheDir, "deidentify/debug").apply { mkdirs() }
    }
  }
  override val delegate get() = tracker.accelerator
  override val extraStats: Map<String, Any>
    get() = tracker.timing.toMap() + mapOf(
      "refine" to refine,
      "refineMs" to refineNs / 1_000_000.0 / frameIndex.coerceAtLeast(1),
      // Diagnostics for comparing with the desktop replica frame by frame.
      "taps" to prompts.map { listOf(it.x, it.y) },
      "maskArea" to maskArea.map { it.toList() },
      "drawnArea" to drawnArea.map { it.toList() },
    )
  /** Per dancer, per frame: pixels > 0 in the 256x256 mask, and pixels drawn at output size. */
  private val maskArea = List(prompts.size) { ArrayList<Int>() }
  private val drawnArea = List(prompts.size) { ArrayList<Int>() }
  private var frameIndex = 0
  private var refineNs = 0L

  // Per-frame scratch, sized on first use.
  private var w = 0
  private var h = 0
  private lateinit var score: Array<FloatArray>
  private lateinit var filter: GuidedFilter

  /** A tracked frame waiting to be drawn: its masks and (for guided edges) its guide image. */
  private class Pending(val masks: List<FloatArray>, val guide: FloatArray?)

  private val pending = ArrayDeque<Pending>()
  private var received = 0
  private var drawn = 0

  /**
   * Tracks [frame] and draws the frame [SMOOTH_RADIUS] behind it: each frame's masks are a
   * weighted average of its neighbours' (weights 1-2-3-2-1). Masks near the threshold flickered
   * frame to frame — arms and head of a dancer re-emerging after a crossing blinked in and out —
   * and the clip is processed offline, so the drawing can look ahead. Memory is not affected.
   */
  override fun segment(frame: Bitmap, timestampMs: Long, labels: ByteArray): Int {
    val masks = if (frameIndex == 0) tracker.start(frame, prompts) else tracker.track(frameIndex, frame)
    frameIndex++
    masks.forEachIndexed { i, m -> maskArea[i].add(m.count { it > 0f }) }

    val t0 = System.nanoTime()
    if (w != frame.width || h != frame.height) {
      w = frame.width
      h = frame.height
      score = Array(masks.size) { FloatArray(w * h) }
      filter = GuidedFilter(w, h, RADIUS, EPS)
    }
    val guide = if (refine == "guided") FloatArray(w * h).also { luminance(frame, it) } else null
    pending.addLast(Pending(masks.map { it.copyOf() }, guide))
    received++
    val found = if (received - drawn > SMOOTH_RADIUS) draw(labels) else -1
    refineNs += System.nanoTime() - t0
    return found
  }

  override fun drain(labels: ByteArray): Int {
    if (drawn >= received) return -1
    val t0 = System.nanoTime()
    val found = draw(labels)
    refineNs += System.nanoTime() - t0
    return found
  }

  /** Draws frame [drawn] from the frames around it that are still buffered. */
  private fun draw(labels: ByteArray): Int {
    val k = drawn
    val first = received - pending.size // frame index of pending[0]
    val objects = pending[k - first].masks.size
    val smoothed = List(objects) { FloatArray(MASK * MASK) }
    var weightSum = 0f
    for (j in maxOf(first, k - SMOOTH_RADIUS)..minOf(received - 1, k + SMOOTH_RADIUS)) {
      val weight = (SMOOTH_RADIUS + 1 - kotlin.math.abs(j - k)).toFloat()
      weightSum += weight
      pending[j - first].masks.forEachIndexed { i, m ->
        val out = smoothed[i]
        for (p in out.indices) out[p] += weight * m[p]
      }
    }
    for (out in smoothed) for (p in out.indices) out[p] /= weightSum

    val guide = pending[k - first].guide
    if (guide != null) filter.setGuide(guide)
    smoothed.forEachIndexed { i, mask ->
      upsample(mask, score[i])
      if (guide != null) {
        val s = score[i]
        for (p in s.indices) s[p] = sigmoid(s[p])
        filter.apply(s)
        for (p in s.indices) s[p] -= 0.5f
      }
    }

    // Where two dancers overlap, the stronger score wins.
    val seen = BooleanArray(objects)
    val drawnPx = IntArray(objects)
    for (p in 0 until w * h) {
      var best = 0f
      var label = 0
      for (i in 0 until objects) {
        val v = score[i][p]
        if (v > best) {
          best = v
          label = i + 1
        }
      }
      labels[p] = label.toByte()
      if (label > 0) {
        seen[label - 1] = true
        drawnPx[label - 1]++
      }
    }
    drawnPx.forEachIndexed { i, n -> drawnArea[i].add(n) }

    drawn++
    // Drop frames no later window needs.
    while (received - pending.size < drawn - SMOOTH_RADIUS) pending.removeFirst()
    return seen.count { it }
  }

  /** Bilinear 256x256 -> w x h (align_corners = false), as SAM 2 resizes its logits. */
  private fun upsample(mask: FloatArray, out: FloatArray) {
    val sx = MASK.toFloat() / w
    val sy = MASK.toFloat() / h
    for (y in 0 until h) {
      val fy = ((y + 0.5f) * sy - 0.5f).coerceIn(0f, (MASK - 1).toFloat())
      val y0 = fy.toInt()
      val y1 = minOf(y0 + 1, MASK - 1)
      val ty = fy - y0
      for (x in 0 until w) {
        val fx = ((x + 0.5f) * sx - 0.5f).coerceIn(0f, (MASK - 1).toFloat())
        val x0 = fx.toInt()
        val x1 = minOf(x0 + 1, MASK - 1)
        val tx = fx - x0
        val top = mask[y0 * MASK + x0] * (1 - tx) + mask[y0 * MASK + x1] * tx
        val bottom = mask[y1 * MASK + x0] * (1 - tx) + mask[y1 * MASK + x1] * tx
        out[y * w + x] = top * (1 - ty) + bottom * ty
      }
    }
  }

  private fun luminance(frame: Bitmap, out: FloatArray) {
    val px = IntArray(w * h)
    frame.getPixels(px, 0, w, 0, 0, w, h)
    for (i in px.indices) {
      val c = px[i]
      out[i] = (0.299f * ((c shr 16) and 0xFF) + 0.587f * ((c shr 8) and 0xFF) + 0.114f * (c and 0xFF)) / 255f
    }
  }

  private fun sigmoid(v: Float) = 1f / (1f + exp(-v.coerceIn(-30f, 30f)))

  override fun close() = tracker.close()

  companion object {
    /** SPIKE: save the encoder's input for a few frames, to compare with a desktop replay. */
    var DUMP_ENCODER_INPUT = false
    private const val MASK = 256
    /** Frames either side averaged into each drawn frame. */
    private const val SMOOTH_RADIUS = 2
    /** Guided-filter window radius and regularisation, at 720p. */
    private const val RADIUS = 8
    private const val EPS = 1e-3f
  }
}

/**
 * Grey-guide guided filter (He, Sun, Tang 2010) with O(1)-per-pixel box means. The guide's
 * statistics are computed once per frame by [setGuide] and reused for every mask filtered
 * against it.
 */
class GuidedFilter(private val w: Int, private val h: Int, private val r: Int, private val eps: Float) {
  private val n = w * h
  private val meanI = FloatArray(n)
  private val varI = FloatArray(n)
  private lateinit var guide: FloatArray
  private val meanP = FloatArray(n)
  private val meanIp = FloatArray(n)
  private val tmp = FloatArray(n)
  private val a = FloatArray(n)
  private val b = FloatArray(n)
  private val rowSum = FloatArray(n)

  fun setGuide(i: FloatArray) {
    guide = i
    box(i, meanI)
    for (k in 0 until n) tmp[k] = i[k] * i[k]
    box(tmp, varI)
    for (k in 0 until n) varI[k] -= meanI[k] * meanI[k]
  }

  /** Filters [p] in place. */
  fun apply(p: FloatArray) {
    box(p, meanP)
    for (k in 0 until n) tmp[k] = guide[k] * p[k]
    box(tmp, meanIp)
    for (k in 0 until n) {
      val cov = meanIp[k] - meanI[k] * meanP[k]
      a[k] = cov / (varI[k] + eps)
      b[k] = meanP[k] - a[k] * meanI[k]
    }
    box(a, tmp)
    box(b, meanP) // reuse as mean of b
    for (k in 0 until n) p[k] = tmp[k] * guide[k] + meanP[k]
  }

  /** Mean over a (2r+1)^2 window, edges averaged over the in-frame part. Separable sliding sums. */
  private fun box(src: FloatArray, dst: FloatArray) {
    for (y in 0 until h) {
      val row = y * w
      var sum = 0f
      for (x in 0..minOf(r, w - 1)) sum += src[row + x]
      for (x in 0 until w) {
        rowSum[row + x] = sum / (minOf(x + r, w - 1) - maxOf(x - r, 0) + 1)
        val add = x + r + 1
        val drop = x - r
        if (add < w) sum += src[row + add]
        if (drop >= 0) sum -= src[row + drop]
      }
    }
    for (x in 0 until w) {
      var sum = 0f
      for (y in 0..minOf(r, h - 1)) sum += rowSum[y * w + x]
      for (y in 0 until h) {
        dst[y * w + x] = sum / (minOf(y + r, h - 1) - maxOf(y - r, 0) + 1)
        val add = y + r + 1
        val drop = y - r
        if (add < h) sum += rowSum[add * w + x]
        if (drop >= 0) sum -= rowSum[drop * w + x]
      }
    }
  }
}
