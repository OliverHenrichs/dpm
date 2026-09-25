export type DeidentifyMode = "passthrough" | "silhouette";
export type DeidentifySegmenter = "pose" | "multiclass" | "deeplab" | "edgetam";

export type DeidentifyOptions = {
  /** Trim window in the source, in seconds. `endSeconds` defaults to the end of the clip. */
  startSeconds?: number;
  endSeconds?: number;
  /** Hard cap on the processed length, applied after the window. */
  maxSeconds?: number;
  /** Target short side in pixels. */
  height?: number;
  mode?: DeidentifyMode;
  segmenter?: DeidentifySegmenter;
  /** EdgeTAM: one normalised [x, y] point per dancer on the first frame. */
  prompts?: number[][];
  /** Stop after this many frames (0 = whole clip) — for benchmarks. */
  maxFrames?: number;
  /** EdgeTAM graphs to force onto the CPU — for diagnosing GPU numerics. */
  cpuGraphs?: string[];
  /** EdgeTAM mask upscaling: "bilinear", or "guided" to snap edges to the frame's contours. */
  refine?: "bilinear" | "guided";
  /** EdgeTAM graphs computed in fp32 on the GPU; default the image encoder. */
  fp32Graphs?: string[];
  /** EdgeTAM: track every n-th frame and interpolate the rest (1 = every frame). */
  trackEvery?: number;
  /** Keep the transcoded intermediate (source footage) for desktop replay — debug only. */
  keepTranscoded?: boolean;
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
