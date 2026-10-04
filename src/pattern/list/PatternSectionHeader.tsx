import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

interface PatternSectionHeaderProps {
  title: string;
  count: number;
  /** The type's colour, when the section is one type. */
  color?: string;
}

/**
 * The header over a group of a sorted pattern list: "Whip 4", "Beginner 6". It is pinned while
 * its patterns scroll, so it carries the screen background to hide the rows passing beneath.
 */
const PatternSectionHeader: React.FC<PatternSectionHeaderProps> = ({
  title,
  count,
  color,
}) => (
  <View style={styles.header} accessible accessibilityRole="header">
    {color ? <View style={styles.swatch(color)} /> : null}
    <Text style={styles.title} numberOfLines={1}>
      {title}
    </Text>
    <Text style={styles.count}>{count}</Text>
  </View>
);

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xs,
    paddingHorizontal: theme.space.xs,
    backgroundColor: theme.colors.background,
  },
  swatch: (color: string) => ({
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  title: {
    ...theme.typography.section,
    flexShrink: 1,
    color: theme.colors[theme.list.sectionColor],
    textTransform: theme.list.sectionUppercase ? "uppercase" : "none",
  },
  count: {
    ...theme.typography.micro,
    color: theme.colors.textMuted,
  },
}));

export default PatternSectionHeader;
