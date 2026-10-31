import React from "react";
import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { PATTERN_TYPE_COLORS } from "@/src/pattern/types/PatternType";

const COLOR_VALUES = Object.values(PATTERN_TYPE_COLORS) as string[];
const COLOR_NAMES = Object.keys(PATTERN_TYPE_COLORS);

interface TypeColorSwatchesProps {
  /** The type's colour now, checked in the grid. */
  current: string;
  onPick: (color: string) => void;
}

/**
 * The palette a pattern type's colour is picked from, as a grid of swatches: list settings
 * (`PatternListTemplateModal`) and the Map's legend both show it. The swatches show data
 * colours, so they are plain labelled radios rather than a UI primitive.
 */
const TypeColorSwatches: React.FC<TypeColorSwatchesProps> = ({
  current,
  onPick,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {COLOR_VALUES.map((color, idx) => (
        <Pressable
          key={COLOR_NAMES[idx]}
          style={[styles.swatch(color), color === current && styles.selected]}
          onPress={() => onPick(color)}
          accessibilityRole="radio"
          accessibilityLabel={t("colorSwatch", {
            n: idx + 1,
            count: COLOR_VALUES.length,
          })}
          accessibilityState={{ checked: color === current }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 148,
    gap: theme.space.sm,
  },
  swatch: (color: string) => ({
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: color,
  }),
  selected: {
    borderColor: theme.colors.text,
  },
}));

export default TypeColorSwatches;
