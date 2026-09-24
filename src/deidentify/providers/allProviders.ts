import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";
import { onDeviceSilhouette } from "@/src/deidentify/providers/onDeviceSilhouette";
import { onDeviceTracking } from "@/src/deidentify/providers/onDeviceTracking";

/**
 * Every provider the app knows, in picker order. A remote service is added here as another
 * `DeidentifyProvider` — e.g. Viggle's character replacement, which takes 5–15 s clips and
 * sends footage off the device, so the trim limits and the consent gate follow from its
 * descriptor without touching the UI.
 */
export const ALL_PROVIDERS: readonly DeidentifyProvider[] = [
  onDeviceTracking,
  onDeviceSilhouette,
];
