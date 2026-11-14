import { NativeModule, requireOptionalNativeModule } from "expo";

/** Play's `InstallStatus`, by name. */
export type InstallStatus =
  | "pending"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "failed"
  | "canceled"
  | "unknown";

export type UpdateCheck = {
  /** Play has a newer version for this install. */
  available: boolean;
  /** The flexible (background download) flow may be started for it. */
  flexibleAllowed: boolean;
  availableVersionCode: number;
  /** Days since Play learned of the update, or null if it does not know. */
  stalenessDays: number | null;
  /** How far an update started earlier got; "downloaded" means it waits for `completeUpdate`. */
  status: InstallStatus;
};

export type InstallStatusEvent = {
  status: InstallStatus;
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

export type AppUpdateModuleEvents = {
  onInstallStatus: (event: InstallStatusEvent) => void;
};

declare class AppUpdateModule extends NativeModule<AppUpdateModuleEvents> {
  /** Asks Play about this install. Rejects outside a Play install (a dev client, a sideload). */
  check(): Promise<UpdateCheck>;
  /** Play's update dialog, after a `check`. The download's progress arrives as events. */
  startFlexibleUpdate(): Promise<"accepted" | "declined" | "failed">;
  /** Installs a downloaded update; Play restarts the app into it. */
  completeUpdate(): Promise<void>;
}

// Optional so that web, iOS (not implemented) and Jest load without the native side.
export default requireOptionalNativeModule<AppUpdateModule>("AppUpdate");
