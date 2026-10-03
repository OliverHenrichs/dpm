import {
  isAnonymizeAvailable,
  VideoAnonymizeModule,
} from "@/modules/video-anonymize";
import {
  AnonymizeOutcome,
  AnonymizeProvider,
} from "@/src/anonymize/providers/AnonymizeProvider";

/**
 * EdgeTAM tracking on the device: the user taps each dancer on the first frame — a couple, or
 * one person dancing alone — and each is followed from memory through the clip, drawn as a
 * silhouette in its own colour. The native side sizes everything by the number of taps.
 * Nothing leaves the phone. ~0.5–0.75 s per frame on a Pixel 10a — see L3 in AGENT_TASKS.md.
 */
/**
 * The native side reports each stage from 0 to 1: a transcode that takes seconds, then the
 * silhouette render that takes minutes. The user only cares when the whole run is done, so the
 * stages are weighted into one count to 100% — by their share of a typical run's time.
 */
const STAGE_SHARE: Record<string, [start: number, share: number]> = {
  transcode: [0, 0.03],
  silhouette: [0.03, 0.97],
};

export function overallFraction(stage: string, fraction: number): number {
  const [start, share] = STAGE_SHARE[stage] ?? [0, 1];
  return start + share * Math.min(Math.max(fraction, 0), 1);
}

export const onDeviceTracking: AnonymizeProvider = {
  id: "on-device-tracking",
  labelKey: "anonymizeProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 2,
  minPromptCount: 1,

  isAvailable: () => isAnonymizeAvailable,

  async run(request, onProgress): Promise<AnonymizeOutcome> {
    if (!VideoAnonymizeModule) {
      throw new Error("On-device anonymization is unavailable");
    }
    const subscription = VideoAnonymizeModule.addListener("onProgress", (e) =>
      onProgress({
        stage: e.stage,
        fraction: overallFraction(e.stage, e.progress),
      }),
    );
    try {
      const { uri, ...stats } = await VideoAnonymizeModule.anonymize(
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
