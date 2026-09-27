import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon, type IconName } from "@/src/common/ui/Icon";
import { alpha } from "@/src/common/theme/tokens";
import { haptics } from "@/src/common/ui/haptics";

export interface Segment<T extends string> {
  value: T;
  label: string;
  /** A MaterialCommunityIcons name before the label. */
  icon?: IconName;
  /** A count shown after the label. Nothing is shown for 0 or undefined. */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * `tabs` switches what is shown below (announced as tabs); `choice` sets a
   * value (announced as radio buttons).
   */
  kind?: "tabs" | "choice";
  /** Names the whole control for a screen reader: "Import action". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Two to four mutually exclusive options in one track — switching views
 * (`kind="tabs"`) or making one small choice (`kind="choice"`). The chosen
 * segment is a raised surface on the track, as on iOS.
 */
function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  kind = "tabs",
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const { theme } = useUnistyles();

  return (
    <View
      style={[styles.track, style]}
      accessibilityRole={kind === "tabs" ? "tablist" : "radiogroup"}
      accessibilityLabel={accessibilityLabel}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        const fg = selected ? theme.colors.primary : theme.colors.textMuted;
        return (
          <Pressable
            key={segment.value}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(segment.value);
            }}
            accessibilityRole={kind === "tabs" ? "tab" : "radio"}
            accessibilityLabel={
              segment.count
                ? `${segment.label} (${segment.count})`
                : segment.label
            }
            accessibilityState={{
              selected,
              checked: kind === "choice" ? selected : undefined,
            }}
            android_ripple={{
              color: alpha(theme.colors.text, 0.1),
              foreground: true,
            }}
            style={({ pressed }) => [
              styles.segment(selected),
              pressed && Platform.OS !== "android" && styles.pressed,
            ]}
          >
            {segment.icon && (
              <Icon name={segment.icon} size={theme.iconSize.sm} color={fg} />
            )}
            <Text style={styles.label(selected)} numberOfLines={1}>
              {segment.label}
            </Text>
            {segment.count ? (
              <View style={styles.count(selected)}>
                <Text style={styles.countText(selected)}>{segment.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: "row",
    padding: theme.space.xs,
    gap: theme.space.xxs,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceVariant,
  },
  segment: (selected: boolean) => ({
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.xs,
    minHeight: 40,
    paddingHorizontal: theme.space.md,
    overflow: "hidden",
    borderRadius: theme.radius.md,
    backgroundColor: selected ? theme.colors.surface : "transparent",
    ...(selected ? theme.elevation.sm : theme.elevation.none),
  }),
  label: (selected: boolean) => ({
    ...theme.typography.label,
    fontWeight: selected ? "600" : "500",
    color: selected ? theme.colors.primary : theme.colors.textMuted,
  }),
  count: (selected: boolean) => ({
    minWidth: 20,
    paddingHorizontal: theme.space.xs,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    backgroundColor: selected
      ? alpha(theme.colors.primary, 0.14)
      : alpha(theme.colors.textMuted, 0.14),
  }),
  countText: (selected: boolean) => ({
    ...theme.typography.micro,
    color: selected ? theme.colors.primary : theme.colors.textMuted,
  }),
  pressed: { opacity: 0.7 },
}));

export default SegmentedControl;
