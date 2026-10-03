package expo.modules.videoanonymize

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import com.google.ai.edge.litert.Accelerator
import com.google.ai.edge.litert.CompiledModel
import java.io.File
import kotlin.math.exp

/**
 * RF-DETR-Seg Small (Roboflow, Apache-2.0), exported with `rfdetr`'s own TFLite export: one pass
 * finds every person in a frame with a mask each. Used to re-anchor a tracked dancer who has been
 * lost behind her partner, so it runs only occasionally — on the CPU, because the graph contains
 * GATHER / TOPK / CAST ops the GPU delegate does not take.
 *
 * Pre- and post-processing mirror `rfdetr/export/_tflite/inference.py`: bilinear resize (no
 * antialias) to 384x384, ImageNet normalisation, NHWC; sigmoid over class logits; masks are
 * 96x96 logits over the whole (squashed) frame, thresholded at 0 after bilinear upsampling.
 */
class PersonDetector(context: Context) : AutoCloseable {

  /** A detected person: mask logits (96x96 over the frame) and confidence. */
  class Person(val maskLogits: FloatArray, val score: Float)

  private val model: CompiledModel
  private val canvasBmp = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val pixels = IntArray(SIZE * SIZE)
  private val input = FloatArray(SIZE * SIZE * 3)

  var lastRunMs = 0.0
    private set

  init {
    val dir = File(context.filesDir, "rfdetr-v$MODEL_VERSION").apply { mkdirs() }
    val file = File(dir, "rfdetr-seg-small.tflite")
    if (!file.exists()) {
      context.assets.open("rfdetr/rfdetr-seg-small.tflite").use { i -> file.outputStream().use { i.copyTo(it) } }
    }
    model = CompiledModel.create(file.absolutePath, CompiledModel.Options(Accelerator.CPU))
  }

  fun detect(frame: Bitmap, threshold: Float = 0.35f): List<Person> {
    val t0 = System.nanoTime()
    Canvas(canvasBmp).drawBitmap(frame, null, RectF(0f, 0f, SIZE.toFloat(), SIZE.toFloat()), paint)
    canvasBmp.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE)
    for (i in pixels.indices) {
      val p = pixels[i]
      input[i * 3] = (((p shr 16) and 0xFF) / 255f - MEAN[0]) / STD[0]
      input[i * 3 + 1] = (((p shr 8) and 0xFF) / 255f - MEAN[1]) / STD[1]
      input[i * 3 + 2] = ((p and 0xFF) / 255f - MEAN[2]) / STD[2]
    }
    val inputs = model.createInputBuffers()
    val people = ArrayList<Person>()
    try {
      inputs[0].writeFloat(input)
      val outputs = model.run(inputs)
      try {
        // Outputs by shape: boxes (100x4), class logits (100x91), masks (100x96x96).
        val arrays = outputs.map { it.readFloat() }
        val logits = arrays.first { it.size == QUERIES * CLASSES }
        val masks = arrays.first { it.size == QUERIES * MASK * MASK }
        for (q in 0 until QUERIES) {
          val score = sigmoid(logits[q * CLASSES + PERSON])
          if (score >= threshold) {
            people += Person(masks.copyOfRange(q * MASK * MASK, (q + 1) * MASK * MASK), score)
          }
        }
      } finally {
        outputs.forEach { it.close() }
      }
    } finally {
      inputs.forEach { it.close() }
    }
    lastRunMs = (System.nanoTime() - t0) / 1_000_000.0
    return people
  }

  private fun sigmoid(v: Float) = 1f / (1f + exp(-v.coerceIn(-88f, 88f)))

  override fun close() {
    model.close()
    canvasBmp.recycle()
  }

  companion object {
    private const val MODEL_VERSION = 1
    private const val SIZE = 384
    const val MASK = 96
    private const val QUERIES = 100
    private const val CLASSES = 91
    /** COCO "person" in RF-DETR's class layout. */
    private const val PERSON = 1
    private val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
    private val STD = floatArrayOf(0.229f, 0.224f, 0.225f)

    /** Resamples a 96x96 logit mask (over the whole frame) to [w]x[h], half-pixel bilinear. */
    fun resample(mask: FloatArray, w: Int, h: Int): FloatArray {
      val out = FloatArray(w * h)
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
      return out
    }
  }
}
