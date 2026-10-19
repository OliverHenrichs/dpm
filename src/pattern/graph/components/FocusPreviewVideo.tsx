import React, { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { embeddedHost, playableLink } from "@/src/common/utils/videoHosts";
import { generateVideoThumbnails } from "@/src/common/utils/YouTubeUtils";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * How long the focus has to rest on a pattern before its video starts. Panning
 * across a dense graph passes a new pattern every few frames, and each player
 * costs a decoder: the phone cannot spin one up per pattern it crosses.
 */
export const PREVIEW_VIDEO_DWELL_MS = 400;

/** A file on the phone or at a direct URL, muted and looping, with no controls. */
function MutedLoop({ video }: { video: IVideoReference }) {
  const source = video.type === "url" ? playableLink(video.value) : video.value;
  const player = useVideoPlayer(source, (p) => {
    capVideoBuffer(p);
    p.muted = true;
    p.loop = true;
    if (video.startTime) p.currentTime = video.startTime;
    p.play();
  });
  return (
    <VideoView
      style={styles.fill}
      player={player}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

/**
 * The focused pattern's first video, small: a still at once, then the video
 * itself, muted, once the focus has settled on it. A YouTube or Vimeo link
 * stays a still; its player is a web page, too heavy to start on a hover.
 */
const FocusPreviewVideo: React.FC<{ video: IVideoReference }> = ({ video }) => {
  const { theme } = useUnistyles();
  const [thumbnail, setThumbnail] = useState("");
  const [settled, setSettled] = useState(false);
  // The tabs keep the Map mounted behind List and Reels; leaving it has to
  // unmount the player, or the video plays on out of sight.
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );
  const playable = !(video.type === "url" && embeddedHost(video.value));

  useEffect(() => {
    let cancelled = false;
    void generateVideoThumbnails([video]).then(([uri]) => {
      if (!cancelled) setThumbnail(uri ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [video]);

  useEffect(() => {
    if (!playable) return;
    const timer = setTimeout(() => setSettled(true), PREVIEW_VIDEO_DWELL_MS);
    return () => clearTimeout(timer);
  }, [playable]);

  return (
    <View style={styles.frame}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.fill} />
      ) : (
        <Icon
          name="play-circle-outline"
          size={theme.iconSize.lg}
          color={theme.colors.textMuted}
        />
      )}
      {settled && screenFocused && (
        <View style={styles.layer}>
          <MutedLoop video={video} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  // 16:9, like the Reels stills: most dance footage is shot wide.
  frame: {
    width: 112,
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  fill: { width: "100%", height: "100%" },
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
}));

export default FocusPreviewVideo;
