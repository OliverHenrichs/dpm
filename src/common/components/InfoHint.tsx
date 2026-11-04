import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppText, Icon } from "@/src/common/ui";

/**
 * A form's hint, beside what it explains: an info glyph and a muted caption. The video tools
 * use it to say why something is not offered, or what to keep in mind while a job runs.
 */
const InfoHint: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.row, style]}>
      <Icon
        name="information-outline"
        size={theme.iconSize.sm}
        color={theme.colors.textMuted}
      />
      <AppText variant="caption" color="textMuted" style={styles.text}>
        {children}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space.xs,
  },
  text: { flex: 1 },
}));

export default InfoHint;
