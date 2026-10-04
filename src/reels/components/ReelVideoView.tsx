import React from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui/Icon";
import YouTubeVideoItem from "@/src/common/components/YouTubeVideoItem";
import { isYouTubeUrl } from "@/src/common/utils/YouTubeUtils";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

interface ReelVideoViewProps {
  video: IVideoReference;
  /**
   * The video on screen while the Reels tab is. Only it holds a player: the phone cannot decode
   * a page of them, and leaving the tab or the page unmounts the player, which stops it.
   */
  active: boolean;
  width: number;
  height: number;
}

/**
 * A video saved on the phone or at a direct URL, with the platform's own controls: play, the
 * time bar and fullscreen, the same as everywhere else in the app. The controls wait for the
 * video to load, so a tap before then is not lost.
 */
function DirectReel({ video }: { video: IVideoReference }) {
  const player = useVideoPlayer(video.value, (p) => {
    capVideoBuffer(p);
    p.loop = true;
    if (video.startTime) p.currentTime = video.startTime;
  });

  return (
    <VideoView
      style={styles.fill}
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true, orientation: "landscape" }}
      contentFit="contain"
    />
  );
}

export default function ReelVideoView({
  video,
  active,
  width,
  height,
}: ReelVideoViewProps) {
  const { theme } = useUnistyles();
  let content: React.ReactNode;
  if (!active) {
    content = (
      <Icon
        name="play-circle-outline"
        size={theme.iconSize.xl}
        color={theme.colors.textMuted}
      />
    );
  } else if (video.type === "url" && isYouTubeUrl(video.value)) {
    // YouTube's own player, with its own controls.
    content = (
      <YouTubeVideoItem videoRef={video} width={width} height={height} />
    );
  } else {
    content = <DirectReel video={video} />;
  }
  return <View style={[styles.frame, { width, height }]}>{content}</View>;
}

const styles = StyleSheet.create((theme) => ({
  // The style's own background, not black: most footage is wider than the phone, and the
  // bands around it are a large part of the screen.
  frame: {
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
}));
