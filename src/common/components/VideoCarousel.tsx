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
};

const VideoCarousel: React.FC<VideoCarouselProps> = ({
  videoRefs,
  palette,
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
            <VideoItem videoRef={item} width={containerWidth} />
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
    paginationText: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
  });
};

export default VideoCarousel;
