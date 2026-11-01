import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button, Chip } from "@/src/common/ui";
import { useTranslation } from "react-i18next";
import { filterStyles } from "../FilterCommonStyles";

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  /** Opens list settings on its Tags section; without it there is no _Manage_ link. */
  onManage?: () => void;
}

const TagFilter: React.FC<TagFilterProps> = ({
  allTags,
  selectedTags,
  onToggle,
  onManage,
}) => {
  const { t } = useTranslation();

  return (
    <View style={filterStyles.filterSection}>
      <View style={styles.header}>
        <Text style={filterStyles.label}>{t("tags")}</Text>
        {onManage && (
          <Button
            title={t("manageTags")}
            variant="ghost"
            size="sm"
            onPress={onManage}
          />
        )}
      </View>
      <View style={filterStyles.chipContainer}>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

export default TagFilter;
