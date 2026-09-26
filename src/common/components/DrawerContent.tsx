import React from "react";
import { ScrollView, Text, View } from "react-native";
import { ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
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
  // Re-renders on a theme switch. The drawer's scroll view did not follow
  // one natively: after switching to light it stayed dark under dark text.
  const { theme } = useUnistyles();

  const go = (route: DrawerRoute) => {
    navigation.closeDrawer();
    router.navigate(route.href);
  };

  const renderItem = (route: DrawerRoute) => {
    const isFocused = pathname === route.href;
    return (
      <ListRow
        key={route.name}
        title={t(route.titleKey)}
        icon={route.icon}
        iconColor={isFocused ? "primary" : "textMuted"}
        selected={isFocused}
        onPress={() => go(route)}
        style={styles.item}
      />
    );
  };

  const mainRoutes = DRAWER_ROUTES.filter((r) => r.name !== "settings");
  const settingsRoutes = DRAWER_ROUTES.filter((r) => r.name === "settings");

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.drawerContent,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + theme.space.lg,
          paddingBottom: insets.bottom,
        },
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
    drawerContent: {
      flexGrow: 1,
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
      marginHorizontal: theme.space.sm,
      marginBottom: theme.space.xxs,
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
