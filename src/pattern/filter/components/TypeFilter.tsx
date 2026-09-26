import React from "react";
import { Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { useTranslation } from "react-i18next";
import { PatternType } from "@/src/pattern/types/PatternType";
import { filterStyles as styles } from "../FilterCommonStyles";

interface TypeFilterProps {
  availableTypes: PatternType[];
  selectedTypes: string[];
  onToggle: (typeId: string) => void;
}

const TypeFilter: React.FC<TypeFilterProps> = ({
  availableTypes,
  selectedTypes,
  onToggle,
}) => {
  const { t } = useTranslation();

  if (!availableTypes || availableTypes.length === 0) {
    return null;
  }

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("type")}</Text>
      <View style={styles.chipContainer}>
        {availableTypes.map((type) => (
          <Chip
            key={type.id}
            label={type.slug}
            selected={selectedTypes.includes(type.id)}
            onPress={() => onToggle(type.id)}
          />
        ))}
      </View>
    </View>
  );
};

export default TypeFilter;
