import AppUpdateModule from "./src/AppUpdateModule";

export type {
  InstallStatus,
  InstallStatusEvent,
  UpdateCheck,
} from "./src/AppUpdateModule";

export const isAppUpdateAvailable = AppUpdateModule != null;

export { AppUpdateModule };
