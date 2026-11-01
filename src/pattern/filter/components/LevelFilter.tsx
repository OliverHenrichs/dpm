import React from "react";
import { Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { useTranslation } from "react-i18next";
import { useActiveListLevels } from "@/src/pattern/data/components/ActivePatternListContext";
import { filterStyles as styles } from "../FilterCommonStyles";

interface LevelFilterProps {
  /** Level ids. */
  selectedLevels: string[];
  onToggle: (levelId: string) => void;
}

/** One chip per level of the active list, in the list's order. */
const LevelFilter: React.FC<LevelFilterProps> = ({
  selectedLevels,
  onToggle,
}) => {
  const { t } = useTranslation();
  const levels = useActiveListLevels();

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("level")}</Text>
      <View style={styles.chipContainer}>
        {levels.map((level) => (
          <Chip
            key={level.id}
            label={level.name}
            selected={selectedLevels.includes(level.id)}
            onPress={() => onToggle(level.id)}
          />
        ))}
      </View>
    </View>
  );
};

export default LevelFilter;
