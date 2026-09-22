import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { PatternType } from "@/src/pattern/types/PatternType";

interface LegendProps {
  palette: Record<PaletteColor, string>;
  patternTypes: PatternType[];
}

const Legend: React.FC<LegendProps> = ({ palette, patternTypes }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getStyles(palette);

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
                backgroundColor: palette[PaletteColor.Surface],
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
                backgroundColor: palette[PaletteColor.Surface],
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
                backgroundColor: palette[PaletteColor.Surface],
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
                borderColor: palette[PaletteColor.Primary],
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

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    collapsedButton: {
      position: "absolute",
      bottom: 10,
      right: 16,
      backgroundColor: palette[PaletteColor.Primary],
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      elevation: 4,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
    },
    buttonText: {
      color: palette[PaletteColor.Surface],
      fontSize: 12,
      fontWeight: "600",
    },
    expandedContainer: {
      position: "absolute",
      bottom: 10,
      right: 16,
      backgroundColor: palette[PaletteColor.Surface],
      borderWidth: 2,
      borderColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      padding: 12,
      maxWidth: 200,
      elevation: 4,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette[PaletteColor.Border],
      paddingBottom: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
    closeButton: {
      fontSize: 12,
      color: palette[PaletteColor.Primary],
    },
    section: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 2,
    },
    colorBox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderRadius: 4,
      marginRight: 8,
      backgroundColor: palette[PaletteColor.Surface],
    },
    legendText: {
      fontSize: 11,
      color: palette[PaletteColor.SecondaryText],
    },
    arrowText: {
      fontSize: 18,
      marginRight: 8,
      color: palette[PaletteColor.PrimaryText],
    },
  });

export default Legend;
