import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/components/common/ThemeContext";
import { Pattern } from "@/components/pattern/types/PatternList";
import {
  getCommonAddButtonContainer,
  getCommonBorder,
  getCommonLabel,
  getCommonRow,
} from "@/components/common/CommonStyles";
import TagPickerBottomSheet from "./TagPickerBottomSheet";
import PlusButton from "@/components/common/PlusButton";

interface PatternTagsProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  allPatterns?: Pattern[];
  styles?: any;
}

const PatternTags: React.FC<PatternTagsProps> = ({
  tags,
  setTags,
  allPatterns,
  styles,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const localStyles = getStyles(palette);
  styles = { ...styles, ...localStyles };

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
      <Text style={styles.label}>{t("tags")}</Text>
      <View style={styles.tagsRow}>
        {tags.map((tag: string, idx: number) => (
          <View key={idx} style={styles.tagItem}>
            <Text style={styles.tagText}>{tag}</Text>
            <TouchableOpacity onPress={() => removeTag(idx)}>
              <Text style={styles.tagRemove}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <View style={styles.addButtonContainer}>
        <PlusButton
          onPress={() => setIsBottomSheetVisible(true)}
          palette={palette}
          accessibilityLabel={t("addTag")}
        />
      </View>

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

const getStyles = (palette: Record<PaletteColor, string>) => {
  return {
    tagsContainer: {
      ...getCommonBorder(palette),
      padding: 6,
      backgroundColor: palette[PaletteColor.TagBg],
      position: "relative",
    },
    tagsRow: {
      ...getCommonRow(),
      flexWrap: "wrap",
      gap: 4,
      marginTop: 8,
    },
    tagItem: {
      ...getCommonBorder(palette),
      ...getCommonRow(),
      backgroundColor: palette[PaletteColor.TagBg],
      paddingHorizontal: 8,
    },
    tagText: { color: palette[PaletteColor.TagText], fontSize: 14 },
    tagRemove: {
      color: palette[PaletteColor.TagText],
      fontSize: 16,
      marginLeft: 4,
    },
    label: { ...getCommonLabel(palette) },
    addButtonContainer: getCommonAddButtonContainer(),
  };
};

export default PatternTags;
