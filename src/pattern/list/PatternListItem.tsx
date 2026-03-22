import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import AppDialog from "@/src/common/components/AppDialog";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";

interface PatternListItemProps {
  pattern: IPattern;
  allPatterns: IPattern[];
  patternTypes?: PatternType[];
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
  isReadonly,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
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
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onEdit(pattern);
              }}
              style={styles.iconButton}
              accessibilityLabel={t("editPattern")}
            >
              <Icon
                name="pencil"
                size={20}
                color={palette[PaletteColor.Primary]}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                setShowConfirmDelete(true);
              }}
              style={styles.iconButton}
              accessibilityLabel={t("deletePattern")}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      {isSelected && (
        <PatternDetails
          selectedPattern={pattern}
          patterns={allPatterns}
          patternTypes={patternTypes}
          palette={palette}
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

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    patternItem: {
      paddingVertical: 4,
      paddingRight: 4,
      paddingLeft: 12,
      borderRadius: 8,
      borderWidth: 2,
      marginBottom: 8,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    patternItemSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.TagBg],
    },
    patternItemHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    patternName: {
      fontWeight: "bold",
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
    },
    deleteIcon: {
      fontSize: 20,
      marginLeft: 8,
      color: palette[PaletteColor.Error],
    },
    iconButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
  });

export default PatternListItem;
