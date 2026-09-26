import React from "react";
import { Text, TextInput, View } from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { getFilterCommonStyles } from "../FilterCommonStyles";

interface NameFilterProps {
  value: string;
  onChange: (value: string) => void;
  palette: Record<PaletteColor, string>;
}

const NameFilter: React.FC<NameFilterProps> = ({
  value,
  onChange,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getFilterCommonStyles(palette);

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("name")}</Text>
      <TextInput
        placeholder={t("searchByName")}
        value={value}
        onChangeText={onChange}
        style={styles.input}
        placeholderTextColor={palette[PaletteColor.TextMuted]}
      />
    </View>
  );
};

export default NameFilter;
