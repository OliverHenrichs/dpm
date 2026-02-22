import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";

const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);

  const styles = getStyles(palette);

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Icon
          name="dance-ballroom"
          size={32}
          color={palette[PaletteColor.Primary]}
          style={styles.headerIcon}
        />
        <Text style={styles.headerTitle}>{t("appTitle")}</Text>
      </View>
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        style={styles.hamburgerButton}
        accessibilityLabel={t("openMenu")}
      >
        <Icon name="menu" size={28} color={palette[PaletteColor.Primary]} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 0,
      marginLeft: 8,
      justifyContent: "space-between",
      backgroundColor: palette[PaletteColor.Background],
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    headerIcon: { fontSize: 32, marginRight: 8 },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
    hamburgerButton: {
      marginLeft: 12,
      padding: 8,
    },
  });

export default AppHeader;
