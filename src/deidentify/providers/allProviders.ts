import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";
import { onDeviceTracking } from "@/src/deidentify/providers/onDeviceTracking";

/**
 * Every provider the app knows, in picker order. With one, the editor shows no picker. The
 * spike's per-frame segmentation ("On this device", no taps) was dropped: it lost dancers in
 * closed position, which tracking from taps does not (L3 in AGENT_TASKS.md).
 *
 * A remote service is added here as another `DeidentifyProvider` — e.g. Viggle's character replacement, which takes 5–15 s clips and
 * sends footage off the device, so the trim limits and the consent gate follow from its
 * descriptor without touching the UI.
 */
export const ALL_PROVIDERS: readonly DeidentifyProvider[] = [onDeviceTracking];
