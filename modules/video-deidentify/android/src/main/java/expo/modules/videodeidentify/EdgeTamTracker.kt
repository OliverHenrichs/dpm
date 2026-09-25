package expo.modules.videodeidentify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.RectF
import com.google.ai.edge.litert.Accelerator
import com.google.ai.edge.litert.CompiledModel
import java.io.File
import kotlin.math.cos
import kotlin.math.sin

/**
 * EdgeTAM (on-device SAM 2) video tracking of several objects on LiteRT, GPU first.
 *
 * Adapted from john-rocky/LiteRT-Models `EdgeTamVideoTracker` (MIT, (c) 2026 Daisuke Majima),
 * whose graphs `scripts/convert_edgetam_video.py` reproduces. Changes here:
 *  - several objects: a frame is encoded once and shared, each object keeps its own memory;
 *  - memory banks are pruned to what `assemble` can read (the original kept every frame, about
 *    256 KB each — ~230 MB over a 30 s clip);
 *  - models load from a file copy, since assets may be stored compressed in this app;
 *  - GPU with a CPU fallback that is reported, and per-graph timing;
 *  - memory is written as SAM 2 does it — soft masks on tracking frames, and one object per
 *    pixel across objects (see memorizeAll); the port did neither.
 *
 *   encode    frame[3x1024x1024] -> [pix_raw | hi0 | hi1]              once per frame
 *   memcond   [pix_raw | memory | mem_pos | key_mask] -> pix_feat      per object, tracking
 *   decode    [pix_feat | hi0 | hi1 | sparse] -> [masks | iou | ptrs | score]   per object
 *   memorize  [pix_raw | mask_for_mem] -> [spatial_mem | spatial_pos]  per object
 */
class EdgeTamTracker(
  context: Context,
  /** Graphs to run on the CPU even when the GPU works — for diagnosing GPU numerics. */
  cpuGraphs: Set<String> = emptySet(),
  /**
   * Graphs to compute in fp32 on the GPU instead of the default fp16. Tried for a dancer who
   * vanished while mostly hidden (clip 1): fp32 tracking made no difference and cost +0.7 s per
   * frame, so fp16 stays the default; kept as a diagnostic.
   */
  fp32Graphs: Set<String> = emptySet(),
) : AutoCloseable {

  class Timing {
    var frames = 0
    var encodeNs = 0L
    var memcondNs = 0L
    var decodeNs = 0L
    var memorizeNs = 0L
    var kotlinNs = 0L

    fun toMap(): Map<String, Any> {
      val n = frames.coerceAtLeast(1)
      fun ms(ns: Long) = ns / 1_000_000.0 / n
      return mapOf(
        "encodeMs" to ms(encodeNs),
        "memcondMs" to ms(memcondNs),
        "decodeMs" to ms(decodeNs),
        "memorizeMs" to ms(memorizeNs),
        "kotlinMs" to ms(kotlinNs),
      )
    }
  }

  val timing = Timing()

  /** Debug: when set, the encoder's exact input image is saved here for [dumpFrames]. */
  var dumpDir: File? = null
  private val dumpFrames = setOf(0, 60, 108, 114, 120)
  /** Where each graph actually runs, e.g. {encode=GPU, memcond=CPU}. */
  val accelerators = linkedMapOf<String, String>()
  val accelerator get() = accelerators.entries.joinToString(" ") { "${it.key}=${it.value}" }

  private val encode: CompiledModel
  private val memcond: CompiledModel
  private val decode: CompiledModel
  private val memorize: CompiledModel

  private val noMemory: FloatArray
  private val mtpe: FloatArray
  private val noObjptr: FloatArray
  private val trackSparse: FloatArray
  private val gaussian: FloatArray
  private val pointEmbed1: FloatArray
  private val notAPoint: FloatArray

  private val inputFloats = FloatArray(3 * SIZE * SIZE)
  private val toMemory = Bilinear(256, 256, SIZE, SIZE)
  private val pixels = IntArray(SIZE * SIZE)
  private val canvasBmp = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)

  private class Spatial(val frame: Int, val mem: FloatArray, val pos: FloatArray)
  private class Pointer(val frame: Int, val ptr: FloatArray)
  private class ObjectState {
    val spatial = ArrayList<Spatial>()
    val pointers = ArrayList<Pointer>()
    /** Extra conditioning frames from corrections (SAM 2's add_new_mask on a later frame). */
    val conds = ArrayList<Spatial>()
  }

  private val objects = ArrayList<ObjectState>()

  init {
    // Versioned, so a changed model is always copied: a same-sized replacement would otherwise
    // be mistaken for the stale copy (see copyAsset). Bump MODEL_VERSION with the assets.
    File(context.filesDir, "edgetam").deleteRecursively() // pre-versioning copies
    context.filesDir.listFiles { f -> f.name.startsWith("edgetam-v") && f.name != "edgetam-v$MODEL_VERSION" }
      ?.forEach { it.deleteRecursively() }
    val dir = File(context.filesDir, "edgetam-v$MODEL_VERSION").apply { mkdirs() }
    fun model(name: String): CompiledModel {
      val file = copyAsset(context, "edgetam/$name.tflite", File(dir, "$name.tflite"))
      if (name in cpuGraphs) {
        accelerators[name] = "CPU"
        return CompiledModel.create(file.absolutePath, CompiledModel.Options(Accelerator.CPU))
      }
      val fp32 = name in fp32Graphs
      val options = CompiledModel.Options(Accelerator.GPU).apply {
        if (fp32) {
          gpuOptions = CompiledModel.GpuOptions(precision = CompiledModel.GpuOptions.Precision.FP32)
        }
      }
      return try {
        CompiledModel.create(file.absolutePath, options).also {
          accelerators[name] = if (fp32) "GPU32" else "GPU"
        }
      } catch (e: Exception) {
        accelerators[name] = "CPU(gpu failed: ${e.message?.take(60)})"
        CompiledModel.create(file.absolutePath, CompiledModel.Options(Accelerator.CPU))
      }
    }
    encode = model("encode")
    memcond = model("memcond")
    decode = model("decode")
    memorize = model("memorize")

    fun bin(name: String, n: Int): FloatArray {
      val bytes = context.assets.open("edgetam/$name.bin").use { it.readBytes() }
      val fb = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
      return FloatArray(n).also { fb.get(it) }
    }
    noMemory = bin("no_memory", 256)
    mtpe = bin("mtpe", 7 * 64)
    noObjptr = bin("no_objptr", 256)
    trackSparse = bin("track_sparse", 512)
    val prompt = bin("video_prompt", 768)
    gaussian = prompt.copyOfRange(0, 256)
    pointEmbed1 = prompt.copyOfRange(256, 512)
    notAPoint = prompt.copyOfRange(512, 768)
  }

  /**
   * First frame: one positive point per object, in the frame's normalised coordinates (0..1).
   * Returns one 256x256 logit mask per object (> 0 = object).
   */
  fun start(frame: Bitmap, points: List<PointF>): List<FloatArray> {
    objects.clear()
    val (pixRaw, hi0, hi1) = encodeFrame(frame, 0)
    val t0 = System.nanoTime()
    val pixFeat = FloatArray(IE)
    for (c in 0 until 256) {
      val nm = noMemory[c]
      val b = c * 4096
      for (s in 0 until 4096) pixFeat[b + s] = pixRaw[b + s] + nm
    }
    timing.kotlinNs += System.nanoTime() - t0
    val decoded = points.mapIndexed { i, p ->
      val state = ObjectState().also { objects += it }
      val others = points.filterIndexed { j, _ -> j != i }
      decodeOne(state, pixFeat, hi0, hi1, pointSparse(p.x * SIZE, p.y * SIZE)) { out ->
        exclusiveCandidate(out, p, others)
      }
    }
    memorizeAll(0, pixRaw, decoded)
    timing.frames++
    return decoded.map { it.mask }
  }

  /**
   * A later frame: each object is tracked from its own memory. [correct] sees the tracked masks
   * (256x256 logits) and may return, per object index, a corrected mask (logits, > 0 = object)
   * for this frame — see [applyCorrection].
   */
  fun track(
    fi: Int,
    frame: Bitmap,
    correct: ((List<FloatArray>) -> Map<Int, FloatArray>)? = null,
  ): List<FloatArray> {
    val (pixRaw, hi0, hi1) = encodeFrame(frame, fi)
    val masks = objects.map { state ->
      val t0 = System.nanoTime()
      val (memory, mpos, keyMask) = assemble(state, fi)
      val mcIn = FloatArray(IE + 2 * MC + MEM)
      System.arraycopy(pixRaw, 0, mcIn, 0, IE)
      System.arraycopy(memory, 0, mcIn, IE, MC)
      System.arraycopy(mpos, 0, mcIn, IE + MC, MC)
      System.arraycopy(keyMask, 0, mcIn, IE + 2 * MC, MEM)
      timing.kotlinNs += System.nanoTime() - t0
      val t1 = System.nanoTime()
      val pixFeat = run1(memcond, mcIn)
      timing.memcondNs += System.nanoTime() - t1
      decodeOne(state, pixFeat, hi0, hi1, trackSparse)
    }.toMutableList()
    correct?.invoke(masks.map { it.mask })?.forEach { (i, corrected) ->
      masks[i] = applyCorrection(masks[i].state, corrected, pixRaw, hi0, hi1)
    }
    memorizeAll(fi, pixRaw, masks)
    timing.frames++
    return masks.map { it.mask }
  }

  private fun encodeFrame(src: Bitmap, fi: Int): Triple<FloatArray, FloatArray, FloatArray> {
    val t0 = System.nanoTime()
    Canvas(canvasBmp).drawBitmap(src, null, RectF(0f, 0f, SIZE.toFloat(), SIZE.toFloat()), paint)
    dumpDir?.takeIf { fi in dumpFrames }?.let { dir ->
      File(dir, "encoder-input-$fi.png").outputStream().use {
        canvasBmp.compress(Bitmap.CompressFormat.PNG, 100, it)
      }
    }
    canvasBmp.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE)
    val plane = SIZE * SIZE
    val px = pixels
    val input = inputFloats
    parallelFor(SIZE) { y ->
      for (x in 0 until SIZE) {
        val i = y * SIZE + x
        val p = px[i]
        input[i] = NORM_R[(p shr 16) and 0xFF]
        input[plane + i] = NORM_G[(p shr 8) and 0xFF]
        input[2 * plane + i] = NORM_B[p and 0xFF]
      }
    }
    val t1 = System.nanoTime()
    val eo = run1(encode, inputFloats)
    val t2 = System.nanoTime()
    val out = Triple(
      eo.copyOfRange(0, IE),
      eo.copyOfRange(IE, IE + H0),
      eo.copyOfRange(IE + H0, IE + H0 + H1),
    )
    timing.kotlinNs += (t1 - t0) + (System.nanoTime() - t2)
    timing.encodeNs += t2 - t1
    return out
  }

  private fun run1(m: CompiledModel, input: FloatArray): FloatArray {
    val inb = m.createInputBuffers()
    try {
      inb[0].writeFloat(input)
      val outs = m.run(inb)
      try {
        return outs[0].readFloat()
      } finally {
        outs.forEach { it.close() }
      }
    } finally {
      inb.forEach { it.close() }
    }
  }

  /** Sparse prompt for a positive point in model (0..1024) coords: [point | not_a_point]. */
  private fun pointSparse(modelX: Float, modelY: Float): FloatArray {
    val sp = FloatArray(512)
    val ccx = 2f * ((modelX + 0.5f) / SIZE) - 1f
    val ccy = 2f * ((modelY + 0.5f) / SIZE) - 1f
    for (k in 0 until 128) {
      val proj = TWO_PI * (ccx * gaussian[k] + ccy * gaussian[128 + k])
      sp[k] = sin(proj) + pointEmbed1[k]
      sp[128 + k] = cos(proj) + pointEmbed1[128 + k]
    }
    for (k in 0 until 256) sp[256 + k] = notAPoint[k]
    return sp
  }

  /** get_1d_sine_pe(off/15, 64): [sin(32) | cos(32)]. */
  private fun sinePe(off: Int): FloatArray {
    val out = FloatArray(64)
    val pos = off / 15f
    for (i in 0 until 32) {
      val dimT = Math.pow(10000.0, (2.0 * (i / 2)) / 32.0).toFloat()
      val v = pos / dimT
      out[i] = sin(v)
      out[32 + i] = cos(v)
    }
    return out
  }

  /** Fixed memory [7x512 spatial | 16x4 ptr] + key mask for one object's bank. */
  private fun assemble(state: ObjectState, fi: Int): Triple<FloatArray, FloatArray, FloatArray> {
    val memory = FloatArray(MC)
    val mpos = FloatArray(MC)
    val mask = FloatArray(MEM) { -1e9f }
    val bank = state.spatial
    val condFrame = bank[0].frame
    val real = ArrayList<Pair<Spatial, Int>>()
    real.add(bank[0] to 6)
    // Corrections are conditioning frames too (temporal slot 6, as SAM 2 gives cond frames), but
    // only for CORRECTION_TTL frames: long enough to bring a dancer back. Kept for good, a
    // correction whose person mask included a sliver of the partner (joined hands at 96x96) kept
    // claiming that area for the rest of the clip — the follower's arm vanished into the leader.
    val live = state.conds.filter { fi - it.frame <= CORRECTION_TTL }.takeLast(MAX_CORRECTIONS)
    live.forEach { real.add(it to 6) }
    val corrected = live.map { it.frame }.toSet()
    for (off in NMM - 1 downTo 1) {
      if (real.size >= NMM) break
      val pf = fi - off
      if (pf == condFrame || pf in corrected) continue
      val hit = bank.firstOrNull { it.frame == pf } ?: continue
      real.add(hit to off - 1)
    }
    for ((slot, sp) in real.withIndex()) {
      val (s, mtpeIdx) = sp
      val base = slot * SPT * MEMCH
      System.arraycopy(s.mem, 0, memory, base, SPT * MEMCH)
      for (t in 0 until SPT) for (c in 0 until MEMCH) {
        mpos[base + t * MEMCH + c] = s.pos[t * MEMCH + c] + mtpe[mtpeIdx * 64 + c]
      }
    }
    for (i in 0 until real.size * SPT) mask[i] = 0f
    val recent = state.pointers.sortedByDescending { it.frame }.take(MAXP)
    var pi = 0
    val ptrBase = NMM * SPT * MEMCH
    for (p in recent) {
      val pp = sinePe(fi - p.frame)
      for (t in 0 until 4) {
        val dst = ptrBase + pi * MEMCH
        System.arraycopy(p.ptr, t * MEMCH, memory, dst, MEMCH)
        System.arraycopy(pp, 0, mpos, dst, MEMCH)
        mask[NMM * SPT + pi] = 0f
        pi++
      }
    }
    return Triple(memory, mpos, mask)
  }

  private class Decoded(
    val state: ObjectState,
    val mask: FloatArray,
    val ptr: FloatArray,
    val appearing: Boolean,
    val correction: Boolean = false,
  )

  /**
   * SAM 2's `add_new_mask` on a tracked frame: the given mask becomes this frame's output and a
   * conditioning memory (always attended to, like the first frame). The object pointer comes from
   * decoding a point inside the mask on unconditioned features, choosing the candidate that
   * overlaps the mask best — the port's decoder cannot take a mask prompt.
   */
  private fun applyCorrection(
    state: ObjectState,
    corrected: FloatArray,
    pixRaw: FloatArray,
    hi0: FloatArray,
    hi1: FloatArray,
  ): Decoded {
    var sx = 0.0
    var sy = 0.0
    var n = 0
    for (p in 0 until 65536) if (corrected[p] > 0f) { sx += p % 256; sy += p / 256; n++ }
    val cx = sx / n
    val cy = sy / n
    var inside = 0
    var bestD = Double.MAX_VALUE
    for (p in 0 until 65536) {
      if (corrected[p] <= 0f) continue
      val d = (p % 256 - cx) * (p % 256 - cx) + (p / 256 - cy) * (p / 256 - cy)
      if (d < bestD) { bestD = d; inside = p }
    }
    val pixFeat = FloatArray(IE)
    for (c in 0 until 256) {
      val nm = noMemory[c]
      val b = c * 4096
      for (s in 0 until 4096) pixFeat[b + s] = pixRaw[b + s] + nm
    }
    val px = (inside % 256 + 0.5f) / 256f * SIZE
    val py = (inside / 256 + 0.5f) / 256f * SIZE
    val probe = decodeOne(state, pixFeat, hi0, hi1, pointSparse(px, py)) { out ->
      (0 until 3).maxBy { k ->
        var inter = 0
        var union = 0
        for (p in 0 until 65536) {
          val a = out[k * 65536 + p] > 0f
          val b = corrected[p] > 0f
          if (a && b) inter++
          if (a || b) union++
        }
        if (union == 0) 0.0 else inter.toDouble() / union
      }
    }
    return Decoded(state, corrected, probe.ptr, appearing = true, correction = true)
  }

  /** Decode, pick the best candidate, gate on the object score; returns 256x256 logits. */
  private fun decodeOne(
    state: ObjectState,
    pixFeat: FloatArray,
    hi0: FloatArray,
    hi1: FloatArray,
    sparse: FloatArray,
    choose: ((FloatArray) -> Int)? = null,
  ): Decoded {
    var t = System.nanoTime()
    val decIn = FloatArray(IE + H0 + H1 + 512)
    System.arraycopy(pixFeat, 0, decIn, 0, IE)
    System.arraycopy(hi0, 0, decIn, IE, H0)
    System.arraycopy(hi1, 0, decIn, IE + H0, H1)
    System.arraycopy(sparse, 0, decIn, IE + H0 + H1, 512)
    timing.kotlinNs += System.nanoTime() - t
    t = System.nanoTime()
    val out = run1(decode, decIn)
    timing.decodeNs += System.nanoTime() - t

    val best = choose?.invoke(out) ?: bestIou(out)
    val appearing = out[DEC_OUT - 1] > 0f
    val mask = FloatArray(256 * 256)
    if (appearing) System.arraycopy(out, best * 65536, mask, 0, 65536)
    else java.util.Arrays.fill(mask, NO_OBJ)
    val ptr = FloatArray(256)
    if (appearing) System.arraycopy(out, 196611 + best * 256, ptr, 0, 256)
    else System.arraycopy(noObjptr, 0, ptr, 0, 256)
    return Decoded(state, mask, ptr, appearing)
  }

  /**
   * Writes this frame into every object's memory.
   *
   * Non-overlap (SAM 2's `non_overlap_masks_for_mem_enc`): where several objects claim a pixel,
   * only the strongest keeps its logit for memory; the others are clamped to <= -10 there. Without
   * it the front dancer's track learned the hidden one's body as its own during a crossing, and the
   * hidden dancer came back unstable (clip 1, user's taps: area 73 → 2056 → 925 → 1808); with it the
   * track follows the PyTorch reference through the crossing. Returned masks are not altered.
   *
   * Soft masks: SAM 2 binarises only the prompted frame's mask for memory; tracking frames are
   * encoded soft, so memory keeps the uncertainty of a half-hidden dancer. The port binarised every
   * frame, and after a full occlusion the hidden dancer was never found again.
   */
  private fun memorizeAll(fi: Int, pixRaw: FloatArray, decoded: List<Decoded>) {
    var t = System.nanoTime()
    val forMemory = decoded.map { it.mask.copyOf() }
    if (forMemory.size > 1) {
      for (p in 0 until 65536) {
        var strongest = forMemory[0][p]
        for (m in forMemory) if (m[p] > strongest) strongest = m[p]
        for (m in forMemory) if (m[p] < strongest && m[p] > -10f) m[p] = -10f
      }
    }
    timing.kotlinNs += System.nanoTime() - t

    decoded.forEachIndexed { i, d ->
      t = System.nanoTime()
      val memIn = FloatArray(2 * IE)
      System.arraycopy(pixRaw, 0, memIn, 0, IE)
      // A correction is a given mask, not a prediction: binarised, like the first frame's.
      maskForMem(forMemory[i], memIn, IE, soft = fi > 0 && !d.correction)
      timing.kotlinNs += System.nanoTime() - t

      t = System.nanoTime()
      val mo = run1(memorize, memIn)
      timing.memorizeNs += System.nanoTime() - t

      val memory = Spatial(fi, mo.copyOfRange(0, SPT * MEMCH), mo.copyOfRange(SPT * MEMCH, 2 * SPT * MEMCH))
      if (d.correction) d.state.conds.add(memory) else d.state.spatial.add(memory)
      d.state.pointers.add(Pointer(fi, d.ptr))
      prune(d.state, fi)
    }
  }

  private fun bestIou(out: FloatArray): Int {
    var best = 0
    for (k in 1 until 3) if (out[196608 + k] > out[196608 + best]) best = k
    return best
  }

  /**
   * For a tapped point, SAM offers three candidates at different scales — a body part, the
   * person, the whole couple — and its own score often prefers the couple when two dancers
   * touch. Taking the largest candidate that contains this dancer's tap but none of the others'
   * picks the person. Falls back to the best-scored candidate when none qualifies.
   */
  private fun exclusiveCandidate(out: FloatArray, own: PointF, others: List<PointF>): Int {
    fun logitAt(k: Int, p: PointF): Float {
      val x = (p.x * 256).toInt().coerceIn(0, 255)
      val y = (p.y * 256).toInt().coerceIn(0, 255)
      return out[k * 65536 + y * 256 + x]
    }
    val ok = (0 until 3).filter { k -> logitAt(k, own) > 0f && others.none { logitAt(k, it) > 0f } }
    if (ok.isEmpty()) return bestIou(out)
    return ok.maxBy { k -> (0 until 65536).count { out[k * 65536 + it] > 0f } }
  }

  /** Keep the conditioning frame plus the last NMM-1 spatial frames, and the last MAXP pointers. */
  private fun prune(state: ObjectState, fi: Int) {
    val cond = state.spatial.first()
    state.spatial.removeAll { it !== cond && it.frame < fi - (NMM - 1) }
    if (state.pointers.size > MAXP) {
      state.pointers.sortByDescending { it.frame }
      while (state.pointers.size > MAXP) state.pointers.removeAt(state.pointers.lastIndex)
    }
  }

  /**
   * Bilinear 256->1024 (align_corners=False) of the logits, then scaled for the memory encoder
   * into [out]: sigmoid(v)*20-10 when [soft], else (v>0)*20-10.
   */
  private fun maskForMem(mask: FloatArray, out: FloatArray, offset: Int, soft: Boolean) {
    toMemory.resample(mask, out, if (soft) Bilinear.Out.MEMORY_SOFT else Bilinear.Out.MEMORY_HARD, offset)
  }

  override fun close() {
    encode.close()
    memcond.close()
    decode.close()
    memorize.close()
    canvasBmp.recycle()
  }

  companion object {
    /** Conditioning memories kept from corrections, besides the first frame, and for how long. */
    private const val MAX_CORRECTIONS = 2
    private const val CORRECTION_TTL = 15
    /** Bump whenever the .tflite assets change. 2: memcond without constant-only ops. */
    private const val MODEL_VERSION = 2
    private const val SIZE = 1024
    private val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
    private val STD = floatArrayOf(0.229f, 0.224f, 0.225f)
    /** ImageNet normalisation of an 8-bit channel value, per channel, by table. */
    private val NORM_R = FloatArray(256) { (it / 255f - MEAN[0]) / STD[0] }
    private val NORM_G = FloatArray(256) { (it / 255f - MEAN[1]) / STD[1] }
    private val NORM_B = FloatArray(256) { (it / 255f - MEAN[2]) / STD[2] }
    private const val IE = 256 * 64 * 64
    private const val H0 = 32 * 256 * 256
    private const val H1 = 64 * 128 * 128
    private const val NMM = 7
    private const val MAXP = 16
    private const val MEMCH = 64
    private const val SPT = 512
    private const val MEM = NMM * SPT + MAXP * 4
    private const val MC = MEM * MEMCH
    private const val NO_OBJ = -1024f
    private const val SCALE = 20f
    private const val BIAS = -10f
    private const val TWO_PI = (2.0 * Math.PI).toFloat()
    private const val DEC_OUT = 196608 + 3 + 768 + 1

    /**
     * Copies an asset to [dest] once; LiteRT maps models from files. `openFd` only works on
     * uncompressed assets, so for a compressed one an existing copy is trusted as is — replace
     * a model by reinstalling (which clears filesDir) rather than by updating in place.
     */
    private fun copyAsset(context: Context, asset: String, dest: File): File {
      val size = runCatching { context.assets.openFd(asset).use { it.length } }.getOrNull()
      if (dest.exists() && (size == null || dest.length() == size)) return dest
      context.assets.open(asset).use { input -> dest.outputStream().use { input.copyTo(it) } }
      return dest
    }
  }
}
