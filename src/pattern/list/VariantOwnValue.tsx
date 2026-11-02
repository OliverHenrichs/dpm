import React from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button, Icon } from "@/src/common/ui";

type VariantOwnValueProps = {
  /** Names what the reset restores, for a screen reader ("Use the figure's level"). */
  resetLabel: string;
  onReset: () => void;
};

/**
 * Marks a field of the figure form that holds the picked variant's own value, not its
 * figure's, with a reset that removes the override (`resetOverride`), so the variant follows
 * the figure again.
 */
const VariantOwnValue: React.FC<VariantOwnValueProps> = ({
  resetLabel,
  onReset,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <Icon
        name="pencil-outline"
        size={theme.iconSize.sm}
        color={theme.colors.primary}
      />
      <AppText variant="caption" color="primary" style={styles.label}>
        {t("variantOwnValue")}
      </AppText>
      <Button
        title={t("reset")}
        icon="restore"
        variant="ghost"
        size="sm"
        onPress={onReset}
        accessibilityLabel={resetLabel}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
  },
  label: { flex: 1 },
}));

export default VariantOwnValue;
