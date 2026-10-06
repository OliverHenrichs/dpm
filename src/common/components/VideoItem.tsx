import { FC, useEffect } from "react";
import { useVideoPlayer, VideoView } from "expo-video";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import YouTubeVideoItem from "@/src/common/components/YouTubeVideoItem";
import { isYouTubeUrl } from "@/src/common/utils/YouTubeUtils";

type VideoItemProps = {
  videoRef: IVideoReference;
  width: number;
  /** Stops a playing video, while another player takes over (a transcript sheet). */
  paused?: boolean;
};

/** Direct-URL / local video player powered by expo-video. */
const DirectVideoItem: FC<VideoItemProps> = ({ videoRef, paused }) => {
  const player = useVideoPlayer(videoRef.value, (p) => {
    capVideoBuffer(p);
    p.loop = false;
    if (videoRef.startTime) {
      p.currentTime = videoRef.startTime;
    }
  });
  useEffect(() => {
    if (paused) player.pause();
  }, [paused, player]);
  return (
    <VideoView
      style={localStyles.videoPlayer}
      player={player}
      fullscreenOptions={{ enable: true, orientation: "landscape" }}
      allowsPictureInPicture
      nativeControls
      contentFit="contain"
    />
  );
};

export const VideoItem: FC<VideoItemProps> = ({ videoRef, width, paused }) => (
  <View style={[localStyles.videoItemContainer, { width }]}>
    {videoRef.type === "url" && isYouTubeUrl(videoRef.value) ? (
      <YouTubeVideoItem videoRef={videoRef} width={width} />
    ) : (
      <DirectVideoItem videoRef={videoRef} width={width} paused={paused} />
    )}
  </View>
);

const localStyles = StyleSheet.create((theme) => ({
  videoItemContainer: {
    height: 200,
    marginBottom: theme.space.sm,
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
}));
