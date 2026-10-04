import React, { useState } from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Tappable } from "@/src/common/ui";
import { Icon } from "@/src/common/ui/Icon";
import YouTubeVideoItem from "@/src/common/components/YouTubeVideoItem";
import { isYouTubeUrl } from "@/src/common/utils/YouTubeUtils";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

interface ReelVideoViewProps {
  video: IVideoReference;
  /** Only the video on screen holds a player; the phone cannot decode a page of them. */
  active: boolean;
  width: number;
  height: number;
}

/** A video saved on the phone or at a direct URL: still until tapped, then loops. */
function DirectReel({ video }: { video: IVideoReference }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(video.value, (p) => {
    capVideoBuffer(p);
    p.loop = true;
    if (video.startTime) p.currentTime = video.startTime;
  });

  const toggle = () => {
    if (playing) player.pause();
    else player.play();
    setPlaying(!playing);
  };

  return (
    <Tappable
      onPress={toggle}
      accessibilityLabel={playing ? t("reelsPause") : t("reelsPlay")}
      style={styles.fill}
    >
      <VideoView
        style={styles.fill}
        player={player}
        nativeControls={false}
        contentFit="contain"
      />
      {!playing && (
        <View style={styles.playBadge} pointerEvents="none">
          <Icon
            name="play"
            size={theme.iconSize.xl}
            color={theme.media.onScrim}
          />
        </View>
      )}
    </Tappable>
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
      <View style={styles.playBadge}>
        <Icon
          name="play"
          size={theme.iconSize.xl}
          color={theme.media.onScrim}
        />
      </View>
    );
  } else if (video.type === "url" && isYouTubeUrl(video.value)) {
    // YouTube's own player, with its own play button.
    content = (
      <YouTubeVideoItem videoRef={video} width={width} height={height} />
    );
  } else {
    content = <DirectReel video={video} />;
  }
  return <View style={[styles.frame, { width, height }]}>{content}</View>;
}

const styles = StyleSheet.create((theme) => ({
  frame: {
    backgroundColor: theme.media.black,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
  playBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -theme.space.xxxl,
    width: theme.space.xxxl * 2,
    height: theme.space.xxxl * 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.media.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
}));
