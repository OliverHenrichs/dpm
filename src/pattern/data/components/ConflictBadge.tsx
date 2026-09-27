import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { useTranslation } from "react-i18next";
export const ConflictBadge: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.conflictBadge}>
      <Text style={styles.conflictBadgeText}>{t("existsLabel")}</Text>
    </View>
  );
};
const styles = StyleSheet.create((theme) => ({
  conflictBadge: {
    backgroundColor: alpha(theme.colors.danger, 0.13),
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xxs,
    borderRadius: theme.radius.xs,
  },
  conflictBadgeText: {
    ...theme.typography.micro,
    color: theme.colors.danger,
  },
}));
