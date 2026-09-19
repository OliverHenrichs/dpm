import "@/src/i18n";
import React from "react";
import { StyleSheet } from "react-native";
import { Drawer } from "expo-router/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  ThemeProvider,
  useThemeContext,
} from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { ActivePatternListProvider } from "@/src/pattern/data/components/ActivePatternListContext";
import DrawerContent from "@/src/common/components/DrawerContent";
import { DRAWER_ROUTES } from "@/src/common/components/DrawerRoutes";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppDrawer />
    </ThemeProvider>
  );
}

function AppDrawer() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  return (
    <ActivePatternListProvider>
      <SafeAreaView style={styles.flexView}>
        <Drawer
          screenOptions={{
            drawerPosition: "right",
            headerShown: false,
            swipeEdgeWidth: 40,
            drawerStyle: styles.drawerStyle,
            drawerActiveTintColor: palette[PaletteColor.Primary],
            drawerInactiveTintColor: palette[PaletteColor.SecondaryText],
            drawerLabelStyle: {
              fontSize: 16,
              fontWeight: "500",
              color: palette[PaletteColor.PrimaryText],
            },
          }}
          drawerContent={(props) => (
            <DrawerContent navigation={props.navigation} />
          )}
        >
          {DRAWER_ROUTES.map((route) => (
            <Drawer.Screen
              key={route.name}
              name={route.name}
              options={{ title: t(route.titleKey) }}
            />
          ))}
        </Drawer>
      </SafeAreaView>
    </ActivePatternListProvider>
  );
}

function getStyles(palette: Record<PaletteColor, string>) {
  return StyleSheet.create({
    flexView: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
    },
    drawerStyle: {
      width: 180,
      backgroundColor: palette[PaletteColor.Background],
    },
  });
}
