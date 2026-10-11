import React, { useState } from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { getCommonBorder, getCommonRow } from "@/src/common/utils/CommonStyles";
import TagPickerBottomSheet from "./TagPickerBottomSheet";
import PlusButton from "@/src/common/components/PlusButton";

interface PatternTagsProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  allPatterns?: IPattern[];
}

const PatternTags: React.FC<PatternTagsProps> = ({
  tags,
  setTags,
  allPatterns,
}) => {
  const { t } = useTranslation();

  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (
      trimmedTag &&
      !tags.some((t) => t.toLowerCase() === trimmedTag.toLowerCase())
    ) {
      setTags([...tags, trimmedTag]);
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.tagsContainer}>
      <View style={styles.tagsRow}>
        {tags.map((tag: string, idx: number) => (
          <View key={idx} style={styles.tagItem}>
            <Text style={styles.tagText}>{tag}</Text>
            <IconButton
              icon="close"
              size={14}
              color="onSurfaceVariant"
              onPress={() => removeTag(idx)}
              accessibilityLabel={`${t("removeTag")}: ${tag}`}
            />
          </View>
        ))}
      </View>
      <PlusButton
        onPress={() => setIsBottomSheetVisible(true)}
        accessibilityLabel={t("addTag")}
      />

      <TagPickerBottomSheet
        visible={isBottomSheetVisible}
        onClose={() => setIsBottomSheetVisible(false)}
        onAddTag={addTag}
        selectedTags={tags}
        allPatterns={allPatterns}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => {
  return {
    // The tags and the add button side by side, centred, so the box fits the button when
    // there are no tags and keeps even space above and below when there are.
    tagsContainer: {
      ...getCommonBorder(theme),
      ...getCommonRow(),
      gap: theme.space.sm,
      padding: theme.space.sm,
      backgroundColor: theme.colors.surfaceVariant,
    },
    tagsRow: {
      ...getCommonRow(),
      flex: 1,
      flexWrap: "wrap",
      gap: theme.space.xs,
    },
    tagItem: {
      ...getCommonBorder(theme),
      ...getCommonRow(),
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: theme.space.sm,
    },
    tagText: {
      ...theme.typography.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
  };
});

export default PatternTags;
