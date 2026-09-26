import React, { useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { IconButton, ListRow } from "@/src/common/ui";
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
      <ListRow
        title={pattern.name}
        expanded={isSelected}
        onPress={handleToggleSelect}
        accessibilityHint={t("selectPattern")}
        trailing={
          !isReadonly && (
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
          )
        }
      />
      {isSelected && (
        <Animated.View
          style={styles.details}
          entering={FadeIn.duration(theme.motion.duration.normal)}
          exiting={FadeOut.duration(theme.motion.duration.fast)}
        >
          <PatternDetails
            selectedPattern={pattern}
            patterns={allPatterns}
            patternTypes={patternTypes}
            modifiers={modifiers}
          />
        </Animated.View>
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
    overflow: "hidden",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginBottom: theme.space.sm,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  patternItemSelected: {
    borderColor: theme.colors.primary,
  },
  details: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
  },
}));

export default PatternListItem;
