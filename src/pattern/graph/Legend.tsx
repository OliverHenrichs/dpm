import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { PatternType } from "@/src/pattern/types/PatternType";
import Svg, { Circle, Path } from "react-native-svg";

interface LegendProps {
  patternTypes: PatternType[];
}

const Legend: React.FC<LegendProps> = ({ patternTypes }) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={styles.collapsedButton}
        onPress={() => setIsExpanded(true)}
      >
        <Text style={styles.buttonText}>{t("showLegend")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.expandedContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("legend")}</Text>
        <TouchableOpacity onPress={() => setIsExpanded(false)}>
          <Text style={styles.closeButton}>{t("hideLegend")}</Text>
        </TouchableOpacity>
      </View>

      {/* Type Colors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("typeColors")}:</Text>
        {patternTypes.map((type) => (
          <View style={styles.legendItem} key={type.id}>
            <View style={[styles.colorBox, { borderColor: type.color }]} />
            <Text style={styles.legendText}>{type.slug} lane</Text>
          </View>
        ))}
      </View>

      {/* Level Shading */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("levelShading")}:</Text>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.colorBox,
              {
                backgroundColor: theme.colors.surface,
                opacity: 0.3,
              },
            ]}
          />
          <Text style={styles.legendText}>{t("beginner")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.colorBox,
              {
                backgroundColor: theme.colors.surface,
                opacity: 0.5,
              },
            ]}
          />
          <Text style={styles.legendText}>{t("intermediate")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.colorBox,
              {
                backgroundColor: theme.colors.surface,
                opacity: 0.7,
              },
            ]}
          />
          <Text style={styles.legendText}>{t("advanced")}</Text>
        </View>
      </View>

      {/* Special Indicators */}
      <View style={styles.section}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.colorBox,
              {
                borderColor: theme.colors.primary,
                borderWidth: 3,
              },
            ]}
          />
          <Text style={styles.legendText}>{t("foundationalPattern")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.arrowText}>→</Text>
          <Text style={styles.legendText}>Prerequisite direction</Text>
        </View>
        {/* The badges a node draws in its bottom-right corner. Rendered here
            with the same shapes, not emoji, so the legend matches the graph
            whatever fonts the device has. */}
        <View style={styles.legendItem}>
          <Svg width={20} height={20} style={styles.glyph}>
            <Path d="M 6 6 L 14 10 L 6 14 Z" fill={theme.colors.primary} />
          </Svg>
          <Text style={styles.legendText}>{t("legendHasVideo")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Svg width={20} height={20} style={styles.glyph}>
            {[0, 1, 2].map((index) => (
              <Circle
                key={index}
                cx={5 + index * 5}
                cy={10}
                r={1.6}
                fill={theme.colors.primary}
              />
            ))}
          </Svg>
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
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    ...theme.elevation.md,
  },
  buttonText: {
    ...theme.typography.caption,
    color: theme.colors.onPrimary,
    fontWeight: "600",
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
  closeButton: {
    ...theme.typography.caption,
    color: theme.colors.primary,
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
  colorBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: theme.radius.xs,
    marginRight: theme.space.sm,
    backgroundColor: theme.colors.surface,
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
    marginRight: theme.space.sm,
    color: theme.colors.text,
  },
}));

export default Legend;
