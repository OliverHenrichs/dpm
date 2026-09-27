import React, { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Button, Chip } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import BottomSheet from "@/src/common/components/BottomSheet";

interface TagPickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onAddTag: (tag: string) => void;
  selectedTags: string[];
  allPatterns?: IPattern[];
}

const TagPickerBottomSheet: React.FC<TagPickerBottomSheetProps> = ({
  visible,
  onClose,
  onAddTag,
  selectedTags,
  allPatterns,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [searchQuery, setSearchQuery] = useState("");

  // Extract all unique tags from all patterns
  const allExistingTags = useMemo(() => {
    if (!allPatterns) return [];
    const tagSet = new Set<string>();
    allPatterns.forEach((pattern) => {
      pattern.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [allPatterns]);

  // Filter existing tags based on search query and exclude already selected
  const filteredExistingTags = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return allExistingTags.filter(
      (tag) =>
        tag.toLowerCase().includes(query) &&
        !selectedTags.some(
          (existingTag) => existingTag.toLowerCase() === tag.toLowerCase(),
        ),
    );
  }, [searchQuery, allExistingTags, selectedTags]);

  // Check if search query is a new tag (not in existing tags)
  const isNewTag = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return false;
    return (
      !allExistingTags.some(
        (tag) => tag.toLowerCase() === query.toLowerCase(),
      ) &&
      !selectedTags.some((tag) => tag.toLowerCase() === query.toLowerCase())
    );
  }, [searchQuery, allExistingTags, selectedTags]);

  const handleAddTag = (tag: string) => {
    onAddTag(tag);
    setSearchQuery("");
  };

  const handleAddNewTag = () => {
    if (searchQuery.trim()) {
      handleAddTag(searchQuery);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} title={t("addTag")}>
      <TextInput
        placeholder={t("addTag")}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        placeholderTextColor={theme.colors.textMuted}
        autoFocus={true}
      />

      <ScrollView
        style={styles.tagsScrollView}
        contentContainerStyle={styles.tagsScrollContent}
      >
        {/* Create new tag option */}
        {isNewTag && (
          <Button
            title={t("createTag", { tag: searchQuery })}
            icon="plus"
            onPress={handleAddNewTag}
            style={styles.createNewTagButton}
          />
        )}

        {/* Existing tags */}
        {filteredExistingTags.length > 0 && (
          <View style={styles.existingTagsSection}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? t("matchingTags") : t("existingTags")}
            </Text>
            <View style={styles.tagsGrid}>
              {filteredExistingTags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  icon="tag-outline"
                  onPress={() => handleAddTag(tag)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!isNewTag && filteredExistingTags.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t("noMatchingTags")}</Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => {
  return {
    searchInput: {
      ...theme.typography.body,
      ...getCommonInput(theme),
      marginBottom: theme.space.lg,
    },
    tagsScrollView: {
      flex: 1,
    },
    tagsScrollContent: {
      paddingBottom: theme.space.lg,
    },
    createNewTagButton: {
      marginBottom: theme.space.lg,
    },
    existingTagsSection: {
      marginBottom: theme.space.lg,
    },
    sectionTitle: {
      ...theme.typography.label,
      color: theme.colors.textMuted,
      marginBottom: theme.space.sm,
      textTransform: "uppercase" as const,
    },
    tagsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: theme.space.sm,
    },
    emptyState: {
      paddingVertical: theme.space.xxxl,
      alignItems: "center" as const,
    },
    emptyStateText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      fontStyle: "italic" as const,
    },
  };
});

export default TagPickerBottomSheet;
