# Shared UI — `src/common/`

App chrome, theming, and the layout and touch rules every screen inherits. Unqualified paths
below are relative to `src/common/`.

## Theming

Styling runs on **Unistyles 3** (`react-native-unistyles`, a native Nitro module) over the design
tokens in `theme/tokens.ts`. A component declares its styles once, at module level, against the
theme:

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

A theme switch updates those styles natively, without re-rendering. A value that is **not** a
`style` — an icon's `color`, `placeholderTextColor`, an SVG `fill`, a navigator option — comes from
`const { theme } = useUnistyles()`, which does re-render. A style that depends on props is a
function inside the sheet (`bottomSheet: (maxHeight) => ({ … })`, called as
`styles.bottomSheet(maxHeight)`); never build a style object in render.

**Type is Inter**, embedded natively by expo-font's config plugin (`app.config.ts`; the files and
their OFL licence are in `assets/fonts/`). On Android the five files form one "Inter" family, so
`fontWeight` picks the right file there as on iOS; every text style in `theme.typography` carries
`fontFamily`. A text style that sets colour or weight but spreads no `theme.typography.*` falls back
to the system font — spread one. Web gets a system font stack instead (`theme/unistyles.ts`). A new
weight needs its file added in both places in `app.config.ts`, and a dev client rebuild.

**Icons come from `@/src/common/ui` (`Icon`, `IconName`)**, one set, MaterialCommunityIcons via
`@expo/vector-icons`. Every `icon` prop is typed `IconName`, so a misspelt glyph is a type error.

**Colour literals fail lint** (`eslint.config.js`, `no-restricted-syntax`) everywhere in `src/` and
`app/` except `tokens.ts` and the pattern-type palette, which is data. A literal that is genuinely
data, like the de-identified video's dancer colours, carries a disable comment saying so.

**Every value comes from a token.** `theme.colors` (roles), `theme.space` (4-point scale),
`theme.radius`, `theme.typography` (spread a text style, then set its colour), `theme.elevation`,
`theme.iconSize`, `theme.motion`; `theme.media` for what sits over video and the camera, which does
not follow the theme. Changing the look is an edit to `tokens.ts`, not to screens. A new literal —
a hex, a font size, a stray `padding: 10` — is a missing token: add the token.

**Pick a colour role for what it is used as, and pair every fill with its `on*` role.** Text or an
icon on a `primary` fill is `onPrimary`, on `danger` it is `onDanger` — never `surface`, `text` or
`"#fff"`, which is how selected chips ended up at 2.2:1. `text` is body text, `textMuted` is hints
and placeholders, `border` is decorative, `borderStrong` outlines a control (inputs), `overlay` is
every modal scrim. `__tests__/unit/tokens.test.ts` holds each pairing to WCAG AA in both themes, so
a palette tweak that breaks legibility fails CI; a new role belongs in its pair list. For a tint of
a role use `alpha(theme.colors.primary, 0.12)`.

**`theme.elevation` sets `elevation` as well as `boxShadow`, on purpose.** Android paints siblings
in elevation order and ignores `zIndex` for that; a popover that must sit above the rows under it
needs it (`PatternListTemplateModal` pins that in a test).

Shared fragments live in `utils/CommonStyles.ts` (`getCommonButton(theme)`, `getCommonInput(theme)`,
…, and the `commonStyles` sheet) and `src/pattern/filter/FilterCommonStyles.ts` (`filterStyles`).
Spread the fragments **inside** a `StyleSheet.create`; spreading a Unistyles style at a `style=`
prop (`{...styles.card}`) cuts it off from theme updates.

**Setup, and where it breaks.**

- The themes are registered in `theme/unistyles.ts`, which must run before any
  `StyleSheet.create`. The app's entry `index.ts` imports it ahead of expo-router, and
  `app/_layout.tsx` imports it first too, because web's static renderer loads routes directly and
  never runs `index.ts` — without it the web export fails with "no theme has been selected yet".
- `babel.config.js` runs the Unistyles plugin with `root: "src"` and an **absolute**
  `autoProcessPaths` for `app/`. The plugin matches that option as a substring of each file path;
  a bare `"app"` also matched files inside `node_modules`, Unistyles' own among them, and broke the
  web bundle with `Cannot read properties of undefined (reading 'createUnistylesElement')`.
- On web the pre-rendered HTML carries class names only; `theme/ServerStyles.web.tsx`
  (`useServerUnistyles`) writes the CSS behind them into the page, both themes under
  `prefers-color-scheme`. The native `ServerStyles.tsx` renders nothing.
- `ThemeProvider` still owns the user's choice (system / light / dark) and its persistence, and
  forwards it to `UnistylesRuntime` (adaptive themes for "system").
- Unistyles is a native module: adding it, or upgrading it, means rebuilding the dev client.
- **Native updates do not reach everything.** Unistyles rewrites a view's `style` on a theme switch
  without re-rendering, but not `contentContainerStyle`, navigator options, or — as it turned out —
  the drawer's content, which lives beside the screens: after switching to light the drawer stayed
  dark under dark text. Anything there takes its colours from `useUnistyles()` (which re-renders)
  instead. Jest cannot see this (the mock has no native side); switch the theme in the design
  gallery and open the drawer to check.
- The two Reanimated-driven graph views (`DragOverlay`, `ZoomableCanvas`) keep React Native's
  `StyleSheet` for their theme-free layout.

## UI primitives — `ui/`

Screens compose `AppText`, `Button`, `IconButton`, `Chip`, `Card`, `ListRow` and
`SegmentedControl` (and, for what none of those cover, `Tappable`) from `@/src/common/ui`
rather than styling `TouchableOpacity` and `Text` by hand. They carry what every hand-rolled
touchable kept forgetting: pressed feedback (Material ripple on Android, a fade elsewhere), a 44dp
touch target, `accessibilityRole`/`accessibilityState`, and haptics where they belong.

- **`Button`** — `variant`: `primary` (the one main action), `secondary` (neutral outline — Cancel
  beside a primary), `outline`, `ghost` (quiet text action), `danger` (confirms a destructive step,
  with a haptic), `dangerOutline` (leads to one), `media` (over video or the camera); `size` `sm`/`md`; optional `icon`, `loading`.
  A footer pair is `secondary` + `primary`, each `flex: 1`, Cancel on the left.
- **`IconButton`** — an icon with a **required** `accessibilityLabel`. The glyph keeps its size;
  `hitSlop` grows the target to 44dp, so dense headers keep their layout.
- **`Chip`** — a selectable pill (filters, types, levels, one-of-several). Selection is shown by
  colour _and_ a check mark; pressing gives a selection haptic. `swatch` adds a colour dot.
  `badge` adds a small uppercase tag (a modifier's position); `onRemove` with `removeLabel` adds a
  remove button inside the chip (detaching a modifier).
- **`Card`** — a surface; with `onPress` the whole card is one button.
- **`ListRow`** — every row of a list, sheet, menu or drawer: `icon` or `leading`, `title` with
  `meta` and `subtitle` (a string or badges), `trailing` controls (separately pressable).
  `selection="single"` is a radio with a check (a language, the active list, a sort field);
  `"multiple"` a checkbox (lists to export); omitted, a button whose `selected` highlights the
  current entry (the drawer). `expanded` shows a chevron and announces the state. `variant="card"`
  for rows standing on the page, `plain` inside sheets. Rows that expand into details holding a
  native player (`PatternListItem`, `ModifierListItem`) keep a plain `View` as the container and use
  `ListRow` only for the header — see "Dismissal touches" below.
- **`SegmentedControl`** — two to four exclusive options in one track, with optional counts.
  `kind="tabs"` switches the view below (the list manager's Patterns / Modifiers); `kind="choice"`
  sets a value, announced as radios (import's Skip / Replace).
- **`AppText`** — `variant` is a text style, `color` a colour role.
- **`Tappable`** — the same press behaviour around content that is not text or an icon: the
  header's logo, a video thumbnail. Its `accessibilityLabel` is required, since such content has
  nothing to read out. Reach for the others first.

`Button` and `Chip` default their `accessibilityLabel` to their visible text, which is what tests
find them by. `style` on a primitive is for layout (flex, margins); the look comes from its props.
Haptics go through `ui/haptics.ts` — selection changes and destructive confirmations only, never
every tap.

**The design gallery** (`ui/DesignGallery.tsx`, route `/gallery`, linked from Settings in
development builds only) shows every token and primitive in the active theme with a theme switch
at the top. It is the fast loop for design work: change `theme/tokens.ts` or a primitive, save, look.
Its strings are not translated on purpose — no user sees it — and release builds redirect it home.

A list's actions are never behind a long press alone: `PatternListSelector` shows a "more" button on
each card, and the long press is only a shortcut to the same sheet.

Two touch surfaces are deliberately not primitives: the backdrops that dismiss `BottomSheet` and
`PatternDetailsModal` (siblings behind their cards, see "Dismissal touches"), and the video editor's
tap-to-mark overlay, which is a canvas rather than a control. The type row's colour dot and swatches
in `PatternListTemplateModal` stay bespoke too, because they display data colours and their tests
pin the row's structure; they are labelled and announce their state.

## Header layout

`AppHeader` lays its three children out in flow — a fixed-width button slot, the title at `flex: 1`,
another slot of the same width. Because both sides are equal the title lands on the centre of the
screen without being positioned over anything.

**Do not make the title absolute again.** It used to be `position: "absolute"` across the full
header width, relying on `pointerEvents: "none"` to stay out of the way — but that is a View style
prop and React Native's `Text` does not implement it, so the title sat on top of the home button
and swallowed most presses. A component test cannot catch that (RNTL has no layout engine and
cannot tell that one view covers another), so the guard in
`__tests__/components/AppHeader.test.tsx` pins the structure instead, and the real check is tapping
the icon on a device.

In `AppHeader` the app icon is a home button that navigates to `HOME_ROUTE` (exported from
`components/DrawerRoutes.ts` — the first drawer entry, `/`), and the hamburger opens the drawer via
`useNavigation<{ openDrawer: () => void }>()`; `DrawerContent` must take `navigation` from the
`drawerContent` render prop instead, since it sits beside the screens and `useNavigation()` there
does not resolve to the drawer navigator.

## The Android back-gesture band

Android 10+ binds the system back gesture to both screen edges and consumes roughly the outer
20 dp of each. Anything horizontally scrollable reaching into that band competes with it — the
timeline's scroller, the network view's pan, the video carousel.

`SCREEN_EDGE_INSET` (`utils/EdgeInsets.ts`) is applied once, as `PageContainer`'s
horizontal padding, so every screen inherits it. **Keep it there rather than padding individual
scrollers**: there are several, they are in different features, and each one that forgets is a
bug nobody will reproduce on an iPhone.

For the same reason **the drawer does not open by swipe on Android**
(`swipeEnabled: Platform.OS !== "android"`). A right-edge swipe was simultaneously "go back" and
"open the drawer", and it stole pans from the network graph. Every screen renders `AppHeader`,
which has an always-visible menu button. iOS keeps the swipe: its interactive pop gesture is
left-edge only and the drawer is on the right. Between the two there is nothing of the app's own
left in the band.

## Modals and the system bars

Android draws apps edge to edge, and a React Native `Modal` gets no insets of its own: content laid
out from the top sat under the clock and battery (the edit-pattern dialog's title did). **Every
`Modal`'s scrim is a `ModalOverlay`** (`components/ModalOverlay.tsx`): it covers the whole screen and
pads its content by the system bars' insets plus a spacing step (`padding`, default `xl`;
`align="bottom"` for panels that meet the bottom edge, whose own card then pads by the bottom inset,
as `DeidentifyModal` does). `BottomSheet` does the same inside itself. The insets come from
Unistyles' runtime (`StyleSheet.create((theme, rt) => …)`, `rt.insets`), so they follow rotation;
the Jest mock reports them as zero.

## Dismissal touches

**A backdrop tap must dismiss via a sibling `Pressable` behind the card, never a wrapper around
it.** A press handler wrapping content claims the touch, and native children never receive it —
the video player's controls stopped responding inside `PatternDetailsModal` while the same details
rendered in a list row were fine. A sibling only receives touches where it is the topmost view,
which is exactly outside the card.

`components/BottomSheet.tsx` has the sibling shape too: its scrim is a `Pressable` behind the
sheet. The sheet rises on a spring over a fading scrim (Reanimated, `theme.motion`), and closes from
its close button, the scrim, the back button, or a swipe down on its handle and header — past a
quarter of its height or on a flick. The pan is attached to the header only, so a `ScrollView`
inside the sheet keeps scrolling. It stays mounted through the closing animation, so a parent that
sets `visible={false}` sees the sheet leave rather than vanish. The scrim is hidden from screen
readers; the close button and the back button are their way out.

## Web split

`components/YouTubeVideoItem.tsx` uses `react-native-youtube-iframe`, which renders through
`react-native-webview`. That library has no web build (its web entry imports the unmaintained
`react-native-web-webview`), so `components/YouTubeVideoItem.web.tsx` embeds the YouTube iframe directly
instead. Keep the YouTube player behind this component — importing `react-native-youtube-iframe`
anywhere reachable from web breaks the web bundle.

`VideoCarousel` keeps `containerWidth` at 0 and mounts its list only once `onLayout` fires.
Nothing fires that under jest — see `__tests__/AGENTS.md`.
