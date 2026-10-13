package expo.modules.videoanonymize

import android.graphics.Bitmap
import kotlin.math.hypot

/**
 * The second way to anonymize: the tracked dancers stay as filmed, each one's head is covered by
 * an opaque oval in their colour, and everything else (the room, bystanders) is blurred and
 * dimmed beyond recognition.
 *
 * Unlike the silhouette, this copies source pixels, so it is not fail-closed in the same way.
 * What keeps faces out:
 * - Only pixels inside the dancers' tracked masks are copied sharp. A bystander, or a dancer
 *   tracking lost, is only ever in the blurred background.
 * - The head is found from the pose model's face joints (nose, eyes, ears, mouth), which it
 *   places on the head even when the face is turned away, sized by the larger of the face,
 *   shoulders and torso, so a profile or a dip still gets a whole-head oval. Joints come from any
 *   frame of the smoothing window, so one frame without a pose keeps its oval. With no pose at
 *   all, the oval goes on the top of the dancer's mask.
 * - The oval is opaque, drawn last, and larger than a head. Blurring a face can be undone or
 *   recognised; a flat oval cannot.
 *
 * Its weak spot is a pose that is confidently wrong, which puts the oval somewhere else: the user
 * reviews the video before it replaces anything.
 */
class FaceDrawer(
  private val w: Int,
  private val h: Int,
  private val objects: Int,
) : FrameDrawer {
  private val scores = MaskScores(w, h, objects)
  private val labels = ByteArray(w * h)
  private val src = IntArray(w * h)
  private val out = IntArray(w * h)
  private val background = BackgroundBlur(w, h)

  /** A finished frame, held as a bitmap (native memory) until the encoder takes it. */
  private class Image(val bitmap: Bitmap, found: Int) : DrawnFrame(found) {
    override fun writeTo(out: IntArray) {
      bitmap.getPixels(out, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
      bitmap.recycle()
    }
  }

  /** An axis-aligned ellipse in output pixels. */
  private class Head(val cx: Float, val cy: Float, val rx: Float, val ry: Float)

  override fun draw(
    window: List<WindowEntry>,
    current: Int,
    guide: FloatArray,
    source: Bitmap?,
    drawnPx: IntArray,
  ): DrawnFrame {
    requireNotNull(source) { "Covering faces needs the frame's pixels" }
    scores.compute(window, guide)
    val sc = scores.score
    fillLabels(sc, w, h, labels, drawnPx)
    source.getPixels(src, 0, w, 0, 0, w, h)
    background.apply(src, out)

    // The dancers as filmed, over the blurred room, with a soft edge a few pixels wide.
    val s = src
    val o = out
    parallelFor(h) { y ->
      for (x in 0 until w) {
        val p = y * w + x
        var best = -1f
        for (i in sc.indices) best = maxOf(best, sc[i][p])
        val a = ((best - EDGE_FROM) / (EDGE_TO - EDGE_FROM)).coerceIn(0f, 1f)
        if (a > 0f) o[p] = mix(o[p], s[p], a)
      }
    }

    for (i in 0 until objects) {
      val head = fromJoints(scores.joints(window, current, i, requireCurrent = false))
        ?: fromMask(sc[i])
        ?: continue
      cover(head, SilhouetteDrawer.SLOT_PALETTE[1 + i], SilhouetteDrawer.SLOT_PALETTE[SilhouetteDrawer.OUTLINE_BASE + i])
    }
    return Image(Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888), drawnPx.count { it > 0 })
  }

  /** The head from the face joints (BlazePose 0–10), or null without a pose. */
  private fun fromJoints(j: FloatArray?): Head? {
    if (j == null) return null
    var cx = 0f
    var cy = 0f
    for (n in FACE) {
      cx += j[n * 3]
      cy += j[n * 3 + 1]
    }
    cx /= FACE.count()
    cy /= FACE.count()
    var face = 0f
    for (a in FACE) for (b in a + 1..FACE.last) {
      face = maxOf(face, hypot(j[a * 3] - j[b * 3], j[a * 3 + 1] - j[b * 3 + 1]))
    }
    val shoulders = hypot(j[11 * 3] - j[12 * 3], j[11 * 3 + 1] - j[12 * 3 + 1])
    val torso = hypot(
      (j[11 * 3] + j[12 * 3] - j[23 * 3] - j[24 * 3]) / 2,
      (j[11 * 3 + 1] + j[12 * 3 + 1] - j[23 * 3 + 1] - j[24 * 3 + 1]) / 2,
    )
    val r = maxOf(face * FACE_SHARE, shoulders * SHOULDER_SHARE, torso * TORSO_SHARE, MIN_RADIUS)
      .coerceAtMost(h * MAX_RADIUS_SHARE)
    // The joints sit at eye and nose height; the hair is above them.
    return Head(cx, cy - r * LIFT, r, r * TALL)
  }

  /**
   * Without a pose: the top of the dancer's mask, sized from the mask's height (a standing person
   * is about 7.5 heads tall). A raised arm can put it on the hands instead, which is why the pose
   * comes first.
   */
  private fun fromMask(score: FloatArray): Head? {
    var y0 = -1
    var y1 = -1
    for (y in 0 until h step SCAN) {
      val row = y * w
      var hit = false
      for (x in 0 until w step SCAN) if (score[row + x] > 0f) { hit = true; break }
      if (!hit) continue
      if (y0 < 0) y0 = y
      y1 = y
    }
    if (y0 < 0 || y1 - y0 < SCAN * 4) return null
    val height = (y1 - y0).toFloat()
    val r = maxOf(height * MASK_HEAD_SHARE, MIN_RADIUS)
    val bandEnd = minOf(h, y0 + (2 * r * TALL).toInt())
    var sx = 0L
    var n = 0
    for (y in y0 until bandEnd step SCAN) for (x in 0 until w step SCAN) {
      if (score[y * w + x] > 0f) { sx += x; n++ }
    }
    if (n == 0) return null
    return Head(sx.toFloat() / n, y0 + r * TALL, r, r * TALL)
  }

  /** An opaque oval in the dancer's colour with a pale rim, so it reads as theirs. */
  private fun cover(head: Head, fill: Int, rim: Int) {
    val x0 = (head.cx - head.rx).toInt().coerceAtLeast(0)
    val x1 = (head.cx + head.rx).toInt().coerceAtMost(w - 1)
    val y0 = (head.cy - head.ry).toInt().coerceAtLeast(0)
    val y1 = (head.cy + head.ry).toInt().coerceAtMost(h - 1)
    if (x0 > x1 || y0 > y1) return
    val irx = head.rx - RIM
    val iry = head.ry - RIM
    for (y in y0..y1) for (x in x0..x1) {
      val dx = x + 0.5f - head.cx
      val dy = y + 0.5f - head.cy
      if ((dx * dx) / (head.rx * head.rx) + (dy * dy) / (head.ry * head.ry) > 1f) continue
      val inner = irx > 0f && iry > 0f && (dx * dx) / (irx * irx) + (dy * dy) / (iry * iry) <= 1f
      out[y * w + x] = if (inner) fill else rim
    }
  }

  private fun mix(a: Int, b: Int, t: Float): Int {
    fun ch(shift: Int) = (((a shr shift) and 0xFF) * (1 - t) + ((b shr shift) and 0xFF) * t).toInt()
    return (0xFF shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
  }

  companion object {
    /** Face joints: nose, eyes (inner, centre, outer), ears, mouth corners. */
    private val FACE = 0..10
    /** Head half-width from the face spread, shoulder width and torso length, at least. */
    private const val FACE_SHARE = 0.7f
    private const val SHOULDER_SHARE = 0.3f
    private const val TORSO_SHARE = 0.25f
    private const val MIN_RADIUS = 14f
    private const val MAX_RADIUS_SHARE = 0.25f
    /** Head half-width from the mask's height, when there is no pose. */
    private const val MASK_HEAD_SHARE = 0.075f
    /** The oval's height over its width, and how far above the eyes its centre sits (of r). */
    private const val TALL = 1.3f
    private const val LIFT = 0.2f
    private const val RIM = 3f
    /** Scores between these fade from the blurred background to the dancer (sigmoid ~0.4–0.6). */
    private const val EDGE_FROM = -0.1f
    private const val EDGE_TO = 0.1f
    /** Pixel stride when looking for the top of a mask. */
    private const val SCAN = 4
  }
}

/**
 * The room behind the dancers, unrecognisable: averaged down by [FACTOR], box-blurred three times
 * (close to a Gaussian, sigma ~28 px at 720p, wider than a bystander's face at that size), scaled
 * back up and dimmed so the dancers stand out. Cheap, since the blur runs at 1/64 of the pixels.
 */
class BackgroundBlur(private val w: Int, private val h: Int) {
  private val lw = maxOf(1, w / FACTOR)
  private val lh = maxOf(1, h / FACTOR)
  private val box = BoxMean(lw, lh, RADIUS)
  private val up = Bilinear(lw, lh, w, h)
  private val low = Array(3) { FloatArray(lw * lh) }
  private val full = FloatArray(w * h)

  /** Writes the blurred, dimmed [src] (ARGB) into [out]. */
  fun apply(src: IntArray, out: IntArray) {
    parallelFor(lh) { y ->
      for (x in 0 until lw) {
        var r = 0
        var g = 0
        var b = 0
        var n = 0
        for (dy in 0 until FACTOR) {
          val sy = y * FACTOR + dy
          if (sy >= h) break
          for (dx in 0 until FACTOR) {
            val sx = x * FACTOR + dx
            if (sx >= w) break
            val c = src[sy * w + sx]
            r += (c shr 16) and 0xFF
            g += (c shr 8) and 0xFF
            b += c and 0xFF
            n++
          }
        }
        val k = y * lw + x
        low[0][k] = r.toFloat() / n
        low[1][k] = g.toFloat() / n
        low[2][k] = b.toFloat() / n
      }
    }
    java.util.Arrays.fill(out, 0xFF shl 24)
    for (c in 0..2) {
      repeat(PASSES) { box.apply(low[c], low[c]) }
      up.resample(low[c], full)
      val shift = 16 - 8 * c
      val f = full
      parallelFor(h) { y ->
        for (x in 0 until w) {
          val p = y * w + x
          out[p] = out[p] or ((f[p] * DIM).toInt().coerceIn(0, 255) shl shift)
        }
      }
    }
  }

  companion object {
    private const val FACTOR = 8
    private const val RADIUS = 3
    private const val PASSES = 3
    /** Brightness left in the background. */
    private const val DIM = 0.55f
  }
}
