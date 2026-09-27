package expo.modules.videodeidentify

import java.util.stream.IntStream

/**
 * Building blocks for the per-pixel work around the models. Profiling on a Pixel 10a put more
 * than half of each frame (~1.2 of ~2.1 s) into plain Kotlin loops over 720p: single-threaded,
 * with `exp` and a division per pixel.
 */

/** Runs [body] for 0 until [n] across all cores. Each index must write only its own outputs. */
inline fun parallelFor(n: Int, crossinline body: (Int) -> Unit) {
  IntStream.range(0, n).parallel().forEach { body(it) }
}

/** Logistic function by table: 1/128-logit steps over [-16, 16], exactly 0.5 at 0. */
object Sigmoid {
  private const val RANGE = 16f
  private const val STEPS_PER_UNIT = 128
  private val table = FloatArray((2 * RANGE * STEPS_PER_UNIT).toInt() + 1) { i ->
    val v = i.toDouble() / STEPS_PER_UNIT - RANGE
    (1.0 / (1.0 + kotlin.math.exp(-v))).toFloat()
  }

  fun of(v: Float): Float = when {
    v <= -RANGE -> 0f
    v >= RANGE -> 1f
    else -> table[((v + RANGE) * STEPS_PER_UNIT + 0.5f).toInt()]
  }
}

/**
 * Half-pixel bilinear resampling (align_corners = false, as PyTorch / SAM 2) from a fixed source
 * size to a fixed destination size, with the per-row and per-column indices and weights computed
 * once instead of per pixel.
 */
class Bilinear(private val srcW: Int, private val srcH: Int, private val dstW: Int, private val dstH: Int) {
  private val x0 = IntArray(dstW)
  private val x1 = IntArray(dstW)
  private val tx = FloatArray(dstW)
  private val y0 = IntArray(dstH)
  private val y1 = IntArray(dstH)
  private val ty = FloatArray(dstH)

  init {
    for (x in 0 until dstW) {
      val f = ((x + 0.5f) * srcW / dstW - 0.5f).coerceIn(0f, (srcW - 1).toFloat())
      x0[x] = f.toInt(); x1[x] = minOf(x0[x] + 1, srcW - 1); tx[x] = f - x0[x]
    }
    for (y in 0 until dstH) {
      val f = ((y + 0.5f) * srcH / dstH - 0.5f).coerceIn(0f, (srcH - 1).toFloat())
      y0[y] = f.toInt(); y1[y] = minOf(y0[y] + 1, srcH - 1); ty[y] = f - y0[y]
    }
  }

  /** What happens to each interpolated value. */
  enum class Out { PLAIN, SIGMOID, MEMORY_SOFT, MEMORY_HARD }

  /**
   * Resamples [src] into [dst] at [offset]. PLAIN keeps the value; SIGMOID maps it through the
   * logistic; MEMORY_* scale it for EdgeTAM's memory encoder (sigmoid*20-10, or (v>0)*20-10).
   */
  fun resample(src: FloatArray, dst: FloatArray, out: Out = Out.PLAIN, offset: Int = 0) {
    parallelFor(dstH) { y ->
      val r0 = y0[y] * srcW
      val r1 = y1[y] * srcW
      val wy = ty[y]
      val row = offset + y * dstW
      for (x in 0 until dstW) {
        val wx = tx[x]
        val top = src[r0 + x0[x]] * (1 - wx) + src[r0 + x1[x]] * wx
        val bottom = src[r1 + x0[x]] * (1 - wx) + src[r1 + x1[x]] * wx
        val v = top * (1 - wy) + bottom * wy
        dst[row + x] = when (out) {
          Out.PLAIN -> v
          Out.SIGMOID -> Sigmoid.of(v)
          Out.MEMORY_SOFT -> 20f * Sigmoid.of(v) - 10f
          Out.MEMORY_HARD -> if (v > 0f) 10f else -10f
        }
      }
    }
  }
}

/**
 * Mean over a (2r+1)^2 window, edges averaged over the in-frame part: separable sliding sums,
 * rows in parallel then columns in parallel, with the window sizes' reciprocals precomputed.
 */
class BoxMean(private val w: Int, private val h: Int, private val r: Int) {
  private val rowSum = FloatArray(w * h)
  private val invX = FloatArray(w) { x -> 1f / (minOf(x + r, w - 1) - maxOf(x - r, 0) + 1) }
  private val invY = FloatArray(h) { y -> 1f / (minOf(y + r, h - 1) - maxOf(y - r, 0) + 1) }

  fun apply(src: FloatArray, dst: FloatArray) {
    parallelFor(h) { y ->
      val row = y * w
      var sum = 0f
      for (x in 0..minOf(r, w - 1)) sum += src[row + x]
      for (x in 0 until w) {
        rowSum[row + x] = sum * invX[x]
        val add = x + r + 1
        val drop = x - r
        if (add < w) sum += src[row + add]
        if (drop >= 0) sum -= src[row + drop]
      }
    }
    parallelFor(w) { x ->
      var sum = 0f
      for (y in 0..minOf(r, h - 1)) sum += rowSum[y * w + x]
      for (y in 0 until h) {
        dst[y * w + x] = sum * invY[y]
        val add = y + r + 1
        val drop = y - r
        if (add < h) sum += rowSum[add * w + x]
        if (drop >= 0) sum -= rowSum[drop * w + x]
      }
    }
  }
}
