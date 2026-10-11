import React, { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Button, Icon } from "@/src/common/ui";
import { VIDEO_HEIGHT, VideoItem } from "@/src/common/components/VideoItem";
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
  /**
   * With no videos, an empty frame of a player's height saying this, in place of the player:
   * switching between sets of videos (a pattern's variants) then moves nothing below it.
   */
  emptyLabel?: string;
  /**
   * Keeps the row under the player (page count, transcript button) at its height even when
   * it has nothing to show, for the same reason.
   */
  reserveFooter?: boolean;
};

const VideoCarousel: React.FC<VideoCarouselProps> = ({
  videoRefs,
  generatedLabel,
  onOpenTranscript,
  transcriptLabel,
  paused,
  emptyLabel,
  reserveFooter = false,
}) => {
  const { theme } = useUnistyles();
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
      {videoRefs.length === 0 && emptyLabel ? (
        <View style={styles.empty}>
          <Icon
            name="video-off-outline"
            size={theme.iconSize.lg}
            color={theme.colors.textMuted}
          />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      ) : containerWidth > 0 ? (
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
      ) : (
        // Until the width is measured, the player's room is held, so the page does not jump
        // when it appears.
        <View style={styles.unmeasured} />
      )}
      {(videoRefs.length > 1 || transcribed || reserveFooter) && (
        <View
          style={[
            styles.paginationContainer,
            transcribed && styles.withAction,
            reserveFooter && styles.reservedFooter,
          ]}
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
    /** The height of the transcript button, which is the row's tallest content. */
    reservedFooter: { minHeight: 36, justifyContent: "center" },
    empty: {
      height: VIDEO_HEIGHT,
      marginBottom: theme.space.sm,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceVariant,
    },
    emptyText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
    },
    unmeasured: { height: VIDEO_HEIGHT, marginBottom: theme.space.sm },
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
