import React from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui/Icon";
import { LIST_TABS } from "@/src/common/components/DrawerRoutes";

/**
 * The active list's views — List and Map — as bottom tabs. The drawer above them holds the
 * places (the lists, Settings), so the views of one list are a thumb away and the menu no
 * longer says "pattern" twice.
 */
export default function ListTabsLayout() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  return (
    <Tabs
      // The root layout's SafeAreaView already keeps the app above the system bar; the tab bar
      // adding the inset again would float it a bar's height too high.
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        // Navigator options, not a view's style prop: read the theme here so a theme or style
        // switch re-renders them.
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: theme.typography.micro,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {LIST_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.titleKey),
            tabBarIcon: ({ color, size }) => (
              <Icon name={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
