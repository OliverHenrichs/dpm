/** Trim only, the dancers as silhouettes, or as filmed with their heads covered. */
export type AnonymizeMode = "passthrough" | "silhouette" | "faces";
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
  /** Silhouette and faces: one normalised [x, y] point per dancer on the first frame. */
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

export type OutlineOptions = {
  /** Where the tap frame is in the source, in seconds. */
  atSeconds: number;
  /** One normalised [x, y] point per dancer, as for silhouettes. */
  prompts: number[][];
};

export type OutlineResult = {
  /** A JPEG of the frame with each tapped dancer's outline blended in; the caller deletes it. */
  uri: string;
  width: number;
  height: number;
  /** Per prompt: whether anyone was found at that point. */
  found: boolean[];
  ms: number;
  /** Where the time went; load, frame and encode are 0 once the frame is prepared. */
  loadMs?: number;
  frameMs?: number;
  encodeMs?: number;
  decodeMs?: number;
  drawMs?: number;
};

export type ProgressEventPayload = {
  /** "silhouette" is the render stage in either anonymizing mode. */
  stage: "transcode" | "silhouette";
  progress: number;
};

export type VideoAnonymizeModuleEvents = {
  onProgress: (params: ProgressEventPayload) => void;
};
