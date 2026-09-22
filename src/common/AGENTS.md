# Shared UI — `src/common/`

App chrome, theming, and the layout and touch rules every screen inherits. Unqualified paths
below are relative to `src/common/`.

## Theming

Every component that needs colours does:

```tsx
const { colorScheme } = useThemeContext();       // "light" | "dark"
const palette = getPalette(colorScheme);          // → LightPalette or DarkPalette
// then: palette[PaletteColor.Background], etc.
```

Styles are created inline per-render (no shared static stylesheets). `PaletteColor` enum and both palettes live in `utils/ColorPalette.ts`. Recurring style fragments are factored into `utils/CommonStyles.ts` (`getCommonButton`, `getCommonInput`, `getCommonLabel`, …) and `src/pattern/filter/FilterCommonStyles.ts` (chips, filter sections) — reuse those instead of re-declaring them.

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

## Dismissal touches

**A backdrop tap must dismiss via a sibling `Pressable` behind the card, never a wrapper around
it.** A press handler wrapping content claims the touch, and native children never receive it —
the video player's controls stopped responding inside `PatternDetailsModal` while the same details
rendered in a list row were fine. A sibling only receives touches where it is the topmost view,
which is exactly outside the card.

`components/BottomSheet.tsx` still uses the nested-`Pressable` form. That works for ordinary
touchables, which win the responder over an ancestor, but **do not put a native player inside it**
without changing it to the sibling shape.

## Web split

`components/YouTubeVideoItem.tsx` uses `react-native-youtube-iframe`, which renders through
`react-native-webview`. That library has no web build (its web entry imports the unmaintained
`react-native-web-webview`), so `components/YouTubeVideoItem.web.tsx` embeds the YouTube iframe directly
instead. Keep the YouTube player behind this component — importing `react-native-youtube-iframe`
anywhere reachable from web breaks the web bundle.

`VideoCarousel` keeps `containerWidth` at 0 and mounts its list only once `onLayout` fires.
Nothing fires that under jest — see `__tests__/AGENTS.md`.
