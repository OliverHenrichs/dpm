package expo.modules.audioextract

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.sin

/**
 * Mixes interleaved PCM down to mono and resamples it with a windowed-sinc filter, carrying its
 * state across buffers.
 *
 * The filter matters when downsampling: a phone records at 44.1 or 48 kHz, and everything above
 * 8 kHz (cymbals, hi-hats, the music's sparkle) folds back into the speech band when samples are
 * simply dropped or interpolated. Each output sample is the input weighed by a low-pass kernel
 * centred on it, so what Whisper gets below 8 kHz is what was recorded there.
 */
internal class MonoResampler(sourceRate: Int, targetRate: Int) {
  private val step = sourceRate.toDouble() / targetRate
  /** The kernel's cutoff, as a fraction of the source's Nyquist frequency. */
  private val cutoff = min(1.0, targetRate.toDouble() / sourceRate) * PASSBAND
  /** How far the kernel reaches on each side, in input samples. */
  private val halfWidth = ceil(ZERO_CROSSINGS / cutoff).toInt()
  private val taps = 2 * halfWidth

  /**
   * The kernel's weights for each fractional position of an output between two inputs, PHASES
   * per input sample: row `phase`, tap `j` weighs input `floor(position) - halfWidth + 1 + j`.
   * Precomputed so each output is one dot product.
   */
  private val table = FloatArray((PHASES + 1) * taps) { index ->
    val t = (index / taps).toDouble() / PHASES + halfWidth - 1 - index % taps
    if (abs(t) >= halfWidth) {
      0f
    } else {
      val x = PI * cutoff * t
      val sinc = if (x == 0.0) 1.0 else sin(x) / x
      val hann = 0.5 + 0.5 * cos(PI * t / halfWidth)
      (cutoff * sinc * hann).toFloat()
    }
  }

  /**
   * Input samples still needed by outputs to come; history[0] is input sample `first`. It starts
   * with halfWidth samples of silence, which is what the first outputs read before the clip.
   */
  private var history = FloatArray(1 shl 14)
  private var held = halfWidth
  private var first = -halfWidth.toLong()
  /** Input samples pushed so far. */
  private var consumed = 0L
  /** Position of the next output sample, in input samples since the start. */
  private var nextOut = 0.0

  fun push(buffer: ByteBuffer, channels: Int, floatPcm: Boolean, write: (Float) -> Unit) {
    val frameBytes = channels * (if (floatPcm) 4 else 2)
    while (buffer.remaining() >= frameBytes) {
      var sum = 0f
      repeat(channels) {
        sum += if (floatPcm) buffer.float else buffer.short / 32768f
      }
      hold(sum / channels)
      consumed++
    }
    // An output needs the inputs up to halfWidth past it.
    drain(write) { it + halfWidth < consumed }
  }

  /** The outputs still owed for the input so far, reading silence past its end. */
  fun finish(write: (Float) -> Unit) {
    repeat(halfWidth) { hold(0f) }
    val end = consumed
    drain(write) { it < end }
  }

  private fun hold(sample: Float) {
    if (held == history.size) history = history.copyOf(history.size * 2)
    history[held++] = sample
  }

  private inline fun drain(write: (Float) -> Unit, ready: (Double) -> Boolean) {
    while (ready(nextOut)) {
      write(sampleAt(nextOut))
      nextOut += step
    }
    // Drop what no later output reaches back to.
    val keepFrom = floor(nextOut).toLong() - halfWidth
    val drop = min(keepFrom - first, held.toLong()).toInt()
    if (drop > 0) {
      System.arraycopy(history, drop, history, 0, held - drop)
      held -= drop
      first += drop
    }
  }

  private fun sampleAt(position: Double): Float {
    val whole = floor(position).toLong()
    val row = ((position - whole) * PHASES + 0.5).toInt() * taps
    val base = (whole - halfWidth + 1 - first).toInt()
    var acc = 0f
    for (j in 0 until taps) acc += history[base + j] * table[row + j]
    return acc
  }

  private companion object {
    /** Cutoff below the target's Nyquist frequency: 7.2 kHz for 16 kHz, before the roll-off. */
    const val PASSBAND = 0.9
    /** The sinc's zero crossings kept on each side; more is a steeper roll-off, and slower. */
    const val ZERO_CROSSINGS = 16
    const val PHASES = 256
  }
}

/** 16-bit mono WAV, header patched with the sizes on close. */
internal class WavWriter(file: File, private val rate: Int) {
  private val raf = RandomAccessFile(file, "rw").apply { setLength(0); write(ByteArray(44)) }
  private val chunk = ByteBuffer.allocate(8192).order(ByteOrder.LITTLE_ENDIAN)
  var samples = 0L
    private set

  fun write(value: Float) {
    val clamped = (value.coerceIn(-1f, 1f) * 32767f).toInt().toShort()
    chunk.putShort(clamped)
    samples++
    if (!chunk.hasRemaining()) flush()
  }

  private fun flush() {
    raf.write(chunk.array(), 0, chunk.position())
    chunk.clear()
  }

  fun close() {
    flush()
    val dataBytes = samples * 2
    val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
      put("RIFF".toByteArray()); putInt((36 + dataBytes).toInt())
      put("WAVE".toByteArray()); put("fmt ".toByteArray())
      putInt(16); putShort(1); putShort(1) // PCM, mono
      putInt(rate); putInt(rate * 2); putShort(2); putShort(16)
      put("data".toByteArray()); putInt(dataBytes.toInt())
    }
    raf.seek(0)
    raf.write(header.array())
    raf.close()
  }
}
