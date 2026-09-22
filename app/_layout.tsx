import "@/src/i18n";
import React from "react";
import { Platform, StyleSheet } from "react-native";
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
            // No swipe-to-open on Android. Android 10+ binds the system back
            // gesture to *both* screen edges and consumes the outermost band,
            // so a right-edge swipe is simultaneously "go back" and "open the
            // drawer" and which one you get depends on how many pixels in you
            // started. It also stole pans from the network graph. Every screen
            // renders AppHeader, which has an always-visible menu button, so
            // nothing is lost. iOS keeps it: the interactive pop gesture there
            // is left-edge only, and the drawer is on the right.
            swipeEnabled: Platform.OS !== "android",
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
