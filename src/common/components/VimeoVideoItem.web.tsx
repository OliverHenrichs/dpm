import { FC } from "react";
import { parseVimeoUrl, vimeoPlayerUrl } from "@/src/common/utils/VimeoUtils";
import type { YouTubeVideoItemProps } from "@/src/common/components/YouTubeVideoItem";

/** Vimeo player for web: Vimeo's embed iframe, as YouTube's is on web. */
const VimeoVideoItem: FC<YouTubeVideoItemProps> = ({
  videoRef,
  width,
  height = 200,
}) => {
  const video = parseVimeoUrl(videoRef.value);
  if (!video) return null;
  return (
    <iframe
      title={videoRef.value}
      src={vimeoPlayerUrl(video, videoRef.startTime)}
      width={width}
      height={height}
      style={{ border: 0 }}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
};

export default VimeoVideoItem;
