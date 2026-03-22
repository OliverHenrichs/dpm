import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { PatternType } from "@/src/pattern/types/PatternType";
import { getFilterCommonStyles } from "../FilterCommonStyles";

interface TypeFilterProps {
  availableTypes: PatternType[];
  selectedTypes: string[];
  onToggle: (typeId: string) => void;
  palette: Record<PaletteColor, string>;
}

const TypeFilter: React.FC<TypeFilterProps> = ({
  availableTypes,
  selectedTypes,
  onToggle,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getFilterCommonStyles(palette);

  if (!availableTypes || availableTypes.length === 0) {
    return null;
  }

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("type")}</Text>
      <View style={styles.chipContainer}>
        {availableTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.chip,
              selectedTypes.includes(type.id) && styles.chipSelected,
            ]}
            onPress={() => onToggle(type.id)}
          >
            <Text
              style={[
                styles.chipText,
                selectedTypes.includes(type.id) && styles.chipTextSelected,
              ]}
            >
              {type.slug}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default TypeFilter;
