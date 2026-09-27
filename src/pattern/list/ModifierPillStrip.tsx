import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import {
  IModifier,
  IPatternModifierRef,
} from "@/src/pattern/types/IPatternList";

export type ModifierPillStripProps = {
  /** All modifiers defined on the list */
  modifiers: IModifier[];
  /** The pattern's currently attached non-universal modifier refs */
  modifierRefs: IPatternModifierRef[];
  /** null = "Base" selected */
  selectedModifierId: string | null;
  onSelect: (modifierId: string | null) => void;
  /** When true the strip renders detach (×) buttons and an attach (+) pill */
  isEditMode?: boolean;
  onDetachModifier?: (modifierId: string) => void;
  /** Called when the user taps the attach (+) pill */
  onShowAttachPicker?: () => void;
};

const ModifierPillStrip: React.FC<ModifierPillStripProps> = ({
  modifiers,
  modifierRefs,
  selectedModifierId,
  onSelect,
  isEditMode = false,
  onDetachModifier,
  onShowAttachPicker,
}) => {
  const { t } = useTranslation();

  const universalModifiers = modifiers.filter((m) => m.universal);
  const attachedNonUniversal = modifiers.filter(
    (m) => !m.universal && modifierRefs.some((ref) => ref.modifierId === m.id),
  );

  const hasAnyAttachedModifier =
    universalModifiers.length > 0 || attachedNonUniversal.length > 0;

  // Don't render the strip at all if there's nothing to show (view mode with no modifiers)
  if (!isEditMode && !hasAnyAttachedModifier) {
    return null;
  }

  const positionLabel = (modifier: IModifier) =>
    modifier.position === "prefix"
      ? t("modifierPositionPrefix")
      : modifier.position === "postfix"
        ? t("modifierPositionPostfix")
        : t("modifierPositionAmends");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("variant")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        <Chip
          label={t("basePattern")}
          selected={selectedModifierId === null}
          onPress={() => onSelect(null)}
        />

        {/* Non-universal attached modifiers — before the universal ones */}
        {attachedNonUniversal.map((mod) => (
          <Chip
            key={mod.id}
            label={mod.name}
            badge={positionLabel(mod)}
            selected={selectedModifierId === mod.id}
            onPress={() => onSelect(mod.id)}
            {...(isEditMode &&
              onDetachModifier && {
                onRemove: () => onDetachModifier(mod.id),
                // Names the modifier, so the control is distinguishable both
                // from the other pills' detach buttons and from the one that
                // removes a video.
                removeLabel: `${t("detachModifier")}: ${mod.name}`,
              })}
          />
        ))}

        {isEditMode && onShowAttachPicker && (
          <Chip
            label={t("attachModifier")}
            icon="plus"
            onPress={onShowAttachPicker}
          />
        )}

        {/* Universal modifiers — always last, marked by an icon rather than
            by colour alone */}
        {universalModifiers.map((mod) => (
          <Chip
            key={mod.id}
            label={mod.name}
            badge={positionLabel(mod)}
            icon="all-inclusive"
            selected={selectedModifierId === mod.id}
            onPress={() => onSelect(mod.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    marginVertical: theme.space.xs,
  },
  title: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: theme.space.xs,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.space.xs,
    gap: theme.space.sm,
  },
}));

export default ModifierPillStrip;
