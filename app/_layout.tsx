import { restoreStoredLanguage } from "@/src/i18n";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
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

// Reading the stored language and theme are round trips to AsyncStorage, and
// the app has already come up in English and the system theme by then.
// Holding the splash over that gap keeps someone who chose Bengali, or dark,
// from seeing a frame of English, or light, first.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable on this platform: the app still works,
  // it just starts a beat earlier.
});

export default function RootLayout() {
  const [languageRestored, setLanguageRestored] = useState(false);
  const [themeRestored, setThemeRestored] = useState(false);

  useEffect(() => {
    restoreStoredLanguage()
      .catch((error) => {
        console.log("Could not restore the stored language:", error);
      })
      // The splash comes down either way. A store we cannot read is a reason
      // to start in English, never a reason not to start.
      .finally(() => setLanguageRestored(true));
  }, []);

  useEffect(() => {
    if (languageRestored && themeRestored) void SplashScreen.hideAsync();
  }, [languageRestored, themeRestored]);

  // The tree stays mounted throughout, rendering in English until the stored
  // language lands. Returning null here instead would hide the swap just as
  // well on a device, but static rendering is on for web, and it would leave
  // every pre-rendered route an empty shell.
  return (
    <ThemeProvider onRestored={() => setThemeRestored(true)}>
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
