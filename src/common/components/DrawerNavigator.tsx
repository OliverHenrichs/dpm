import React from "react";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import PatternGraphScreen from "@/src/pattern/graph/PatternGraphScreen";
import PatternListSelector from "@/src/pattern/list/PatternListSelector";
import SettingsScreen from "@/src/settings/SettingsScreen";
import { ActivePatternListProvider } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from "@react-navigation/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";

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

  const activeRouteName = props.state.routes[props.state.index]?.name ?? "";

  const mainRoutes = props.state.routes.filter((r) => r.name !== "Settings");
  const settingsRoutes = props.state.routes.filter(
    (r) => r.name === "Settings",
  );

  const renderItem = (route: (typeof props.state.routes)[number]) => {
    const isFocused = route.name === activeRouteName;
    const label = props.descriptors[route.key]?.options?.title ?? route.name;
    return (
      <DrawerItem
        key={route.key}
        label={label}
        focused={isFocused}
        activeTintColor={palette[PaletteColor.Primary]}
        inactiveTintColor={palette[PaletteColor.SecondaryText]}
        labelStyle={{
          fontSize: 16,
          fontWeight: "500",
          color: palette[PaletteColor.PrimaryText],
        }}
        onPress={() => {
          props.navigation.navigate(route.name);
        }}
      />
    );
  };

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
      {mainRoutes.map(renderItem)}
      <View style={styles.divider} />
      {settingsRoutes.map(renderItem)}
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
    divider: {
      height: 1,
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: palette[PaletteColor.SecondaryText],
      opacity: 0.3,
    },
  });
}
