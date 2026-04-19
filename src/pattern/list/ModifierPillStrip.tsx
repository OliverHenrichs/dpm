import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

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

      {/* Universal modifier pills */}
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

      {/* Non-universal attached modifier pills */}
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
    </ScrollView>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    strip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      gap: 6,
    },
    pillWrapper: {
      position: "relative",
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    pillSelected: {
      backgroundColor: palette[PaletteColor.Primary],
      borderColor: palette[PaletteColor.Primary],
    },
    pillUniversal: {
      borderColor: palette[PaletteColor.Accent],
    },
    pillText: {
      fontSize: 13,
      color: palette[PaletteColor.PrimaryText],
    },
    pillTextSelected: {
      color: palette[PaletteColor.Surface],
      fontWeight: "600",
    },
    positionBadge: {
      fontSize: 9,
      color: palette[PaletteColor.SecondaryText],
      textTransform: "uppercase",
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    detachButton: {
      position: "absolute",
      top: -6,
      right: -6,
      backgroundColor: palette[PaletteColor.Error],
      borderRadius: 9,
      width: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
    detachButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "bold",
      lineHeight: 16,
    },
    pillAttach: {
      borderStyle: "dashed",
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: "transparent",
    },
    pillAttachText: {
      fontSize: 13,
      color: palette[PaletteColor.Primary],
    },
  });

export default ModifierPillStrip;
