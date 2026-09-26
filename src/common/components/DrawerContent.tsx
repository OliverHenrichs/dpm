import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
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
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

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

const styles = StyleSheet.create((theme) => {
  return {
    drawerStyle: {
      backgroundColor: theme.colors.background,
    },
    drawerContent: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
    },
    drawerHeaderContainer: {
      paddingBottom: theme.space.lg,
      paddingHorizontal: theme.space.lg,
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    drawerHeader: {
      ...theme.typography.title,
      color: theme.colors.primary,
      letterSpacing: 1,
    },
    item: {
      marginHorizontal: theme.space.md,
      marginVertical: theme.space.xs,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      borderRadius: theme.radius.xs,
    },
    itemFocused: {
      // Matches the highlight the old react-navigation DrawerItem applied:
      // the primary colour at 12% opacity.
      backgroundColor: alpha(theme.colors.primary, 0.12),
    },
    itemLabel: {
      ...theme.typography.body,
      fontWeight: "500",
      color: theme.colors.text,
    },
    divider: {
      height: 1,
      marginHorizontal: theme.space.lg,
      marginVertical: theme.space.sm,
      backgroundColor: theme.colors.textMuted,
      opacity: 0.3,
    },
  };
});
