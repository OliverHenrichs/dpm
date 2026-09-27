import VideoDeidentifyModule from "./src/VideoDeidentifyModule";

export * from "./src/VideoDeidentify.types";

export const isDeidentifyAvailable = VideoDeidentifyModule != null;

export { VideoDeidentifyModule };
