# App chrome — `src/common/`

The header, navigators, page container, modals and the touch rules every screen inherits.
Unqualified paths are relative to `src/common/`. Styling is in `theme/AGENTS.md`, the primitives in
`ui/AGENTS.md`.

## Header and navigators

`AppHeader` lays its three children out in flow: a fixed-width button slot, the title at `flex: 1`,
another slot of the same width, so the title lands centred without being positioned over anything.

**Do not make the title absolute again.** It was `position: "absolute"` across the header with
`pointerEvents: "none"`, but React Native's `Text` does not implement that prop, so the title sat on
the home button and swallowed most presses. RNTL has no layout engine and cannot see one view
covering another, so `__tests__/components/AppHeader.test.tsx` pins the structure instead; the real
check is tapping the icon on a device.

- The app icon is a home button to `HOME_ROUTE` (`components/DrawerRoutes.ts`, `/`). The hamburger
  opens the drawer via `useNavigation<{ openDrawer: () => void }>()`; inside a `(list)` tab that
  returns the tab's navigation, which carries its parent drawer's `openDrawer` too.
- `DrawerContent` takes `navigation` from the `drawerContent` render prop: it sits beside the
  screens, where `useNavigation()` does not resolve to the drawer.
- The tab bar (`ListTabsLayout`) passes `safeAreaInsets={{ bottom: 0 }}`: the root layout's
  `SafeAreaView` already keeps the app above the system bar, and adding the inset again floats the
  bar too high. Its colours, like the drawer's, are navigator options read from `useUnistyles()`.

## The Android back-gesture band

Android 10+ binds the back gesture to both screen edges and consumes roughly the outer 20 dp.
Anything horizontally scrollable there competes with it (the timeline's scroller, the network
view's pan, the video carousel).

- `SCREEN_EDGE_INSET` (`utils/EdgeInsets.ts`) is applied once, as `PageContainer`'s horizontal
  padding. **Keep it there rather than padding scrollers**: there are several, in different
  features, and each one that forgets is a bug nobody reproduces on an iPhone. Content outside
  `PageContainer` (the full-screen sheets `AnonymizeModal`, `VideoReviewModal`,
  `TranscriptSheet`) pads itself by `SCREEN_EDGE_INSET` plus a step.
- **The drawer does not open by swipe on Android** (`swipeEnabled: Platform.OS !== "android"`). A
  right-edge swipe was both "back" and "open the drawer", and stole pans from the network graph.
  Every screen has `AppHeader`'s menu button. iOS keeps the swipe: its back gesture is left-edge
  only and the drawer is on the right.

## Modals and the system bars

Android draws edge to edge, and a React Native `Modal` gets no insets: content laid out from the top
sat under the clock. **Every `Modal`'s scrim is a `ModalOverlay`** (`components/ModalOverlay.tsx`):
it covers the screen and pads its content by the system bars' insets plus a spacing step
(`padding`, default `xl`; `align="bottom"` for panels that meet the bottom edge, whose card then
pads by the bottom inset itself, as `AnonymizeModal` does). `BottomSheet` does the same inside
itself.

A `Modal` renders in its own native window, outside the drawer's `GestureHandlerRootView`, so a
Gesture Handler gesture inside it never activates on Android unless the modal mounts its own root.
`BottomSheet` and `AnonymizeModal` do. Screens do not (see `src/pattern/graph/AGENTS.md`).

Every `Modal` handles Android's back button through `onRequestClose`.

## Dismissal touches

**A backdrop tap dismisses through a sibling `Pressable` behind the card, never a wrapper around
it.** A press handler wrapping content claims the touch, and native children never receive it: the
video player's controls stopped responding inside `PatternDetailsModal` while the same details in a
list row were fine. A sibling only gets touches where it is topmost, which is exactly outside the
card. `PatternDetailsModal` and `BottomSheet` both have this shape.

`components/BottomSheet.tsx` rises on a spring over a fading scrim (Reanimated, `theme.motion`) and
closes from its close button, the scrim, the back button, or a swipe down on its handle and header
(past a quarter of its height, or a flick). The pan is on the header only, so a `ScrollView` inside
keeps scrolling. It stays mounted through the closing animation, so a parent that sets
`visible={false}` sees it leave rather than vanish. The scrim is hidden from screen readers; the
close and back buttons are their way out.

## Video players

- `components/VideoItem.tsx` plays any video reference: YouTube links through
  `YouTubeVideoItem`, everything else with expo-video and the platform's own controls.
  `VideoCarousel` pages through a pattern's videos and renders nothing until measured
  (`__tests__/AGENTS.md`).
- **YouTube stays behind `components/YouTubeVideoItem.tsx`.** It uses `react-native-youtube-iframe`,
  which renders through `react-native-webview`, which has no web build; `YouTubeVideoItem.web.tsx`
  embeds the iframe directly. Importing `react-native-youtube-iframe` anywhere reachable from web
  breaks the web bundle.
