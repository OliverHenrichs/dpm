import React, { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "@/src/common/ui";
import { VideoItem } from "@/src/common/components/VideoItem";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

// FlatList requires a referentially stable viewability config, so it lives
// outside the component rather than being rebuilt per render.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

type VideoCarouselProps = {
  videoRefs: IVideoReference[];
  /** Label of the badge on generated (anonymized) videos. */
  generatedLabel?: string;
  /**
   * Opens the transcript of the video on screen; with it, a video that has one gets a button
   * under the carousel, labelled [transcriptLabel].
   */
  onOpenTranscript?: (videoRef: IVideoReference) => void;
  transcriptLabel?: string;
  /** Pauses the videos, while the transcript's own player is up. */
  paused?: boolean;
};

const VideoCarousel: React.FC<VideoCarouselProps> = ({
  videoRefs,
  generatedLabel,
  onOpenTranscript,
  transcriptLabel,
  paused,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  // Paging to another pattern's videos (a modifier pill) can leave the index past the end.
  const onScreen = videoRefs[Math.min(currentIndex, videoRefs.length - 1)];
  const transcribed =
    onOpenTranscript && onScreen?.transcript ? onScreen : undefined;

  return (
    <View
      style={styles.videoCarouselContainer}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        setContainerWidth(width);
      }}
    >
      {containerWidth > 0 && (
        <FlatList
          data={videoRefs}
          renderItem={({ item }) => (
            <View>
              <VideoItem
                videoRef={item}
                width={containerWidth}
                paused={paused}
              />
              {item.generated && generatedLabel && (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>{generatedLabel}</Text>
                </View>
              )}
            </View>
          )}
          keyExtractor={(_, index) => index.toString()}
          horizontal
          pagingEnabled
          snapToInterval={containerWidth}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          extraData={paused}
        />
      )}
      {(videoRefs.length > 1 || transcribed) && (
        <View
          style={[styles.paginationContainer, transcribed && styles.withAction]}
        >
          {transcribed && (
            <Button
              title={transcriptLabel ?? ""}
              icon="text-box-outline"
              variant="ghost"
              size="sm"
              onPress={() => onOpenTranscript?.(transcribed)}
            />
          )}
          {videoRefs.length > 1 && (
            <Text style={styles.paginationText}>
              {currentIndex + 1} / {videoRefs.length}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => {
  return {
    videoCarouselContainer: {
      marginBottom: theme.space.xs,
    },
    paginationContainer: {
      alignItems: "center",
    },
    withAction: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    badge: {
      position: "absolute",
      top: 6,
      left: 6,
      backgroundColor: theme.media.scrim,
      borderRadius: theme.radius.xs,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xxs,
    },
    badgeText: { ...theme.typography.micro, color: theme.media.onScrim },
    paginationText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
  };
});

export default VideoCarousel;
