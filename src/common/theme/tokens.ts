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

export const lightColors: ColorTokens = {
  background: "#f5f3ff",
  surface: "#ffffff",
  surfaceVariant: "#ede9fe",
  onSurfaceVariant: "#6d28d9",
  text: "#1e1b4b",
  textMuted: "#57557a",
  primary: "#4f46e5",
  onPrimary: "#ffffff",
  danger: "#b91c1c",
  onDanger: "#ffffff",
  success: "#15803d",
  border: "#d1d5db",
  borderStrong: "#8b8aa6",
  overlay: "rgba(0,0,0,0.5)",
};

export const darkColors: ColorTokens = {
  background: "#18181b",
  surface: "#23232b",
  surfaceVariant: "#2e2e38",
  onSurfaceVariant: "#a78bfa",
  text: "#f1f5f9",
  textMuted: "#a1a1aa",
  primary: "#818cf8",
  onPrimary: "#1e1b4b",
  danger: "#f87171",
  onDanger: "#450a0a",
  success: "#4ade80",
  border: "#3f3f46",
  borderStrong: "#71717a",
  overlay: "rgba(0,0,0,0.6)",
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

export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

/**
 * Text styles. Pick the one that names the text's job, then set its colour; do not adjust the
 * size.
 */
export const typography = {
  /** Uppercase tags inside pills and on thumbnails, where space is tightest. */
  badge: { fontSize: 10, lineHeight: 12, fontWeight: "600" },
  /** Small annotations: counters, corner labels. */
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
  /** Captions, hints, secondary details. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  /** Dense secondary text: descriptions, list metadata. */
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  /** Running text and inputs. */
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  /** Field labels, chip and button text. */
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  /** Primary button text. */
  button: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  /** Section headers, sheet and dialog titles. */
  title: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  /** Screen-level headings. */
  headline: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  /** Codes and figures meant to be read across a room — a share code. */
  display: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
} as const satisfies Record<string, TextStyle>;

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

const base = { space, radius, typography, iconSize, touchTarget, motion };

export const lightTheme = {
  ...base,
  colors: lightColors,
  media: mediaColors,
  elevation: shadows(1),
} as const;

export const darkTheme = {
  ...base,
  colors: darkColors,
  media: mediaColors,
  // Shadows barely read on a dark background; they need to be denser to separate layers.
  elevation: shadows(2),
} as const;

export type AppTheme = typeof lightTheme;

/** `#rrggbb` plus an alpha from 0 to 1, as `#rrggbbaa`. For tints of a role colour. */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return hex + a.toString(16).padStart(2, "0");
}
