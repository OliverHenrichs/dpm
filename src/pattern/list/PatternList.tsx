import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import BottomSheet from "@/src/common/components/BottomSheet";
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
import { usePatternFilter } from "@/src/pattern/filter/hooks/usePatternFilter";
import { usePatternSort } from "./hooks/usePatternSort";

/** Where "a pattern from a video" takes its video from. */
export type VideoSource = "library" | "camera";

/** How long a reveal waits for the list to relayout before scrolling anyway. */
const REVEAL_FALLBACK_MS = 300;

type PatternListProps = {
  patterns: IPattern[];
  patternTypes?: PatternType[];
  modifiers?: IModifier[];
  selectedPattern?: IPattern;
  isReadonly?: boolean;
  onSelect: (pattern: IPattern | undefined) => void;
  onDelete: (id?: number) => void;
  onAdd: () => void;
  /**
   * Creating a pattern from a video. When given, '+' opens a menu offering it next to a plain
   * new pattern; without it, '+' adds a pattern directly.
   */
  onAddFromVideo?: (source: VideoSource) => void;
  /** Scrolls this pattern into view whenever the value changes. */
  reveal?: { id: number; at: number };
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

  const [isAddMenuVisible, setIsAddMenuVisible] = useState(false);
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

  const listRef = useRef<FlatList<IPattern>>(null);
  const revealIndex = props.reveal
    ? sortedPatterns.findIndex((p) => p.id === props.reveal!.id)
    : -1;
  // Revealing also selects the row, which collapses whichever row was open before. The list
  // learns the new row heights only from the next layout, so scrolling at once used the old
  // offsets and overshot when the collapsed row was above. Wait for the relayout (the content
  // size changes), with a timer for when it does not.
  const pendingReveal = useRef<number | null>(null);
  const flushReveal = () => {
    const index = pendingReveal.current;
    if (index === null) return;
    pendingReveal.current = null;
    listRef.current?.scrollToIndex({ index, viewPosition: 0 });
  };
  useEffect(() => {
    if (revealIndex < 0) return;
    pendingReveal.current = revealIndex;
    const fallback = setTimeout(flushReveal, REVEAL_FALLBACK_MS);
    return () => clearTimeout(fallback);
    // Only a new reveal scrolls, not every re-sort while one is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.reveal]);

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
        onAdd={
          props.onAddFromVideo ? () => setIsAddMenuVisible(true) : props.onAdd
        }
      />

      <FlatList
        ref={listRef}
        // A frame later: the cells' own layouts, which the offsets come from, land around the
        // same time as the content size.
        onContentSizeChange={() => requestAnimationFrame(flushReveal)}
        // Rows are not laid out ahead, so a far one first needs an estimated jump.
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          listRef.current?.scrollToOffset({
            offset: index * averageItemLength,
          })
        }
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

      {props.onAddFromVideo && (
        <BottomSheet
          visible={isAddMenuVisible}
          onClose={() => setIsAddMenuVisible(false)}
          title={t("addPattern")}
          palette={palette}
          maxHeight="40%"
          minHeight="25%"
        >
          <View style={styles.menu}>
            {[
              {
                key: "new",
                label: t("addPatternNew"),
                icon: "plus",
                action: props.onAdd,
              },
              {
                key: "video",
                label: t("addPatternFromVideo"),
                icon: "video-plus-outline",
                action: () => props.onAddFromVideo?.("library"),
              },
              {
                key: "camera",
                label: t("addPatternRecordVideo"),
                icon: "video-outline",
                action: () => props.onAddFromVideo?.("camera"),
              },
            ].map(({ key, label, icon, action }) => (
              <TouchableOpacity
                key={key}
                style={styles.menuOption}
                accessibilityRole="button"
                onPress={() => {
                  setIsAddMenuVisible(false);
                  action();
                }}
              >
                <Icon
                  name={icon}
                  size={22}
                  color={palette[PaletteColor.Primary]}
                />
                <Text style={styles.menuText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BottomSheet>
      )}

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
    menu: { gap: 8 },
    menuOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    menuText: { fontSize: 16, color: palette[PaletteColor.PrimaryText] },
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
