import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  getCommonBorder,
  getCommonInput,
} from "@/src/common/utils/CommonStyles";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

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
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={t("addTag")}
      palette={palette}
    >
      <TextInput
        placeholder={t("addTag")}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        placeholderTextColor={palette[PaletteColor.TextMuted]}
        autoFocus={true}
      />

      <ScrollView
        style={styles.tagsScrollView}
        contentContainerStyle={styles.tagsScrollContent}
      >
        {/* Create new tag option */}
        {isNewTag && (
          <TouchableOpacity
            style={styles.createNewTagButton}
            onPress={handleAddNewTag}
          >
            <Text style={styles.createNewTagText}>
              + Create &quot;{searchQuery}&quot;
            </Text>
          </TouchableOpacity>
        )}

        {/* Existing tags */}
        {filteredExistingTags.length > 0 && (
          <View style={styles.existingTagsSection}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? t("matchingTags") : t("existingTags")}
            </Text>
            <View style={styles.tagsGrid}>
              {filteredExistingTags.map((tag, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.existingTagChip}
                  onPress={() => handleAddTag(tag)}
                >
                  <Text style={styles.existingTagText}>{tag}</Text>
                </TouchableOpacity>
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

const getStyles = (palette: Record<PaletteColor, string>) => {
  return StyleSheet.create({
    searchInput: {
      ...getCommonInput(palette),
      marginBottom: 16,
      fontSize: 16,
    },
    tagsScrollView: {
      flex: 1,
    },
    tagsScrollContent: {
      paddingBottom: 16,
    },
    createNewTagButton: {
      ...getCommonBorder(palette),
      backgroundColor: palette[PaletteColor.Primary],
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      alignItems: "center" as const,
    },
    createNewTagText: {
      color: palette[PaletteColor.OnPrimary],
      fontWeight: "bold" as const,
      fontSize: 14,
    },
    existingTagsSection: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: palette[PaletteColor.TextMuted],
      marginBottom: 8,
      textTransform: "uppercase" as const,
    },
    tagsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    },
    existingTagChip: {
      ...getCommonBorder(palette),
      backgroundColor: palette[PaletteColor.SurfaceVariant],
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
    },
    existingTagText: {
      color: palette[PaletteColor.OnSurfaceVariant],
      fontSize: 14,
    },
    emptyState: {
      paddingVertical: 32,
      alignItems: "center" as const,
    },
    emptyStateText: {
      color: palette[PaletteColor.TextMuted],
      fontSize: 14,
      fontStyle: "italic" as const,
    },
  });
};

export default TagPickerBottomSheet;
