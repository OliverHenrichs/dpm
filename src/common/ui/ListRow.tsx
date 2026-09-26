import React from "react";
import {
  AccessibilityRole,
  Platform,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { alpha, type ColorTokens } from "@/src/common/theme/tokens";
import { haptics } from "@/src/common/ui/haptics";

/**
 * How a row takes part in a choice:
 * - `single`: one of a list (a language, a sort field) — a check when chosen,
 *   announced as a radio button.
 * - `multiple`: any of a list (lists to export) — a leading checkbox.
 * - omitted: an action or a place (a menu entry, a drawer route); `selected`
 *   still highlights the current one.
 */
export type ListRowSelection = "single" | "multiple";

export interface ListRowProps {
  title: string;
  /** A second, muted line — or badges, or anything else that sits under the title. */
  subtitle?: React.ReactNode;
  /** Short muted text at the end of the title line — a count, a gloss. */
  meta?: string;
  /** A MaterialCommunityIcons name before the text. */
  icon?: string;
  /** Colour role of `icon`. */
  iconColor?: keyof ColorTokens;
  /** Anything else to lead with — a colour swatch, an avatar. */
  leading?: React.ReactNode;
  /** Controls or status icons after the text. They stay separately pressable. */
  trailing?: React.ReactNode;
  selected?: boolean;
  selection?: ListRowSelection;
  /**
   * The row opens details below itself. Shows a chevron and announces the
   * state; leave it undefined for rows that do not expand.
   */
  expanded?: boolean;
  /** Title in the danger colour: the row deletes something. */
  destructive?: boolean;
  /** `card` for rows that stand on the page, `plain` inside a sheet or menu. */
  variant?: "plain" | "card";
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  /** Layout only. */
  style?: StyleProp<ViewStyle>;
}

const ROLE: Record<ListRowSelection | "none", AccessibilityRole> = {
  single: "radio",
  multiple: "checkbox",
  none: "button",
};

/**
 * One row of a list, sheet or menu — the shape every list in the app shares:
 * an optional leading icon, a title with optional meta and subtitle, trailing
 * controls, and one consistent way of showing that it is the chosen one.
 */
const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  meta,
  icon,
  iconColor = "primary",
  leading,
  trailing,
  selected = false,
  selection,
  expanded,
  destructive = false,
  variant = "plain",
  onPress,
  onLongPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}) => {
  const { theme } = useUnistyles();
  const interactive = !!(onPress || onLongPress);
  const checked = selection ? selected : undefined;

  const content = (
    <>
      {selection === "multiple" && (
        <Icon
          name={selected ? "checkbox-marked" : "checkbox-blank-outline"}
          size={theme.iconSize.lg}
          color={selected ? theme.colors.primary : theme.colors.textMuted}
        />
      )}
      {leading}
      {icon && (
        <Icon
          name={icon}
          size={theme.iconSize.lg}
          color={destructive ? theme.colors.danger : theme.colors[iconColor]}
        />
      )}
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={styles.title(selected, destructive)} numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {typeof subtitle === "string" ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
      {expanded !== undefined && (
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={theme.iconSize.lg}
          color={theme.colors.textMuted}
        />
      )}
      {selection === "single" &&
        (selected ? (
          <Icon
            name="check"
            size={theme.iconSize.lg}
            color={theme.colors.primary}
          />
        ) : (
          // Holds the check's place, so titles line up whichever is chosen.
          // (A "transparent" icon colour draws black on Android.)
          <View style={styles.checkSpace} />
        ))}
    </>
  );

  if (!interactive) {
    return (
      <View style={[styles.row(variant, selected), style]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          if (selection) haptics.selection();
          onPress();
        })
      }
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={ROLE[selection ?? "none"]}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, checked, disabled, expanded }}
      testID={testID}
      android_ripple={{
        color: alpha(theme.colors.text, 0.1),
        foreground: true,
      }}
      style={({ pressed }) => [
        styles.row(variant, selected),
        pressed && Platform.OS !== "android" && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  row: (variant: "plain" | "card", selected: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.md,
    minHeight: 48,
    overflow: "hidden",
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: variant === "card" ? theme.radius.lg : theme.radius.md,
    borderWidth: variant === "card" ? 1 : 0,
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    marginBottom: variant === "card" ? theme.space.sm : 0,
    backgroundColor: selected
      ? alpha(theme.colors.primary, 0.1)
      : variant === "card"
        ? theme.colors.surface
        : "transparent",
  }),
  text: {
    flex: 1,
    gap: theme.space.xxs,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.space.sm,
  },
  title: (selected: boolean, destructive: boolean) => ({
    ...theme.typography.body,
    flexShrink: 1,
    fontWeight: selected ? "600" : "400",
    color: destructive
      ? theme.colors.danger
      : selected
        ? theme.colors.primary
        : theme.colors.text,
  }),
  meta: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  checkSpace: {
    width: theme.iconSize.lg,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
}));

export default ListRow;
