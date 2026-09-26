/**
 * Colour roles. Each is named for what it is used *as*, not what it looks like, and means the
 * same thing in both themes. Every colour that text or an icon sits on has a matching `On*`
 * role — never borrow `Surface` or `Text` for that, it is how the contrast failures crept in.
 * `__tests__/unit/ColorPalette.test.ts` holds each pairing to its WCAG minimum.
 *
 * Values must stay 6-digit hex: some call sites append a hex alpha (`palette[…] + "1F"`).
 */
export enum PaletteColor {
  /** Screen background, behind cards. */
  Background = "Background",
  /** Cards, sheets, dialogs. */
  Surface = "Surface",
  /** Inputs, chips, tags, grouped areas inside a surface. */
  SurfaceVariant = "SurfaceVariant",
  /** Coloured text on `SurfaceVariant` — tag and chip labels. */
  OnSurfaceVariant = "OnSurfaceVariant",
  /** Body text, titles. */
  Text = "Text",
  /** Hints, captions, placeholders, secondary details. */
  TextMuted = "TextMuted",
  /** Brand colour: primary buttons, selection, links, icons, graph edges. */
  Primary = "Primary",
  /** Text and icons on `Primary`. */
  OnPrimary = "OnPrimary",
  /** Errors and destructive actions. */
  Danger = "Danger",
  /** Text and icons on `Danger`. */
  OnDanger = "OnDanger",
  /** Done, active, positive state. Icons and short labels; not for button fills. */
  Success = "Success",
  /** Dividers and decorative outlines. */
  Border = "Border",
  /** Outlines that identify a control (inputs), held to 3:1 against what surrounds them. */
  BorderStrong = "BorderStrong",
  /** Scrim behind modals, dialogs and sheets. */
  Overlay = "Overlay",
}

export type Palette = Record<PaletteColor, string>;

export const LightPalette: Palette = {
  [PaletteColor.Background]: "#f5f3ff",
  [PaletteColor.Surface]: "#ffffff",
  [PaletteColor.SurfaceVariant]: "#ede9fe",
  [PaletteColor.OnSurfaceVariant]: "#6d28d9",
  [PaletteColor.Text]: "#1e1b4b",
  [PaletteColor.TextMuted]: "#57557a",
  [PaletteColor.Primary]: "#4f46e5",
  [PaletteColor.OnPrimary]: "#ffffff",
  [PaletteColor.Danger]: "#b91c1c",
  [PaletteColor.OnDanger]: "#ffffff",
  [PaletteColor.Success]: "#15803d",
  [PaletteColor.Border]: "#d1d5db",
  [PaletteColor.BorderStrong]: "#8b8aa6",
  [PaletteColor.Overlay]: "rgba(0,0,0,0.5)",
};

export const DarkPalette: Palette = {
  [PaletteColor.Background]: "#18181b",
  [PaletteColor.Surface]: "#23232b",
  [PaletteColor.SurfaceVariant]: "#2e2e38",
  [PaletteColor.OnSurfaceVariant]: "#a78bfa",
  [PaletteColor.Text]: "#f1f5f9",
  [PaletteColor.TextMuted]: "#a1a1aa",
  [PaletteColor.Primary]: "#818cf8",
  [PaletteColor.OnPrimary]: "#1e1b4b",
  [PaletteColor.Danger]: "#f87171",
  [PaletteColor.OnDanger]: "#450a0a",
  [PaletteColor.Success]: "#4ade80",
  [PaletteColor.Border]: "#3f3f46",
  [PaletteColor.BorderStrong]: "#71717a",
  [PaletteColor.Overlay]: "rgba(0,0,0,0.6)",
};

export function getPalette(colorScheme: "light" | "dark"): Palette {
  return colorScheme === "dark" ? DarkPalette : LightPalette;
}
