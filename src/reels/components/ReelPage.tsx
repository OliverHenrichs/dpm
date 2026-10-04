import React, { useCallback, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import ReelCaption from "@/src/reels/components/ReelCaption";
import ReelVideoView from "@/src/reels/components/ReelVideoView";
import { Reel, ReelVideo } from "@/src/reels/reels";

// FlatList requires a referentially stable viewability config.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

interface ReelPageProps {
  reel: Reel;
  /** The page on screen, while the tab is; only its current video holds a player. */
  active: boolean;
  width: number;
  height: number;
  /** Name the list too, when the reels come from every list. */
  showListName: boolean;
}

/** One pattern, one screen: its videos side by side, and what it is underneath. */
export default function ReelPage({
  reel,
  active,
  width,
  height,
  showListName,
}: ReelPageProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const current = reel.videos[index];

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ReelVideo>[] }) => {
      if (viewableItems.length > 0) setIndex(viewableItems[0].index ?? 0);
    },
    [],
  );

  const onVideoLayout = (event: LayoutChangeEvent) =>
    setVideoHeight(event.nativeEvent.layout.height);

  return (
    <View style={[styles.page, { width, height }]}>
      <View style={styles.videos} onLayout={onVideoLayout}>
        {videoHeight > 0 && (
          <FlatList
            data={reel.videos}
            keyExtractor={(item) => item.key}
            renderItem={({ item, index: i }) => (
              <ReelVideoView
                video={item.video}
                active={active && i === index}
                width={width}
                height={videoHeight}
              />
            )}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
          />
        )}
      </View>
      <View style={styles.caption}>
        <View style={styles.titleLine}>
          <Text style={styles.name} numberOfLines={2}>
            {reel.pattern.name}
          </Text>
          {reel.videos.length > 1 && (
            <Text
              style={styles.counter}
              accessibilityLabel={t("reelsVideoPosition", {
                n: index + 1,
                total: reel.videos.length,
              })}
            >
              {index + 1} / {reel.videos.length}
            </Text>
          )}
        </View>
        {current?.modifierName && (
          <Text style={styles.modifier} numberOfLines={1}>
            {current.modifierName}
          </Text>
        )}
        <ReelCaption reel={reel} showListName={showListName} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  videos: { flex: 1 },
  caption: {
    paddingHorizontal: theme.space.xs,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.md,
    gap: theme.space.xxs,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.space.sm,
  },
  name: { ...theme.typography.title, color: theme.colors.text, flex: 1 },
  counter: { ...theme.typography.micro, color: theme.colors.textMuted },
  modifier: { ...theme.typography.label, color: theme.colors.primary },
}));
