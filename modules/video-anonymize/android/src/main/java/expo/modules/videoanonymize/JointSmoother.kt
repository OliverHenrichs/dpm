package expo.modules.videoanonymize

/**
 * Steadies one dancer's pose over time, so the skeleton neither shakes nor blinks.
 *
 * Positions go through a One Euro filter per coordinate (Casiez et al., CHI 2012): heavy
 * smoothing while a joint is nearly still, where shaking shows most, and little while it moves
 * fast, so a turning arm does not trail behind. Visibility gets hysteresis: a joint appears at
 * [SHOW] and stays until its visibility drops under [HIDE], so a joint near the threshold no
 * longer blinks in and out. Positions are in the frame's normalised coordinates.
 *
 * Pure Kotlin, no Android, so it can be checked on a desktop JVM.
 */
class JointSmoother(private val joints: Int = 33) {
  private val x = FloatArray(joints * 2)
  private val dx = FloatArray(joints * 2)
  private val shown = BooleanArray(joints)
  private var lastSec = Double.NaN

  /** Whether a pose has gone in since the last [reset]. */
  val primed get() = !lastSec.isNaN()

  /** Forgets the past: the next pose is taken as it is. */
  fun reset() {
    lastSec = Double.NaN
  }

  /**
   * The steadied pose for [raw] ([x, y, visibility] x [joints]) seen at [seconds]. The returned
   * visibility is pushed clearly to one side of [PoseSkeletons.VISIBLE] (at least [SHOWN] or at
   * most [HIDDEN]), so averaging it with neighbouring frames keeps the decision.
   */
  fun filter(raw: FloatArray, seconds: Double): FloatArray {
    val first = lastSec.isNaN()
    val dt = if (first) 0.0 else (seconds - lastSec).coerceAtLeast(1e-3)
    lastSec = seconds
    val out = FloatArray(joints * 3)
    for (n in 0 until joints) {
      for (c in 0..1) {
        val k = n * 2 + c
        val v = raw[n * 3 + c]
        if (first) {
          x[k] = v
          dx[k] = 0f
        } else {
          val d = ((v - x[k]) / dt).toFloat()
          dx[k] += alpha(D_CUTOFF, dt) * (d - dx[k])
          val cutoff = MIN_CUTOFF + BETA * kotlin.math.abs(dx[k])
          x[k] += alpha(cutoff, dt) * (v - x[k])
        }
        out[n * 3 + c] = x[k]
      }
      val vis = raw[n * 3 + 2]
      shown[n] = if (first) vis >= SHOW else if (shown[n]) vis >= HIDE else vis >= SHOW
      out[n * 3 + 2] = if (shown[n]) maxOf(vis, SHOWN) else minOf(vis, HIDDEN)
    }
    return out
  }

  /** Moves the remembered pose by ([ox], [oy]), for a frame where the dancer moved unseen. */
  fun shift(ox: Float, oy: Float): FloatArray {
    val out = FloatArray(joints * 3)
    for (n in 0 until joints) {
      x[n * 2] += ox
      x[n * 2 + 1] += oy
      out[n * 3] = x[n * 2]
      out[n * 3 + 1] = x[n * 2 + 1]
      out[n * 3 + 2] = if (shown[n]) SHOWN else HIDDEN
    }
    return out
  }

  private fun alpha(cutoffHz: Float, dt: Double): Float {
    val tau = 1.0 / (2 * Math.PI * cutoffHz)
    return (1.0 / (1.0 + tau / dt)).toFloat()
  }

  companion object {
    /**
     * Cutoff (Hz) while a joint is still: low enough to calm the model's frame-to-frame shake
     * (a few pixels at 15 tracked frames a second). On synthetic joints with 3.6 px of noise at
     * 720p it halved the shake of a still joint.
     */
    const val MIN_CUTOFF = 1.5f
    /**
     * How much speed (frame widths per second) opens the cutoff, so fast moves keep up. At 6 a
     * swinging arm trailed by ~9 px; at 40 by ~3 px, about the model's own shake.
     */
    const val BETA = 40f
    /** Cutoff (Hz) for the speed estimate itself. */
    const val D_CUTOFF = 1f
    /** Visibility at which a hidden joint appears. */
    const val SHOW = 0.55f
    /** Visibility under which a shown joint disappears. */
    const val HIDE = 0.35f
    /** Visibility reported for a shown joint, at least: well above [PoseSkeletons.VISIBLE]. */
    const val SHOWN = 0.75f
    /** Visibility reported for a hidden joint, at most: well below [PoseSkeletons.VISIBLE]. */
    const val HIDDEN = 0.25f
  }
}
