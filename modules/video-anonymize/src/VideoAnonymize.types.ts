export type AnonymizeMode = "passthrough" | "silhouette";
export type AnonymizeSegmenter = "edgetam";

export type AnonymizeOptions = {
  /** Trim window in the source, in seconds. `endSeconds` defaults to the end of the clip. */
  startSeconds?: number;
  endSeconds?: number;
  /** Hard cap on the processed length, applied after the window. */
  maxSeconds?: number;
  /** Target short side in pixels; 0 keeps the source's size (passthrough only). */
  height?: number;
  mode?: AnonymizeMode;
  segmenter?: AnonymizeSegmenter;
  /** Silhouette mode: one normalised [x, y] point per dancer on the first frame. */
  prompts?: number[][];
};

export type AnonymizeResult = {
  uri: string;
  /** Wall time for the whole call. */
  ms: number;
  transcodeMs: number;
  durationMs: number;
  // Silhouette mode only:
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
  segmenter?: string;
  delegate?: string;
  avgSegmentMs?: number;
  /** Frame count keyed by the number of people found in the frame. */
  framesByPeopleFound?: Record<string, number>;
};

export type ProgressEventPayload = {
  stage: "transcode" | "silhouette";
  progress: number;
};

export type VideoAnonymizeModuleEvents = {
  onProgress: (params: ProgressEventPayload) => void;
};
