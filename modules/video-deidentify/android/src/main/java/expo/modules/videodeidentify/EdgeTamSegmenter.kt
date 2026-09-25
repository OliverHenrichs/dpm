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
 *    the edges onto the real contours — fingers, hems, gaps between legs. It can only add to the
 *    plain mask, never remove from it, so thin limbs survive.
 * The frame only steers where the mask boundary lies; the output is still drawn from the mask
 * alone, so the fail-closed guarantee holds.
 */
class EdgeTamSegmenter(
  context: Context,
  private val prompts: List<PointF>,
  cpuGraphs: Set<String> = emptySet(),
  private val refine: String = "guided",
  fp32Graphs: Set<String> = emptySet(),
  /** Re-anchor a dancer lost at a crossing with a person detector (see [reanchor]). */
  private val reanchorEnabled: Boolean = true,
  /** Draw a pose skeleton per dancer over the silhouettes (see [PoseSkeletons]). */
  private val skeletonEnabled: Boolean = true,
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
      "corrections" to corrections,
      "detectorRuns" to detectorRuns,
      "detectorMs" to if (detectorRuns == 0) 0.0 else detectorNs / 1_000_000.0 / detectorRuns,
      "skeletonMs" to (skeletons?.ms ?: 0L) / frameIndex.coerceAtLeast(1).toDouble(),
    )
  /** Per dancer, per frame: pixels > 0 in the 256x256 mask, and pixels drawn at output size. */
  private val maskArea = List(prompts.size) { ArrayList<Int>() }
  private val drawnArea = List(prompts.size) { ArrayList<Int>() }
  private var frameIndex = 0
  private var refineNs = 0L

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

  // Per-frame scratch, sized on first use.
  private var w = 0
  private var h = 0
  private lateinit var score: Array<FloatArray>
  private lateinit var filter: GuidedFilter
  private var plain = FloatArray(0)

  /** A tracked frame waiting to be drawn: its masks and (for guided edges) its guide image. */
  private class Pending(
    val masks: List<FloatArray>,
    val guide: FloatArray?,
    /** Per dancer: 33 joints as [x, y, visibility] normalised to the frame, or null. */
    val joints: List<FloatArray?>,
  )

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
    val masks = if (frameIndex == 0) {
      tracker.start(frame, prompts)
    } else {
      tracker.track(frameIndex, frame) { tracked -> if (reanchorEnabled) reanchor(frame, tracked) else emptyMap() }
    }
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
    val joints = skeletons?.detect(frame, masks, timestampMs) ?: masks.map { null }
    pending.addLast(Pending(masks.map { it.copyOf() }, guide, joints))
    received++
    val found = if (received - drawn > SMOOTH_RADIUS) draw(labels) else -1
    refineNs += System.nanoTime() - t0
    return found
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
      if (frameIndex % REANCHOR_EVERY != 0) return@forEachIndexed
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

  /**
   * Each dancer's whole outline, drawn over both fills in a light shade of her colour (label
   * [OUTLINE_BASE] + dancer index). An arm in front of the partner then shows as an outlined arm
   * over the partner's body whichever mask won the fill there.
   */
  private fun drawOutlines(labels: ByteArray, objects: Int) {
    for (i in 0 until objects) {
      val s = score[i]
      val outline = (OUTLINE_BASE + i).toByte()
      for (y in 0 until h) {
        for (x in 0 until w) {
          val p = y * w + x
          if (s[p] <= 0f) continue
          var edge = false
          for (d in 1..OUTLINE_WIDTH) {
            if ((x - d < 0 || s[p - d] <= 0f) || (x + d >= w || s[p + d] <= 0f) ||
              (y - d < 0 || s[p - d * w] <= 0f) || (y + d >= h || s[p + d * w] <= 0f)
            ) {
              edge = true
              break
            }
          }
          if (edge) labels[p] = outline
        }
      }
    }
  }

  /**
   * A dancer's joints averaged over the same ±[SMOOTH_RADIUS] frames as the masks (1-2-3-2-1),
   * in output pixels as [x, y, visibility] x 33 — or null when the drawn frame has no pose.
   */
  private fun averagedJoints(i: Int, k: Int, first: Int): FloatArray? {
    if (pending[k - first].joints[i] == null) return null // neighbours only steady, never invent
    val sum = FloatArray(33 * 3)
    val weights = FloatArray(33)
    for (j in maxOf(first, k - SMOOTH_RADIUS)..minOf(received - 1, k + SMOOTH_RADIUS)) {
      val joints = pending[j - first].joints[i] ?: continue
      val weight = (SMOOTH_RADIUS + 1 - kotlin.math.abs(j - k)).toFloat()
      for (n in 0 until 33) {
        sum[n * 3] += weight * joints[n * 3]
        sum[n * 3 + 1] += weight * joints[n * 3 + 1]
        sum[n * 3 + 2] += weight * joints[n * 3 + 2]
        weights[n] += weight
      }
    }
    return FloatArray(33 * 3) { idx ->
      val n = idx / 3
      val v = sum[idx] / weights[n]
      when (idx % 3) { 0 -> v * w; 1 -> v * h; else -> v }
    }
  }

  /**
   * Arms in front: the pose model only calls an arm clearly visible when it can see it, so an
   * arm across the partner is in front of her. Along each such upper arm and forearm, a band of
   * arm width is filled in the dancer's colour over whichever mask won there — limited to where
   * some mask claims the body, so no arm is painted into the background. Returns each dancer's
   * band so it can be outlined (over the own torso only the outline shows: the arm in front).
   */
  private fun armBands(labels: ByteArray, joints: List<FloatArray?>): List<BooleanArray> =
    joints.mapIndexed { i, j ->
      val band = BooleanArray(w * h)
      if (j == null) return@mapIndexed band
      val shoulder = kotlin.math.hypot(j[11 * 3] - j[12 * 3], j[11 * 3 + 1] - j[12 * 3 + 1])
      val r = (shoulder * ARM_WIDTH_SHARE).coerceIn(ARM_RADIUS_MIN, ARM_RADIUS_MAX)
      for ((a, b) in ARMS) {
        if (minOf(j[a * 3 + 2], j[b * 3 + 2]) < PoseSkeletons.VISIBLE) continue
        capsule(band, j[a * 3], j[a * 3 + 1], j[b * 3], j[b * 3 + 1], r)
      }
      val fill = (i + 1).toByte()
      for (p in band.indices) {
        if (!band[p]) continue
        if (labels[p].toInt() == 0) band[p] = false // no body here: not an arm either
        else labels[p] = fill
      }
      band
    }

  private fun capsule(band: BooleanArray, x0: Float, y0: Float, x1: Float, y1: Float, r: Float) {
    val minX = (minOf(x0, x1) - r).toInt().coerceAtLeast(0)
    val maxX = (maxOf(x0, x1) + r).toInt().coerceAtMost(w - 1)
    val minY = (minOf(y0, y1) - r).toInt().coerceAtLeast(0)
    val maxY = (maxOf(y0, y1) + r).toInt().coerceAtMost(h - 1)
    val dx = x1 - x0
    val dy = y1 - y0
    val len2 = dx * dx + dy * dy
    for (y in minY..maxY) for (x in minX..maxX) {
      val t = if (len2 == 0f) 0f else (((x - x0) * dx + (y - y0) * dy) / len2).coerceIn(0f, 1f)
      val ex = x0 + t * dx - x
      val ey = y0 + t * dy - y
      if (ex * ex + ey * ey <= r * r) band[y * w + x] = true
    }
  }

  /** The band's edge (a band pixel with a non-band 4-neighbour within 2 px), in [colour]. */
  private fun outlineBand(labels: ByteArray, band: BooleanArray, colour: Byte) {
    for (y in 0 until h) for (x in 0 until w) {
      val p = y * w + x
      if (!band[p]) continue
      var edge = false
      for (d in 1..2) {
        if ((x - d < 0 || !band[p - d]) || (x + d >= w || !band[p + d]) ||
          (y - d < 0 || !band[p - d * w]) || (y + d >= h || !band[p + d * w])
        ) {
          edge = true
          break
        }
      }
      if (edge) labels[p] = colour
    }
  }

  /** Bones between joints the model sees clearly, and wrist/ankle dots, in the outline colour. */
  private fun drawSkeletons(labels: ByteArray, joints: List<FloatArray?>) {
    joints.forEachIndexed { i, j ->
      if (j == null) return@forEachIndexed
      val colour = (OUTLINE_BASE + i).toByte()
      for ((a, b) in PoseSkeletons.BONES) {
        if (minOf(j[a * 3 + 2], j[b * 3 + 2]) < PoseSkeletons.VISIBLE) continue
        line(labels, j[a * 3], j[a * 3 + 1], j[b * 3], j[b * 3 + 1], BONE_RADIUS, colour)
      }
      for (n in PoseSkeletons.ENDS) {
        if (j[n * 3 + 2] >= PoseSkeletons.VISIBLE) disc(labels, j[n * 3], j[n * 3 + 1], JOINT_RADIUS, colour)
      }
    }
  }

  private fun line(labels: ByteArray, x0: Float, y0: Float, x1: Float, y1: Float, r: Float, v: Byte) {
    val steps = maxOf(1, (kotlin.math.hypot(x1 - x0, y1 - y0) / (r / 2)).toInt())
    for (s in 0..steps) {
      val t = s.toFloat() / steps
      disc(labels, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, v)
    }
  }

  private fun disc(labels: ByteArray, cx: Float, cy: Float, r: Float, v: Byte) {
    val ri = r.toInt() + 1
    for (dy in -ri..ri) for (dx in -ri..ri) {
      if (dx * dx + dy * dy > r * r) continue
      val x = cx.toInt() + dx
      val y = cy.toInt() + dy
      if (x in 0 until w && y in 0 until h) labels[y * w + x] = v
    }
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
        // The filter may only add, never remove: it averaged thin limbs (a raised forearm, a
        // few px wide) with the background below the threshold and erased them. So a pixel is
        // body if the guided result or the plain mask says so — the filter still adds detail.
        val s = score[i]
        for (p in s.indices) s[p] = sigmoid(s[p])
        if (plain.size != s.size) plain = FloatArray(s.size)
        System.arraycopy(s, 0, plain, 0, s.size)
        filter.apply(s)
        for (p in s.indices) s[p] = maxOf(s[p], plain[p]) - 0.5f
      }
    }

    // Fill: where two dancers overlap, the stronger mask wins. The masks cannot say who is in
    // front — EdgeTAM "completes" a body behind an occluding arm, so both claim the arm, and a
    // "whoever moves onto the other's area is in front" rule failed when a dancer passed behind.
    // So the fill picks one, and outlines (below) keep both shapes readable.
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
    val joints = if (skeletons != null) List(objects) { averagedJoints(it, k, first) } else emptyList()
    val bands = if (skeletons != null) armBands(labels, joints) else emptyList()
    drawOutlines(labels, objects)
    bands.forEachIndexed { i, band -> outlineBand(labels, band, (OUTLINE_BASE + i).toByte()) }
    if (skeletons != null) drawSkeletons(labels, joints)

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

  override fun close() {
    tracker.close()
    detector?.close()
    skeletons?.close()
  }

  companion object {
    /** SPIKE: save the encoder's input for a few frames, to compare with a desktop replay. */
    var DUMP_ENCODER_INPUT = false
    private const val MASK = 256
    /** Outline width in output pixels, and the label of dancer 0's outline (dancer i: +i). */
    private const val OUTLINE_WIDTH = 3
    const val OUTLINE_BASE = 3
    /** Skeleton line and wrist/ankle dot radii in output pixels. */
    private const val BONE_RADIUS = 2.5f
    private const val JOINT_RADIUS = 5f
    /** Arm band: half-width as a share of shoulder width, clamped to output pixels. */
    private const val ARM_WIDTH_SHARE = 0.14f
    private const val ARM_RADIUS_MIN = 5f
    private const val ARM_RADIUS_MAX = 22f
    /** Upper arms and forearms (BlazePose indices). */
    private val ARMS = arrayOf(11 to 13, 13 to 15, 12 to 14, 14 to 16)
    /** Frames either side averaged into each drawn frame. */
    private const val SMOOTH_RADIUS = 2
    /** Re-anchoring: "weak" below this share of the usual area; checked every n frames. */
    private const val WEAK = 0.5f
    private const val REANCHOR_EVERY = 3
    /** A candidate must be this large (share of usual area), this close (share of frame), and
     *  covered by the other dancer less than this share. */
    private const val MIN_SIZE = 0.4f
    private const val MAX_DISTANCE = 0.15f
    private const val MAX_COVERED = 0.3f
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
