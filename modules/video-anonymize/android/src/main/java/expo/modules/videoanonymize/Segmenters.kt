package expo.modules.videoanonymize

import android.content.Context
import android.graphics.Bitmap

/**
 * Turns each source frame into the frame written to the video, with each person in a slot that
 * is stable across frames.
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
   * Fills [out] (ARGB, width * height of [frame]) and returns how many people were found. A
   * segmenter that looks ahead (see [drain]) may instead return -1, meaning "no frame ready yet";
   * its frames then lag the input, but come out in order.
   */
  fun segment(frame: Bitmap, timestampMs: Long, out: IntArray): Int

  /** After the last frame: fills [out] with the next pending frame, or returns -1 when none. */
  fun drain(out: IntArray): Int = -1
}

fun createSegmenter(
  context: Context,
  kind: String,
  prompts: List<android.graphics.PointF> = emptyList(),
  style: RenderStyle = RenderStyle.SILHOUETTE,
): Segmenter = when (kind) {
  "edgetam" -> EdgeTamSegmenter(context, prompts, style)
  else -> throw IllegalArgumentException("Unknown segmenter \"$kind\"")
}
