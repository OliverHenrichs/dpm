import React, { useCallback, useState } from "react";
import { FlatList, Text, View, ViewToken } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import ReelVideoView from "@/src/reels/components/ReelVideoView";
import { Reel, ReelVideo } from "@/src/reels/reels";

// FlatList requires a referentially stable viewability config.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

interface ReelPageProps {
  reel: Reel;
  /** The page on screen; only its current video holds a player. */
  active: boolean;
  width: number;
  height: number;
  /** Name the list too, when the reels come from every list. */
  showListName: boolean;
}

/** One pattern: its videos side by side, its name over them. */
export default function ReelPage({
  reel,
  active,
  width,
  height,
  showListName,
}: ReelPageProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const current = reel.videos[index];

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ReelVideo>[] }) => {
      if (viewableItems.length > 0) setIndex(viewableItems[0].index ?? 0);
    },
    [],
  );

  const meta = [
    reel.typeName,
    reel.pattern.level ? t(reel.pattern.level) : undefined,
    showListName ? reel.listName : undefined,
  ].filter(Boolean);

  return (
    <View style={{ width, height }}>
      <FlatList
        data={reel.videos}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <ReelVideoView
            video={item.video}
            active={active && i === index}
            width={width}
            height={height}
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
      <View style={styles.caption} pointerEvents="none">
        <Text style={styles.name} numberOfLines={2}>
          {reel.pattern.name}
        </Text>
        {current?.modifierName && (
          <Text style={styles.modifier} numberOfLines={1}>
            {current.modifierName}
          </Text>
        )}
        <View style={styles.metaLine}>
          {reel.typeColor && <View style={styles.dot(reel.typeColor)} />}
          <Text style={styles.meta} numberOfLines={1}>
            {meta.join(" · ")}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.lg,
    backgroundColor: theme.media.scrim,
    gap: theme.space.xxs,
  },
  name: { ...theme.typography.title, color: theme.media.onScrim },
  modifier: { ...theme.typography.label, color: theme.media.onScrim },
  metaLine: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  dot: (color: string) => ({
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  meta: {
    ...theme.typography.bodySmall,
    color: theme.media.onScrim,
    flex: 1,
  },
  counter: { ...theme.typography.micro, color: theme.media.onScrim },
}));
