import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import {
  DrawerActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";

const CONTENT_ROUTES = new Set(["Patterns", "PatternGraph"]);
const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { activeList } = useActivePatternList();
  const styles = getStyles(palette);
  const screenTitles: Record<string, string> = {
    PatternLists: t("appTitle"),
    Patterns: t("patternTab"),
    PatternGraph: t("patternGraph"),
    Settings: t("settingsTab"),
  };
  const title = CONTENT_ROUTES.has(route.name)
    ? (activeList?.name ?? screenTitles[route.name])
    : (screenTitles[route.name] ?? route.name);
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image
          source={require("@/assets/images/app-icon.png")}
          style={styles.headerIcon}
        />
      </View>
      <Text
        style={styles.headerTitle}
        numberOfLines={1}
        ellipsizeMode="tail"
        pointerEvents="none"
      >
        {title}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        style={styles.hamburgerButton}
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
      marginBottom: 0,
      paddingLeft: 8,
      justifyContent: "space-between",
      backgroundColor: palette[PaletteColor.Background],
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    headerIcon: { width: 32, height: 32, marginRight: 8 },
    headerTitle: {
      position: "absolute",
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
    hamburgerButton: {
      marginLeft: 12,
      padding: 8,
    },
  });
export default AppHeader;
