package expo.modules.videodeidentify

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
 * so each gets her own cut-out from her tracked mask, with 25% margin and her partner's pixels
 * greyed out; one person per crop is what the model is built for. Without the greying, the
 * follower's skeleton jumped onto the more prominent leader in closed position (clip 1).
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
    val result = masks.indices.map { i ->
      val box = bounds(masks[i]) ?: return@map null
      val mx = ((box[2] - box[0]) * MARGIN).toInt()
      val my = ((box[3] - box[1]) * MARGIN).toInt()
      val x0 = maxOf(0, box[0] * w / MASK - mx * w / MASK)
      val y0 = maxOf(0, box[1] * h / MASK - my * h / MASK)
      val x1 = minOf(w, (box[2] + 1) * w / MASK + mx * w / MASK)
      val y1 = minOf(h, (box[3] + 1) * h / MASK + my * h / MASK)
      val cw = x1 - x0
      val ch = y1 - y0
      if (cw < 16 || ch < 16) return@map null
      val px = IntArray(cw * ch)
      frame.getPixels(px, 0, cw, x0, y0, cw, ch)
      // Grey out the partner so the model sees one person. The masks alone are not enough where
      // arms overlap: once the leader's mask held the follower's arm (clip 1, joined hands at
      // ~6 s), her crop greyed her own arm out and his pose model took it as his second arm. So
      // the previous frame's arms arbitrate: near her own arms nothing is greyed, near the
      // partner's arms everything is, whatever the masks say.
      val reach = ARM_REACH * w
      val own = armSegments(last[i], w, h)
      val theirs = masks.indices.filter { it != i }.flatMap { armSegments(last[it], w, h) }
      for (y in 0 until ch) {
        val my256 = (y0 + y) * MASK / h
        for (x in 0 until cw) {
          val cell = my256 * MASK + (x0 + x) * MASK / w
          val fx = (x0 + x).toFloat()
          val fy = (y0 + y).toFloat()
          if (near(own, fx, fy, reach)) continue
          val partnerOnly = masks[i][cell] <= 0f && masks.indices.any { it != i && masks[it][cell] > 0f }
          if (partnerOnly || near(theirs, fx, fy, reach)) px[y * cw + x] = GREY
        }
      }
      val crop = Bitmap.createBitmap(px, cw, ch, Bitmap.Config.ARGB_8888)
      val res = landmarkers[i].detectForVideo(BitmapImageBuilder(crop).build(), timestampMs)
      crop.recycle()
      val lm = res.landmarks().firstOrNull() ?: return@map null
      FloatArray(lm.size * 3).also { out ->
        lm.forEachIndexed { j, p ->
          out[j * 3] = (x0 + p.x() * cw) / w
          out[j * 3 + 1] = (y0 + p.y() * ch) / h
          out[j * 3 + 2] = p.visibility().orElse(0f)
        }
      }
    }
    result.forEachIndexed { i, joints -> last[i] = joints }
    ms += (System.nanoTime() - t0) / 1_000_000
    return result
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
    private const val GREY = 0xFF808080.toInt()

    /** Bones drawn: arms, shoulders, hips, torso sides, legs (BlazePose indices). */
    val BONES = arrayOf(
      11 to 13, 13 to 15, 12 to 14, 14 to 16,
      11 to 12, 23 to 24, 11 to 23, 12 to 24,
      23 to 25, 25 to 27, 24 to 26, 26 to 28,
    )
    /** Arm segments used to arbitrate crops: upper arms and forearms. */
    private val ARMS = arrayOf(11 to 13, 13 to 15, 12 to 14, 14 to 16)
    /** How close to an arm (share of frame width) counts as "that arm", ~32 px at 720p. */
    private const val ARM_REACH = 0.025f
    /** Joints drawn as dots: wrists and ankles. */
    val ENDS = intArrayOf(15, 16, 27, 28)
    const val VISIBLE = 0.5f
  }
}
