import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Pattern } from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import PatternFilterBottomSheet, {
  PatternFilter,
} from "../filter/PatternFilterBottomSheet";
import SortBottomSheet, { SortConfig } from "../sort/SortBottomSheet";
import PatternListHeader from "./PatternListHeader";
import PatternListItem from "./PatternListItem";
import { usePatternFilter } from "./hooks/usePatternFilter";
import { usePatternSort } from "./hooks/usePatternSort";

type PatternListProps = {
  patterns: Pattern[];
  patternTypes?: PatternType[];
  selectedPattern?: Pattern;
  onSelect: (pattern: Pattern | undefined) => void;
  onDelete: (id?: number) => void;
  onAdd: () => void;
  onEdit: (pattern: Pattern) => void;
};

const PatternList: React.FC<PatternListProps> = (props) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filter, setFilter] = useState<PatternFilter>({
    name: "",
    types: [],
    levels: [],
    counts: undefined,
    tags: [],
  });

  const [isSortVisible, setIsSortVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "name",
    order: "asc",
  });

  const { filteredPatterns, hasActiveFilter } = usePatternFilter(
    props.patterns,
    filter,
  );
  const { sortedPatterns } = usePatternSort(filteredPatterns, sortConfig);

  return (
    <>
      <PatternListHeader
        hasActiveFilter={hasActiveFilter}
        onSort={() => setIsSortVisible(true)}
        onFilter={() => setIsFilterVisible(true)}
        onAdd={props.onAdd}
      />

      <ScrollView style={styles.scrollView}>
        {sortedPatterns.map((pattern) => (
          <PatternListItem
            key={pattern.id}
            pattern={pattern}
            allPatterns={props.patterns}
            patternTypes={props.patternTypes}
            isSelected={props.selectedPattern?.id === pattern.id}
            onSelect={props.onSelect}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
          />
        ))}
        {sortedPatterns.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {hasActiveFilter ? t("noMatchingPatterns") : t("noPatterns")}
            </Text>
          </View>
        )}
      </ScrollView>

      <PatternFilterBottomSheet
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApplyFilter={setFilter}
        currentFilter={filter}
        allPatterns={props.patterns}
      />

      <SortBottomSheet
        visible={isSortVisible}
        onClose={() => setIsSortVisible(false)}
        onApplySort={setSortConfig}
        currentSort={sortConfig}
      />
    </>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    emptyState: {
      paddingVertical: 32,
      alignItems: "center",
    },
    emptyStateText: {
      color: palette[PaletteColor.SecondaryText],
      fontSize: 14,
      fontStyle: "italic",
    },
  });

export default PatternList;
