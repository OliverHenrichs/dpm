import React from "react";
import YouTubeVideoItem from "@/src/common/components/YouTubeVideoItem";
import type { SequencePlayerProps } from "@/src/pattern/sequences/sequencePlayer";

/**
 * On web the YouTube player is a plain iframe (`YouTubeVideoItem.web.tsx`), without the API
 * that reads and sets its time: the video plays, the steps cannot be marked in it.
 */
export const YOUTUBE_SEEKS = false;

export const YOUTUBE_POLL_MS = 250;

const SequenceYouTubePlayer: React.FC<
  SequencePlayerProps & { width: number; height: number }
> = ({ video, width, height }) => (
  <YouTubeVideoItem videoRef={video} width={width} height={height} />
);

export default SequenceYouTubePlayer;
