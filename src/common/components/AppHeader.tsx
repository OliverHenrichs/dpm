import React from "react";
import { Image, Text, View } from "react-native";
import { Tappable } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui/Icon";
import { useTranslation } from "react-i18next";
import { router, useNavigation, usePathname } from "expo-router";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { ALL_ROUTES, HOME_ROUTE } from "@/src/common/components/DrawerRoutes";

/** The slots already clear the 48dp minimum; hit slop is margin for error. */
const HEADER_BUTTON_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Equal-width side slots. Because both ends are the same width, the title can
 * be centred by flex — between the buttons — and still land on the centre of
 * the screen, without anything being positioned on top of anything else.
 */
const HEADER_SLOT_SIZE = 56;

/** The extra button's slot beside the menu: a 44dp touch target. */
const ACTION_SLOT_SIZE = 44;

/** Only the drawer-specific part of the navigation object is needed here. */
type DrawerNavigation = { openDrawer: () => void };

interface AppHeaderProps {
  /** For a screen outside the drawer, which has no title of its own there. */
  title?: string;
  /**
   * One more button at the right, before the menu: the List tab's list settings, which edit
   * the whole list rather than one of its segments. The left side widens by the same amount,
   * so the title stays centred on screen.
   */
  action?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title: titleOverride,
  action,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation<DrawerNavigation>();
  const pathname = usePathname();
  const { theme } = useUnistyles();
  const { activeList } = useActivePatternList();
  const route = ALL_ROUTES.find((r) => r.href === pathname);
  const screenTitle =
    route?.name === "index" ? t("appTitle") : route && t(route.titleKey);
  const title = route?.showsActiveListName
    ? (activeList?.name ?? screenTitle)
    : (titleOverride ?? screenTitle ?? pathname);
  return (
    <View style={styles.header}>
      <View
        testID="app-header-start"
        style={[styles.side, action ? styles.sideWide : undefined]}
      >
        <Tappable
          onPress={() => router.navigate(HOME_ROUTE.href)}
          style={styles.headerSlot}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          borderless
          accessibilityLabel={t("goHome")}
        >
          <Image
            source={require("@/assets/images/app-icon-in-app.png")}
            style={styles.headerIcon}
          />
        </Tappable>
      </View>
      <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      <View
        testID="app-header-end"
        style={[
          styles.side,
          styles.sideEnd,
          action ? styles.sideWide : undefined,
        ]}
      >
        {action && <View style={styles.actionSlot}>{action}</View>}
        <Tappable
          onPress={() => navigation.openDrawer()}
          style={styles.headerSlot}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          borderless
          accessibilityLabel={t("openMenu")}
        >
          <Icon name="menu" size={28} color={theme.colors.primary} />
        </Tappable>
      </View>
    </View>
  );
};
const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.space.sm,
    backgroundColor: theme.colors.background,
  },
  headerSlot: {
    width: HEADER_SLOT_SIZE,
    height: HEADER_SLOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  // The logo is one colour on transparency, so it takes the style's brand colour like the menu
  // button beside it.
  headerIcon: { width: 40, height: 40, tintColor: theme.colors.primary },
  headerTitle: {
    ...theme.typography.headline,
    // Laid out *between* the buttons, never over them.
    //
    // This used to be `position: "absolute"` spanning the full header width,
    // kept harmless by `pointerEvents: "none"` — except that is a View style
    // prop and RN's Text does not implement it, so the title sat on top of
    // the home button and swallowed most taps on it. Taking it out of the
    // overlay removes the whole class of problem rather than relying on a
    // property that has to be honoured for the button to work at all.
    flex: 1,
    textAlign: "center",
    color: theme.colors.text,
  },
  // Both sides are always the same width, so the title between them centres on screen.
  side: { width: HEADER_SLOT_SIZE, flexDirection: "row", alignItems: "center" },
  sideEnd: { justifyContent: "flex-end" },
  sideWide: { width: HEADER_SLOT_SIZE + ACTION_SLOT_SIZE },
  actionSlot: {
    width: ACTION_SLOT_SIZE,
    height: HEADER_SLOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
}));
export default AppHeader;
