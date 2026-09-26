import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { IconButton } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import AppDialog from "@/src/common/components/AppDialog";
import { useTranslation } from "react-i18next";

interface PatternListItemProps {
  pattern: IPattern;
  allPatterns: IPattern[];
  patternTypes?: PatternType[];
  modifiers?: IModifier[];
  isReadonly?: boolean;
  isSelected: boolean;
  onSelect: (pattern: IPattern | undefined) => void;
  onEdit: (pattern: IPattern) => void;
  onDelete: (id?: number) => void;
}

const PatternListItem: React.FC<PatternListItemProps> = ({
  pattern,
  allPatterns,
  patternTypes,
  modifiers,
  isReadonly,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleToggleSelect = () => {
    if (isSelected) {
      onSelect(undefined);
    } else {
      onSelect(pattern);
    }
  };

  return (
    <View
      style={[styles.patternItem, isSelected && styles.patternItemSelected]}
    >
      <View style={styles.patternItemHeader}>
        <TouchableOpacity
          onPress={handleToggleSelect}
          style={{ flex: 1 }}
          accessibilityLabel={t("selectPattern")}
        >
          <Text style={styles.patternName}>{pattern.name}</Text>
        </TouchableOpacity>
        {!isReadonly && (
          <>
            <IconButton
              icon="pencil"
              size={theme.iconSize.md}
              onPress={() => onEdit(pattern)}
              accessibilityLabel={t("editPattern")}
            />
            <IconButton
              icon="trash-can-outline"
              size={theme.iconSize.md}
              color="danger"
              onPress={() => setShowConfirmDelete(true)}
              accessibilityLabel={t("deletePattern")}
            />
          </>
        )}
      </View>
      {isSelected && (
        <PatternDetails
          selectedPattern={pattern}
          patterns={allPatterns}
          patternTypes={patternTypes}
          modifiers={modifiers}
        />
      )}
      <AppDialog
        visible={showConfirmDelete}
        title={t("deletePattern")}
        message={t("deletePatternConfirm", { name: pattern.name })}
        closeLabel={t("cancel")}
        onClose={() => setShowConfirmDelete(false)}
        confirmLabel={t("delete")}
        confirmDestructive
        onConfirm={() => {
          setShowConfirmDelete(false);
          onDelete(pattern.id);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  patternItem: {
    paddingVertical: theme.space.xs,
    paddingRight: theme.space.xs,
    paddingLeft: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    marginBottom: theme.space.sm,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  patternItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  patternItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  patternName: {
    ...theme.typography.button,
    fontWeight: "bold",
    color: theme.colors.text,
  },
}));

// Rows are rendered by a FlatList and get identical props on most re-renders of
// the list; memoising keeps unrelated rows (and their thumbnails) from
// re-rendering when one row's selection changes.
export default React.memo(PatternListItem);
