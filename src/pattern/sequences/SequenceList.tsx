import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ListToolbar from "@/src/common/components/ListToolbar";
import SortBottomSheet, {
  SortConfig,
  SortOption,
} from "@/src/pattern/list/SortBottomSheet";
import SequenceFilterBottomSheet from "@/src/pattern/sequences/SequenceFilterBottomSheet";
import {
  countSequenceFilters,
  DEFAULT_SEQUENCE_SORT,
  EMPTY_SEQUENCE_FILTER,
  filterSequences,
  SequenceFilter,
  SequenceSortField,
  sortSequences,
} from "@/src/pattern/sequences/sequenceView";
import PlusButton from "@/src/common/components/PlusButton";
import AppDialog from "@/src/common/components/AppDialog";
import { Icon, IconButton, ListRow } from "@/src/common/ui";
import type { Dance } from "@/src/pattern/types/Dance";
import {
  IModifier,
  IPattern,
  ISequence,
} from "@/src/pattern/types/IPatternList";
import {
  MAX_SEQUENCES,
  sequenceTotals,
} from "@/src/pattern/sequences/sequences";
import { useTotalsText } from "@/src/pattern/sequences/SequenceTotalsLine";

interface SequenceListProps {
  sequences: ISequence[];
  patterns: IPattern[];
  modifiers: IModifier[];
  dance?: Dance;
  isReadonly?: boolean;
  onOpen: (sequence: ISequence) => void;
  onAdd: () => void;
  onEdit: (sequence: ISequence) => void;
  onDelete: (id: string) => void;
  /** Opens the list's settings from the toolbar; absent on a read-only list. */
  onEditList?: () => void;
}

/**
 * The List tab's Sequences: one row per sequence with its name, step count and total counts,
 * and a badge when it has a video.
 * Tapping a row opens it; + adds one, and each row edits or deletes it, unless the list is
 * read-only. At `MAX_SEQUENCES` the + is greyed out and says why.
 */
const SequenceList: React.FC<SequenceListProps> = ({
  sequences,
  patterns,
  modifiers,
  dance,
  isReadonly,
  onOpen,
  onAdd,
  onEdit,
  onDelete,
  onEditList,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const totalsText = useTotalsText();
  const [deleting, setDeleting] = useState<ISequence | null>(null);
  const full = sequences.length >= MAX_SEQUENCES;
  const [sort, setSort] = useState<SortConfig<SequenceSortField>>(
    DEFAULT_SEQUENCE_SORT,
  );
  const [filter, setFilter] = useState<SequenceFilter>(EMPTY_SEQUENCE_FILTER);
  const [isSortVisible, setIsSortVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const sortOptions: SortOption<SequenceSortField>[] = [
    { field: "name", label: t("name") },
    { field: "added", label: t("dateCreated") },
    { field: "counts", label: t("sequenceSortCounts") },
    { field: "steps", label: t("sequenceSteps") },
  ];
  const shown = useMemo(
    () =>
      sortSequences(
        filterSequences(sequences, filter, patterns),
        sort,
        patterns,
        modifiers,
        dance,
      ),
    [sequences, filter, sort, patterns, modifiers, dance],
  );

  return (
    <>
      <ListToolbar
        sortLabel={sortOptions.find((o) => o.field === sort.field)!.label}
        sortOrder={sort.order}
        onSort={() => setIsSortVisible(true)}
        sortAccessibilityLabel={t("sortSequences")}
        activeFilters={countSequenceFilters(filter)}
        onFilter={() => setIsFilterVisible(true)}
        filterAccessibilityLabel={t("filterSequences")}
        onEditList={onEditList}
        actions={
          isReadonly ? undefined : (
            <PlusButton
              onPress={onAdd}
              accessibilityLabel={t("sequenceNew")}
              disabled={full}
            />
          )
        }
      />
      {!isReadonly && full && (
        <Text style={styles.full}>
          {t("sequencesFull", { max: MAX_SEQUENCES })}
        </Text>
      )}
      <ScrollView style={styles.scrollView}>
        {shown.map((sequence) => (
          <View key={sequence.id} style={styles.item}>
            <ListRow
              title={sequence.name}
              strong
              subtitle={totalsText(
                sequenceTotals(sequence.steps, patterns, modifiers, dance),
              )}
              onPress={() => onOpen(sequence)}
              trailing={
                <View style={styles.actions}>
                  {sequence.video && (
                    <View
                      style={styles.videoBadge}
                      accessible
                      accessibilityLabel={t("sequenceHasVideo")}
                    >
                      <Icon
                        name="play-circle-outline"
                        size={theme.iconSize.md}
                        color={theme.colors.textMuted}
                      />
                    </View>
                  )}
                  {!isReadonly && (
                    <>
                      <IconButton
                        icon="pencil"
                        size={theme.iconSize.md}
                        onPress={() => onEdit(sequence)}
                        accessibilityLabel={t("sequenceEditNamed", {
                          name: sequence.name,
                        })}
                      />
                      <IconButton
                        icon="trash-can-outline"
                        size={theme.iconSize.md}
                        color="danger"
                        onPress={() => setDeleting(sequence)}
                        accessibilityLabel={t("sequenceDeleteNamed", {
                          name: sequence.name,
                        })}
                      />
                    </>
                  )}
                </View>
              }
            />
          </View>
        ))}
        {sequences.length > 0 && shown.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t("noMatchingSequences")}
            </Text>
          </View>
        )}
        {sequences.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t("noSequences")}</Text>
            <Text style={styles.emptyStateSubtext}>{t("noSequencesHint")}</Text>
          </View>
        )}
      </ScrollView>
      <SortBottomSheet
        visible={isSortVisible}
        onClose={() => setIsSortVisible(false)}
        onApplySort={setSort}
        currentSort={sort}
        options={sortOptions}
        title={t("sortSequences")}
      />
      <SequenceFilterBottomSheet
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApplyFilter={setFilter}
        currentFilter={filter}
      />
      <AppDialog
        visible={deleting !== null}
        title={t("sequenceDelete")}
        message={t("sequenceDeleteConfirm", { name: deleting?.name ?? "" })}
        closeLabel={t("cancel")}
        onClose={() => setDeleting(null)}
        confirmLabel={t("delete")}
        confirmDestructive
        onConfirm={() => {
          if (deleting) onDelete(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  scrollView: { flex: 1 },
  item: {
    overflow: "hidden",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginBottom: theme.space.sm,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  videoBadge: { paddingHorizontal: theme.space.xs },
  full: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  emptyState: {
    paddingVertical: theme.space.xxxl,
    paddingHorizontal: theme.space.lg,
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
    textAlign: "center",
  },
}));

export default SequenceList;
