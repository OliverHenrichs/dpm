import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { useNavigation, usePathname } from "expo-router";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { DRAWER_ROUTES } from "@/src/common/components/DrawerRoutes";

/** Only the drawer-specific part of the navigation object is needed here. */
type DrawerNavigation = { openDrawer: () => void };

const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<DrawerNavigation>();
  const pathname = usePathname();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { activeList } = useActivePatternList();
  const styles = getStyles(palette);
  const route = DRAWER_ROUTES.find((r) => r.href === pathname);
  const screenTitle =
    route?.name === "index" ? t("appTitle") : route && t(route.titleKey);
  const title = route?.showsActiveListName
    ? (activeList?.name ?? screenTitle)
    : (screenTitle ?? pathname);
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image
          source={require("@/assets/images/app-icon-in-app.png")}
          style={styles.headerIcon}
        />
      </View>
      <Text
        style={styles.headerTitle}
        numberOfLines={1}
        ellipsizeMode="tail"
        pointerEvents="none"
      >
        {title}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.openDrawer()}
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
      paddingLeft: 8,
      justifyContent: "space-between",
      backgroundColor: palette[PaletteColor.Background],
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    headerIcon: { width: 32, height: 32, marginRight: 8 },
    headerTitle: {
      position: "absolute",
      left: 0,
      right: 0,
      textAlign: "center",
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
