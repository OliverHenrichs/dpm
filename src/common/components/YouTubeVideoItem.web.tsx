import { FC } from "react";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { extractYouTubeVideoId } from "@/src/common/utils/YouTubeUtils";

export type YouTubeVideoItemProps = {
  videoRef: IVideoReference;
  width: number;
};

/**
 * YouTube player for web.
 *
 * react-native-youtube-iframe drives the player through a WebView, and its web
 * build depends on `react-native-web-webview`, which is unmaintained and not
 * installed here. On web the embed is available natively, so we render the
 * YouTube iframe directly instead of pulling that dependency in.
 */
const YouTubeVideoItem: FC<YouTubeVideoItemProps> = ({ videoRef, width }) => {
  const videoId = extractYouTubeVideoId(videoRef.value) ?? "";
  const query =
    videoRef.startTime != null ? `?start=${videoRef.startTime}` : "";
  return (
    <iframe
      title={videoRef.value}
      src={`https://www.youtube.com/embed/${videoId}${query}`}
      width={width}
      height={200}
      style={{ border: 0 }}
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
};

export default YouTubeVideoItem;
