package expo.modules.videoanonymize

import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Rect
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.view.Surface
import java.io.File
import kotlin.math.roundToInt

/**
 * H.264 encoder fed by drawing bitmaps onto its input surface.
 *
 * A canvas-fed surface cannot carry presentation timestamps, so they are rewritten on the
 * way out from the frame index. That relies on output order == input order, which holds
 * because B-frames are disabled.
 */
class SurfaceEncoder(
  out: File,
  private val width: Int,
  private val height: Int,
  fps: Double,
  orientationHint: Int,
) {
  private val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
  private val muxer = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
  private val surface: Surface
  private val info = MediaCodec.BufferInfo()
  private val frameDurationUs = (1_000_000 / fps).toLong()
  private val dst = Rect(0, 0, width, height)
  /** Frames are drawn at working resolution; bilinear upscaling only blends palette colours. */
  private val scalePaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private var track = -1
  private var framesOut = 0L
  private var released = false

  init {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      // Flat colour regions compress extremely well; 2 Mbit/s is generous at 720p.
      setInteger(MediaFormat.KEY_BIT_RATE, 2_000_000)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps.roundToInt().coerceAtLeast(1))
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
    }
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    surface = codec.createInputSurface()
    codec.start()
    muxer.setOrientationHint(orientationHint)
  }

  fun encode(bitmap: Bitmap) {
    val canvas = surface.lockHardwareCanvas()
    try {
      canvas.drawBitmap(bitmap, null, dst, scalePaint)
    } finally {
      surface.unlockCanvasAndPost(canvas)
    }
    drain(endOfStream = false)
  }

  fun finish() {
    codec.signalEndOfInputStream()
    drain(endOfStream = true)
  }

  private fun drain(endOfStream: Boolean) {
    while (true) {
      val index = codec.dequeueOutputBuffer(info, if (endOfStream) 10_000 else 0)
      when {
        index == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!endOfStream) return
        index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          track = muxer.addTrack(codec.outputFormat)
          muxer.start()
        }
        index >= 0 -> {
          val buffer = codec.getOutputBuffer(index)!!
          val isConfig = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
          if (!isConfig && info.size > 0 && track >= 0) {
            info.presentationTimeUs = framesOut * frameDurationUs
            framesOut++
            buffer.position(info.offset)
            buffer.limit(info.offset + info.size)
            muxer.writeSampleData(track, buffer, info)
          }
          codec.releaseOutputBuffer(index, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
      }
    }
  }

  fun release() {
    if (released) return
    released = true
    runCatching { codec.stop() }
    codec.release()
    surface.release()
    runCatching { if (track >= 0) muxer.stop() }
    muxer.release()
  }
}
