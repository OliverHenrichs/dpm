import React from "react";
import PatternListManager from "@/components/pattern/list/PatternListManager";
import PatternGraphScreen from "@/components/pattern/graph/PatternGraphScreen";
import PatternListSelector from "@/components/pattern/list/PatternListSelector";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { ActivePatternListProvider } from "@/components/pattern/context/ActivePatternListContext";
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  return (
    <ActivePatternListProvider>
      <SafeAreaView style={styles.flexView}>
        <Drawer.Navigator
          initialRouteName="PatternLists"
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
          drawerContent={(props) => <CustomDrawerContent {...props} />}
        >
          <Drawer.Screen
            name="PatternLists"
            component={PatternListSelector}
            options={{ title: t("patternLists") }}
          />
          <Drawer.Screen
            name="Patterns"
            component={PatternListManager}
            options={{ title: t("patternTab") }}
          />
          <Drawer.Screen
            name="PatternGraph"
            component={PatternGraphScreen}
            options={{ title: t("patternGraph") }}
          />
          <Drawer.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: t("settingsTab") }}
          />
        </Drawer.Navigator>
      </SafeAreaView>
    </ActivePatternListProvider>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        flex: 1,
        backgroundColor: palette[PaletteColor.Background],
      }}
      style={styles.drawerStyle}
    >
      <View style={styles.drawerHeaderContainer}>
        <Text style={styles.drawerHeader}>{t("menu")}</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

function getStyles(palette: Record<PaletteColor, string>) {
  return StyleSheet.create({
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
