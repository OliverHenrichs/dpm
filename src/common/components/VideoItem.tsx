import { FC } from "react";
import { useVideoPlayer, VideoView } from "expo-video";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import YouTubeVideoItem from "@/src/common/components/YouTubeVideoItem";
import { isYouTubeUrl } from "@/src/common/utils/YouTubeUtils";

type VideoItemProps = {
  videoRef: IVideoReference;
  width: number;
};

/** Direct-URL / local video player powered by expo-video. */
const DirectVideoItem: FC<VideoItemProps> = ({ videoRef }) => {
  const player = useVideoPlayer(videoRef.value, (p) => {
    p.loop = false;
    if (videoRef.startTime) {
      p.currentTime = videoRef.startTime;
    }
  });
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

export const VideoItem: FC<VideoItemProps> = ({ videoRef, width }) => (
  <View style={[localStyles.videoItemContainer, { width }]}>
    {videoRef.type === "url" && isYouTubeUrl(videoRef.value) ? (
      <YouTubeVideoItem videoRef={videoRef} width={width} />
    ) : (
      <DirectVideoItem videoRef={videoRef} width={width} />
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
