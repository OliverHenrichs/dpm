import React from "react";
import { Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { useTranslation } from "react-i18next";
import { filterStyles as styles } from "../FilterCommonStyles";

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({
  allTags,
  selectedTags,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("tags")}</Text>
      <View style={styles.chipContainer}>
        {allTags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            selected={selectedTags.includes(tag)}
            onPress={() => onToggle(tag)}
          />
        ))}
      </View>
    </View>
  );
};

export default TagFilter;
