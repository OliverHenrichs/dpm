import React, { useImperativeHandle, useState } from "react";
import { View } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet } from "react-native-unistyles";
import VimeoVideoItem from "@/src/common/components/VimeoVideoItem";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { embeddedHost, playableLink } from "@/src/common/utils/videoHosts";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import type { SequencePlayerProps } from "@/src/pattern/sequences/sequencePlayer";
import SequenceYouTubePlayer, {
  YOUTUBE_SEEKS,
} from "@/src/pattern/sequences/SequenceYouTubePlayer";

/** The player's height at most: the steps below it must stay in sight on a phone. */
export const SEQUENCE_VIDEO_MAX_HEIGHT = 220;
/** How often `expo-video` reports the time while playing, in seconds. */
const TIME_UPDATE_S = 0.25;

/**
 * Whether the steps can be marked in this video and seek in it: a file or a direct link
 * (`expo-video`), and YouTube on a phone. Vimeo's player is a plain embed whose time DPM
 * cannot read or set, so the video only plays.
 */
export function videoSeeks(video: IVideoReference): boolean {
  if (video.type === "local") return true;
  const host = embeddedHost(video.value);
  if (host === "youtube") return YOUTUBE_SEEKS;
  return host === null;
}

/** A file on the phone, or a direct link, in `expo-video` with the platform's controls. */
function DirectPlayer({
  video,
  playerRef,
  onTime,
  onPlayingChange,
  onEnded,
}: SequencePlayerProps) {
  const source = video.type === "url" ? playableLink(video.value) : video.value;
  const player = useVideoPlayer(source, (p) => {
    capVideoBuffer(p);
    if (video.startTime) p.currentTime = video.startTime;
    // The time is reported only while the video plays: a paused player's clock would tick on
    // (Android's does). Set here, on the player being made: the one the hook returns is
    // immutable to the React Compiler. The listener goes with the player.
    p.addListener("playingChange", ({ isPlaying }) => {
      p.timeUpdateEventInterval = isPlaying ? TIME_UPDATE_S : 0;
    });
  });
  useEventListener(player, "playingChange", ({ isPlaying }) =>
    onPlayingChange(isPlaying),
  );
  useEventListener(player, "timeUpdate", ({ currentTime }) =>
    onTime(currentTime),
  );
  useEventListener(player, "playToEnd", () => onEnded());
  // seekBy rather than assigning currentTime: the React Compiler treats the player returned
  // by a hook as immutable, and a method call is not a mutation to it.
  useImperativeHandle(
    playerRef,
    () => ({
      seekTo: (seconds) => player.seekBy(seconds - player.currentTime),
      play: () => player.play(),
      pause: () => player.pause(),
      currentTime: async () => player.currentTime,
    }),
    [player],
  );
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

/**
 * A sequence's one video, the width of the sheet, above its steps. The player behind it
 * depends on the video: `expo-video` for a file or a direct link, YouTube's own player, or
 * Vimeo's (which plays but does not seek, so it takes no handle).
 */
const SequenceVideo: React.FC<SequencePlayerProps> = (props) => {
  const [width, setWidth] = useState(0);
  const height = Math.min(
    Math.round((width * 9) / 16),
    SEQUENCE_VIDEO_MAX_HEIGHT,
  );
  const host =
    props.video.type === "url" ? embeddedHost(props.video.value) : null;

  let player: React.ReactNode = null;
  if (width > 0) {
    if (host === "youtube") {
      player = (
        <SequenceYouTubePlayer {...props} width={width} height={height} />
      );
    } else if (host === "vimeo") {
      player = (
        <VimeoVideoItem videoRef={props.video} width={width} height={height} />
      );
    } else {
      player = <DirectPlayer {...props} />;
    }
  }
  return (
    <View
      style={[styles.frame, width > 0 && { height }]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      testID="sequence-video"
    >
      {player}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  frame: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: SEQUENCE_VIDEO_MAX_HEIGHT,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.media.black,
    marginBottom: theme.space.sm,
  },
  fill: { width: "100%", height: "100%" },
}));

export default SequenceVideo;
