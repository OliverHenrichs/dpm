import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { router, useNavigation, usePathname } from "expo-router";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  DRAWER_ROUTES,
  HOME_ROUTE,
} from "@/src/common/components/DrawerRoutes";

/** The slots already clear the 48dp minimum; hit slop is margin for error. */
const HEADER_BUTTON_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Equal-width side slots. Because both ends are the same width, the title can
 * be centred by flex — between the buttons — and still land on the centre of
 * the screen, without anything being positioned on top of anything else.
 */
const HEADER_SLOT_SIZE = 56;

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
      <TouchableOpacity
        onPress={() => router.navigate(HOME_ROUTE.href)}
        style={styles.headerSlot}
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t("goHome")}
      >
        <Image
          source={require("@/assets/images/app-icon-in-app.png")}
          style={styles.headerIcon}
        />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.openDrawer()}
        style={styles.headerSlot}
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        accessibilityRole="button"
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
      paddingHorizontal: 8,
      backgroundColor: palette[PaletteColor.Background],
    },
    headerSlot: {
      width: HEADER_SLOT_SIZE,
      height: HEADER_SLOT_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    headerIcon: { width: 40, height: 40 },
    headerTitle: {
      // Laid out *between* the buttons, never over them.
      //
      // This used to be `position: "absolute"` spanning the full header width,
      // kept harmless by `pointerEvents: "none"` — except that is a View style
      // prop and RN's Text does not implement it, so the title sat on top of
      // the home button and swallowed most taps on it. Taking it out of the
      // overlay removes the whole class of problem rather than relying on a
      // property that has to be honoured for the button to work at all.
      flex: 1,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
  });
export default AppHeader;
