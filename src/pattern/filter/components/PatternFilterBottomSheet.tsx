import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import { PatternType } from "@/src/pattern/types/PatternType";
import BottomSheet from "@/src/common/components/BottomSheet";
import NameFilter from "./NameFilter";
import TypeFilter from "./TypeFilter";
import LevelFilter from "./LevelFilter";
import CountsFilter from "./CountsFilter";
import TagFilter from "./TagFilter";

export interface PatternFilter {
  name: string;
  types: string[];
  levels: PatternLevel[];
  counts?: number;
  tags: string[];
}

interface PatternFilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilter: (filter: PatternFilter) => void;
  currentFilter: PatternFilter;
  allPatterns: IPattern[];
  patternTypes?: PatternType[];
  /**
   * Rendered above the criteria. The graph screen puts its chain-mode control
   * here rather than the sheet growing a graph concept the list has no use for.
   */
  headerSection?: React.ReactNode;
}

const PatternFilterBottomSheet: React.FC<PatternFilterBottomSheetProps> = ({
  visible,
  onClose,
  onApplyFilter,
  currentFilter,
  allPatterns,
  patternTypes = [],
  headerSection,
}) => {
  const { t } = useTranslation();

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

  const toggleType = (typeId: string) => {
    setFilter((prev) => ({
      ...prev,
      types: prev.types.includes(typeId)
        ? prev.types.filter((t) => t !== typeId)
        : [...prev.types, typeId],
    }));
  };

  const toggleLevel = (level: PatternLevel) => {
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
      maxHeight="95%"
      minHeight="85%"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {headerSection}

        <NameFilter
          value={filter.name}
          onChange={(text) => setFilter({ ...filter, name: text })}
        />

        <TypeFilter
          availableTypes={patternTypes}
          selectedTypes={filter.types}
          onToggle={toggleType}
        />

        <LevelFilter selectedLevels={filter.levels} onToggle={toggleLevel} />

        <CountsFilter
          counts={filter.counts}
          onChange={(value) => setFilter({ ...filter, counts: value })}
        />

        <TagFilter
          allTags={allTags}
          selectedTags={filter.tags}
          onToggle={toggleTag}
        />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Button
          title={t("reset")}
          variant="secondary"
          onPress={handleReset}
          style={styles.footerButton}
        />
        <Button
          title={t("apply")}
          onPress={handleApply}
          style={styles.footerButton}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => {
  return {
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.space.lg,
    },
    buttonRow: {
      flexDirection: "row" as const,
      gap: theme.space.md,
      marginTop: theme.space.lg,
    },
    footerButton: { flex: 1 },
  };
});

export default PatternFilterBottomSheet;
