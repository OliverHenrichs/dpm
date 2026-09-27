import React from "react";
import { Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { filterStyles as styles } from "../FilterCommonStyles";

interface NameFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const NameFilter: React.FC<NameFilterProps> = ({ value, onChange }) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("name")}</Text>
      <TextInput
        placeholder={t("searchByName")}
        value={value}
        onChangeText={onChange}
        style={styles.input}
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );
};

export default NameFilter;
