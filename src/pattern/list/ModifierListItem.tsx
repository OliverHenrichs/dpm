import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
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
              <Icon
                name="pencil"
                size={20}
                color={palette[PaletteColor.Primary]}
              />
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
          palette={palette}
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

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    item: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 2,
      marginBottom: 8,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    itemSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.TagBg],
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    itemMeta: {
      flex: 1,
    },
    name: {
      fontWeight: "bold",
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
    },
    badges: {
      flexDirection: "row",
      gap: 4,
      marginTop: 2,
    },
    positionBadge: {
      backgroundColor: palette[PaletteColor.TagBg],
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    positionBadgeText: {
      fontSize: 10,
      color: palette[PaletteColor.TagText],
      fontWeight: "600",
      textTransform: "uppercase",
    },
    universalBadge: {
      backgroundColor: palette[PaletteColor.Accent] + "33",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    universalBadgeText: {
      fontSize: 10,
      color: palette[PaletteColor.Accent],
      fontWeight: "600",
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    deleteIcon: {
      fontSize: 20,
      marginLeft: 8,
    },
  });

export default ModifierListItem;
