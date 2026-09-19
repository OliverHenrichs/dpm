import { FC } from "react";
import YoutubePlayer from "react-native-youtube-iframe";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { extractYouTubeVideoId } from "@/src/common/utils/YouTubeUtils";

export type YouTubeVideoItemProps = {
  videoRef: IVideoReference;
  width: number;
};

/** YouTube player for native platforms – renders the player inside a WebView. */
const YouTubeVideoItem: FC<YouTubeVideoItemProps> = ({ videoRef, width }) => {
  const videoId = extractYouTubeVideoId(videoRef.value) ?? "";
  return (
    <YoutubePlayer
      height={200}
      width={width}
      videoId={videoId}
      play={false}
      initialPlayerParams={
        videoRef.startTime != null ? { start: videoRef.startTime } : undefined
      }
    />
  );
};

export default YouTubeVideoItem;
