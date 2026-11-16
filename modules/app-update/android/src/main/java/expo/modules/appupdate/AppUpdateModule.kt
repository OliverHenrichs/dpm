package expo.modules.appupdate

import android.app.Activity
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppUpdateException(message: String, cause: Throwable? = null) :
  CodedException("ERR_APP_UPDATE", message, cause)

/**
 * Google Play's in-app updates, flexible flow only: Play asks the user, downloads the update in
 * the background while the app keeps running, and the app restarts into it when the user says so
 * (`completeUpdate`). Works only for an install that came from Play; anywhere else (a dev client,
 * a sideloaded APK) `check` rejects or reports no update.
 */
class AppUpdateModule : Module() {
  private var manager: AppUpdateManager? = null
  private var listener: InstallStateUpdatedListener? = null

  /** The last `check`'s answer, which `startFlexibleUpdate` needs (Play wants the same object). */
  private var lastInfo: AppUpdateInfo? = null

  override fun definition() = ModuleDefinition {
    Name("AppUpdate")

    Events("onInstallStatus")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      val created = AppUpdateManagerFactory.create(context)
      val stateListener = InstallStateUpdatedListener { state ->
        sendEvent(
          "onInstallStatus",
          mapOf(
            "status" to statusName(state.installStatus()),
            "bytesDownloaded" to state.bytesDownloaded().toDouble(),
            "totalBytesToDownload" to state.totalBytesToDownload().toDouble(),
          ),
        )
      }
      created.registerListener(stateListener)
      manager = created
      listener = stateListener
    }

    OnDestroy {
      listener?.let { manager?.unregisterListener(it) }
      listener = null
      manager = null
      lastInfo = null
    }

    /** Whether Play has a newer version for this install, and how far a started update got. */
    AsyncFunction("check") { promise: Promise ->
      val m = manager ?: return@AsyncFunction promise.reject(AppUpdateException("Not ready"))
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          lastInfo = info
          promise.resolve(
            mapOf(
              "available" to (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE),
              "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
              "availableVersionCode" to info.availableVersionCode(),
              "stalenessDays" to info.clientVersionStalenessDays(),
              "status" to statusName(info.installStatus()),
            ),
          )
        }
        .addOnFailureListener { e ->
          promise.reject(AppUpdateException(e.message ?: "Update check failed", e))
        }
    }

    /**
     * Shows Play's update dialog. Resolves "accepted" (the download starts; progress arrives as
     * `onInstallStatus` events), "declined", or "failed".
     */
    AsyncFunction("startFlexibleUpdate") { promise: Promise ->
      val m = manager ?: return@AsyncFunction promise.reject(AppUpdateException("Not ready"))
      val info = lastInfo ?: return@AsyncFunction promise.reject(AppUpdateException("Call check first"))
      val activity: Activity = appContext.currentActivity
        ?: return@AsyncFunction promise.reject(AppUpdateException("No activity"))
      // Each AppUpdateInfo starts at most one flow; the next one needs a fresh check.
      lastInfo = null
      m.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
        .addOnSuccessListener { resultCode ->
          promise.resolve(
            when (resultCode) {
              Activity.RESULT_OK -> "accepted"
              Activity.RESULT_CANCELED -> "declined"
              else -> "failed" // ActivityResult.RESULT_IN_APP_UPDATE_FAILED
            },
          )
        }
        .addOnFailureListener { e ->
          promise.reject(AppUpdateException(e.message ?: "Update flow failed", e))
        }
    }

    /** Installs a downloaded update. Play restarts the app into the new version. */
    AsyncFunction("completeUpdate") { promise: Promise ->
      val m = manager ?: return@AsyncFunction promise.reject(AppUpdateException("Not ready"))
      m.completeUpdate()
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { e ->
          promise.reject(AppUpdateException(e.message ?: "Install failed", e))
        }
    }
  }

  private fun statusName(status: Int): String =
    when (status) {
      InstallStatus.PENDING -> "pending"
      InstallStatus.DOWNLOADING -> "downloading"
      InstallStatus.DOWNLOADED -> "downloaded"
      InstallStatus.INSTALLING -> "installing"
      InstallStatus.INSTALLED -> "installed"
      InstallStatus.FAILED -> "failed"
      InstallStatus.CANCELED -> "canceled"
      else -> "unknown"
    }
}
