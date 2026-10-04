import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { Reel } from "@/src/reels/reels";

interface ReelCaptionProps {
  reel: Reel;
  /** Name the list too, when the reels come from every list. */
  showListName: boolean;
}

/** What a reel is: the type's colour, the type, the level and, across lists, the list. */
export function reelMeta(
  reel: Reel,
  showListName: boolean,
  t: (key: string) => string,
): string {
  return [
    reel.typeName,
    reel.pattern.level ? t(reel.pattern.level) : undefined,
    showListName ? reel.listName : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ReelCaption({ reel, showListName }: ReelCaptionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.metaLine}>
      {reel.typeColor && <View style={styles.dot(reel.typeColor)} />}
      <Text style={styles.meta} numberOfLines={1}>
        {reelMeta(reel, showListName, t)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  metaLine: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  dot: (color: string) => ({
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  meta: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flexShrink: 1,
  },
}));
