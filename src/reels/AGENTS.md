# Reels — `src/reels/`

The _Reels_ tab: every pattern that has a video, for browsing before a social rather than looking
something up. Unqualified paths are relative to `src/reels/`.

- **Overview** (`ReelsScreen`, `components/ReelCard.tsx`): the patterns as stills, several to a
  screen, from the open list or from every list on the phone (a `SegmentedControl`).
- **One per screen** (`components/ReelPage.tsx`): tapping a card opens them; swiping up or down
  moves between patterns (a vertical paging `FlatList`), sideways through the pattern's videos (a
  horizontal pager inside the page). The grid button or Android's back returns to the overview.
- `components/ReelCaption.tsx` names the pattern, its type and, for a modifier video, the modifier.

## Data

`collectReels` (`reels.ts`) is pure and unit-tested: lists in their order, patterns by name, each
pattern's own videos first, then those danced with a modifier (still shown when the modifier is
gone), and patterns without video left out. `hooks/useReels.ts` takes the open list from the context,
so an edit shows at once, and **reads the other lists from storage on each visit** (nothing else
holds them in memory). That is the one place a screen reads lists other than the active one.

Reels only reads, so it needs no read-only guard.

## Players

**Only the video on screen holds a player, and only while the tab is in front.** The tabs keep the
screen mounted, so leaving it must unmount the player to stop the video, and the phone cannot decode
a page of players at once. `ReelsScreen` tracks focus with `useFocusEffect` and passes `active` down;
`components/ReelVideoView.tsx` mounts the player only when active. Videos use the platform's own
controls (play, time bar, fullscreen in landscape), as elsewhere in the app, on the style's
background rather than black. YouTube links go through `YouTubeVideoItem`.

The visible page comes from `onViewableItemsChanged` with a module-level viewability config (a
`FlatList` requires it to be referentially stable). In tests, call that prop inside `act()`
(`__tests__/AGENTS.md`).
