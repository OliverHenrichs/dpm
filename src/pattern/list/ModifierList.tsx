import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import SectionHeader from "@/src/common/components/SectionHeader";
import PlusButton from "@/src/common/components/PlusButton";
import { IModifier } from "@/src/pattern/types/IPatternList";
import ModifierListItem from "@/src/pattern/list/ModifierListItem";

type ModifierListProps = {
  modifiers: IModifier[];
  isReadonly?: boolean;
  onAdd: () => void;
  onEdit: (modifier: IModifier) => void;
  onDelete: (id: string) => void;
};

const ModifierList: React.FC<ModifierListProps> = ({
  modifiers,
  isReadonly,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const rightActions = isReadonly ? null : (
    <PlusButton
      onPress={onAdd}
      palette={palette}
      accessibilityLabel={t("addModifier")}
    />
  );

  return (
    <>
      <SectionHeader
        title={t("modifiers")}
        rightActions={rightActions ?? undefined}
      />
      <ScrollView style={styles.scrollView}>
        {modifiers.map((modifier) => (
          <ModifierListItem
            key={modifier.id}
            modifier={modifier}
            isReadonly={isReadonly}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
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
    emptyStateSubtext: {
      color: palette[PaletteColor.SecondaryText],
      fontSize: 12,
      marginTop: 4,
    },
  });

export default ModifierList;

