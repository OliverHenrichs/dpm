import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Tappable } from "@/src/common/ui";
import TypeColorSwatches from "@/src/pattern/list/TypeColorSwatches";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { PatternType } from "@/src/pattern/types/PatternType";
import Svg, { Circle, Path } from "react-native-svg";
import NodeFrame from "@/src/pattern/graph/render/NodeFrame";
import { LEVEL_TINTS, levelTints } from "@/src/pattern/graph/model/nodeFrame";
import { useActiveListLevels } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  isLegendSeen,
  markLegendSeen,
} from "@/src/pattern/graph/data/GraphHintStorage";

/** A pattern box in miniature, drawn by the graph's own `NodeFrame`. */
const SAMPLE_WIDTH = 28;
const SAMPLE_HEIGHT = 18;
/** Room around a sample for its outline and After Hours' halo, which reach outside the box. */
const SAMPLE_MARGIN = 4;
/** Every glyph column is this wide, so the explanations line up beside them. */
const GLYPH_WIDTH = SAMPLE_WIDTH + SAMPLE_MARGIN * 2;

const NodeSample: React.FC<{
  color: string;
  tint?: number;
  foundational?: boolean;
}> = ({ color, tint = LEVEL_TINTS.beginner, foundational = false }) => (
  <Glyph>
    <Svg width={GLYPH_WIDTH} height={SAMPLE_HEIGHT + SAMPLE_MARGIN * 2}>
      <NodeFrame
        x={GLYPH_WIDTH / 2}
        y={SAMPLE_HEIGHT / 2 + SAMPLE_MARGIN}
        width={SAMPLE_WIDTH}
        height={SAMPLE_HEIGHT}
        color={color}
        tint={tint}
        foundational={foundational}
      />
    </Svg>
  </Glyph>
);

/**
 * The glyph column. A `View` around the `Svg` carries the spacing because an
 * `Svg` is a third-party component, and on web it drops a Unistyles style.
 */
const Glyph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.glyph}>{children}</View>
);

interface LegendProps {
  patternTypes: PatternType[];
  /** Level is optional; a list that uses none has no shading to explain. */
  showLevels?: boolean;
  /**
   * Recolours a type. Given only for a list the user may edit: each type then opens the
   * palette list settings use, so the colours are found where they are seen (review 2).
   */
  onChangeTypeColor?: (typeId: string, color: string) => void;
}

const Legend: React.FC<LegendProps> = ({
  patternTypes,
  showLevels = true,
  onChangeTypeColor,
}) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  // The list's own levels, lightest first, shaded as the graph shades them.
  const levels = useActiveListLevels();
  const tints = levelTints(levels.length);
  const [isExpanded, setIsExpanded] = useState(false);
  // The type whose palette is open, if any.
  const [pickingTypeId, setPickingTypeId] = useState<string | null>(null);

  // Open by itself the first time the Map is shown, then stay out of the way.
  useEffect(() => {
    let active = true;
    isLegendSeen().then((seen) => {
      if (!active || seen) return;
      setIsExpanded(true);
      markLegendSeen();
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isExpanded) {
    return (
      <Button
        title={t("showLegend")}
        icon="palette-outline"
        size="sm"
        onPress={() => setIsExpanded(true)}
        style={styles.collapsedButton}
      />
    );
  }

  return (
    <View style={styles.expandedContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("legend")}</Text>
        <Button
          title={t("hideLegend")}
          variant="ghost"
          size="sm"
          onPress={() => setIsExpanded(false)}
        />
      </View>

      {/* Type Colors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("typeColors")}:</Text>
        {onChangeTypeColor && (
          <Text style={styles.hint}>{t("legendTapToRecolor")}</Text>
        )}
        {patternTypes.map((type) => {
          const sample = (
            <>
              <NodeSample color={type.color} />
              <Text style={styles.legendText}>
                {t("legendTypeLane", { type: type.slug })}
              </Text>
            </>
          );
          if (!onChangeTypeColor) {
            return (
              <View style={styles.legendItem} key={type.id}>
                {sample}
              </View>
            );
          }
          const isPicking = pickingTypeId === type.id;
          return (
            <View key={type.id}>
              <Tappable
                onPress={() =>
                  setPickingTypeId((prev) =>
                    prev === type.id ? null : type.id,
                  )
                }
                accessibilityLabel={t("patternTypeColor", { type: type.slug })}
                accessibilityState={{ expanded: isPicking }}
                style={styles.legendItem}
              >
                {sample}
              </Tappable>
              {isPicking && (
                <View style={styles.swatches}>
                  <TypeColorSwatches
                    current={type.color}
                    onPick={(color) => {
                      setPickingTypeId(null);
                      if (color !== type.color) {
                        onChangeTypeColor(type.id, color);
                      }
                    }}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Level Shading */}
      {showLevels && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("levelShading")}:</Text>
          {levels.map((level, i) => (
            <View style={styles.legendItem} key={level.id}>
              <NodeSample color={theme.colors.primary} tint={tints[i]} />
              <Text style={styles.legendText}>{level.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Special Indicators */}
      <View style={styles.section}>
        <View style={styles.legendItem}>
          <NodeSample color={theme.colors.primary} foundational />
          <Text style={styles.legendText}>{t("foundationalPattern")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.arrowText}>→</Text>
          <Text style={styles.legendText}>
            {t("legendPrerequisiteDirection")}
          </Text>
        </View>
        {/* The badges a node draws in its bottom-right corner. Rendered here
            with the same shapes, not emoji, so the legend matches the graph
            whatever fonts the device has. */}
        <View style={styles.legendItem}>
          <Glyph>
            <Svg width={GLYPH_WIDTH} height={20}>
              <Path d="M 14 6 L 22 10 L 14 14 Z" fill={theme.colors.primary} />
            </Svg>
          </Glyph>
          <Text style={styles.legendText}>{t("legendHasVideo")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Glyph>
            <Svg width={GLYPH_WIDTH} height={20}>
              {[0, 1, 2].map((index) => (
                <Circle
                  key={index}
                  cx={13 + index * 5}
                  cy={10}
                  r={1.6}
                  fill={theme.colors.primary}
                />
              ))}
            </Svg>
          </Glyph>
          <Text style={styles.legendText}>{t("legendModifiers")}</Text>
        </View>
        {/* Repeated here because the hint bar above the graph is dismissible,
            and nothing about a node says it can be picked up. */}
        <View style={styles.legendItem}>
          <Text style={styles.arrowText}>✋</Text>
          <Text style={styles.legendText}>{t("dragToMove")}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  collapsedButton: {
    position: "absolute",
    bottom: 10,
    right: 16,
    ...theme.elevation.md,
  },
  expandedContainer: {
    position: "absolute",
    bottom: 10,
    right: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    maxWidth: 200,
    ...theme.elevation.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.space.sm,
  },
  title: {
    ...theme.typography.label,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  section: {
    marginBottom: theme.space.md,
  },
  sectionTitle: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: theme.space.xxs,
  },
  hint: {
    ...theme.typography.micro,
    color: theme.colors.textMuted,
    marginBottom: theme.space.xs,
  },
  swatches: {
    marginVertical: theme.space.xs,
  },
  legendText: {
    ...theme.typography.micro,
    color: theme.colors.textMuted,
  },
  glyph: {
    marginRight: theme.space.sm,
  },
  arrowText: {
    ...theme.typography.title,
    width: GLYPH_WIDTH,
    textAlign: "center",
    marginRight: theme.space.sm,
    color: theme.colors.text,
  },
}));

export default Legend;
