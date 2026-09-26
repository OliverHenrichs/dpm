package expo.modules.videodeidentify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PointF
import java.util.concurrent.Executors
import java.util.concurrent.Future

/**
 * [EdgeTamTracker] behind the [Segmenter] seam: the first frame starts tracking from [prompts]
 * (normalised points, one per dancer), every later frame is tracked from memory. Labels are the
 * dancer's slot (1-based), so the renderer's two-colour palette applies.
 *
 * This is the tracking side (GPU models, re-anchoring, pose). Drawing happens in
 * [SilhouetteDrawer] on a worker thread, [SMOOTH_RADIUS] frames behind, so the GPU tracks the
 * next frame while the CPU draws the last — drawing then costs no wall time as long as it is
 * faster than tracking. Each drawing job gets a snapshot of its window and its own buffers.
 *
 * Only every [TRACK_EVERY]-th frame is tracked; the frames between get their masks by linear
 * interpolation of the tracked neighbours' logits, and EdgeTAM's memory counts tracked frames as
 * consecutive so its 6-frame window still holds 6 real frames.
 */
class EdgeTamSegmenter(
  context: Context,
  private val prompts: List<PointF>,
  /** Re-anchor a dancer lost at a crossing with a person detector (see [reanchor]). */
  private val reanchorEnabled: Boolean = true,
  /** Draw a pose skeleton per dancer over the silhouettes (see [PoseSkeletons]). */
  private val skeletonEnabled: Boolean = true,
) : Segmenter {
  override val name = "edgetam"
  private val tracker = EdgeTamTracker(context)
  override val delegate get() = tracker.accelerator
  override val extraStats: Map<String, Any>
    get() = tracker.timing.toMap() + mapOf(
      "trackEvery" to TRACK_EVERY,
      "drawMs" to drawNs / 1_000_000.0 / drawnFrames.coerceAtLeast(1),
      "waitMs" to waitNs / 1_000_000.0 / frameIndex.coerceAtLeast(1),
      // Diagnostics for comparing with the desktop replica frame by frame.
      "taps" to prompts.map { listOf(it.x, it.y) },
      "maskArea" to maskArea.map { it.toList() },
      "drawnArea" to drawnArea.map { it.toList() },
      "corrections" to corrections,
      "detectorRuns" to detectorRuns,
      "detectorMs" to if (detectorRuns == 0) 0.0 else detectorNs / 1_000_000.0 / detectorRuns,
      "skeletonMs" to (skeletons?.ms ?: 0L) / frameIndex.coerceAtLeast(1).toDouble(),
    )
  /** Per dancer, per frame: pixels > 0 in the 256x256 mask, and pixels drawn at output size. */
  private val maskArea = List(prompts.size) { ArrayList<Int>() }
  private val drawnArea = List(prompts.size) { ArrayList<Int>() }
  private var frameIndex = 0
  private var trackedCount = 0
  @Volatile private var drawNs = 0L
  @Volatile private var drawnFrames = 0
  private var waitNs = 0L

  // Re-anchoring state, per dancer.
  private val context = context.applicationContext
  private var detector: PersonDetector? = null
  private val skeletons = if (skeletonEnabled) PoseSkeletons(context, prompts.size) else null
  private val refArea = arrayOfNulls<Float>(prompts.size)
  private val lastPos = arrayOfNulls<PointF>(prompts.size)
  /** (frame, dancer, area before, corrected area) per correction — for the stats. */
  private val corrections = ArrayList<List<Int>>()
  private var detectorRuns = 0
  private var detectorNs = 0L

  private var w = 0
  private var h = 0
  private var pixels = IntArray(0)

  /** A frame waiting to be drawn. [masks] stays null until an untracked frame is interpolated. */
  private class Pending(
    var masks: List<FloatArray>?,
    val guide: FloatArray,
    /** Per dancer: 33 joints as [x, y, visibility] normalised to the frame, or null. */
    val joints: List<FloatArray?>,
  )

  private val pending = ArrayDeque<Pending>()
  private var received = 0
  private var submitted = 0
  private var lastTracked: List<FloatArray>? = null

  private class Drawn(val labels: ByteArray, val found: Int)

  // Drawing: one worker thread (drawer buffers are its alone), results in submission order.
  private val worker = Executors.newSingleThreadExecutor()
  private var drawer: SilhouetteDrawer? = null
  private val results = ArrayDeque<Future<Drawn>>()

  override fun segment(frame: Bitmap, timestampMs: Long, labels: ByteArray): Int {
    val track = frameIndex % TRACK_EVERY == 0
    if (track) {
      val masks = if (trackedCount == 0) {
        tracker.start(frame, prompts)
      } else {
        tracker.track(trackedCount, frame) { t -> if (reanchorEnabled) reanchor(frame, t) else emptyMap() }
      }
      trackedCount++
      interpolateGap(masks)
      lastTracked = masks
    }
    frameIndex++
    val cropMasks = lastTracked!!
    cropMasks.forEachIndexed { i, m -> maskArea[i].add(if (track) m.count { it > 0f } else -1) }

    if (w != frame.width || h != frame.height) {
      w = frame.width
      h = frame.height
    }
    val guide = FloatArray(w * h).also { luminance(frame, it) }
    val joints = skeletons?.detect(frame, cropMasks, timestampMs) ?: cropMasks.map { null }
    pending.addLast(Pending(if (track) cropMasks.map { it.copyOf() } else null, guide, joints))
    received++
    submitReady(atEnd = false)
    return take(labels, block = results.size > MAX_IN_FLIGHT)
  }

  /** Fills the untracked frames just before this tracked one by interpolating the logits. */
  private fun interpolateGap(next: List<FloatArray>) {
    val gap = pending.takeLastWhile { it.masks == null }
    if (gap.isEmpty()) return
    val prev = lastTracked ?: return
    gap.forEachIndexed { g, p ->
      val a = (g + 1).toFloat() / (gap.size + 1)
      p.masks = prev.indices.map { i -> FloatArray(prev[i].size) { k -> (1 - a) * prev[i][k] + a * next[i][k] } }
    }
  }

  /** Submits every frame whose ±[SMOOTH_RADIUS] window is known (clamped at the clip's end). */
  private fun submitReady(atEnd: Boolean) {
    val first = received - pending.size
    while (submitted < received) {
      val k = submitted
      val last = if (atEnd) received - 1 else k + SMOOTH_RADIUS
      if (last >= received) break
      val from = maxOf(first, k - SMOOTH_RADIUS)
      val to = minOf(received - 1, last)
      if ((from..to).any { pending[it - first].masks == null }) break
      val window = (from..to).map { j ->
        val p = pending[j - first]
        SilhouetteDrawer.Entry((SMOOTH_RADIUS + 1 - kotlin.math.abs(j - k)).toFloat(), p.masks!!, p.joints)
      }
      val guide = pending[k - first].guide
      val current = k - from
      if (drawer == null) drawer = SilhouetteDrawer(w, h, prompts.size)
      val d = drawer!!
      results.addLast(worker.submit<Drawn> {
        val t0 = System.nanoTime()
        val out = ByteArray(w * h)
        val px = IntArray(prompts.size)
        val found = d.draw(window, current, guide, out, px)
        synchronized(drawnArea) { px.forEachIndexed { i, n -> drawnArea[i].add(n) } }
        drawNs += System.nanoTime() - t0
        drawnFrames++
        Drawn(out, found)
      })
      submitted++
    }
    // Frames no future window needs.
    while (received - pending.size < submitted - SMOOTH_RADIUS) pending.removeFirst()
  }

  /** Hands over the oldest finished drawing, waiting for it if [block]; -1 if none is ready. */
  private fun take(labels: ByteArray, block: Boolean): Int {
    val f = results.firstOrNull() ?: return -1
    if (!block && !f.isDone) return -1
    val t0 = System.nanoTime()
    val d = f.get()
    waitNs += System.nanoTime() - t0
    results.removeFirst()
    System.arraycopy(d.labels, 0, labels, 0, labels.size)
    return d.found
  }

  override fun drain(labels: ByteArray): Int {
    // Trailing untracked frames have no later tracked frame: they hold the last masks.
    lastTracked?.let { last -> pending.filter { it.masks == null }.forEach { it.masks = last.map { m -> m.copyOf() } } }
    submitReady(atEnd = true)
    return take(labels, block = true)
  }

  /**
   * Detect-then-track correction. While a dancer is weak — under half her usual mask area, as at
   * a crossing where her partner hides her — look every [REANCHOR_EVERY] frames for a person that
   * is near her last clear position, at least 40% of her usual size and not more than 30% covered
   * by the other dancer, and hand EdgeTAM that person's mask as a correction. Without it she came
   * back ~0.6 s after she was visible again (clip 1, phone), waiting for memory to re-find her.
   */
  private fun reanchor(frame: Bitmap, tracked: List<FloatArray>): Map<Int, FloatArray> {
    val out = HashMap<Int, FloatArray>()
    var people: List<BooleanArray>? = null
    tracked.forEachIndexed { i, mask ->
      val area = mask.count { it > 0f }
      val ref = refArea[i] ?: area.toFloat().also { refArea[i] = it }
      if (area >= WEAK * ref) {
        refArea[i] = 0.9f * ref + 0.1f * area
        centroid(mask)?.let { lastPos[i] = it }
        return@forEachIndexed
      }
      val last = lastPos[i] ?: return@forEachIndexed
      if (trackedCount % REANCHOR_EVERY != 0) return@forEachIndexed
      val candidates = people ?: detect(frame).also { people = it }
      var best: BooleanArray? = null
      var bestDist = Float.MAX_VALUE
      for (cand in candidates) {
        val ca = cand.count { it }
        if (ca < MIN_SIZE * ref) continue
        val c = centroid(cand) ?: continue
        val dist = kotlin.math.hypot(c.x - last.x, c.y - last.y)
        if (dist >= MAX_DISTANCE || dist >= bestDist) continue
        val covered = tracked.indices.filter { it != i }.maxOfOrNull { j ->
          var n = 0
          for (p in 0 until MASK * MASK) if (cand[p] && tracked[j][p] > 0f) n++
          n.toFloat() / ca
        } ?: 0f
        if (covered >= MAX_COVERED) continue
        best = cand
        bestDist = dist
      }
      // Never hand her the pixels her partner currently claims: RF-DETR's person masks are
      // coarse (96x96) and around joined hands can include a sliver of the partner.
      val chosen = best?.copyOf() ?: return@forEachIndexed
      for (j in tracked.indices) if (j != i) for (p in 0 until MASK * MASK) if (tracked[j][p] > 0f) chosen[p] = false
      if (chosen.count { it } < MIN_SIZE * ref) return@forEachIndexed
      out[i] = FloatArray(MASK * MASK) { if (chosen[it]) 10f else -10f }
      corrections += listOf(frameIndex, i, area, chosen.count { it })
    }
    return out
  }

  /** All people in [frame] as 256x256 masks over the frame. */
  private fun detect(frame: Bitmap): List<BooleanArray> {
    val t0 = System.nanoTime()
    val d = detector ?: PersonDetector(context).also { detector = it }
    val masks = d.detect(frame).map { person ->
      val logits = PersonDetector.resample(person.maskLogits, MASK, MASK)
      BooleanArray(MASK * MASK) { logits[it] > 0f }
    }
    detectorRuns++
    detectorNs += System.nanoTime() - t0
    return masks
  }

  private fun centroid(mask: FloatArray): PointF? = centroid(BooleanArray(mask.size) { mask[it] > 0f })

  private fun centroid(mask: BooleanArray): PointF? {
    var sx = 0f
    var sy = 0f
    var n = 0
    for (p in mask.indices) if (mask[p]) { sx += p % MASK; sy += p / MASK; n++ }
    return if (n == 0) null else PointF(sx / n / MASK, sy / n / MASK)
  }

  private fun luminance(frame: Bitmap, out: FloatArray) {
    if (pixels.size != w * h) pixels = IntArray(w * h)
    frame.getPixels(pixels, 0, w, 0, 0, w, h)
    val px = pixels
    parallelFor(h) { y ->
      for (x in 0 until w) {
        val c = px[y * w + x]
        out[y * w + x] =
          (0.299f * ((c shr 16) and 0xFF) + 0.587f * ((c shr 8) and 0xFF) + 0.114f * (c and 0xFF)) / 255f
      }
    }
  }

  override fun close() {
    worker.shutdown()
    tracker.close()
    detector?.close()
    skeletons?.close()
  }

  companion object {
    /**
     * Track every n-th frame and interpolate the rest. 2 (15 fps) looked the same as every frame
     * on clips 1 and 4 and takes ~0.64 instead of ~1.08 s per frame on a Pixel 10a.
     */
    private const val TRACK_EVERY = 2
    private const val MASK = 256
    const val OUTLINE_BASE = SilhouetteDrawer.OUTLINE_BASE
    /** Frames either side averaged into each drawn frame. */
    private const val SMOOTH_RADIUS = 2
    /** Drawings allowed to queue up before tracking waits for the drawer. */
    private const val MAX_IN_FLIGHT = 3
    /** Re-anchoring: "weak" below this share of the usual area; checked every n tracked frames. */
    private const val WEAK = 0.5f
    private const val REANCHOR_EVERY = 3
    /** A candidate must be this large (share of usual area), this close (share of frame), and
     *  covered by the other dancer less than this share. */
    private const val MIN_SIZE = 0.4f
    private const val MAX_DISTANCE = 0.15f
    private const val MAX_COVERED = 0.3f
  }
}

/**
 * Grey-guide guided filter (He, Sun, Tang 2010), in its "fast" form (He & Sun 2015): the linear
 * coefficients are computed on a [factor]-times subsampled guide and mask, then upsampled and
 * applied at full resolution. Nearly the same edges at a fraction of the cost — the full-res
 * version took most of the ~0.8 s/frame the drawing cost on a Pixel 10a. The guide's statistics
 * are computed once per frame by [setGuide] and reused for every mask filtered against it.
 */
class GuidedFilter(
  private val w: Int,
  private val h: Int,
  r: Int,
  private val eps: Float,
  private val factor: Int = 2,
) {
  private val lw = w / factor
  private val lh = h / factor
  private val n = lw * lh
  private val box = BoxMean(lw, lh, maxOf(1, r / factor))
  private val up = Bilinear(lw, lh, w, h)
  private lateinit var guide: FloatArray
  private val guideLow = FloatArray(n)
  private val meanI = FloatArray(n)
  private val varI = FloatArray(n)
  private val pLow = FloatArray(n)
  private val meanP = FloatArray(n)
  private val meanIp = FloatArray(n)
  private val tmp = FloatArray(n)
  private val a = FloatArray(n)
  private val b = FloatArray(n)
  private val aFull = FloatArray(w * h)
  private val bFull = FloatArray(w * h)

  fun setGuide(i: FloatArray) {
    guide = i
    downsample(i, guideLow)
    box.apply(guideLow, meanI)
    parallelFor(lh) { y -> for (x in 0 until lw) { val k = y * lw + x; tmp[k] = guideLow[k] * guideLow[k] } }
    box.apply(tmp, varI)
    parallelFor(lh) { y -> for (x in 0 until lw) { val k = y * lw + x; varI[k] -= meanI[k] * meanI[k] } }
  }

  /** Filters [p] (full resolution) in place. */
  fun apply(p: FloatArray) {
    downsample(p, pLow)
    box.apply(pLow, meanP)
    parallelFor(lh) { y -> for (x in 0 until lw) { val k = y * lw + x; tmp[k] = guideLow[k] * pLow[k] } }
    box.apply(tmp, meanIp)
    parallelFor(lh) { y ->
      for (x in 0 until lw) {
        val k = y * lw + x
        val cov = meanIp[k] - meanI[k] * meanP[k]
        a[k] = cov / (varI[k] + eps)
        b[k] = meanP[k] - a[k] * meanI[k]
      }
    }
    box.apply(a, tmp)
    up.resample(tmp, aFull)
    box.apply(b, tmp)
    up.resample(tmp, bFull)
    parallelFor(h) { y -> for (x in 0 until w) { val k = y * w + x; p[k] = aFull[k] * guide[k] + bFull[k] } }
  }

  /** Mean of each [factor] x [factor] block. */
  private fun downsample(src: FloatArray, dst: FloatArray) {
    val inv = 1f / (factor * factor)
    parallelFor(lh) { y ->
      for (x in 0 until lw) {
        var sum = 0f
        for (dy in 0 until factor) {
          val row = (y * factor + dy) * w + x * factor
          for (dx in 0 until factor) sum += src[row + dx]
        }
        dst[y * lw + x] = sum * inv
      }
    }
  }
}
