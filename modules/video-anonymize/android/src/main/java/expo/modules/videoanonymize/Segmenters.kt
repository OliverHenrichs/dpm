package expo.modules.videoanonymize

import android.content.Context
import android.graphics.Bitmap

/**
 * Writes a per-pixel label for a frame: 0 = background, 1..n = person slot, stable across frames.
 *
 * The seam SilhouetteRenderer draws through. EdgeTAM tracking is the only implementation left:
 * the spike's per-frame segmenters (MediaPipe pose masks, selfie-multiclass, DeepLab) lost
 * dancers in closed position and were removed with their models.
 */
interface Segmenter : AutoCloseable {
  val name: String
  val delegate: String

  /** Segmenter-specific numbers for the result, e.g. per-graph timing. */
  val extraStats: Map<String, Any> get() = emptyMap()

  /**
   * Fills [labels] (width * height of [frame]) and returns how many people were found. A
   * segmenter that looks ahead (see [drain]) may instead return -1, meaning "no frame ready yet";
   * its labels then lag the input, but come out in order.
   */
  fun segment(frame: Bitmap, timestampMs: Long, labels: ByteArray): Int

  /** After the last frame: fills [labels] with the next pending frame, or returns -1 when none. */
  fun drain(labels: ByteArray): Int = -1
}

fun createSegmenter(
  context: Context,
  kind: String,
  prompts: List<android.graphics.PointF> = emptyList(),
): Segmenter = when (kind) {
  "edgetam" -> EdgeTamSegmenter(context, prompts)
  else -> throw IllegalArgumentException("Unknown segmenter \"$kind\"")
}
