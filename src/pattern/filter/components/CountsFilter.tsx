import React from "react";
import { Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { filterStyles as styles } from "../FilterCommonStyles";

interface CountsFilterProps {
  counts?: number;
  onChange: (value?: number) => void;
}

const CountsFilter: React.FC<CountsFilterProps> = ({ counts, onChange }) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("counts")}</Text>
      <TextInput
        placeholder={t("exactCounts")}
        value={counts?.toString() || ""}
        onChangeText={(text) =>
          onChange(text ? parseInt(text) || 0 : undefined)
        }
        style={styles.input}
        keyboardType="numeric"
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );
};

export default CountsFilter;
