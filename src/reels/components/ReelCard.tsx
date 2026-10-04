import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Tappable } from "@/src/common/ui";
import { Icon } from "@/src/common/ui/Icon";
import { generateVideoThumbnails } from "@/src/common/utils/YouTubeUtils";
import ReelCaption from "@/src/reels/components/ReelCaption";
import { Reel } from "@/src/reels/reels";

interface ReelCardProps {
  reel: Reel;
  showListName: boolean;
  onPress: () => void;
}

/**
 * One reel in the overview: a still of its first video, its name and what it is. Tapping opens
 * the reels one at a time, at this one.
 */
export default function ReelCard({
  reel,
  showListName,
  onPress,
}: ReelCardProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [thumbnail, setThumbnail] = useState("");
  const first = reel.videos[0]?.video;

  useEffect(() => {
    if (!first) return;
    let cancelled = false;
    void generateVideoThumbnails([first]).then(([uri]) => {
      if (!cancelled) setThumbnail(uri ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [first]);

  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={t("reelsOpen", { name: reel.pattern.name })}
      style={styles.card}
    >
      <View style={styles.still}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.image} />
        ) : null}
        <View style={styles.playBadge}>
          <Icon
            name="play"
            size={theme.iconSize.lg}
            color={theme.media.onScrim}
          />
        </View>
        {reel.videos.length > 1 && (
          <View style={styles.count}>
            <Icon
              name="play-box-multiple-outline"
              size={theme.iconSize.sm}
              color={theme.media.onScrim}
            />
            <Text style={styles.countText}>{reel.videos.length}</Text>
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {reel.pattern.name}
        </Text>
        <ReelCaption reel={reel} showListName={showListName} />
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    marginBottom: theme.space.lg,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  // Most dance footage is shot wide; a 16:9 still shows it whole and fits three to a screen.
  still: {
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  playBadge: {
    width: theme.space.xxxl + theme.space.sm,
    height: theme.space.xxxl + theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.media.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    position: "absolute",
    right: theme.space.sm,
    bottom: theme.space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xxs,
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.xxs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.media.scrim,
  },
  countText: { ...theme.typography.micro, color: theme.media.onScrim },
  text: { padding: theme.space.md, gap: theme.space.xxs },
  name: { ...theme.typography.rowTitle, color: theme.colors.text },
}));
