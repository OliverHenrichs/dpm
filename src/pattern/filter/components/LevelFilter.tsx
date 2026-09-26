import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import { filterStyles as styles } from "../FilterCommonStyles";

interface LevelFilterProps {
  selectedLevels: PatternLevel[];
  onToggle: (level: PatternLevel) => void;
}

const LevelFilter: React.FC<LevelFilterProps> = ({
  selectedLevels,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("level")}</Text>
      <View style={styles.chipContainer}>
        {Object.values(PatternLevel).map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.chip,
              selectedLevels.includes(level) && styles.chipSelected,
            ]}
            onPress={() => onToggle(level)}
          >
            <Text
              style={[
                styles.chipText,
                selectedLevels.includes(level) && styles.chipTextSelected,
              ]}
            >
              {t(level)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default LevelFilter;
