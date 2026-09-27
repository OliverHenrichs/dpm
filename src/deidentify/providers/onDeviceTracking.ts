import {
  isDeidentifyAvailable,
  VideoDeidentifyModule,
} from "@/modules/video-deidentify";
import {
  DeidentifyOutcome,
  DeidentifyProvider,
} from "@/src/deidentify/providers/DeidentifyProvider";

/**
 * EdgeTAM tracking on the device: the user taps each dancer on the first frame — a couple, or
 * one person dancing alone — and each is followed from memory through the clip, drawn as a
 * silhouette in its own colour. The native side sizes everything by the number of taps.
 * Nothing leaves the phone. ~0.5–0.75 s per frame on a Pixel 10a — see L3 in AGENT_TASKS.md.
 */
export const onDeviceTracking: DeidentifyProvider = {
  id: "on-device-tracking",
  labelKey: "deidentifyProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 2,
  minPromptCount: 1,

  isAvailable: () => isDeidentifyAvailable,

  async run(request, onProgress): Promise<DeidentifyOutcome> {
    if (!VideoDeidentifyModule) {
      throw new Error("On-device de-identification is unavailable");
    }
    const subscription = VideoDeidentifyModule.addListener("onProgress", (e) =>
      onProgress({ stage: e.stage, fraction: e.progress }),
    );
    try {
      const { uri, ...stats } = await VideoDeidentifyModule.deidentify(
        request.sourceUri,
        {
          startSeconds: request.startSeconds,
          endSeconds: request.endSeconds,
          maxSeconds: onDeviceTracking.maxSeconds,
          height: 720,
          mode: "silhouette",
          segmenter: "edgetam",
          prompts: (request.prompts ?? []).map((p) => [p.x, p.y]),
        },
      );
      return { uri, stats };
    } finally {
      subscription.remove();
    }
  },
};
