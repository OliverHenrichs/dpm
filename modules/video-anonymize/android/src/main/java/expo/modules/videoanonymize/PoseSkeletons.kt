package expo.modules.videoanonymize

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker

/**
 * One pose skeleton per tracked dancer, so arms stay readable where a silhouette cannot show
 * them — in front of the dancer's own torso, or across the partner.
 *
 * MediaPipe's pose model finds people by face and upper body and lost dancers at crossings when
 * it had to find both itself (the first spike). Here EdgeTAM already knows where each dancer is,
 * so each gets her own cut-out from her tracked mask, with a margin and her partner's pixels
 * greyed out; one person per crop is what the model is built for. Without the greying, the
 * follower's skeleton jumped onto the more prominent leader in closed position (clip 1).
 *
 * Steadiness (the skeleton shook and blinked): each dancer's cut-out is kept where it was while
 * she stays inside it, instead of following her mask's bounds frame by frame. A box that moved
 * by a mask cell or two moved and rescaled the crop, and with it every joint, and the model's
 * own VIDEO-mode tracking assumes a steady image. Joints then go through [JointSmoother], and a
 * pose the model misses for a frame or two is carried along with her mask rather than dropped.
 *
 * Only joint positions leave this class; the frame's pixels are read, never drawn.
 */
class PoseSkeletons(context: Context, private val dancers: Int) : AutoCloseable {
  private val appContext = context.applicationContext
  private val model = context.assets.open("pose_landmarker_full.task").use { it.readBytes() }.let {
    java.nio.ByteBuffer.allocateDirect(it.size).order(java.nio.ByteOrder.nativeOrder()).put(it).also { b -> b.rewind() }
  }
  private val landmarkers = List(dancers) { create() }
  /** The previous frame's joints per dancer (frame-normalised), for arbitrating arms. */
  private val last = arrayOfNulls<FloatArray>(dancers)
  /** Each dancer's current crop in frame pixels [x0, y0, x1, y1], kept while she fits in it. */
  private val crops = arrayOfNulls<IntArray>(dancers)
  private val smoothers = List(dancers) { JointSmoother() }
  /** Per dancer: tracked frames in a row without a pose, and her mask's last centre (0 to 1). */
  private val misses = IntArray(dancers)
  private val centres = arrayOfNulls<FloatArray>(dancers)
  /** Per dancer: how many cells she usually shows, a slowly decaying maximum. */
  private val typical = FloatArray(dancers)

  /** Upper- and forearm segments (pixels) of a skeleton, where the model sees them clearly. */
  private fun armSegments(joints: FloatArray?, w: Int, h: Int): List<FloatArray> {
    if (joints == null) return emptyList()
    return ARMS.mapNotNull { (a, b) ->
      if (minOf(joints[a * 3 + 2], joints[b * 3 + 2]) < VISIBLE) null
      else floatArrayOf(joints[a * 3] * w, joints[a * 3 + 1] * h, joints[b * 3] * w, joints[b * 3 + 1] * h)
    }
  }

  /** Whether (x, y) lies within [r] of any segment. */
  private fun near(segments: List<FloatArray>, x: Float, y: Float, r: Float): Boolean {
    for (s in segments) {
      val dx = s[2] - s[0]
      val dy = s[3] - s[1]
      val len2 = dx * dx + dy * dy
      val t = if (len2 == 0f) 0f else (((x - s[0]) * dx + (y - s[1]) * dy) / len2).coerceIn(0f, 1f)
      val ex = s[0] + t * dx - x
      val ey = s[1] + t * dy - y
      if (ex * ex + ey * ey <= r * r) return true
    }
    return false
  }
  var ms = 0L
    private set

  private fun create(): PoseLandmarker {
    fun options(delegate: Delegate) = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(BaseOptions.builder().setModelAssetBuffer(model).setDelegate(delegate).build())
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.4f)
      .setMinPosePresenceConfidence(0.4f)
      .setMinTrackingConfidence(0.4f)
      .build()
    return try {
      PoseLandmarker.createFromOptions(appContext, options(Delegate.GPU))
    } catch (e: Exception) {
      PoseLandmarker.createFromOptions(appContext, options(Delegate.CPU))
    }
  }

  /**
   * Joints per dancer as [x, y, visibility] x 33 in the frame's normalised coordinates, or null
   * where no pose was found. [masks] are the tracked 256x256 logits over the frame.
   */
  fun detect(frame: Bitmap, masks: List<FloatArray>, timestampMs: Long): List<FloatArray?> {
    val t0 = System.nanoTime()
    val w = frame.width
    val h = frame.height
    val seconds = timestampMs / 1000.0
    val result = masks.indices.map { i ->
      val box = bounds(masks[i]) ?: return@map lost(i)
      val centre = floatArrayOf((box[0] + box[2] + 1) / 2f / MASK, (box[1] + box[3] + 1) / 2f / MASK)
      val previousCentre = centres[i]
      centres[i] = centre
      // Mostly hidden behind the partner: whatever the model finds is more likely him than her
      // (her face cover floated into the background at Basic Whip ~9.9 s). Count it as missed.
      val visible = visibleCells(masks, i)
      typical[i] = maxOf(typical[i] * TYPICAL_DECAY, visible.toFloat())
      if (visible < typical[i] * MIN_VISIBLE_SHARE) return@map missed(i, centre, previousCentre)
      val crop = crop(i, box, w, h) ?: return@map lost(i)
      val (x0, y0, x1, y1) = crop
      val cw = x1 - x0
      val ch = y1 - y0
      val px = IntArray(cw * ch)
      frame.getPixels(px, 0, cw, x0, y0, cw, ch)
      // Grey out the partner so the model sees one person. The masks alone are not enough where
      // arms overlap: once the leader's mask held the follower's arm (clip 1, joined hands at
      // ~6 s), her crop greyed her own arm out and his pose model took it as his second arm. So
      // the previous frame's arms arbitrate: near her own arms nothing is greyed, near the
      // partner's arms everything is, except what only her own mask claims: his hand reaching
      // for her face greyed her shoulder and head, and her skeleton collapsed into a column
      // (Basic Whip video 2, ~14.4 s). Halving the band near her torso instead let his forearm
      // beside her shoulder through, and her arm followed his for two seconds (~13 s).
      val reach = ARM_REACH * w
      val own = armSegments(last[i], w, h)
      val theirs = masks.indices.filter { it != i }.flatMap { armSegments(last[it], w, h) }
      parallelFor(ch) { y ->
        val my256 = (y0 + y) * MASK / h
        for (x in 0 until cw) {
          val cell = my256 * MASK + (x0 + x) * MASK / w
          val fx = (x0 + x).toFloat()
          val fy = (y0 + y).toFloat()
          if (near(own, fx, fy, reach)) continue
          val partnerClaims = masks.indices.any { it != i && masks[it][cell] > 0f }
          val partnerOnly = masks[i][cell] <= 0f && partnerClaims
          val ownOnly = masks[i][cell] > 0f && !partnerClaims
          if (partnerOnly || (!ownOnly && near(theirs, fx, fy, reach))) px[y * cw + x] = GREY
        }
      }
      val image = Bitmap.createBitmap(px, cw, ch, Bitmap.Config.ARGB_8888)
      val res = landmarkers[i].detectForVideo(BitmapImageBuilder(image).build(), timestampMs)
      image.recycle()
      val lm = res.landmarks().firstOrNull()?.takeUnless { onPartner(it, x0, y0, cw, ch, w, h, masks, i) }
      if (lm == null) return@map missed(i, centre, previousCentre)
      misses[i] = 0
      val raw = FloatArray(lm.size * 3).also { out ->
        lm.forEachIndexed { j, p ->
          out[j * 3] = (x0 + p.x() * cw) / w
          out[j * 3 + 1] = (y0 + p.y() * ch) / h
          out[j * 3 + 2] = p.visibility().orElse(0f)
        }
      }
      smoothers[i].filter(raw, seconds, h.toFloat() / w)
    }
    result.forEachIndexed { i, joints -> last[i] = joints }
    ms += (System.nanoTime() - t0) / 1_000_000
    return result
  }

  /**
   * Whether a pose found in dancer [i]'s crop is not hers: most of its torso (shoulders, hips)
   * on cells the partner's mask claims more strongly than hers, or that hers does not claim at
   * all. When one dancer is hidden behind the other, the model found the one in front through
   * the greying and her skeleton was drawn on his body (Basic Whip video 2, ~4.7 s and ~10.3 s);
   * with only his head showing, it fitted a whole body around the head, out into the empty
   * background. Such a pose counts as missed.
   */
  private fun onPartner(
    lm: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>,
    x0: Int, y0: Int, cw: Int, ch: Int, w: Int, h: Int, masks: List<FloatArray>, i: Int,
  ): Boolean {
    var theirs = 0
    for (n in TORSO) {
      val fx = (x0 + lm[n].x() * cw) / w
      val fy = (y0 + lm[n].y() * ch) / h
      val cell = (fy * MASK).toInt().coerceIn(0, MASK - 1) * MASK + (fx * MASK).toInt().coerceIn(0, MASK - 1)
      val mine = masks[i][cell]
      if (mine <= 0f || masks.indices.any { it != i && masks[it][cell] > mine }) theirs++
    }
    return theirs >= TORSO_ON_PARTNER
  }

  /** A missed frame or two: carry the last pose along with her mask instead of blinking. */
  private fun missed(i: Int, centre: FloatArray, previousCentre: FloatArray?): FloatArray? {
    if (++misses[i] > HOLD || !smoothers[i].primed || previousCentre == null) return lost(i)
    return smoothers[i].shift(centre[0] - previousCentre[0], centre[1] - previousCentre[1])
  }

  /** Cells where dancer [i]'s mask is the strongest claim: how much of her the camera sees. */
  private fun visibleCells(masks: List<FloatArray>, i: Int): Int {
    var n = 0
    for (p in 0 until MASK * MASK) {
      val mine = masks[i][p]
      if (mine > 0f && masks.indices.none { it != i && masks[it][p] > mine }) n++
    }
    return n
  }

  /** No pose for dancer [i]: the next one she gets starts afresh. */
  private fun lost(i: Int): FloatArray? {
    misses[i] = HOLD + 1
    smoothers[i].reset()
    return null
  }

  /**
   * Dancer [i]'s crop for her mask [box] (cells), in frame pixels, or null if too small. The
   * previous crop is kept while it holds her box with [MIN_MARGIN] and is not much larger than a
   * fresh one would be; a fresh crop gets [MARGIN] plus [SLACK], so small moves stay inside it.
   */
  private fun crop(i: Int, box: IntArray, w: Int, h: Int): IntArray? {
    fun around(margin: Float): IntArray {
      val mx = (box[2] - box[0] + 1) * margin
      val my = (box[3] - box[1] + 1) * margin
      return intArrayOf(
        maxOf(0, ((box[0] - mx) * w / MASK).toInt()),
        maxOf(0, ((box[1] - my) * h / MASK).toInt()),
        minOf(w, ((box[2] + 1 + mx) * w / MASK).toInt()),
        minOf(h, ((box[3] + 1 + my) * h / MASK).toInt()),
      )
    }
    fun area(c: IntArray) = (c[2] - c[0]).toLong() * (c[3] - c[1])
    val fresh = around(MARGIN + SLACK)
    val need = around(MIN_MARGIN)
    val kept = crops[i]
    val c = if (
      kept != null && kept[0] <= need[0] && kept[1] <= need[1] && kept[2] >= need[2] && kept[3] >= need[3] &&
      area(kept) <= area(fresh) * MAX_GROWTH
    ) kept else fresh
    crops[i] = c
    return if (c[2] - c[0] < 16 || c[3] - c[1] < 16) null else c
  }

  /** [minX, minY, maxX, maxY] of the mask's cells, or null if empty or tiny. */
  private fun bounds(mask: FloatArray): IntArray? {
    var x0 = MASK
    var y0 = MASK
    var x1 = -1
    var y1 = -1
    var n = 0
    for (p in 0 until MASK * MASK) {
      if (mask[p] <= 0f) continue
      val x = p % MASK
      val y = p / MASK
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      n++
    }
    return if (n < 30) null else intArrayOf(x0, y0, x1, y1)
  }

  override fun close() = landmarkers.forEach { it.close() }

  companion object {
    private const val MASK = 256
    private const val MARGIN = 0.25f
    /** Extra room around a fresh crop, so the dancer can move a little before it must move. */
    private const val SLACK = 0.1f
    /** The least room a kept crop must leave around her mask. */
    private const val MIN_MARGIN = 0.1f
    /** A kept crop may be at most this much larger (area) than a fresh one; then it shrinks. */
    private const val MAX_GROWTH = 1.6f
    /** Tracked frames in a row (~0.13 s at 15) a missed pose is carried along with her mask. */
    private const val HOLD = 2
    private const val GREY = 0xFF808080.toInt()

    /** Bones drawn: arms, shoulders, hips, torso sides, legs (BlazePose indices). */
    val BONES = arrayOf(
      11 to 13, 13 to 15, 12 to 14, 14 to 16,
      11 to 12, 23 to 24, 11 to 23, 12 to 24,
      23 to 25, 25 to 27, 24 to 26, 26 to 28,
    )
    /** Arm segments used to arbitrate crops: upper arms and forearms. */
    private val ARMS = arrayOf(11 to 13, 13 to 15, 12 to 14, 14 to 16)
    /** Torso joints for [onPartner], and how many of them off her own body disown a pose. */
    private val TORSO = intArrayOf(11, 12, 23, 24)
    private const val TORSO_ON_PARTNER = 3
    /** Below this share of her usual visible area, a dancer's pose is not looked for. */
    private const val MIN_VISIBLE_SHARE = 0.3f
    /** Per tracked frame; halves the usual area in ~9 s at 15 tracked frames a second. */
    private const val TYPICAL_DECAY = 0.995f
    /** How close to an arm (share of frame width) counts as "that arm", ~32 px at 720p. */
    private const val ARM_REACH = 0.025f
    /** Joints drawn as dots: wrists and ankles. */
    val ENDS = intArrayOf(15, 16, 27, 28)
    const val VISIBLE = 0.5f
  }
}
