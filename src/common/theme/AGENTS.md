# Theming — `src/common/theme/`

Styling runs on **Unistyles 3** (`react-native-unistyles`, a native Nitro module) over the design
tokens in `tokens.ts`. These rules apply to every component in the app, not only to files here.

## Writing styles

```tsx
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.space.lg,
    borderRadius: theme.radius.lg,
    ...theme.elevation.sm,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
}));
```

- **Declare sheets at module level.** A theme switch updates them natively, without re-rendering.
  A style that depends on props is a function in the sheet (`sheet: (maxHeight) => ({ … })`,
  called as `styles.sheet(maxHeight)`); never build a style object in render.
- **A value that is not a `style`** (an icon's `color`, `placeholderTextColor`, an SVG `fill`, a
  navigator option) comes from `const { theme } = useUnistyles()`, which does re-render.
- **Native updates do not reach everything.** Unistyles rewrites a view's `style` without
  re-rendering, but not `contentContainerStyle`, navigator options, or the drawer's content (it
  sits beside the screens: after a switch to light it stayed dark under dark text). Those take
  their colours from `useUnistyles()`. Jest cannot see this; switch the theme in the design gallery
  and open the drawer to check.
- **Spread shared fragments inside a `StyleSheet.create`**, never at a `style=` prop
  (`{...styles.card}` cuts it off from theme updates). Fragments: `src/common/utils/CommonStyles.ts`
  (`getCommonButton(theme)`, `getCommonInput(theme)`, `commonStyles`) and
  `src/pattern/filter/FilterCommonStyles.ts` (`filterStyles`).
- The two Reanimated-driven graph views (`DragOverlay`, `ZoomableCanvas`) keep React Native's
  `StyleSheet` for their theme-free layout.

## Tokens

**Every value comes from a token**: `theme.colors` (roles), `theme.space` (4-point scale),
`theme.radius`, `theme.typography` (spread a text style, then set its colour), `theme.elevation`,
`theme.iconSize`, `theme.motion`, and `theme.media` for what sits over video and the camera (it
does not follow the theme). A new literal (a hex, a font size, a stray `padding: 10`) is a missing
token: add it to every palette. Changing the look is an edit to `tokens.ts`, not to screens.

**Colour literals fail lint** (`eslint.config.js`, `no-restricted-syntax`) in `src/` and `app/`,
except `tokens.ts` and the pattern-type palette, which is data. A literal that is genuinely data,
like the silhouette's dancer colours, carries a disable comment saying so.

**Pick a colour role for what it is used as, and pair every fill with its `on*` role.** Text or an
icon on `primary` is `onPrimary`, on `danger` it is `onDanger`; never `surface`, `text` or `"#fff"`
(that is how selected chips ended up at 2.2:1). `text` is body text, `textMuted` hints and
placeholders, `border` decorative, `borderStrong` outlines a control, `overlay` every modal scrim.
A tint is `alpha(theme.colors.primary, 0.12)`. `__tests__/unit/tokens.test.ts` holds each pairing to
WCAG AA in every palette; a new role belongs in its pair list.

**`theme.elevation` sets `elevation` as well as `boxShadow`, on purpose.** Android paints siblings
in elevation order and ignores `zIndex` for that, so a popover that must sit above the rows under it
needs it (`PatternListTemplateModal` pins that in a test).

## Two styles, each light and dark

_After Hours_ (default: warm, roomy, serif display face, for dancers) and _Clipboard_ (dense,
condensed, squared-off, mono labels, for trainers), picked in Settings beside the theme. Both are
built by `buildTheme(style, scheme)` and share every token name, so a component never asks which
style is on. What differs is values (`palettes`, per-style `radius`, the type scale) plus
`theme.list`, the few places the pattern list differs in shape (type as a dot or a filled tag,
section header tone).

Unistyles knows only two themes, `light` and `dark`, so adaptive themes and web's static render
keep working. `ThemeProvider` (`src/common/components/ThemeContext.tsx`) owns the user's choices
(theme `@theme`, style `@appStyle`), persists them, fills both Unistyles themes with the style
through `applyAppStyle` (`UnistylesRuntime.updateTheme`), and uses adaptive themes for "system".

## Type

Embedded per style: Manrope and DM Serif Display (After Hours), IBM Plex Sans Condensed and IBM
Plex Mono (Clipboard), through expo-font's config plugin (`FONT_FAMILIES` in `app.config.ts`; files
and OFL licences in `assets/fonts/`). Each family is registered on Android under the files' own
family name, which is what iOS resolves by, so one name works on both and `fontWeight` picks the
file.

- Text styles name a _role_ (`display`, `body`, `mono`) that each style maps to a family.
- DM Serif Display has one weight, so its styles stay at 400; Android fakes any other.
- A text style that sets colour or weight but spreads no `theme.typography.*` falls back to the
  system font. Spread one.
- Web gets system stacks instead (`webFonts`).
- A new weight needs its file in `FONT_FAMILIES` and a dev client rebuild. `fonts.test.ts` checks
  that every text style names a family and weight a shipped file has.

## Icons

From `@/src/common/ui` (`Icon`, `IconName`): one set, MaterialCommunityIcons via
`@expo/vector-icons`. Every `icon` prop is typed `IconName`, so a misspelt glyph is a type error.

## Setup, and where it breaks

- **The themes are registered in `unistyles.ts`, which must run before any `StyleSheet.create`.**
  `index.ts` imports it ahead of expo-router, and `app/_layout.tsx` imports it first too, because
  web's static renderer loads routes directly and never runs `index.ts`. Without it the web export
  fails with "no theme has been selected yet".
- **`babel.config.js` runs the Unistyles plugin with `root: "src"` and an absolute
  `autoProcessPaths` for `app/`.** The plugin matches that option as a substring of each path; a
  bare `"app"` also matched files in `node_modules` (Unistyles' own) and broke the web bundle with
  `Cannot read properties of undefined (reading 'createUnistylesElement')`.
- **Web's pre-rendered HTML carries class names only.** `ServerStyles.web.tsx`
  (`useServerUnistyles`) writes the CSS behind them into the page, both themes under
  `prefers-color-scheme`. The native `ServerStyles.tsx` renders nothing.
- **Insets** come from Unistyles' runtime (`StyleSheet.create((theme, rt) => …)`, `rt.insets`), so
  they follow rotation. The Jest mock reports them as zero and resolves every sheet against the
  light theme at import, so a component test cannot observe a theme switch.
- Unistyles is a native module: adding or upgrading it means rebuilding the dev client.
