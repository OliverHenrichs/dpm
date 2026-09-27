import {
  isDeidentifyAvailable,
  VideoDeidentifyModule,
} from "@/modules/video-deidentify";

export type TrimRequest = {
  sourceUri: string;
  startSeconds: number;
  endSeconds: number;
};

/** Whether this device can cut videos (the native module is present). */
export const canShortenVideos = (): boolean => isDeidentifyAvailable;

/**
 * Cuts [startSeconds, endSeconds) out of a clip at the source's size, audio kept — the same
 * Media3 pass de-identification starts with, without the silhouettes. Returns the cache URI.
 */
export async function shortenVideo(
  request: TrimRequest,
  onProgress: (fraction: number) => void,
): Promise<string> {
  if (!VideoDeidentifyModule) throw new Error("Shortening is unavailable");
  const subscription = VideoDeidentifyModule.addListener("onProgress", (e) =>
    onProgress(e.progress),
  );
  try {
    const { uri } = await VideoDeidentifyModule.deidentify(request.sourceUri, {
      startSeconds: request.startSeconds,
      endSeconds: request.endSeconds,
      // The module caps any output; shortening has no cap of its own.
      maxSeconds: request.endSeconds - request.startSeconds + 1,
      height: 0,
      mode: "passthrough",
    });
    return uri;
  } finally {
    subscription.remove();
  }
}
