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
import java.nio.ByteOrder
import java.security.MessageDigest

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

    /** Hex SHA-256 of a file, streamed — for checking a downloaded model against its hash. */
    AsyncFunction("sha256File") Coroutine { fileUri: String ->
      withContext(Dispatchers.IO) {
        val path = Uri.parse(fileUri).path ?: throw AudioExtractException("Not a file URI: $fileUri")
        val digest = MessageDigest.getInstance("SHA-256")
        File(path).inputStream().use { input ->
          val buffer = ByteArray(1 shl 16)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
          }
        }
        digest.digest().joinToString("") { "%02x".format(it) }
      }
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
            resampler?.finish(writer::write)
            resampler = null
          }
          MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
          else -> if (outIndex >= 0) {
            val buffer = codec.getOutputBuffer(outIndex)!!
            buffer.position(info.offset)
            buffer.limit(info.offset + info.size)
            val r = resampler ?: MonoResampler(sourceRate, TARGET_RATE).also { resampler = it }
            r.push(buffer.order(ByteOrder.LITTLE_ENDIAN), channels, floatPcm, writer::write)
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
      // The filter runs a little behind its input; the clip's last few milliseconds.
      runCatching { resampler?.finish(writer::write) }
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
