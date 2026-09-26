import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/src/common/components/SectionHeader";
import PlusButton from "@/src/common/components/PlusButton";
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
};

const ModifierList: React.FC<ModifierListProps> = ({
  modifiers,
  patterns,
  patternTypes,
  isReadonly,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [selectedModifier, setSelectedModifier] = useState<
    IModifier | undefined
  >(undefined);

  const rightActions = isReadonly ? null : (
    <PlusButton onPress={onAdd} accessibilityLabel={t("addModifier")} />
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
            patterns={patterns}
            patternTypes={patternTypes}
            isSelected={selectedModifier?.id === modifier.id}
            onSelect={(m) => setSelectedModifier(m)}
            isReadonly={isReadonly}
            onEdit={onEdit}
            onDelete={(id) => {
              if (selectedModifier?.id === id) setSelectedModifier(undefined);
              onDelete(id);
            }}
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
