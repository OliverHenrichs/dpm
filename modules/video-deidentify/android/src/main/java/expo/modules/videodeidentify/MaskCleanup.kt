package expo.modules.videodeidentify

import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.hypot

/**
 * Post-processes category masks (0 = background) of a whole clip, in order, to:
 *
 * 1. **Remove flicker** — a pixel is "person" only if it is person in the majority of the
 *    frames within ±[RADIUS]. The clip is processed offline, so frames may look ahead; output
 *    lags input by [RADIUS] frames.
 * 2. **Fill holes** — a morphological close (dilate, then erode) of the person mask.
 * 3. **Keep only the couple** — split the mask into connected blobs and keep those that overlap
 *    what was kept in the previous frame. With nothing to follow (first frame, or the couple was
 *    lost), pick the largest blob near the centre that does not touch the frame edge, plus any
 *    comparable blob next to it (the partner, in open position). About once a second the centre
 *    choice is re-checked against what is being followed.
 *
 * Every step only deletes or relabels mask pixels, so the fail-closed guarantee is unaffected.
 */
class MaskCleanup(private val width: Int, private val height: Int) {
  private val size = width * height
  private val window = ArrayDeque<ByteArray>()
  private var windowStart = 0
  private var received = 0
  private var emitted = 0

  /** Dilated mask of what was kept in the previous frame; null when nothing was. */
  private var previousKept: BooleanArray? = null

  /** A cleaned frame and how many blobs were kept in it (the "lost dancer" stat). */
  class Cleaned(val labels: ByteArray, val keptBlobs: Int)

  /** Adds the next frame's labels (copied) and returns cleaned frames that became ready. */
  fun push(labels: ByteArray): List<Cleaned> {
    window.addLast(labels.copyOf())
    received++
    val ready = mutableListOf<Cleaned>()
    while (emitted + RADIUS < received) ready += emitNext()
    return ready
  }

  /** Returns the remaining frames at the end of the clip. */
  fun flush(): List<Cleaned> {
    val ready = mutableListOf<Cleaned>()
    while (emitted < received) ready += emitNext()
    return ready
  }

  private fun frame(index: Int) = window[index - windowStart]

  private fun emitNext(): Cleaned {
    val k = emitted
    val from = maxOf(0, k - RADIUS)
    val to = minOf(received - 1, k + RADIUS)
    val current = frame(k)
    val votesNeeded = (to - from + 1) / 2 + 1

    // 1. Temporal majority vote; a pixel voted in but empty now borrows the nearest category.
    val person = BooleanArray(size)
    val labels = ByteArray(size)
    for (p in 0 until size) {
      var votes = 0
      for (i in from..to) if (frame(i)[p].toInt() != 0) votes++
      if (votes < votesNeeded) continue
      person[p] = true
      labels[p] = if (current[p].toInt() != 0) current[p] else nearestCategory(p, k, from, to)
    }

    // 2. Close small holes; pixels it adds are drawn as clothes, the commonest category.
    val closed = erode(dilate(person, CLOSE_RADIUS), CLOSE_RADIUS)
    for (p in 0 until size) {
      if (closed[p] && labels[p].toInt() == 0) labels[p] = MulticlassCategory.CLOTHES.toByte()
      if (!closed[p]) labels[p] = 0
    }

    // 3. Keep only the couple.
    val (kept, keptBlobs) = selectCouple(closed)
    for (p in 0 until size) if (!kept[p]) labels[p] = 0

    emitted++
    // Drop frames no future window will need.
    while (windowStart < emitted - RADIUS) {
      window.removeFirst()
      windowStart++
    }
    return Cleaned(labels, keptBlobs)
  }

  private fun nearestCategory(p: Int, k: Int, from: Int, to: Int): Byte {
    for (d in 1..RADIUS) {
      if (k - d >= from && frame(k - d)[p].toInt() != 0) return frame(k - d)[p]
      if (k + d <= to && frame(k + d)[p].toInt() != 0) return frame(k + d)[p]
    }
    return MulticlassCategory.CLOTHES.toByte()
  }

  private class Blob(val pixels: IntArray, val cx: Float, val cy: Float, val touchesEdge: Boolean) {
    val area get() = pixels.size
  }

  private fun selectCouple(mask: BooleanArray): Pair<BooleanArray, Int> {
    val minArea = (size * MIN_BLOB_FRACTION).toInt()
    val blobs = findBlobs(mask).filter { it.area >= minArea }
    val previous = previousKept

    // Follow: blobs that overlap enough of last frame's (dilated) couple.
    var chosen = if (previous == null) emptyList() else blobs.filter { blob ->
      val overlap = blob.pixels.count { previous[it] }
      overlap >= blob.area * MIN_OVERLAP
    }

    // Following alone can lock onto a bystander for good (clip 1 followed a spectator's head
    // for seconds), so every RECHECK_FRAMES the centre prior gets a vote: if a candidate far
    // outscores what is being followed, switch to it.
    val candidates = blobs.filter { acquirable(it) }
    val recheck = emitted % RECHECK_FRAMES == 0
    if (chosen.isNotEmpty() && recheck && candidates.isNotEmpty()) {
      val followed = chosen.sumOf { if (acquirable(it)) score(it) else 0.0 }
      if (candidates.maxOf { score(it) } > followed * SWITCH_RATIO) chosen = emptyList()
    }

    // (Re-)acquire with the centre prior when there is nothing to follow.
    if (chosen.isEmpty() && candidates.isNotEmpty()) {
      val scored = candidates.map { it to score(it) }.sortedByDescending { it.second }
      val (best, bestScore) = scored.first()
      chosen = listOf(best) + scored.drop(1)
        .filter { (blob, s) ->
          s >= bestScore * PARTNER_SCORE_RATIO &&
            hypot(blob.cx - best.cx, blob.cy - best.cy) < width * PARTNER_MAX_DISTANCE
        }
        .map { it.first }
    }

    val kept = BooleanArray(size)
    for (blob in chosen) for (p in blob.pixels) kept[p] = true
    previousKept = if (chosen.isEmpty()) null else dilate(kept, FOLLOW_MARGIN)
    return kept to chosen.size
  }

  /**
   * Whether a blob may be picked as the couple, as opposed to followed. A blob touching the
   * frame edge is usually a spectator cut off by it, so it qualifies only with its centre in the
   * middle of the frame (a couple filling a close shot). An empty frame is the safe outcome.
   */
  private fun acquirable(blob: Blob): Boolean {
    if (!blob.touchesEdge) return true
    val dx = abs(blob.cx / width - 0.5f)
    val dy = abs(blob.cy / height - 0.5f)
    return dx < EDGE_BLOB_CENTRE_BOX && dy < EDGE_BLOB_CENTRE_BOX
  }

  /** Larger is better; blobs near the centre win, blobs cut off by the frame edge lose. */
  private fun score(blob: Blob): Double {
    val dx = (blob.cx - width / 2f) / width
    val dy = (blob.cy - height / 2f) / height
    val centre = exp(-(dx * dx + dy * dy) / (2 * CENTRE_SIGMA * CENTRE_SIGMA).toDouble())
    return blob.area * centre * (if (blob.touchesEdge) EDGE_PENALTY else 1.0)
  }

  private fun findBlobs(mask: BooleanArray): List<Blob> {
    val seen = BooleanArray(size)
    val stack = IntArray(size)
    val blobs = mutableListOf<Blob>()
    for (start in 0 until size) {
      if (!mask[start] || seen[start]) continue
      var top = 0
      stack[top++] = start
      seen[start] = true
      val pixels = mutableListOf<Int>()
      var sx = 0L
      var sy = 0L
      var edge = false
      while (top > 0) {
        val p = stack[--top]
        pixels += p
        val x = p % width
        val y = p / width
        sx += x
        sy += y
        if (x == 0 || y == 0 || x == width - 1 || y == height - 1) edge = true
        if (x > 0) visit(p - 1, mask, seen, stack, top).also { if (it) top++ }
        if (x < width - 1) visit(p + 1, mask, seen, stack, top).also { if (it) top++ }
        if (y > 0) visit(p - width, mask, seen, stack, top).also { if (it) top++ }
        if (y < height - 1) visit(p + width, mask, seen, stack, top).also { if (it) top++ }
      }
      val n = pixels.size
      blobs += Blob(pixels.toIntArray(), sx.toFloat() / n, sy.toFloat() / n, edge)
    }
    return blobs
  }

  private fun visit(q: Int, mask: BooleanArray, seen: BooleanArray, stack: IntArray, top: Int): Boolean {
    if (!mask[q] || seen[q]) return false
    seen[q] = true
    stack[top] = q
    return true
  }

  /** Square dilation via separable running counts. */
  private fun dilate(mask: BooleanArray, r: Int) = boxFilter(mask, r) { count, _ -> count > 0 }

  /** Square erosion; pixels outside the frame count as empty. */
  private fun erode(mask: BooleanArray, r: Int) = boxFilter(mask, r) { count, full -> count == full }

  private inline fun boxFilter(
    mask: BooleanArray,
    r: Int,
    keep: (count: Int, full: Int) -> Boolean,
  ): BooleanArray {
    val full = (2 * r + 1) * (2 * r + 1)
    // Horizontal counts, then vertical sums of those.
    val rows = IntArray(size)
    for (y in 0 until height) {
      val row = y * width
      var count = 0
      for (x in -r until width + r) {
        val add = x + r
        if (add < width && mask[row + add]) count++
        val drop = x - r - 1
        if (drop >= 0 && mask[row + drop]) count--
        if (x in 0 until width) rows[row + x] = count
      }
    }
    val out = BooleanArray(size)
    for (x in 0 until width) {
      var count = 0
      for (y in -r until height + r) {
        val add = y + r
        if (add < height) count += rows[add * width + x]
        val drop = y - r - 1
        if (drop >= 0) count -= rows[drop * width + x]
        if (y in 0 until height) out[y * width + x] = keep(count, full)
      }
    }
    return out
  }

  companion object {
    const val RADIUS = 2
    const val CLOSE_RADIUS = 2
    /** Blobs smaller than this share of the frame are noise (bags, chair legs, distant heads). */
    const val MIN_BLOB_FRACTION = 0.002
    /** Share of a blob that must lie on last frame's couple for it to be followed. */
    const val MIN_OVERLAP = 0.3
    /** How far (px at working resolution) the couple may move between frames. */
    const val FOLLOW_MARGIN = 8
    const val CENTRE_SIGMA = 0.25
    const val EDGE_PENALTY = 0.3
    const val PARTNER_SCORE_RATIO = 0.35
    const val PARTNER_MAX_DISTANCE = 0.35
    /** About once a second at 30 fps. */
    const val RECHECK_FRAMES = 30
    /** How much a new candidate must outscore the followed couple to take over. */
    const val SWITCH_RATIO = 2.0
    /** Half-size of the central box an edge-touching blob's centre must lie in. */
    const val EDGE_BLOB_CENTRE_BOX = 0.2f
  }
}
