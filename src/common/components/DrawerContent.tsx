import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  AppRoute,
  DRAWER_ROUTES,
  HOME_ROUTE,
  LIST_TABS,
} from "@/src/common/components/DrawerRoutes";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { loadAllPatternLists } from "@/src/pattern/data/PatternListStorage";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * Only the drawer-specific part of the navigation object is needed here. It has
 * to come from the `drawerContent` render prop: this component sits beside the
 * screens rather than inside one, so `useNavigation()` would not resolve to the
 * drawer navigator.
 */
interface RowLayout {
  y: number;
  height: number;
}

/** The scroll offset that puts `row` in the middle of the visible lists. */
function centredOffset(row: RowLayout, viewportHeight: number): number {
  return Math.max(0, row.y + row.height / 2 - viewportHeight / 2);
}

interface DrawerContentProps {
  navigation: { closeDrawer: () => void };
  /**
   * Whether the drawer is open. The lists are read again each time it moves,
   * since they are created, renamed and deleted on the Lists screen without
   * the drawer hearing of it.
   */
  isOpen: boolean;
}

export default function DrawerContent({
  navigation,
  isOpen,
}: DrawerContentProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // Re-renders on a theme switch. The drawer's scroll view did not follow
  // one natively: after switching to light it stayed dark under dark text.
  const { theme } = useUnistyles();
  const { activeList, setActiveList } = useActivePatternList();
  const [lists, setLists] = useState<IPatternList[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  // Where each list's row sits in the scroll view, by list id.
  const rowLayouts = useRef(new Map<string, RowLayout>());

  // Also on closing, which is harmless, and on mounting, so the first
  // opening already has them.
  useEffect(() => {
    let cancelled = false;
    loadAllPatternLists().then((loaded) => {
      if (!cancelled) setLists(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Bring the open list into view, centred where the lists scroll.
  const centre = (row: RowLayout) => {
    if (viewportHeight === 0) return;
    scrollRef.current?.scrollTo({
      y: centredOffset(row, viewportHeight),
      animated: false,
    });
  };

  // On each opening. On the first, the rows are not laid out yet, and the
  // open list's row centres itself when it is (below).
  const activeId = activeList?.id;
  useEffect(() => {
    if (!isOpen || !activeId || viewportHeight === 0) return;
    const row = rowLayouts.current.get(activeId);
    if (!row) return;
    scrollRef.current?.scrollTo({
      y: centredOffset(row, viewportHeight),
      animated: false,
    });
  }, [isOpen, activeId, viewportHeight]);

  const go = (route: AppRoute) => {
    navigation.closeDrawer();
    router.navigate(route.href);
  };

  const openList = async (list: IPatternList) => {
    navigation.closeDrawer();
    if (list.id !== activeList?.id) await setActiveList(list);
    router.navigate(LIST_TABS[0].href);
  };

  const renderItem = (route: AppRoute) => {
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

  const otherRoutes = DRAWER_ROUTES.filter((r) => r !== HOME_ROUTE);

  return (
    <View
      style={[
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
      {renderItem(HOME_ROUTE)}
      {/* Every list, the open one highlighted. Only this part scrolls, so
          Lists and Settings stay on screen however many lists there are. */}
      <ScrollView
        ref={scrollRef}
        style={styles.lists}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        testID="drawer-lists"
      >
        {lists.map((list) => {
          const isActive = list.id === activeList?.id;
          return (
            // A wrapper, because a row does not report its layout.
            <View
              key={list.id}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                rowLayouts.current.set(list.id, { y, height });
                if (isActive && isOpen) centre({ y, height });
              }}
            >
              <ListRow
                title={list.name}
                selected={isActive}
                onPress={() => openList(list)}
                style={styles.listItem}
              />
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.divider} />
      {otherRoutes.map(renderItem)}
    </View>
  );
}

const styles = StyleSheet.create((theme) => {
  return {
    drawerContent: {
      flex: 1,
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
    // As tall as its rows, and no taller than the room the menu has left.
    lists: {
      flexGrow: 0,
      flexShrink: 1,
    },
    // Under "Lists", as the lists it holds: no icon of their own, and the
    // names start where "Lists" does (past its icon and the row's gap).
    listItem: {
      marginLeft: theme.space.sm + theme.iconSize.lg + theme.space.md,
      marginRight: theme.space.sm,
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
