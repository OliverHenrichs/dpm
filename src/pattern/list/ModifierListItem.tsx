import React, { useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { IconButton, ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { useTranslation } from "react-i18next";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import AppDialog from "@/src/common/components/AppDialog";
import ModifierDetails from "@/src/pattern/list/ModifierDetails";

interface ModifierListItemProps {
  modifier: IModifier;
  patterns: IPattern[];
  patternTypes?: PatternType[];
  isSelected: boolean;
  onSelect: (modifier: IModifier | undefined) => void;
  isReadonly?: boolean;
  onEdit: (modifier: IModifier) => void;
  onDelete: (id: string) => void;
}

const ModifierListItem: React.FC<ModifierListItemProps> = ({
  modifier,
  patterns,
  patternTypes,
  isSelected,
  onSelect,
  isReadonly,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const positionLabel =
    modifier.position === "prefix"
      ? t("modifierPositionPrefix")
      : modifier.position === "postfix"
        ? t("modifierPositionPostfix")
        : t("modifierPositionAmends");

  const handleToggleSelect = () => {
    onSelect(isSelected ? undefined : modifier);
  };

  return (
    <View style={[styles.item, isSelected && styles.itemSelected]}>
      <ListRow
        title={modifier.name}
        expanded={isSelected}
        onPress={handleToggleSelect}
        subtitle={
          <View style={styles.badges}>
            <View style={styles.positionBadge}>
              <Text style={styles.positionBadgeText}>{positionLabel}</Text>
            </View>
            {modifier.universal && (
              <View style={styles.universalBadge}>
                <Text style={styles.universalBadgeText}>
                  {t("modifierUniversalBadge")}
                </Text>
              </View>
            )}
          </View>
        }
        trailing={
          !isReadonly && (
            <View style={styles.actions}>
              <IconButton
                icon="pencil"
                size={theme.iconSize.md}
                onPress={() => onEdit(modifier)}
                accessibilityLabel={t("editModifier")}
              />
              <IconButton
                icon="trash-can-outline"
                size={theme.iconSize.md}
                color="danger"
                onPress={() => setShowConfirmDelete(true)}
                accessibilityLabel={t("deleteModifier")}
              />
            </View>
          )
        }
      />

      {isSelected && (
        <Animated.View
          style={styles.details}
          entering={FadeIn.duration(theme.motion.duration.normal)}
          exiting={FadeOut.duration(theme.motion.duration.fast)}
        >
          <ModifierDetails
            modifier={modifier}
            patterns={patterns}
            patternTypes={patternTypes}
          />
        </Animated.View>
      )}

      <AppDialog
        visible={showConfirmDelete}
        title={t("deleteModifier")}
        message={t("deleteModifierConfirm")}
        closeLabel={t("cancel")}
        onClose={() => setShowConfirmDelete(false)}
        confirmLabel={t("delete")}
        confirmDestructive
        onConfirm={() => {
          setShowConfirmDelete(false);
          onDelete(modifier.id);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  item: {
    overflow: "hidden",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginBottom: theme.space.sm,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  itemSelected: {
    borderColor: theme.colors.primary,
  },
  badges: {
    flexDirection: "row",
    gap: theme.space.xs,
    marginTop: theme.space.xxs,
  },
  positionBadge: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 1,
  },
  positionBadgeText: {
    ...theme.typography.badge,
    color: theme.colors.onSurfaceVariant,
    textTransform: "uppercase",
  },
  universalBadge: {
    backgroundColor: alpha(theme.colors.success, 0.2),
    borderRadius: theme.radius.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 1,
  },
  universalBadgeText: {
    ...theme.typography.badge,
    color: theme.colors.success,
  },
  details: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
}));

export default ModifierListItem;
