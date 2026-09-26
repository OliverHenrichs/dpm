import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { VideoItem } from "@/src/common/components/VideoItem";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

// FlatList requires a referentially stable viewability config, so it lives
// outside the component rather than being rebuilt per render.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

type VideoCarouselProps = {
  videoRefs: IVideoReference[];
  palette: Record<PaletteColor, string>;
  /** Shown under the video on screen — e.g. an action on that video. */
  renderFooter?: (videoRef: IVideoReference, index: number) => React.ReactNode;
  /** Label of the badge on generated (de-identified) videos. */
  generatedLabel?: string;
};

const VideoCarousel: React.FC<VideoCarouselProps> = ({
  videoRefs,
  palette,
  renderFooter,
  generatedLabel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const styles = getStyles(palette);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

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
              <VideoItem videoRef={item} width={containerWidth} />
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
        />
      )}
      {renderFooter &&
        videoRefs[currentIndex] &&
        renderFooter(videoRefs[currentIndex], currentIndex)}
      {videoRefs.length > 1 && (
        <View style={styles.paginationContainer}>
          <Text style={styles.paginationText}>
            {currentIndex + 1} / {videoRefs.length}
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) => {
  return StyleSheet.create({
    videoCarouselContainer: {
      marginBottom: 4,
    },
    paginationContainer: {
      alignItems: "center",
    },
    badge: {
      position: "absolute",
      top: 6,
      left: 6,
      backgroundColor: "rgba(0,0,0,0.65)",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
    paginationText: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
  });
};

export default VideoCarousel;
