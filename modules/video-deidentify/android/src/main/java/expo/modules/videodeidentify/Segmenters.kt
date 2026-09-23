package expo.modules.videodeidentify

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.hypot

/**
 * Writes a per-pixel label for a frame: 0 = background, 1..n = person slot.
 * Slots are kept stable across frames where the segmenter can tell people apart.
 */
interface Segmenter : AutoCloseable {
  val name: String
  val delegate: String

  /** Fills [labels] (width * height of [frame]) and returns how many people were found. */
  fun segment(frame: Bitmap, timestampMs: Long, labels: ByteArray): Int
}

private fun loadModel(context: Context, asset: String): ByteBuffer {
  val bytes = context.assets.open(asset).use { it.readBytes() }
  return ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).apply {
    put(bytes)
    rewind()
  }
}

/** Tries the GPU delegate first and falls back to CPU if it cannot be created. */
private fun <T> createWithFallback(build: (Delegate) -> T): Pair<T, String> =
  try {
    build(Delegate.GPU) to "gpu"
  } catch (e: Exception) {
    // Keep the reason: whether the GPU path works decides the speed verdict.
    build(Delegate.CPU) to "cpu (gpu failed: ${e.message?.take(120)})"
  }

fun createSegmenter(context: Context, kind: String): Segmenter = when (kind) {
  "multiclass" -> CategorySegmenter.multiclass(context)
  "deeplab" -> CategorySegmenter.deeplab(context)
  else -> PoseSegmenter(context)
}

/** Nearest-neighbour sample of a mask of size mw x mh at output pixel (x, y) of w x h. */
private inline fun maskIndex(x: Int, y: Int, w: Int, h: Int, mw: Int, mh: Int): Int =
  (y * mh / h) * mw + (x * mw / w)

/**
 * MediaPipe PoseLandmarker with segmentation masks: one mask per detected person, so the
 * two dancers can be told apart. Identity is tracked by hip-centre distance between frames.
 */
class PoseSegmenter(context: Context) : Segmenter {
  override val name = "pose"
  override val delegate: String
  private val landmarker: PoseLandmarker
  private val model = loadModel(context, "pose_landmarker_full.task")

  /** Last known hip centre (normalised) per slot, or null if the slot was never seen. */
  private val lastCentre = arrayOfNulls<Pair<Float, Float>>(MAX_PEOPLE)

  init {
    val (lm, d) = createWithFallback { delegate ->
      val options = PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(
          BaseOptions.builder().setModelAssetBuffer(model).setDelegate(delegate).build()
        )
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(MAX_PEOPLE)
        .setMinPoseDetectionConfidence(0.3f)
        .setMinPosePresenceConfidence(0.3f)
        .setMinTrackingConfidence(0.3f)
        .setOutputSegmentationMasks(true)
        .build()
      PoseLandmarker.createFromOptions(context, options)
    }
    landmarker = lm
    delegate = d
  }

  override fun segment(frame: Bitmap, timestampMs: Long, labels: ByteArray): Int {
    labels.fill(0)
    val result = landmarker.detectForVideo(BitmapImageBuilder(frame).build(), timestampMs)
    val masks = result.segmentationMasks().orElse(emptyList())
    if (masks.isEmpty()) return 0

    val centres = result.landmarks().map { pose ->
      // 23 / 24 are the hips in the BlazePose topology.
      ((pose[23].x() + pose[24].x()) / 2f) to ((pose[23].y() + pose[24].y()) / 2f)
    }
    val slots = assignSlots(centres)

    val w = frame.width
    val h = frame.height
    val best = FloatArray(w * h)
    masks.forEachIndexed { i, mask ->
      val slot = (slots.getOrNull(i) ?: i) + 1
      val mw = mask.width
      val mh = mask.height
      val values = floatMask(mask)
      for (y in 0 until h) {
        for (x in 0 until w) {
          val v = values.get(maskIndex(x, y, w, h, mw, mh))
          val p = y * w + x
          if (v > THRESHOLD && v > best[p]) {
            best[p] = v
            labels[p] = slot.toByte()
          }
        }
      }
    }
    return masks.size
  }

  /**
   * Byte order of the float mask, decided from data on first use: a confidence must lie in
   * [0, 1], so whichever order keeps it there is the right one. Added because the masks drew
   * as outlines only on a Pixel 10a — but that did not change after this, so byte order was
   * not the cause. Unresolved; pose was dropped for detecting both dancers in 0-47% of frames.
   */
  private var maskOrder: ByteOrder? = null

  private fun floatMask(mask: MPImage): FloatBuffer {
    val bytes = ByteBufferExtractor.extract(mask)
    maskOrder?.let { return bytes.duplicate().order(it).asFloatBuffer() }

    fun plausible(order: ByteOrder): Boolean {
      val probe = bytes.duplicate().order(order).asFloatBuffer()
      return (0 until probe.limit()).all { probe.get(it) in 0f..1f }
    }
    val little = plausible(ByteOrder.LITTLE_ENDIAN)
    val big = plausible(ByteOrder.BIG_ENDIAN)
    // An all-zero mask is plausible either way; only a mask that tells them apart decides.
    if (little != big) maskOrder = if (little) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN
    return bytes.duplicate().order(if (big && !little) ByteOrder.BIG_ENDIAN else ByteOrder.LITTLE_ENDIAN)
      .asFloatBuffer()
  }

  /** Maps each detection to a slot, minimising total hip-centre movement since last frame. */
  private fun assignSlots(centres: List<Pair<Float, Float>>): List<Int> {
    fun dist(a: Pair<Float, Float>, b: Pair<Float, Float>?) =
      if (b == null) 0.5f else hypot(a.first - b.first, a.second - b.second)

    val slots = when (centres.size) {
      1 -> listOf(if (dist(centres[0], lastCentre[0]) <= dist(centres[0], lastCentre[1])) 0 else 1)
      2 -> {
        val keep = dist(centres[0], lastCentre[0]) + dist(centres[1], lastCentre[1])
        val swap = dist(centres[0], lastCentre[1]) + dist(centres[1], lastCentre[0])
        if (swap < keep) listOf(1, 0) else listOf(0, 1)
      }
      else -> centres.indices.toList()
    }
    slots.forEachIndexed { i, slot -> if (slot < MAX_PEOPLE) lastCentre[slot] = centres[i] }
    return slots
  }

  override fun close() = landmarker.close()

  companion object {
    const val MAX_PEOPLE = 2
    const val THRESHOLD = 0.5f
  }
}

/**
 * A MediaPipe ImageSegmenter that yields one category mask for everyone, so it cannot tell
 * dancers apart. [toCategory] maps the model's own ids onto [MulticlassCategory], which the
 * renderer and [MaskCleanup] understand.
 */
class CategorySegmenter(
  context: Context,
  override val name: String,
  modelAsset: String,
  private val toCategory: (Int) -> Int,
) : Segmenter {
  override val delegate: String
  private val segmenter: ImageSegmenter
  private val model = loadModel(context, modelAsset)
  private val lookup = IntArray(256) { toCategory(it) }

  init {
    val (s, d) = createWithFallback { delegate ->
      val options = ImageSegmenter.ImageSegmenterOptions.builder()
        .setBaseOptions(
          BaseOptions.builder().setModelAssetBuffer(model).setDelegate(delegate).build()
        )
        .setRunningMode(RunningMode.VIDEO)
        .setOutputCategoryMask(true)
        .setOutputConfidenceMasks(false)
        .build()
      ImageSegmenter.createFromOptions(context, options)
    }
    segmenter = s
    delegate = d
  }

  override fun segment(frame: Bitmap, timestampMs: Long, labels: ByteArray): Int {
    val result = segmenter.segmentForVideo(BitmapImageBuilder(frame).build(), timestampMs)
    val mask: MPImage = result.categoryMask().orElse(null) ?: run {
      labels.fill(0)
      return 0
    }
    val w = frame.width
    val h = frame.height
    val mw = mask.width
    val mh = mask.height
    val values = ByteBufferExtractor.extract(mask)
    var any = false
    for (y in 0 until h) {
      for (x in 0 until w) {
        val category = lookup[values.get(maskIndex(x, y, w, h, mw, mh)).toInt() and 0xFF]
        labels[y * w + x] = category.toByte()
        any = any || category != MulticlassCategory.BACKGROUND
      }
    }
    return if (any) 1 else 0
  }

  override fun close() = segmenter.close()

  companion object {
    /** Google's selfie model: close-up people, but keeps hair / skin / clothes apart. */
    fun multiclass(context: Context) =
      CategorySegmenter(context, "multiclass", "selfie_multiclass_256x256.tflite") { it }

    /** PASCAL VOC person class. */
    private const val DEEPLAB_PERSON = 15

    /**
     * DeepLab-v3 (PASCAL VOC): trained on general scenes with full-body people, but it only
     * knows "person", so every person pixel is drawn as clothes — no internal structure.
     */
    fun deeplab(context: Context) =
      CategorySegmenter(context, "deeplab", "deeplab_v3.tflite") {
        if (it == DEEPLAB_PERSON) MulticlassCategory.CLOTHES else MulticlassCategory.BACKGROUND
      }
  }
}

/** Category ids of the selfie-multiclass model. */
object MulticlassCategory {
  const val BACKGROUND = 0
  const val HAIR = 1
  const val BODY_SKIN = 2
  const val FACE_SKIN = 3
  const val CLOTHES = 4
  const val OTHERS = 5
}
