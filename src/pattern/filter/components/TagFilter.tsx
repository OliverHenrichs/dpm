import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
          <TouchableOpacity
            key={tag}
            style={[
              styles.chip,
              selectedTags.includes(tag) && styles.chipSelected,
            ]}
            onPress={() => onToggle(tag)}
          >
            <Text
              style={[
                styles.chipText,
                selectedTags.includes(tag) && styles.chipTextSelected,
              ]}
            >
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default TagFilter;
