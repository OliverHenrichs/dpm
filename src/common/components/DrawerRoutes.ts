import type { Href } from "expo-router";

/**
 * The drawer's routes, in the order they appear in the menu.
 *
 * Single source of truth for both the navigator (`app/_layout.tsx`), the
 * drawer menu (`DrawerContent.tsx`) and the header title (`AppHeader.tsx`),
 * so a route can't be declared in one place and forgotten in another.
 */
export interface DrawerRoute {
  /** File-based route name, i.e. the file in `app/` without its extension */
  name: string;
  href: Href;
  /** i18n key for the menu entry and the header title */
  titleKey: string;
  /** Screens that show the active list's name in the header instead of a static title */
  showsActiveListName?: boolean;
}

export const DRAWER_ROUTES: DrawerRoute[] = [
  { name: "index", href: "/", titleKey: "patternLists" },
  {
    name: "patterns",
    href: "/patterns",
    titleKey: "patternTab",
    showsActiveListName: true,
  },
  {
    name: "graph",
    href: "/graph",
    titleKey: "patternGraph",
    showsActiveListName: true,
  },
  { name: "settings", href: "/settings", titleKey: "settingsTab" },
];

/**
 * The screen the app returns to from the header icon ("home" button).
 * It is the drawer's first entry, i.e. the pattern-list ("Dances") overview.
 */
export const HOME_ROUTE: DrawerRoute = DRAWER_ROUTES[0];
