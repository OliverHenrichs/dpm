import React from "react";
import { Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
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
          <Chip
            key={level}
            label={t(level)}
            selected={selectedLevels.includes(level)}
            onPress={() => onToggle(level)}
          />
        ))}
      </View>
    </View>
  );
};

export default LevelFilter;
