import type { Href } from "expo-router";
import type { IconName } from "@/src/common/ui/Icon";

/**
 * The app's screens, in two layers: the drawer holds the places (the lists, Settings), and the
 * active list's views are bottom tabs inside the drawer's `(list)` group (`app/(list)/`).
 *
 * Single source of truth for the navigators (`app/_layout.tsx`, `ListTabsLayout.tsx`), the
 * drawer menu (`DrawerContent.tsx`) and the header title (`AppHeader.tsx`), so a route can't be
 * declared in one place and forgotten in another.
 */
export interface AppRoute {
  /** File-based route name, i.e. the file in `app/` without its extension */
  name: string;
  href: Href;
  /** i18n key for the menu entry or tab, and the header title */
  titleKey: string;
  /** MaterialCommunityIcons name for the menu entry or tab */
  icon: IconName;
  /** Screens that show the active list's name in the header instead of a static title */
  showsActiveListName?: boolean;
}

/** The drawer's own entries, in menu order. */
export const DRAWER_ROUTES: AppRoute[] = [
  {
    name: "index",
    href: "/",
    titleKey: "patternLists",
    icon: "format-list-bulleted-square",
  },
  {
    name: "settings",
    href: "/settings",
    titleKey: "settingsTab",
    icon: "cog-outline",
  },
];

/** The drawer screen that holds the list tabs: the `app/(list)/` group. */
export const LIST_GROUP = "(list)";

/** The active list's views, as bottom tabs, in tab order. */
export const LIST_TABS: AppRoute[] = [
  {
    name: "patterns",
    href: "/patterns",
    titleKey: "patternTab",
    icon: "view-list-outline",
    showsActiveListName: true,
  },
  {
    name: "graph",
    href: "/graph",
    titleKey: "patternGraph",
    icon: "map-outline",
    showsActiveListName: true,
  },
];

/** Every screen with a title of its own, for the header. */
export const ALL_ROUTES: AppRoute[] = [...DRAWER_ROUTES, ...LIST_TABS];

export function isListTab(pathname: string): boolean {
  return LIST_TABS.some((tab) => tab.href === pathname);
}

/**
 * The screen the app returns to from the header icon ("home" button): the drawer's first entry,
 * the overview of lists.
 */
export const HOME_ROUTE: AppRoute = DRAWER_ROUTES[0];
