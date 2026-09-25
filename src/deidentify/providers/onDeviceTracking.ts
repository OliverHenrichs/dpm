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
} = {
  cpuGraphs: [],
  fp32Graphs: ["encode"],
  refine: "guided",
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
 * EdgeTAM tracking on the device: the user taps both dancers on the first frame and each is
 * followed from memory through the clip, drawn as a two-colour silhouette. Nothing leaves the
 * phone. Slower than per-frame segmentation — see L3 in AGENT_TASKS.md for the numbers.
 */
export const onDeviceTracking: DeidentifyProvider = {
  id: "on-device-tracking",
  labelKey: "deidentifyProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 2,

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
          // SPIKE: kept so a run can be replayed on the desktop; remove before this ships.
          keepTranscoded: true,
        },
      );
      return { uri, stats };
    } finally {
      subscription.remove();
    }
  },
};
