import { APP_ICON_COLORS } from "@/src/common/theme/tokens";

type AlternateIconsModule = typeof import("expo-alternate-app-icons");

/**
 * The launcher icon's colour. Android and iOS cannot recolour an icon, so each colour is a
 * separate icon set registered at build time (`expo-alternate-app-icons` in app.config.ts):
 * Android enables one launcher alias and disables the others, iOS switches to an alternate
 * icon and says so in a system alert. Indigo is the app's own icon.
 *
 * Every call is best-effort. Without the native module (web, Jest, a dev client built before it
 * was added) the setting is simply not offered.
 */

export type AppIconColor = keyof typeof APP_ICON_COLORS;
export const APP_ICON_COLOR_OPTIONS = Object.keys(
  APP_ICON_COLORS,
) as AppIconColor[];

/** The alternate icon's registered name; the default icon has none. */
const ICON_NAMES: Record<AppIconColor, string | null> = {
  indigo: null,
  amber: "Amber",
  coral: "Coral",
};

/**
 * Required on first use rather than imported: the module reads its native side at module
 * scope, so a static import would take the app down on a dev client built without it. Same
 * reason as jobNotifications.ts.
 */
function alternateIcons(): AlternateIconsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-alternate-app-icons") as AlternateIconsModule;
  } catch {
    return null;
  }
}

export function canChangeAppIcon(): boolean {
  return alternateIcons()?.supportsAlternateIcons === true;
}

export function currentAppIconColor(): AppIconColor {
  try {
    const name = alternateIcons()?.getAppIconName() ?? null;
    const found = APP_ICON_COLOR_OPTIONS.find((c) => ICON_NAMES[c] === name);
    return found ?? "indigo";
  } catch {
    return "indigo";
  }
}

/** Switches the launcher icon. Resolves to whether it took. */
export async function setAppIconColor(color: AppIconColor): Promise<boolean> {
  try {
    const module = alternateIcons();
    if (!module?.supportsAlternateIcons) return false;
    await module.setAlternateAppIcon(ICON_NAMES[color]);
    return true;
  } catch (error) {
    console.error("Could not change the app icon:", error);
    return false;
  }
}
