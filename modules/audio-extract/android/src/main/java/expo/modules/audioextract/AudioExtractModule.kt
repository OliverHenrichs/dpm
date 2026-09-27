package expo.modules.audioextract

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

class NoAudioException :
  CodedException("ERR_NO_AUDIO", "The video has no audio track", null)

class AudioExtractException(message: String, cause: Throwable? = null) :
  CodedException("ERR_AUDIO_EXTRACT", message, cause)

/**
 * L4 (AGENT_TASKS.md): the speech in a video, as whisper.cpp wants it — 16 kHz mono 16-bit PCM
 * in a WAV file. whisper.cpp decodes nothing itself, and a pattern's video carries AAC or Opus.
 *
 * The audio track is decoded with MediaCodec, mixed down to mono and resampled while it streams,
 * so a long clip never sits in memory whole.
 */
class AudioExtractModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioExtract")

    AsyncFunction("extractSpeechWav") Coroutine { srcUri: String, maxSeconds: Double ->
      val context = appContext.reactContext ?: throw AudioExtractException("React context lost")
      withContext(Dispatchers.IO) { extract(context, Uri.parse(srcUri), maxSeconds) }
    }
  }

  private fun extract(context: Context, uri: Uri, maxSeconds: Double): Map<String, Any> {
    val started = System.nanoTime()
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(context, uri, null)
    } catch (e: Exception) {
      throw AudioExtractException("Cannot open $uri", e)
    }
    val track = (0 until extractor.trackCount).firstOrNull {
      extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
    } ?: run {
      extractor.release()
      throw NoAudioException()
    }
    extractor.selectTrack(track)
    val inputFormat = extractor.getTrackFormat(track)
    val mime = inputFormat.getString(MediaFormat.KEY_MIME)!!
    val codec = MediaCodec.createDecoderByType(mime)
    codec.configure(inputFormat, null, null, 0)
    codec.start()

    val outDir = File(context.cacheDir, "audio-extract").apply { mkdirs() }
    val out = File(outDir, "${System.currentTimeMillis()}-speech.wav")
    val writer = WavWriter(out, TARGET_RATE)
    var resampler: MonoResampler? = null
    var sourceRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    var channels = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    var floatPcm = false
    val maxOutSamples = if (maxSeconds > 0) (maxSeconds * TARGET_RATE).toLong() else Long.MAX_VALUE

    try {
      val info = MediaCodec.BufferInfo()
      var inputDone = false
      var outputDone = false
      while (!outputDone && writer.samples < maxOutSamples) {
        if (!inputDone) {
          val inIndex = codec.dequeueInputBuffer(TIMEOUT_US)
          if (inIndex >= 0) {
            val buffer = codec.getInputBuffer(inIndex)!!
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) {
              codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        when (val outIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)) {
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val format = codec.outputFormat
            sourceRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            floatPcm = format.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
              format.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
            resampler = null
          }
          MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
          else -> if (outIndex >= 0) {
            val buffer = codec.getOutputBuffer(outIndex)!!
            buffer.position(info.offset)
            buffer.limit(info.offset + info.size)
            val r = resampler ?: MonoResampler(sourceRate, TARGET_RATE).also { resampler = it }
            r.push(buffer.order(ByteOrder.LITTLE_ENDIAN), channels, floatPcm, writer)
            codec.releaseOutputBuffer(outIndex, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
          }
        }
      }
    } catch (e: CodedException) {
      throw e
    } catch (e: Exception) {
      throw AudioExtractException("Decoding failed", e)
    } finally {
      runCatching { codec.stop() }
      codec.release()
      extractor.release()
      writer.close()
    }

    return mapOf(
      "uri" to Uri.fromFile(out).toString(),
      "durationSeconds" to writer.samples.toDouble() / TARGET_RATE,
      "sourceSampleRate" to sourceRate,
      "sourceChannels" to channels,
      "elapsedMs" to (System.nanoTime() - started) / 1_000_000,
    )
  }

  companion object {
    const val TARGET_RATE = 16_000
    private const val TIMEOUT_US = 10_000L
  }
}

/**
 * Mixes interleaved PCM down to mono and resamples it by linear interpolation, carrying its
 * position across buffers. Linear interpolation is crude for music and fine for speech that is
 * going to a speech model at 16 kHz.
 */
private class MonoResampler(sourceRate: Int, targetRate: Int) {
  private val step = sourceRate.toDouble() / targetRate
  /** Position of the next output sample, in input samples since the start. */
  private var nextOut = 0.0
  /** Input samples consumed so far. */
  private var consumed = 0L
  private var previous = 0f

  fun push(buffer: ByteBuffer, channels: Int, floatPcm: Boolean, writer: WavWriter) {
    val frameBytes = channels * (if (floatPcm) 4 else 2)
    while (buffer.remaining() >= frameBytes) {
      var sum = 0f
      repeat(channels) {
        sum += if (floatPcm) buffer.float else buffer.short / 32768f
      }
      val current = sum / channels
      // Emit every output sample that falls between the previous input sample and this one.
      while (nextOut <= consumed) {
        val t = (nextOut - (consumed - 1)).toFloat().coerceIn(0f, 1f)
        writer.write(previous + (current - previous) * t)
        nextOut += step
      }
      previous = current
      consumed++
    }
  }
}

/** 16-bit mono WAV, header patched with the sizes on close. */
private class WavWriter(file: File, private val rate: Int) {
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
