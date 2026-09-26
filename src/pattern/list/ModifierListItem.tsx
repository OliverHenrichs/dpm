import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
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
      <View style={styles.itemHeader}>
        <TouchableOpacity
          onPress={handleToggleSelect}
          style={styles.itemMeta}
          accessibilityLabel={modifier.name}
        >
          <Text style={styles.name}>{modifier.name}</Text>
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
        </TouchableOpacity>
        {!isReadonly && (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onEdit(modifier);
              }}
              style={styles.iconButton}
              accessibilityLabel={t("editModifier")}
            >
              <Icon name="pencil" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                setShowConfirmDelete(true);
              }}
              style={styles.iconButton}
              accessibilityLabel={t("deleteModifier")}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isSelected && (
        <ModifierDetails
          modifier={modifier}
          patterns={patterns}
          patternTypes={patternTypes}
        />
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
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    marginBottom: theme.space.sm,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  itemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemMeta: {
    flex: 1,
  },
  name: {
    ...theme.typography.button,
    fontWeight: "bold",
    color: theme.colors.text,
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.xxs,
  },
  deleteIcon: {
    fontSize: theme.iconSize.md,
    marginLeft: theme.space.sm,
  },
}));

export default ModifierListItem;
