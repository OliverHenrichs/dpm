import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ListToolbar from "@/src/common/components/ListToolbar";
import PlusButton from "@/src/common/components/PlusButton";
import SortBottomSheet, {
  SortConfig,
  SortOption,
} from "@/src/pattern/list/SortBottomSheet";
import ModifierFilterBottomSheet from "@/src/pattern/list/ModifierFilterBottomSheet";
import PatternSectionHeader from "@/src/pattern/list/PatternSectionHeader";
import {
  buildModifierEntries,
  countModifierFilters,
  DEFAULT_MODIFIER_SORT,
  EMPTY_MODIFIER_FILTER,
  filterModifiers,
  ModifierFilter,
  modifierPositionKey,
  ModifierSortField,
  sortModifiers,
} from "@/src/pattern/list/modifierView";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import ModifierListItem from "@/src/pattern/list/ModifierListItem";

type ModifierListProps = {
  modifiers: IModifier[];
  patterns: IPattern[];
  patternTypes?: PatternType[];
  isReadonly?: boolean;
  onAdd: () => void;
  onEdit: (modifier: IModifier) => void;
  onDelete: (id: string) => void;
  /** Opens the list's settings from the toolbar; absent on a read-only list. */
  onEditList?: () => void;
};

const ModifierList: React.FC<ModifierListProps> = ({
  modifiers,
  patterns,
  patternTypes,
  isReadonly,
  onAdd,
  onEdit,
  onDelete,
  onEditList,
}) => {
  const { t } = useTranslation();
  const [selectedModifier, setSelectedModifier] = useState<
    IModifier | undefined
  >(undefined);

  const [sort, setSort] = useState<SortConfig<ModifierSortField>>(
    DEFAULT_MODIFIER_SORT,
  );
  const [filter, setFilter] = useState<ModifierFilter>(EMPTY_MODIFIER_FILTER);
  const [isSortVisible, setIsSortVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const sortOptions: SortOption<ModifierSortField>[] = [
    { field: "name", label: t("name") },
    { field: "position", label: t("modifierPosition") },
    { field: "added", label: t("dateCreated") },
  ];
  const activeFilters = countModifierFilters(filter);
  const entries = useMemo(
    () =>
      buildModifierEntries(
        sortModifiers(filterModifiers(modifiers, filter), sort),
        sort.field,
      ),
    [modifiers, filter, sort],
  );

  return (
    <>
      <ListToolbar
        sortLabel={sortOptions.find((o) => o.field === sort.field)!.label}
        sortOrder={sort.order}
        onSort={() => setIsSortVisible(true)}
        sortAccessibilityLabel={t("sortModifiers")}
        activeFilters={activeFilters}
        onFilter={() => setIsFilterVisible(true)}
        filterAccessibilityLabel={t("filterModifiers")}
        onEditList={onEditList}
        actions={
          isReadonly ? undefined : (
            <PlusButton onPress={onAdd} accessibilityLabel={t("addModifier")} />
          )
        }
      />
      <ScrollView style={styles.scrollView}>
        {entries.map((entry) =>
          entry.kind === "section" ? (
            <PatternSectionHeader
              key={entry.key}
              title={t(modifierPositionKey(entry.position))}
              count={entry.count}
            />
          ) : (
            <ModifierListItem
              key={entry.key}
              modifier={entry.modifier}
              patterns={patterns}
              patternTypes={patternTypes}
              isSelected={selectedModifier?.id === entry.modifier.id}
              onSelect={(m) => setSelectedModifier(m)}
              isReadonly={isReadonly}
              onEdit={onEdit}
              onDelete={(id) => {
                if (selectedModifier?.id === id) setSelectedModifier(undefined);
                onDelete(id);
              }}
            />
          ),
        )}
        {modifiers.length > 0 && entries.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t("noMatchingModifiers")}
            </Text>
          </View>
        )}
        {modifiers.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t("noModifiers")}</Text>
            {!isReadonly && (
              <Text style={styles.emptyStateSubtext}>
                {t("noModifiersHint")}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      <SortBottomSheet
        visible={isSortVisible}
        onClose={() => setIsSortVisible(false)}
        onApplySort={setSort}
        currentSort={sort}
        options={sortOptions}
        title={t("sortModifiers")}
      />
      <ModifierFilterBottomSheet
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApplyFilter={setFilter}
        currentFilter={filter}
      />
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  scrollView: {
    flex: 1,
  },
  emptyState: {
    paddingVertical: theme.space.xxxl,
    alignItems: "center",
  },
  emptyStateText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
  emptyStateSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.space.xs,
  },
}));

export default ModifierList;
