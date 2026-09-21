import React, { useCallback, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import PatternFilterBottomSheet, {
  PatternFilter,
} from "../filter/components/PatternFilterBottomSheet";
import SortBottomSheet, {
  SortConfig,
} from "@/src/pattern/list/SortBottomSheet";
import PatternListHeader from "./PatternListHeader";
import PatternListItem from "./PatternListItem";
import { usePatternFilter } from "./hooks/usePatternFilter";
import { usePatternSort } from "./hooks/usePatternSort";

type PatternListProps = {
  patterns: IPattern[];
  patternTypes?: PatternType[];
  modifiers?: IModifier[];
  selectedPattern?: IPattern;
  isReadonly?: boolean;
  onSelect: (pattern: IPattern | undefined) => void;
  onDelete: (id?: number) => void;
  onAdd: () => void;
  onEdit: (pattern: IPattern) => void;
};

const PatternList: React.FC<PatternListProps> = (props) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const isReadonly = props.isReadonly ?? false;

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

  const keyExtractor = useCallback(
    (pattern: IPattern) => String(pattern.id),
    [],
  );

  // Rebuilt whenever the row's inputs change; PatternListItem is memoised, so
  // only the rows whose props actually differ re-render.
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<IPattern>) => (
      <PatternListItem
        pattern={item}
        allPatterns={props.patterns}
        patternTypes={props.patternTypes}
        modifiers={props.modifiers}
        isReadonly={isReadonly}
        isSelected={props.selectedPattern?.id === item.id}
        onSelect={props.onSelect}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
      />
    ),
    [
      props.patterns,
      props.patternTypes,
      props.modifiers,
      props.selectedPattern?.id,
      props.onSelect,
      props.onEdit,
      props.onDelete,
      isReadonly,
    ],
  );

  return (
    <>
      <PatternListHeader
        hasActiveFilter={hasActiveFilter}
        isReadonly={isReadonly}
        onSort={() => setIsSortVisible(true)}
        onFilter={() => setIsFilterVisible(true)}
        onAdd={props.onAdd}
      />

      <FlatList
        style={styles.scrollView}
        data={sortedPatterns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {hasActiveFilter ? t("noMatchingPatterns") : t("noPatterns")}
            </Text>
          </View>
        }
      />

      <PatternFilterBottomSheet
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApplyFilter={setFilter}
        currentFilter={filter}
        allPatterns={props.patterns}
        patternTypes={props.patternTypes}
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
