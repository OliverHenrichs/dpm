package expo.modules.videoanonymize

/**
 * Draws one frame's two-colour silhouette from tracked masks, on the drawing worker thread (see
 * [EdgeTamSegmenter]): nothing here is touched by the tracking thread, so the GPU can track the
 * next frame while this draws the last. Everything is drawn from masks and joint positions only
 * — the frame's pixels steer the edge filter but are never copied (fail-closed).
 *
 * EdgeTAM's masks are 256x256 over the whole frame — a dancer is ~40 mask pixels wide — so how
 * they are brought up to the frame decides how the silhouette looks. The logits are interpolated
 * bilinearly at the frame's resolution, as SAM 2 itself does (nearest-neighbour sampling gave
 * 2–3 px staircases), and a guided filter (He et al.) with the frame's luminance as guide pulls
 * the edges onto the real contours — fingers, hems, gaps between legs. It can only add to the
 * plain mask, never remove from it, so thin limbs survive.
 */
class SilhouetteDrawer(
  private val w: Int,
  private val h: Int,
  private val objects: Int,
) {
  /** One frame of the smoothing window: its weight, masks (256x256 logits) and joints. */
  class Entry(val weight: Float, val masks: List<FloatArray>, val joints: List<FloatArray?>)

  private val score = Array(objects) { FloatArray(w * h) }
  private val filter = GuidedFilter(w, h, RADIUS, EPS)
  private val upsampler = Bilinear(MASK, MASK, w, h)
  private val plain = FloatArray(w * h)
  private val body = BooleanArray(w * h)
  private val eroded = BooleanArray(w * h)
  private val rowRun = IntArray(w * h)
  private val bands = List(objects) { BooleanArray(w * h) }

  /**
   * Draws the frame whose [guide] (luminance) and window are given;
   * [current] is its index in [window]. Writes [labels] and [drawnPx] (pixels per dancer) and
   * returns how many dancers are visible.
   *
   * Masks and joints are averaged over the window (the caller weights 1-2-3-2-1 over ±2 frames):
   * masks near the threshold flickered frame to frame, and the clip is processed offline.
   */
  fun draw(window: List<Entry>, current: Int, guide: FloatArray, labels: ByteArray, drawnPx: IntArray): Int {
    val smoothed = List(objects) { FloatArray(MASK * MASK) }
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

    // Fill: where two dancers overlap, the stronger mask wins. The masks cannot say who is in
    // front — EdgeTAM "completes" a body behind an occluding arm, so both claim the arm, and a
    // "whoever moves onto the other's area is in front" rule failed when a dancer passed behind.
    // So the fill picks one; arm bands and outlines (below) keep the shapes readable.
    val sc = score
    parallelFor(h) { y ->
      for (x in 0 until w) {
        val p = y * w + x
        var best = 0f
        var label = 0
        for (i in 0 until objects) {
          val v = sc[i][p]
          if (v > best) {
            best = v
            label = i + 1
          }
        }
        labels[p] = label.toByte()
      }
    }
    java.util.Arrays.fill(drawnPx, 0)
    for (p in 0 until w * h) {
      val l = labels[p].toInt()
      if (l > 0) drawnPx[l - 1]++
    }

    val joints = List(objects) { averagedJoints(window, current, it) }
    val armBands = armBands(labels, joints)
    drawOutlines(labels)
    armBands.forEachIndexed { i, band -> outlineBand(labels, band, (OUTLINE_BASE + i).toByte()) }
    drawSkeletons(labels, joints)
    armBands.forEach { it.clear() }
    return drawnPx.count { it > 0 }
  }

  /**
   * Each dancer's whole outline, drawn over both fills in a light shade of her colour (label
   * [OUTLINE_BASE] + dancer index). An arm in front of the partner then shows as an outlined arm
   * over the partner's body whichever mask won the fill there.
   */
  private fun drawOutlines(labels: ByteArray) {
    for (i in 0 until objects) {
      val sc = score[i]
      parallelFor(h) { y -> for (x in 0 until w) { val p = y * w + x; body[p] = sc[p] > 0f } }
      erode(body, eroded, OUTLINE_WIDTH)
      val outline = (OUTLINE_BASE + i).toByte()
      parallelFor(h) { y ->
        for (x in 0 until w) {
          val p = y * w + x
          if (body[p] && !eroded[p]) labels[p] = outline
        }
      }
    }
  }

  /**
   * Square erosion by [r]: [dst] is true where every pixel within r (Chebyshev) of it is true in
   * [src]; outside the frame counts as false. Two separable passes of run counts, rows then
   * columns in parallel.
   */
  private fun erode(src: BooleanArray, dst: BooleanArray, r: Int) {
    val full = 2 * r + 1
    val run = rowRun
    parallelFor(h) { y ->
      val row = y * w
      var count = 0
      for (x in -r until w + r) {
        val add = x + r
        if (add in 0 until w && src[row + add]) count++
        val drop = x - r - 1
        if (drop in 0 until w && src[row + drop]) count--
        if (x in 0 until w) run[row + x] = if (count == full) 1 else 0
      }
    }
    parallelFor(w) { x ->
      var count = 0
      for (y in -r until h + r) {
        val add = y + r
        if (add in 0 until h) count += run[add * w + x]
        val drop = y - r - 1
        if (drop in 0 until h) count -= run[drop * w + x]
        if (y in 0 until h) dst[y * w + x] = count == full
      }
    }
  }

  /**
   * A dancer's joints averaged over the window, in output pixels as [x, y, visibility] x 33 —
   * or null when the drawn frame itself has no pose (neighbours only steady, never invent).
   */
  private fun averagedJoints(window: List<Entry>, current: Int, i: Int): FloatArray? {
    if (window[current].joints[i] == null) return null
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
  private fun armBands(labels: ByteArray, joints: List<FloatArray?>): List<Band> =
    joints.mapIndexed { i, j ->
      val band = Band(bands[i])
      if (j == null) return@mapIndexed band
      val shoulder = kotlin.math.hypot(j[11 * 3] - j[12 * 3], j[11 * 3 + 1] - j[12 * 3 + 1])
      val r = (shoulder * ARM_WIDTH_SHARE).coerceIn(ARM_RADIUS_MIN, ARM_RADIUS_MAX)
      for ((a, b) in ARMS) {
        if (minOf(j[a * 3 + 2], j[b * 3 + 2]) < PoseSkeletons.VISIBLE) continue
        capsule(band, j[a * 3], j[a * 3 + 1], j[b * 3], j[b * 3 + 1], r)
      }
      val fill = (i + 1).toByte()
      band.forEach { p ->
        if (labels[p].toInt() == 0) band.cells[p] = false // no body here: not an arm either
        else labels[p] = fill
      }
      band
    }

  /** A reused mask plus the box it was drawn in, so only that box is visited and cleared. */
  private inner class Band(val cells: BooleanArray) {
    var x0 = w
    var y0 = h
    var x1 = -1
    var y1 = -1

    fun grow(ax: Int, ay: Int, bx: Int, by: Int) {
      x0 = minOf(x0, ax); y0 = minOf(y0, ay); x1 = maxOf(x1, bx); y1 = maxOf(y1, by)
    }

    inline fun forEach(body: (Int) -> Unit) {
      for (y in y0..y1) for (x in x0..x1) { val p = y * w + x; if (cells[p]) body(p) }
    }

    fun clear() {
      for (y in y0..y1) java.util.Arrays.fill(cells, y * w + x0, y * w + x1 + 1, false)
    }
  }

  private fun capsule(band: Band, x0: Float, y0: Float, x1: Float, y1: Float, r: Float) {
    val minX = (minOf(x0, x1) - r).toInt().coerceAtLeast(0)
    val maxX = (maxOf(x0, x1) + r).toInt().coerceAtMost(w - 1)
    val minY = (minOf(y0, y1) - r).toInt().coerceAtLeast(0)
    val maxY = (maxOf(y0, y1) + r).toInt().coerceAtMost(h - 1)
    if (minX > maxX || minY > maxY) return
    band.grow(minX, minY, maxX, maxY)
    val dx = x1 - x0
    val dy = y1 - y0
    val len2 = dx * dx + dy * dy
    for (y in minY..maxY) for (x in minX..maxX) {
      val t = if (len2 == 0f) 0f else (((x - x0) * dx + (y - y0) * dy) / len2).coerceIn(0f, 1f)
      val ex = x0 + t * dx - x
      val ey = y0 + t * dy - y
      if (ex * ex + ey * ey <= r * r) band.cells[y * w + x] = true
    }
  }

  /** The band's edge (a band pixel with a non-band 4-neighbour within 2 px), in [colour]. */
  private fun outlineBand(labels: ByteArray, band: Band, colour: Byte) {
    if (band.x1 < 0) return
    val cells = band.cells
    for (y in band.y0..band.y1) for (x in band.x0..band.x1) {
      val p = y * w + x
      if (!cells[p]) continue
      var edge = false
      for (d in 1..2) {
        if ((x - d < 0 || !cells[p - d]) || (x + d >= w || !cells[p + d]) ||
          (y - d < 0 || !cells[p - d * w]) || (y + d >= h || !cells[p + d * w])
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

  companion object {
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
    /** Guided-filter window radius and regularisation, at 720p. */
    private const val RADIUS = 8
    private const val EPS = 1e-3f
  }
}
