import type { TextStyle, ViewStyle } from "react-native";

/**
 * Design tokens — the one place the app's look is decided. Screens and components take every
 * colour, spacing step, corner radius, text style and shadow from here (through the Unistyles
 * `theme`), never as a literal, so a redesign is an edit to this file.
 *
 * Pure data with no React Native runtime behind it, so the unit tests can check it.
 */

/**
 * Colour roles. Each is named for what it is used *as*, and means the same thing in both
 * themes. Every colour that text or an icon sits on has a matching `on*` role — never borrow
 * `surface` or `text` for that; it is how the contrast failures crept in.
 * `__tests__/unit/tokens.test.ts` holds each pairing to its WCAG minimum.
 *
 * Solid colours must stay 6-digit hex: `alpha()` appends a hex alpha to them.
 */
export interface ColorTokens {
  /** Screen background, behind cards. */
  background: string;
  /** Cards, sheets, dialogs. */
  surface: string;
  /** Inputs, chips, tags, grouped areas inside a surface. */
  surfaceVariant: string;
  /** Coloured text on `surfaceVariant` — tag and chip labels. */
  onSurfaceVariant: string;
  /** Body text, titles. */
  text: string;
  /** Hints, captions, placeholders, secondary details. */
  textMuted: string;
  /** Brand colour: primary buttons, selection, links, icons, graph edges. */
  primary: string;
  /** Text and icons on `primary`. */
  onPrimary: string;
  /** Errors and destructive actions. */
  danger: string;
  /** Text and icons on `danger`. */
  onDanger: string;
  /** Done, active, positive state. Icons and short labels; not for button fills. */
  success: string;
  /** Dividers and decorative outlines. */
  border: string;
  /** Outlines that identify a control (inputs), held to 3:1 against what surrounds them. */
  borderStrong: string;
  /** Scrim behind modals, dialogs and sheets. */
  overlay: string;
}

/**
 * The app ships in two styles, which the user picks in Settings, each in a light and a dark
 * theme. They share every token *name*, so a component never asks which style is on; only the
 * values differ.
 *
 * - **After Hours** (the default): warm and roomy, a serif voice for headings, a dark theme
 *   meant for a dim venue. Made for dancers practising and going to socials.
 * - **Clipboard**: dense, condensed and squared-off, with mono labels. Made for trainers who
 *   keep a whole course on one screen.
 */
export const APP_STYLES = ["afterHours", "clipboard"] as const;
export type AppStyle = (typeof APP_STYLES)[number];
export const DEFAULT_APP_STYLE: AppStyle = "afterHours";

export function isAppStyle(value: unknown): value is AppStyle {
  return APP_STYLES.includes(value as AppStyle);
}

export type ColorScheme = "light" | "dark";

export const palettes: Record<AppStyle, Record<ColorScheme, ColorTokens>> = {
  afterHours: {
    light: {
      background: "#f6f2f7",
      surface: "#ffffff",
      surfaceVariant: "#ece5ef",
      onSurfaceVariant: "#6a3b86",
      text: "#21182c",
      textMuted: "#5f546b",
      primary: "#93500d",
      onPrimary: "#ffffff",
      danger: "#b3261e",
      onDanger: "#ffffff",
      success: "#1f7a3a",
      border: "#ddd3e3",
      borderStrong: "#8a7e95",
      overlay: "rgba(20,12,28,0.5)",
    },
    dark: {
      background: "#15121d",
      surface: "#201b2b",
      surfaceVariant: "#2b2439",
      onSurfaceVariant: "#d9c2ff",
      text: "#f1e8dc",
      textMuted: "#b0a6bd",
      primary: "#f3b46a",
      onPrimary: "#2a1b0b",
      danger: "#ff8a80",
      onDanger: "#3d0703",
      success: "#7ed99a",
      border: "#3a3149",
      borderStrong: "#7d7290",
      overlay: "rgba(0,0,0,0.6)",
    },
  },
  clipboard: {
    light: {
      background: "#eef1ee",
      surface: "#ffffff",
      surfaceVariant: "#e1e7e2",
      onSurfaceVariant: "#24503f",
      text: "#141815",
      textMuted: "#515953",
      primary: "#b3300f",
      onPrimary: "#ffffff",
      danger: "#9f1239",
      onDanger: "#ffffff",
      success: "#17663a",
      border: "#d0d7d1",
      borderStrong: "#7c867e",
      overlay: "rgba(10,14,11,0.5)",
    },
    dark: {
      background: "#111513",
      surface: "#1a1f1c",
      surfaceVariant: "#262d28",
      onSurfaceVariant: "#9fd8c0",
      text: "#e6ebe7",
      textMuted: "#a0a9a2",
      primary: "#ff7a5c",
      onPrimary: "#2a0a02",
      danger: "#ff7aa0",
      onDanger: "#3b0614",
      success: "#6fd39a",
      border: "#333b35",
      borderStrong: "#737d75",
      overlay: "rgba(0,0,0,0.6)",
    },
  },
};

/**
 * Colours that sit over video and the camera. They do not follow the theme: the picture under
 * them is the same in light and dark.
 */
export const mediaColors = {
  scrim: "rgba(0,0,0,0.65)",
  scrimStrong: "rgba(0,0,0,0.8)",
  onScrim: "#ffffff",
  black: "#000000",
} as const;

/**
 * The colours the launcher icon comes in (Settings → App icon), independent of the style.
 * Indigo is the original and the default; the others are mid tones of the two styles' accents,
 * chosen to read on the icon's dark background and on iOS's light one alike. The icon files
 * themselves are in assets/images/icon-colors/.
 */
export const APP_ICON_COLORS = {
  indigo: "#6366f1",
  amber: "#e8962e",
  coral: "#e5532f",
} as const;

/** A 4-point spacing scale, for padding, margin and gap. */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export interface RadiusTokens {
  none: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  /** Fully rounded in After Hours; Clipboard keeps its corners nearly square here too. */
  pill: number;
}

const radii: Record<AppStyle, RadiusTokens> = {
  afterHours: {
    none: 0,
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
  },
  clipboard: { none: 0, xs: 2, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6, pill: 4 },
};

/**
 * Which face a text style is set in. Each style maps the roles to its own families
 * (`nativeFonts`, `webFonts`); `display` is the voice of headings, `mono` of codes and labels.
 */
export type FontRole = "display" | "body" | "mono";
export type FontFamilies = Record<FontRole, string>;

/**
 * The embedded families on Android and iOS (app.config.ts → expo-font, files and OFL licences in
 * assets/fonts/). The names are the files' own family names, which iOS resolves by; Android
 * registers each family under the same name.
 */
export const nativeFonts: Record<AppStyle, FontFamilies> = {
  afterHours: {
    display: "DM Serif Display",
    body: "Manrope",
    mono: "IBM Plex Mono",
  },
  clipboard: {
    display: "IBM Plex Sans Condensed",
    body: "IBM Plex Sans Condensed",
    mono: "IBM Plex Mono",
  },
};

const systemSans =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const systemMono = 'ui-monospace, Menlo, Consolas, "Courier New", monospace';

/** The web build does not embed the files and uses close system stacks instead. */
export const webFonts: Record<AppStyle, FontFamilies> = {
  afterHours: {
    display: 'Georgia, "Times New Roman", serif',
    body: systemSans,
    mono: systemMono,
  },
  clipboard: {
    display: `"Arial Narrow", ${systemSans}`,
    body: `"Arial Narrow", ${systemSans}`,
    mono: systemMono,
  },
};

type TextStyleSpec = Pick<
  TextStyle,
  "fontSize" | "lineHeight" | "fontWeight" | "fontStyle" | "letterSpacing"
> & { font: FontRole };

/**
 * Text styles. Pick the one that names the text's job, then set its colour; do not adjust the
 * size.
 */
export interface TypeScale<T> {
  /** Uppercase tags inside pills and on thumbnails, where space is tightest. */
  badge: T;
  /** Small annotations: counters, corner labels. */
  micro: T;
  /** Captions, hints, secondary details. */
  caption: T;
  /** Dense secondary text: descriptions, list metadata. */
  bodySmall: T;
  /** Running text and inputs. */
  body: T;
  /** Field labels, chip and button text. */
  label: T;
  /** Primary button text. */
  button: T;
  /** The name heading a row: a pattern in the list. */
  rowTitle: T;
  /** Section headers, sheet and dialog titles. */
  title: T;
  /** Screen-level headings. */
  headline: T;
  /** Codes and figures meant to be read across a room — a share code. */
  display: T;
  /** The divider between the groups of a sorted list ("Whip", "Beginner"). */
  section: T;
}

// DM Serif Display ships one weight, so After Hours sets its headings at 400: asking Android
// for 700 from a one-weight family makes it fake the bold.
const typeSpecs: Record<AppStyle, TypeScale<TextStyleSpec>> = {
  afterHours: {
    badge: { font: "body", fontSize: 10, lineHeight: 12, fontWeight: "700" },
    micro: { font: "body", fontSize: 11, lineHeight: 14, fontWeight: "600" },
    caption: { font: "body", fontSize: 12, lineHeight: 16, fontWeight: "400" },
    bodySmall: {
      font: "body",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "400",
    },
    body: { font: "body", fontSize: 16, lineHeight: 22, fontWeight: "400" },
    label: { font: "body", fontSize: 14, lineHeight: 20, fontWeight: "600" },
    button: { font: "body", fontSize: 16, lineHeight: 22, fontWeight: "700" },
    rowTitle: {
      font: "body",
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "700",
    },
    title: {
      font: "display",
      fontSize: 21,
      lineHeight: 26,
      fontWeight: "400",
    },
    headline: {
      font: "display",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "400",
    },
    display: {
      font: "display",
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "400",
    },
    section: {
      font: "display",
      fontSize: 19,
      lineHeight: 24,
      fontWeight: "400",
      fontStyle: "italic",
    },
  },
  clipboard: {
    badge: { font: "mono", fontSize: 10, lineHeight: 12, fontWeight: "600" },
    micro: { font: "mono", fontSize: 11, lineHeight: 14, fontWeight: "600" },
    caption: { font: "body", fontSize: 12, lineHeight: 16, fontWeight: "400" },
    bodySmall: {
      font: "body",
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "400",
    },
    body: { font: "body", fontSize: 16, lineHeight: 21, fontWeight: "400" },
    label: { font: "body", fontSize: 14, lineHeight: 19, fontWeight: "600" },
    button: { font: "body", fontSize: 15, lineHeight: 20, fontWeight: "600" },
    rowTitle: {
      font: "body",
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "600",
    },
    title: { font: "body", fontSize: 18, lineHeight: 23, fontWeight: "700" },
    headline: {
      font: "body",
      fontSize: 20,
      lineHeight: 25,
      fontWeight: "700",
    },
    display: {
      font: "mono",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "600",
    },
    section: {
      font: "mono",
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
      letterSpacing: 0.8,
    },
  },
};

export type ResolvedTextStyle = Omit<TextStyleSpec, "font"> & {
  fontFamily: string;
};

/** A style's type scale, with each text style's role resolved to a family. */
export function typeScale(
  style: AppStyle,
  fonts: FontFamilies,
): TypeScale<ResolvedTextStyle> {
  return Object.fromEntries(
    (Object.entries(typeSpecs[style]) as [string, TextStyleSpec][]).map(
      ([name, { font, ...rest }]) => [
        name,
        { ...rest, fontFamily: fonts[font] },
      ],
    ),
  ) as unknown as TypeScale<ResolvedTextStyle>;
}

/**
 * How the pattern list draws its rows and sections: the places where the styles differ in
 * shape rather than in value.
 */
export interface ListTokens {
  /** How a row names its type in the type's colour: a dot before the name, or a filled tag. */
  typeLabel: "dot" | "tag";
  /** Space between rows. */
  rowGap: number;
  /** Section header colour: the text colour, or the brand colour as a label. */
  sectionColor: "text" | "primary";
  /** Clipboard writes section headers in capitals. */
  sectionUppercase: boolean;
}

const listTokens: Record<AppStyle, ListTokens> = {
  afterHours: {
    typeLabel: "dot",
    rowGap: space.sm,
    sectionColor: "text",
    sectionUppercase: false,
  },
  clipboard: {
    typeLabel: "tag",
    rowGap: space.xxs,
    sectionColor: "primary",
    sectionUppercase: true,
  },
};

/** Icon sizes, so icon buttons line up. */
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/** Minimum touch target, per the Android and iOS guidelines. */
export const touchTarget = 44;

/**
 * Layers. `elevation` is not only Android's shadow: Android also paints siblings in elevation
 * order and ignores `zIndex` for that, so anything that must sit above its neighbours needs it.
 */
const shadows = (strength: number) =>
  ({
    none: {},
    sm: {
      boxShadow: `0px 1px 2px rgba(0, 0, 0, ${0.15 * strength})`,
      elevation: 2,
    },
    md: {
      boxShadow: `0px 2px 4px rgba(0, 0, 0, ${0.25 * strength})`,
      elevation: 5,
    },
    lg: {
      boxShadow: `0px 6px 16px rgba(0, 0, 0, ${0.3 * strength})`,
      elevation: 8,
    },
  }) satisfies Record<string, ViewStyle>;

/** Motion timings, shared by Reanimated and `Animated` so everything moves alike. */
export const motion = {
  duration: { fast: 150, normal: 250, slow: 400 },
  spring: { damping: 20, stiffness: 220, mass: 1 },
} as const;

/** Shadows read less on a dark background, so the dark themes make them denser. */
const shadowStrength: Record<AppStyle, Record<ColorScheme, number>> = {
  afterHours: { light: 1, dark: 2 },
  // Clipboard separates by fill and rule rather than by depth.
  clipboard: { light: 0.6, dark: 1.5 },
};

/** One complete theme: a style in a colour scheme, with its fonts resolved. */
export function buildTheme(
  style: AppStyle,
  scheme: ColorScheme,
  fonts: FontFamilies = nativeFonts[style],
) {
  return {
    space,
    radius: radii[style],
    typography: typeScale(style, fonts),
    iconSize,
    touchTarget,
    motion,
    list: listTokens[style],
    colors: palettes[style][scheme],
    media: mediaColors,
    elevation: shadows(shadowStrength[style][scheme]),
  };
}

export type AppTheme = ReturnType<typeof buildTheme>;

/** The default style's themes: what Jest renders against (its Unistyles mock uses light). */
export const lightTheme: AppTheme = buildTheme(DEFAULT_APP_STYLE, "light");
export const darkTheme: AppTheme = buildTheme(DEFAULT_APP_STYLE, "dark");

/** `#rrggbb` plus an alpha from 0 to 1, as `#rrggbbaa`. For tints of a role colour. */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return hex + a.toString(16).padStart(2, "0");
}
