export type DeidentifyMode = "passthrough" | "silhouette";
export type DeidentifySegmenter = "pose" | "multiclass" | "deeplab";

export type DeidentifyOptions = {
  maxSeconds?: number;
  /** Target short side in pixels. */
  height?: number;
  mode?: DeidentifyMode;
  segmenter?: DeidentifySegmenter;
};

export type DeidentifyResult = {
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

export type VideoDeidentifyModuleEvents = {
  onProgress: (params: ProgressEventPayload) => void;
};
