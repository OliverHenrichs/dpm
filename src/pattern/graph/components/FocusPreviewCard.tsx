import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useActiveListLevels } from "@/src/pattern/data/components/ActivePatternListContext";
import { levelName } from "@/src/pattern/types/PatternLevel";
import Animated, {
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Tappable } from "@/src/common/ui";
import { GraphNode } from "@/src/pattern/graph/model/GraphModel";
import FocusPreviewVideo from "@/src/pattern/graph/components/FocusPreviewVideo";

interface FocusPreviewCardProps {
  node: GraphNode;
  typeName: string;
  /** How many patterns come before and after this one, as drawn. */
  before: number;
  after: number;
  /** While the canvas pans the card stays a little see-through: it is a glimpse, not a page. */
  panning: SharedValue<boolean>;
  onOpen: () => void;
}

/** Opacity while the canvas moves under the card; it firms up on release. */
const PANNING_OPACITY = 0.82;

/**
 * A glimpse of the pattern under the focus mark: what it is, how it is
 * counted, what it connects to and, when it has one, its first video. One
 * tap opens it in full.
 *
 * The parent keys it by pattern, so passing the focus to another pattern
 * fades this one out while the next fades in over it.
 */
const FocusPreviewCard: React.FC<FocusPreviewCardProps> = ({
  node,
  typeName,
  before,
  after,
  panning,
  onOpen,
}) => {
  const { t } = useTranslation();
  const levels = useActiveListLevels();
  const { theme } = useUnistyles();
  const { pattern } = node;
  const typeColour = node.color ?? theme.colors.primary;
  const duration = theme.motion.duration.fast;
  const video = pattern.videoRefs?.[0];

  const cardStyle = useAnimatedStyle(() => ({
    opacity: withTiming(panning.get() ? PANNING_OPACITY : 1, { duration }),
  }));
  // "Tap to open" means nothing while the finger is still down.
  const hintStyle = useAnimatedStyle(() => ({
    opacity: withTiming(panning.get() ? 0 : 1, { duration }),
  }));

  const facts = [
    levelName(levels, pattern.level, t) ?? null,
    pattern.counts ? `${t("counts")} ${pattern.counts}` : null,
    pattern.rhythm || null,
  ].filter(Boolean);

  return (
    <Animated.View
      entering={FadeIn.duration(theme.motion.duration.normal)}
      exiting={FadeOut.duration(theme.motion.duration.normal)}
      style={styles.slot}
    >
      {/* The pan's opacity on a view of its own: a layout animation owns the
          opacity of the view it runs on. */}
      <Animated.View style={cardStyle}>
        <Tappable
          onPress={onOpen}
          accessibilityLabel={t("focusPreviewOpen", { name: pattern.name })}
          style={[
            styles.card,
            theme.graph.nodeOutline === "type" && { borderColor: typeColour },
            { borderLeftColor: typeColour },
          ]}
        >
          {video && <FocusPreviewVideo video={video} />}
          <View style={styles.text}>
            {/* The type colour as a swatch, not as the text's colour: some palette
              colours fall well under 4.5:1 on the surface. */}
            <View style={styles.typeRow}>
              <View style={[styles.swatch, { backgroundColor: typeColour }]} />
              <Text style={styles.type} numberOfLines={1}>
                {typeName}
              </Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {pattern.name}
            </Text>
            {facts.length > 0 && (
              <Text style={styles.meta} numberOfLines={1}>
                {facts.join(" · ")}
              </Text>
            )}
            {!!pattern.description && (
              <Text style={styles.description} numberOfLines={2}>
                {pattern.description}
              </Text>
            )}
            <View style={styles.footer}>
              <Text style={styles.meta} numberOfLines={1}>
                {`${t("prerequisites")} ${before} · ${t("buildsInto")} ${after}`}
              </Text>
              <Animated.Text style={[styles.hint, hintStyle]}>
                {t("focusPreviewHint")}
              </Animated.Text>
            </View>
          </View>
        </Tappable>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create((theme) => ({
  // Every card takes the same slot, so the outgoing and the incoming one
  // overlap exactly while they cross-fade.
  slot: { position: "absolute", left: 0, right: 0, bottom: 0 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space.md,
    padding: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.graph.nodeRadius,
    borderWidth: theme.graph.nodeStrokeWidth,
    borderColor: theme.colors.border,
    // Clipboard marks the type with a bar down the left edge, as on its boxes.
    borderLeftWidth: theme.graph.typeBarWidth || theme.graph.nodeStrokeWidth,
    overflow: "hidden",
    ...theme.elevation.lg,
    // Android draws an elevation shadow under the whole box as well, and it
    // shows through while the card is see-through, like a tilted second card.
    // The boxShadow alone stops at the card's edge.
    elevation: 0,
  },
  text: { flex: 1, gap: theme.space.xxs },
  typeRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  swatch: {
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  type: { ...theme.typography.micro, color: theme.colors.textMuted },
  name: { ...theme.typography.rowTitle, color: theme.colors.text },
  meta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    flexShrink: 1,
  },
  description: { ...theme.typography.bodySmall, color: theme.colors.text },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
  },
  hint: { ...theme.typography.micro, color: theme.colors.primary },
}));

export default FocusPreviewCard;
