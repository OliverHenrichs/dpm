import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import {
  DRAWER_ROUTES,
  DrawerRoute,
} from "@/src/common/components/DrawerRoutes";

/**
 * Only the drawer-specific part of the navigation object is needed here. It has
 * to come from the `drawerContent` render prop: this component sits beside the
 * screens rather than inside one, so `useNavigation()` would not resolve to the
 * drawer navigator.
 */
interface DrawerContentProps {
  navigation: { closeDrawer: () => void };
}

export default function DrawerContent({ navigation }: DrawerContentProps) {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const styles = getStyles(palette);

  const go = (route: DrawerRoute) => {
    navigation.closeDrawer();
    router.navigate(route.href);
  };

  const renderItem = (route: DrawerRoute) => {
    const isFocused = pathname === route.href;
    return (
      <TouchableOpacity
        key={route.name}
        onPress={() => go(route)}
        style={[styles.item, isFocused && styles.itemFocused]}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
      >
        <Text style={styles.itemLabel}>{t(route.titleKey)}</Text>
      </TouchableOpacity>
    );
  };

  const mainRoutes = DRAWER_ROUTES.filter((r) => r.name !== "settings");
  const settingsRoutes = DRAWER_ROUTES.filter((r) => r.name === "settings");

  return (
    <ScrollView
      style={styles.drawerStyle}
      contentContainerStyle={[
        styles.drawerContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.drawerHeaderContainer}>
        <Text style={styles.drawerHeader}>{t("menu")}</Text>
      </View>
      {mainRoutes.map(renderItem)}
      <View style={styles.divider} />
      {settingsRoutes.map(renderItem)}
    </ScrollView>
  );
}

function getStyles(palette: Record<PaletteColor, string>) {
  return StyleSheet.create({
    drawerStyle: {
      backgroundColor: palette[PaletteColor.Background],
    },
    drawerContent: {
      flexGrow: 1,
      backgroundColor: palette[PaletteColor.Background],
    },
    drawerHeaderContainer: {
      paddingBottom: 16,
      paddingHorizontal: 16,
      alignItems: "center",
      backgroundColor: palette[PaletteColor.Background],
    },
    drawerHeader: {
      fontSize: 18,
      fontWeight: "bold",
      color: palette[PaletteColor.Primary],
      letterSpacing: 1,
    },
    item: {
      marginHorizontal: 10,
      marginVertical: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 4,
    },
    itemFocused: {
      // Matches the highlight the old react-navigation DrawerItem applied:
      // the primary colour at 12% opacity.
      backgroundColor: palette[PaletteColor.Primary] + "1F",
    },
    itemLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: palette[PaletteColor.PrimaryText],
    },
    divider: {
      height: 1,
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: palette[PaletteColor.SecondaryText],
      opacity: 0.3,
    },
  });
}
