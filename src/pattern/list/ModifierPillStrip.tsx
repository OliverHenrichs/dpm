import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
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

  const renderPositionBadge = (modifier: IModifier) => {
    const label =
      modifier.position === "prefix"
        ? t("modifierPositionPrefix")
        : modifier.position === "postfix"
          ? t("modifierPositionPostfix")
          : t("modifierPositionAmends");
    return <Text style={styles.positionBadge}>{label}</Text>;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("variant")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {/* Base pill */}
        <TouchableOpacity
          style={[
            styles.pill,
            selectedModifierId === null && styles.pillSelected,
          ]}
          onPress={() => onSelect(null)}
        >
          <Text
            style={[
              styles.pillText,
              selectedModifierId === null && styles.pillTextSelected,
            ]}
          >
            {t("basePattern")}
          </Text>
        </TouchableOpacity>

        {/* Non-universal attached modifier pills — before universal */}
        {attachedNonUniversal.map((mod) => (
          <View key={mod.id} style={styles.pillWrapper}>
            <TouchableOpacity
              style={[
                styles.pill,
                selectedModifierId === mod.id && styles.pillSelected,
              ]}
              onPress={() => onSelect(mod.id)}
            >
              {renderPositionBadge(mod)}
              <Text
                style={[
                  styles.pillText,
                  selectedModifierId === mod.id && styles.pillTextSelected,
                ]}
              >
                {mod.name}
              </Text>
            </TouchableOpacity>
            {isEditMode && onDetachModifier && (
              <TouchableOpacity
                style={styles.detachButton}
                onPress={() => onDetachModifier(mod.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                // Names the modifier, so the control is distinguishable both
                // from the other pills' detach buttons and from the identical
                // "×" that removes a video.
                accessibilityLabel={`${t("detachModifier")}: ${mod.name}`}
              >
                <Text style={styles.detachButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Attach picker trigger (edit mode only) */}
        {isEditMode && onShowAttachPicker && (
          <TouchableOpacity
            style={[styles.pill, styles.pillAttach]}
            onPress={onShowAttachPicker}
          >
            <Text style={styles.pillAttachText}>{t("attachModifier")}</Text>
          </TouchableOpacity>
        )}

        {/* Universal modifier pills — always last */}
        {universalModifiers.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={[
              styles.pill,
              styles.pillUniversal,
              selectedModifierId === mod.id && styles.pillSelected,
            ]}
            onPress={() => onSelect(mod.id)}
          >
            {renderPositionBadge(mod)}
            <Text
              style={[
                styles.pillText,
                selectedModifierId === mod.id && styles.pillTextSelected,
              ]}
            >
              {mod.name}
            </Text>
          </TouchableOpacity>
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
  pillWrapper: {
    position: "relative",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pillSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillUniversal: {
    borderColor: theme.colors.success,
  },
  pillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
  },
  pillTextSelected: {
    color: theme.colors.onPrimary,
    fontWeight: "600",
  },
  positionBadge: {
    ...theme.typography.badge,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detachButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: theme.colors.danger,
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  detachButtonText: {
    ...theme.typography.label,
    color: theme.colors.onDanger,
    fontWeight: "bold",
    lineHeight: 16,
  },
  pillAttach: {
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
    backgroundColor: "transparent",
  },
  pillAttachText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
  },
}));

export default ModifierPillStrip;
