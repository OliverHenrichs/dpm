import {
  isDeidentifyAvailable,
  VideoDeidentifyModule,
} from "@/modules/video-deidentify";
import {
  DeidentifyOutcome,
  DeidentifyProvider,
} from "@/src/deidentify/providers/DeidentifyProvider";

/** SPIKE: dev-only diagnosis of GPU numerics — graphs named here run on the CPU. */
const trackingDebug: {
  cpuGraphs: string[];
  fp32Graphs: string[];
  refine: "bilinear" | "guided";
  trackEvery: number;
} = {
  cpuGraphs: [],
  fp32Graphs: ["encode"],
  refine: "guided",
  // Tracking at 15 fps (interpolating the frames between) looked the same as every frame on
  // clips 1 and 4 and takes ~0.64 instead of ~1.08 s per frame on a Pixel 10a.
  trackEvery: 2,
};

export const setTrackingEvery = (n: number) => {
  trackingDebug.trackEvery = n;
};

export const setTrackingPlacement = (
  cpuGraphs: string[],
  fp32Graphs: string[],
) => {
  trackingDebug.cpuGraphs = cpuGraphs;
  trackingDebug.fp32Graphs = fp32Graphs;
};

export const setTrackingRefine = (refine: "bilinear" | "guided") => {
  trackingDebug.refine = refine;
};

/**
 * EdgeTAM tracking on the device: the user taps each dancer on the first frame — a couple, or
 * one person dancing alone — and each is followed from memory through the clip, drawn as a
 * silhouette in its own colour. The native side sizes everything by the number of taps. Nothing leaves the
 * phone. Slower than per-frame segmentation — see L3 in AGENT_TASKS.md for the numbers.
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
          cpuGraphs: trackingDebug.cpuGraphs,
          fp32Graphs: trackingDebug.fp32Graphs,
          refine: trackingDebug.refine,
          trackEvery: trackingDebug.trackEvery,
          // SPIKE: set true to keep the transcode (source footage) for replaying a run on the
          // desktop — see the L3 write-up. Off: it would pile up the user's footage in the cache.
          keepTranscoded: false,
        },
      );
      return { uri, stats };
    } finally {
      subscription.remove();
    }
  },
};
