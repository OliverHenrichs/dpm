import {
  isDeidentifyAvailable,
  VideoDeidentifyModule,
} from "@/modules/video-deidentify";
import {
  DeidentifyOutcome,
  DeidentifyProvider,
} from "@/src/deidentify/providers/DeidentifyProvider";

/**
 * The on-device pipeline in `modules/video-deidentify`: trim + downscale, then silhouettes drawn
 * only from segmentation labels. Nothing leaves the phone.
 */
export const onDeviceSilhouette: DeidentifyProvider = {
  id: "on-device-silhouette",
  labelKey: "deidentifyProviderOnDevice",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 0,

  isAvailable: () => isDeidentifyAvailable,

  async run(request, onProgress): Promise<DeidentifyOutcome> {
    if (!VideoDeidentifyModule)
      throw new Error("On-device de-identification is unavailable");
    const subscription = VideoDeidentifyModule.addListener("onProgress", (e) =>
      onProgress({ stage: e.stage, fraction: e.progress }),
    );
    try {
      const { uri, ...stats } = await VideoDeidentifyModule.deidentify(
        request.sourceUri,
        {
          startSeconds: request.startSeconds,
          endSeconds: request.endSeconds,
          maxSeconds: onDeviceSilhouette.maxSeconds,
          height: 720,
          mode: "silhouette",
          segmenter: "multiclass",
        },
      );
      return { uri, stats };
    } finally {
      subscription.remove();
    }
  },
};
