import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/components/common/ThemeContext";
import { Pattern } from "@/components/pattern/types/PatternList";
import {
  WCSPatternLevel,
  WCSPatternType,
} from "@/components/pattern/types/WCSPatternEnums";
import BottomSheet from "@/components/common/BottomSheet";
import NameFilter from "./NameFilter";
import TypeFilter from "./TypeFilter";
import LevelFilter from "./LevelFilter";
import CountsFilter from "./CountsFilter";
import TagFilter from "./TagFilter";

export interface PatternFilter {
  name: string;
  types: WCSPatternType[];
  levels: WCSPatternLevel[];
  counts?: number;
  tags: string[];
}

interface PatternFilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilter: (filter: PatternFilter) => void;
  currentFilter: PatternFilter;
  allPatterns: Pattern[];
}

const PatternFilterBottomSheet: React.FC<PatternFilterBottomSheetProps> = ({
  visible,
  onClose,
  onApplyFilter,
  currentFilter,
  allPatterns,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const [filter, setFilter] = useState<PatternFilter>(currentFilter);

  // Extract all unique tags from all patterns
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allPatterns.forEach((pattern) => {
      pattern.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [allPatterns]);

  const toggleType = (type: WCSPatternType) => {
    setFilter((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  const toggleLevel = (level: WCSPatternLevel) => {
    setFilter((prev) => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter((l) => l !== level)
        : [...prev.levels, level],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilter((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleApply = () => {
    onApplyFilter(filter);
    onClose();
  };

  const handleReset = () => {
    const emptyFilter: PatternFilter = {
      name: "",
      types: [],
      levels: [],
      counts: undefined,
      tags: [],
    };
    setFilter(emptyFilter);
    onApplyFilter(emptyFilter);
  };

  const handleClose = () => {
    setFilter(currentFilter); // Reset to current filter on cancel
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={t("filterPatterns")}
      palette={palette}
      maxHeight="95%"
      minHeight="85%"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <NameFilter
          value={filter.name}
          onChange={(text) => setFilter({ ...filter, name: text })}
          palette={palette}
        />

        <TypeFilter
          selectedTypes={filter.types}
          onToggle={toggleType}
          palette={palette}
        />

        <LevelFilter
          selectedLevels={filter.levels}
          onToggle={toggleLevel}
          palette={palette}
        />

        <CountsFilter
          counts={filter.counts}
          onChange={(value) => setFilter({ ...filter, counts: value })}
          palette={palette}
        />

        <TagFilter
          allTags={allTags}
          selectedTags={filter.tags}
          onToggle={toggleTag}
          palette={palette}
        />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>{t("reset")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>{t("apply")}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) => {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    buttonRow: {
      flexDirection: "row" as const,
      gap: 12,
      marginTop: 16,
    },
    resetButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      borderRadius: 8,
      backgroundColor: palette[PaletteColor.Surface],
      padding: 12,
      alignItems: "center" as const,
    },
    resetButtonText: {
      color: palette[PaletteColor.SecondaryText],
      fontWeight: "bold" as const,
      fontSize: 16,
    },
    applyButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Primary],
      padding: 12,
      borderRadius: 8,
      alignItems: "center" as const,
    },
    applyButtonText: {
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "bold" as const,
      fontSize: 16,
    },
  });
};

export default PatternFilterBottomSheet;
