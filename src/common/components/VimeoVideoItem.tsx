import { FC } from "react";
import { WebView } from "react-native-webview";
import { parseVimeoUrl, vimeoPlayerUrl } from "@/src/common/utils/VimeoUtils";
import type { YouTubeVideoItemProps } from "@/src/common/components/YouTubeVideoItem";

/**
 * Vimeo's own player for native platforms, in a WebView. It brings Vimeo's controls, and asks
 * for the password of a password-protected video itself.
 */
const VimeoVideoItem: FC<YouTubeVideoItemProps> = ({
  videoRef,
  width,
  height = 200,
}) => {
  const video = parseVimeoUrl(videoRef.value);
  if (!video) return null;
  return (
    <WebView
      source={{ uri: vimeoPlayerUrl(video, videoRef.startTime) }}
      style={{ width, height }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      // Links inside the player (Vimeo's logo, the title) would replace it with a web page.
      onShouldStartLoadWithRequest={(request) =>
        request.url.startsWith("https://player.vimeo.com/") ||
        request.url === "about:blank"
      }
    />
  );
};

export default VimeoVideoItem;
