package expo.modules.genaiprobe

import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * SPIKE (L4 suggestions, AGENT_TASKS.md): does this phone offer Gemini Nano through ML Kit's
 * Prompt API, and what does it make of the same prompt the llama.rn models get? Not for merge.
 */
class GenAiProbeModule : Module() {
  private val model by lazy { Generation.getClient() }

  override fun definition() = ModuleDefinition {
    Name("GenAiProbe")

    AsyncFunction("status") Coroutine { ->
      // The app's minSdk is 24 and ML Kit GenAI needs 26 (the manifest overrides the check).
      if (android.os.Build.VERSION.SDK_INT < 26) {
        return@Coroutine mapOf("status" to -1, "name" to "sdk too old")
      }
      val status = model.checkStatus()
      mapOf(
        "status" to status,
        "name" to when (status) {
          FeatureStatus.UNAVAILABLE -> "unavailable"
          FeatureStatus.DOWNLOADABLE -> "downloadable"
          FeatureStatus.DOWNLOADING -> "downloading"
          FeatureStatus.AVAILABLE -> "available"
          else -> "unknown"
        },
      )
    }

    AsyncFunction("download") Coroutine { ->
      var outcome = "started"
      model.download().collect { status ->
        outcome = when (status) {
          is DownloadStatus.DownloadStarted -> "started"
          is DownloadStatus.DownloadProgress -> "progress ${status.totalBytesDownloaded}"
          DownloadStatus.DownloadCompleted -> "completed"
          is DownloadStatus.DownloadFailed -> "failed: ${status.e.message}"
          else -> outcome
        }
      }
      outcome
    }

    AsyncFunction("generate") Coroutine { prompt: String ->
      val started = System.nanoTime()
      val response = model.generateContent(prompt)
      mapOf(
        "text" to (response.candidates.firstOrNull()?.text ?: ""),
        "ms" to (System.nanoTime() - started) / 1_000_000,
      )
    }
  }
}
