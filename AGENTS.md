# AGENTS.md — DancePatternMapper

Expo/React Native (TypeScript) app for mapping partner-dance prerequisite graphs.

## Architecture overview

```
app/_layout.tsx        ← root layout (imports @/src/i18n)
  ThemeProvider        ← global light/dark theme
    ActivePatternListProvider  ← global state: active list + its patterns
      Drawer           ← expo-router/drawer, 4 file-based routes
```

**The drawer does not open by swipe on Android** (`swipeEnabled: Platform.OS !== "android"`). Android 10+ binds the system back gesture to both screen edges and consumes the outermost band, so a right-edge swipe was simultaneously "go back" and "open the drawer" — and it stole pans from the network graph. Every screen renders `AppHeader`, which has an always-visible menu button. iOS keeps the swipe: its interactive pop gesture is left-edge only and the drawer is on the right.

Navigation is **file-based expo-router**; there is no `@react-navigation/*` dependency (SDK 56 forbids importing those from app code — Metro fails the bundle). Import `Drawer` from `expo-router/drawer`, and `useNavigation` / `useFocusEffect` / `router` / `usePathname` from `expo-router`.

| File | Path | Screen component |
|---|---|---|
| `app/index.tsx` | `/` | `src/pattern/list/PatternListSelector.tsx` |
| `app/patterns.tsx` | `/patterns` | `src/pattern/list/PatternListManager.tsx` |
| `app/graph.tsx` | `/graph` | `src/pattern/graph/PatternGraphScreen.tsx` |
| `app/settings.tsx` | `/settings` | `src/settings/SettingsScreen.tsx` |

Each route file is a one-line re-export; the screens live in `src/`. `src/common/components/DrawerRoutes.ts` is the single source of truth for the route list (name, href, i18n title key, whether the header shows the active list's name) and is consumed by the navigator, the drawer menu (`DrawerContent.tsx`) and `AppHeader.tsx` — add a route there and in `app/`, not in three places.

Screens navigate with `router.navigate("/patterns")`, not a `navigation` prop. In `AppHeader` the app icon is a home button that navigates to `HOME_ROUTE` (also exported from `DrawerRoutes.ts` — the first drawer entry, `/`), and the hamburger opens the drawer via `useNavigation<{ openDrawer: () => void }>()`; `DrawerContent` must take `navigation` from the `drawerContent` render prop instead, since it sits beside the screens and `useNavigation()` there does not resolve to the drawer navigator.

Pattern and modifier **mutations** go through `usePatternCrud` (`src/pattern/list/hooks/usePatternCrud.ts`), not through the context directly. It owns the read-only guard, id allocation, the prerequisite scrub on delete and the opportunistic Firestore push, and every mutation returns whether it was applied so a caller can keep a form open on rejection. `PatternListManager` is left holding only which modal is open. Add a mutation there, not inline in a screen.

All screens share state through `ActivePatternListContext` (`src/pattern/data/components/ActivePatternListContext.tsx`). Every screen reads `activeList`, `patterns`, `isLoading`, and `hasLists` from `useActivePatternList()` and mutates via `setActiveList`, `updatePatterns`, `updateActiveList(list, patternsOverride?)`, `refreshActiveList` — never loads storage directly. The provider also maintains a live Firestore subscription via `useSharedList` when the active list has a `shareCode`.

## Core data model

Everything lives in `src/pattern/types/IPatternList.ts` (plus `PatternType.ts`, `PatternLevel.ts`).

| Type | Id type | Key detail |
|---|---|---|
| `IPatternList` | `string` (UUID) | Owns its own `PatternType[]` **and** `IModifier[]` — both are **per-list**, not global; optional `readonly?: boolean` (subscriber/read-only copy) and `shareCode?: string` (Firestore doc ID) |
| `PatternType` | `string` (UUID) | `slug` = display name; `color` = hex; referenced from patterns via `typeId` |
| `IPattern` | `number` (integer) | `prerequisites: number[]` drives both graph views; `typeId` is a UUID string; `tags: string[]`; optional `level` (`PatternLevel` value); `videoRefs: IVideoReference[]`; `modifierRefs: IPatternModifierRef[]` |
| `IModifier` | `string` (UUID) | `position: "prefix" \| "postfix" \| "amends"`; `universal: boolean`; `videoRefs` are only used when `universal === true` |
| `IPatternModifierRef` | — | `{ modifierId, videoRefs }` — a non-universal modifier attached to one pattern, with videos of that pattern **executed with** the modifier |
| `IVideoReference` | — | `{ type: "url" \| "local", value: string, startTime?: number }` (`startTime` for URL videos only) |

Creation helper types: `NewPattern = Omit<IPattern, "id">`, `NewModifier = Omit<IModifier, "id">`.

`PatternType.ts` also exports `PATTERN_TYPE_COLORS` (12 named hex colours), `generateUUID()`, `normalizeSlug()`, and `isSlugUnique()`.

## Modifiers

Modifiers are affixes ("with a spin", "slow") that live on the list, not on a pattern:

- **Universal** modifiers implicitly apply to every pattern in the list and carry their own `videoRefs`.
- **Non-universal** modifiers are attached per-pattern through `IPattern.modifierRefs`; each attachment carries its own videos of that specific combination.

`PatternListManager` has a `patterns` / `modifiers` tab switch and owns modifier CRUD (`addModifier`, `editModifier`, `deleteModifier` — deleting also scrubs the id from every pattern's `modifierRefs`). UI: `ModifierList` → `ModifierListItem` → `ModifierDetails`, editing via `EditModifierForm`; `ModifierPillStrip` renders/toggles a pattern's modifiers inside `EditPatternForm` and `PatternDetails`.

## Persistence (AsyncStorage)

Storage keys in `src/pattern/data/PatternListStorage.ts`:
- `@patternLists` — serialised `IPatternList[]` (no patterns)
- `@patterns_{listId}` — serialised `IPattern[]` for a given list
- `@activeListId` — UUID of the currently active list

**Writes to the same key are serialised.** `savePatternList` and `deletePatternList` are
read-modify-write over the whole list array, so two overlapping calls used to both read the
pre-change array and the second silently discarded the first's change — reachable in the app,
since `PatternListSelector.handleSaveList` and the context's `updateActiveList` can be in flight
together. `withWriteLock` queues the **entire operation**, not just its final `setItem`; the read
has to be inside the critical section too. Reads are not queued, so a locked operation can read
freely without deadlocking against itself.

Patterns and lists are stored under **separate keys**. Always use the helpers in `PatternListStorage.ts` (`loadAllPatternLists`, `savePatternList`, `deletePatternList`, `getPatternListById`, `getActiveListId`, `setActiveListId`, `getActiveList`, `loadPatterns`, `savePatterns`, `hasPatternLists`, `clearAllData`, `collectOrphanedPatternKeys`) — never call `AsyncStorage` directly from UI code.

**`@patternLists` holds lists without patterns.** The import and cloud-subscribe paths both hand over a `PatternListWithPatterns`, whose extra `patterns` array TypeScript cannot see because `IPatternList` has no such field — so `savePatternList` strips it rather than trusting callers, and `loadAllPatternLists` strips it again to clean up records an older build already bloated. Do not "simplify" that away: it writes a second copy of every pattern that nothing reads and nothing keeps in step.

`clearAllData` removes the per-list `@patterns_*` keys as well as the two top-level ones. `collectOrphanedPatternKeys` reclaims `@patterns_*` entries whose list no longer exists and is called once, unawaited, from `ActivePatternListProvider` after the initial load — it must never delay or fail first paint.

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

## Prerequisite integrity

`IPattern.prerequisites` is the data model — both graph views are built from it — and two ways of
corrupting it used to make patterns disappear from the network view while the list and timeline
still showed them. Three rules keep that shut, and all three live in
`src/pattern/graph/utils/GenericGraphUtils.ts`:

- **Never remove a pattern without scrubbing references to it.** `deletePattern` composes deletion
  as `repairDanglingPrerequisites(patterns.filter(...))` rather than filtering alone. The helper
  returns the same array reference when there is nothing to repair, so the healthy path is free.
- **`loadPatterns` repairs on read**, so lists corrupted by older builds heal themselves as they
  load. Do not remove this in favour of a one-off migration — there is no migration runner yet
  ([F3](AGENT_TASKS.md)).
- **The prerequisite picker refuses cycles.** `findIneligiblePrerequisiteIds(patterns, id)` returns
  the pattern plus everything that already depends on it; `EditPatternForm` disables those chips.
  Note the direction: `P.prerequisites = [Q]` means Q comes *before* P, so the edge runs Q → P and
  "would cycle" means Q already depends on P. Use `collectDependents` from `model/adjacency.ts` to
  walk forwards — a BFS over the index, not a path enumeration.

Belt and braces, and the part that actually protects the user: **`calculateGraphLayout` must place
every node it is given.** Its DFS only places a node once all prerequisites are positioned, so a
dangling id or a cycle leaves one unplaceable — and `drawNodes` renders nothing for a node with no
position, losing it and its whole subtree silently.

Since the model landed, most degenerate input never reaches that hazard: `buildAdjacency` drops
prerequisite ids matching no pattern, so a pattern whose prerequisites are all missing has none as
far as the layout is concerned, scores depth 0, and is laid out as a root on the foundational
ellipse. The fallback pass — position whatever is left over from its known prerequisites, else on
a ring outside the ellipse — is retained as the deeper net for what the model cannot resolve
(nodes inside a genuine cycle). Keep it, and keep
`__tests__/unit/GraphLayoutInvariants.test.ts` asserting `positions.size === patterns.length` for
degenerate input: imports, shared lists and old devices still supply both kinds of bad data.

## Theming

Every component that needs colours does:
```tsx
const { colorScheme } = useThemeContext();       // "light" | "dark"
const palette = getPalette(colorScheme);          // → LightPalette or DarkPalette
// then: palette[PaletteColor.Background], etc.
```
Styles are created inline per-render (no shared static stylesheets). `PaletteColor` enum and both palettes live in `src/common/utils/ColorPalette.ts`. Recurring style fragments are factored into `src/common/utils/CommonStyles.ts` (`getCommonButton`, `getCommonInput`, `getCommonLabel`, …) and `src/pattern/filter/FilterCommonStyles.ts` (chips, filter sections) — reuse those instead of re-declaring them.

## Internationalisation

All user-facing strings use `const { t } = useTranslation()`. Translation keys must be added to **both** `locales/en.json` and `locales/de.json` (flat key/value, no nesting). i18n is initialised once in `src/i18n.ts` (imported by `app/_layout.tsx`; it lives outside `app/` because every file in there becomes a route); available languages are listed in `src/settings/types/Languages.ts`.

## Graph views

`src/pattern/graph/` contains two switchable views (`ViewMode = "timeline" | "graph"`, declared once in `src/pattern/graph/types/ViewMode.ts`, selected in `PatternGraphScreen`, rendered by `GraphViewContainer` alongside `Legend`), both driven by `IPattern.prerequisites[]`.

### The graph model

**Both views render from one `GraphModel`, built once.** `buildGraphModel(patterns, patternTypes)` (`model/GraphModel.ts`) returns nodes, edges, the adjacency index, the depth map, the cycles and the type-colour map; `useGraphModel(patterns, patternTypes)` memoises it on the screen and hands it down. This is the contract every view, layout function and renderer agrees on — nothing derives depth, edges or colour for itself any more.

- `model/adjacency.ts` is the whole graph maths: `buildAdjacency` (indexes both directions and **drops prerequisite ids that match no pattern**, so no consumer guards against a dangling id), `collectDependents` / `collectPrerequisites` (BFS, cycle-safe), `findCycles` (iterative Tarjan, O(V + E)) and `buildDepthMap` (iterative longest-path DFS with memoisation). All iterative on purpose: a 5000-long chain must not blow the stack, and the detector this replaced enumerated every distinct path.
- A `GraphNode` carries `{ pattern, depth, foundational, color, inCycle }`. `foundational` is judged on *resolvable* prerequisites, so a pattern pointing only at missing ids is a root.
- Keep the model pure and cheap. It is rebuilt on every change to the pattern set, and `PatternNode` takes a `GraphNode` rather than a bare pattern plus a colour map — that is what removed the `as any` casts at each call site.
- `model.cycles` is not just diagnostics: `CycleWarning.tsx` renders a banner above the graph when it is non-empty. Cycle detection used to run on every render and emit only a `console.warn`.

### Filtering

The graph screen filters through the same `PatternFilter` and `PatternFilterBottomSheet` the list screen uses (`usePatternFilter` lives in `src/pattern/filter/hooks/`, shared by both). `useGraphFilter` owns the filter and chain-mode state and produces the model to render.

**Never hand a filtered `patterns` array to a layout function.** The network layout places a node only once *every* prerequisite is positioned, and `drawNodes` renders nothing for an unpositioned node — so one id pointing outside the shown set deletes that node and its whole subtree with no error. `filterGraphModel` (`model/filterGraphModel.ts`) exists to prevent that: it rewrites every surviving node's `prerequisites` against the shown set, turning a prerequisite hidden by the filter into an *elided* edge onto the nearest shown ancestor (drawn dashed, `ELIDED_DASH`) or dropping it when there is none. `__tests__/unit/filterGraphModel.test.ts` holds this as a property over random graphs; do not weaken it.

- `selectSubgraph` decides which nodes appear: a multi-source BFS, O(V + E), with `matchesOnly` / `prerequisites` / `dependents` / `fullChain` and an optional radius. Only three of those are offered in the UI — see `types/ChainMode.ts` for why.
- **Depth stays on full-graph terms** so a node keeps its timeline column when a filter is toggled; that is why `calculateDynamicTimelineLayout` takes a `depthMap` rather than deriving one. `foundational` deliberately does not, because it anchors the network ellipse and must describe what is drawn. `cycles` stay full-graph too — data a filter hides is still corrupt.
- Context nodes (shown but not matched) dim via the group's `opacity`, never via `PatternNode`'s fill opacity, which already encodes level.
- The network view's initial zoom is fitted to the drawn content (`useGraphLayout`). It was a fixed 0.35, which leaves a filtered graph as a mostly empty canvas.
- Filter state is **not persisted**, deliberately: a filter that survives a navigation away is invisible on return and reads as "my patterns disappeared". It resets when the active list changes, adjusted during render rather than in an effect.

### Pan and zoom

The network view's canvas is `components/ZoomableCanvas.tsx` — Gesture Handler gestures driving Reanimated shared values, with the live transform published to descendants through `CanvasTransformContext`.

It replaced `@openspacelabs/react-native-zoomable-view`, which is implemented with `PanResponder`. **Do not reintroduce a `PanResponder`-based gesture here.** A node drag has to live in Gesture Handler's touch system, and the two systems do not negotiate — there is no `simultaneousHandlers` across that boundary, so whichever claimed a touch first won, non-deterministically from the user's point of view.

- Everything is on the UI thread: shared values and `useAnimatedStyle`, never `setState` from a handler. Use `.get()` / `.set()`, not `.value` — the React Compiler is on and cannot see through bare `.value` access.
- The transform array is `[{ translateX }, { translateY }, { scale }]`. Translate before scale, so offsets stay in screen pixels and a drag tracks the finger 1:1 at any zoom.
- Pinch reports *cumulative* scale; the canvas converts it to a per-frame factor so pinch and pan can both write `translate` without fighting.
- **No `GestureHandlerRootView` is mounted in `src/`, deliberately.** On native the drawer supplies a real one (`react-native-drawer-layout`'s `Drawer.native` renders one around its children, so every screen is inside it). On web RNGH's root view is a plain `View` plus a context flag, so gestures work without one. Nesting another around the graph would take that area out of the drawer's own gesture tree.

### Manual layout

A user-arranged network layout is stored per list, per device, at `@graphLayout_{listId}`
(`data/GraphLayoutStorage.ts`, with the key itself in the import-free `data/GraphLayoutKeys.ts`
so `PatternListStorage` can clean it up without pulling in the reconciliation layer).

`model/resolveLayout.ts` merges what is stored with the patterns that exist now, and the rule that
matters is: **a pattern added since must be seeded near its prerequisites, never by re-running the
global layout.** Re-laying-out would be correct and would also throw away everything the user
arranged, every time they add a pattern. Stored positions are clamped to `MAX_GRAPH_COORDINATE` —
a node outside that box could not be dragged back, because it would never be on screen.

- A stored entry whose pattern no longer exists is reported as stale and pruned on save. That is
  also the mitigation for [B14](AGENT_TASKS.md) — pattern ids are recycled (`createNewId` is
  `max(id) + 1`), so a stored position can in principle attach to a pattern that merely inherited
  the id. Do not key any other long-lived data by pattern id until that is fixed properly.
- **Filtering must not prune.** Filtering hides patterns, it does not delete them; `resolveLayout`
  reports them stale because it only sees the patterns it was handed, so the caller passes the
  *unfiltered* set when deciding what to persist.
- A manual layout is **never written to the Firestore shared document**. A subscriber's
  arrangement is theirs, and `syncPublishedList` runs after every pattern CRUD — a layout in there
  would fire a network write on every drag.
- Dragging is allowed on read-only lists. It is a local view preference, not a content edit, so it
  is a deliberate exception to the `isReadonly` guard every mutating path has.

### Dragging a node

Long-press a node in the network view and drag it; the position is persisted on release.

**Nodes in the network view have no `onPress`, and must not get one.** `onPress` on an SVG element installs React Native's full Touchable responder set — `onStartShouldSetResponder` claims the touch, and `onResponderTerminationRequest` refuses to yield it — so a touch landing on a node never reaches Gesture Handler. That is why long-press-to-drag did nothing on a node while panning from empty canvas worked, and it was only found on a device. The network view draws inert nodes and handles **both** tap and drag in the gesture system; the timeline, which has no canvas gesture to compete with, still uses `onPress`.

Because the node tap is a Gesture Handler tap now, **the canvas has no double-tap-to-zoom**. The two cannot both be fast: a single tap would have to wait for a double tap to fail before it could open a pattern, which is the screen's most common interaction. Pinch remains, and the initial zoom is fitted to the content.

**One pan gesture on the canvas hit-tests, rather than a gesture per node** (`hooks/useNodeDrag.ts`, `model/graphCoordinates.ts`). Nodes are SVG elements, so a `GestureDetector` per node means a detector inside an `<Svg>` — fragile on native, and colliding with the web build's hand-bound click listeners. Hit testing against positions we already have is pure and testable, and arbitration is still Gesture Handler's job: the drag is *raced* against the canvas's own gestures, not made exclusive, so a plain drag pans immediately instead of waiting for a long press to fail.

- **Screen deltas are divided by the live zoom.** Without that a dragged node lags the finger above 1:1 and outruns it below. The zoom is read from the shared value each frame rather than captured at gesture start.
- `draggingId` is React state, set once at the start of a drag and cleared at the end. **Nothing re-renders per frame**: only the dragged node and the edges touching it follow a shared value, so the per-frame cost is a handful of worklets whatever the size of the graph (`render/DragOverlay.tsx`, `render/DraggedEdge.tsx`).
- **The dragged node is drawn in its own `Animated.View` above the graph, not as an animated `<G>` inside the main `<Svg>`.** Animating an SVG group's transform props made the node disappear for the duration of the drag on device, while its edges followed correctly. A `View` transform is reliable everywhere, so the node is lifted into a small SVG of its own and the view moves; `drawNodes` skips it meanwhile so it does not ghost at its old position.
- **The lift is not decoration.** Haptics are off system-wide for many people and silent on plenty of Android hardware, so the scale-up is what actually tells the user a node has been picked up. Never make a haptic the only feedback.
- A long press on empty canvas pans instead of doing nothing — the drag has already won the race by then, so the canvas pan will not fire.
- **The gesture has no affordance**, so `components/GraphDragHint.tsx` says so in words. It was reported as "how would I move the graph items?" the first time it reached a device. Do not remove it without replacing the cue with something else.
- **The canvas is measured from the positions actually drawn** (`model/canvasMetrics.ts`), not from the automatic layout — a node dragged beyond the automatic bounds would fall outside the SVG and stop being drawn. Those positions are deliberately *not* re-normalised: that would shift every node whenever one was dragged past an edge. Positions are clamped at both ends (`MIN_GRAPH_COORDINATE`/`MAX_GRAPH_COORDINATE`) for the same reason.

**`generateOrthogonalPath` and the helpers it calls are worklets, and their position in `GraphUtils.ts` is load-bearing.** The worklets Babel plugin rewrites a `"worklet"` function declaration into a `var` assigned from a factory that closes over its helpers *by value at the point the declaration appears*. Declared above its helpers, such a function captures `undefined` and throws `getConnectionPoint is not a function` the first time an edge is drawn — on device as well as under test, and function hoisting does not save it because there is no longer a declaration to hoist. If you add a helper there, mark it `"worklet"` and define it above its callers.

### The views

- **Timeline** (`TimelineView.tsx`) — swimlane by `PatternType`, left-to-right by `node.depth` (`calculateDynamicTimelineLayout` in `TimelineGraphUtils.ts`); skip-level edge routing handled by `CollisionAvoidanceUtils.ts`
- **Network** (`NetworkGraphView.tsx`) — force-free hierarchical layout (`calculateGraphLayout` in `NetworkGraphUtils.ts`), driven by the `useGraphLayout` hook (`hooks/useGraphLayout.ts`)

Both draw through the shared primitives in `render/GraphPrimitives.tsx` (`ArrowheadMarker`, `drawEdges`, `drawNodes`) rather than one view importing from its sibling. `GraphSvg.tsx` is now just the network view's `<Svg>` around those primitives.

`utils/GenericGraphUtils.ts` keeps only what is needed *outside* the views — `findIneligiblePrerequisiteIds` (the editor's cycle guard) and `repairDanglingPrerequisites` (storage's repair-on-read) — and both delegate to `model/adjacency.ts`. `GraphUtils.ts` holds `LayoutPosition` and the path geometry (`generateOrthogonalPath` / `generateSkipLevelPath`). Layout constants (`NODE_HEIGHT`, `HORIZONTAL_SPACING`, …) are centralised in `types/Constants.ts`; the shared SVG props contract is `IGraphSvgProps` in `types/IGraphSvgProps.ts`. Tapping a node opens `PatternDetailsModal` → `PatternDetails`.

## The pattern details view

`PatternDetails` is shared by two hosts: `PatternListItem`, where it expands directly under a row, and `PatternDetailsModal`, which the graph opens on a node tap. That is why the top rule is a prop (`showTopSeparator`) — it separates the row from its detail in the list, and duplicates the modal header's rule in the modal.

- **The modal's card is sized to its content**, capped at 80% of the screen rather than fixed at it. React Native puts `flexGrow: 1` on a ScrollView's content container, so both the ScrollView's own style *and* its `contentContainerStyle` need `flexGrow: 0` or the card fills its whole allowance however little is in it.
- **Empty sections are not all alike.** Prerequisites and "builds into" say so explicitly when empty — "nothing comes before this" answers a question someone opened a *graph* detail view to ask. Tags render nothing at all, because an absent tag list carries no information and a bare label is just height.
- **Backdrop tap dismisses via a sibling `Pressable` behind the card, never a wrapper around it.** A press handler wrapping content claims the touch, and native children never receive it — the video player's controls stopped responding inside this modal while the same details rendered in a list row were fine. A sibling only receives touches where it is the topmost view, which is exactly outside the card. `BottomSheet` still uses the nested-`Pressable` form; that works for ordinary touchables, which win the responder over an ancestor, but do not put a native player inside it without changing it to this shape.

## Filtering & sorting

- `PatternFilter` (`src/pattern/filter/components/PatternFilterBottomSheet.tsx`): `{ name, types, levels, counts?, tags }`, applied by `usePatternFilter` (`src/pattern/list/hooks/usePatternFilter.ts`). Sub-panels: `NameFilter`, `TypeFilter`, `LevelFilter`, `CountsFilter`, `TagFilter`.
- `SortConfig` (`src/pattern/list/SortBottomSheet.tsx`): `{ field, order }` with `SortField = "name" | "typeId" | "level" | "counts" | "id"` and `SortOrder = "asc" | "desc"`, applied by `usePatternSort`.

Both panels are rendered through the shared `BottomSheet` component (`src/common/components/BottomSheet.tsx`).

## Default list templates

`src/pattern/data/DefaultPatternLists.ts` exposes factory functions (`createWestCoastSwingList`, `createSalsaList`, `createBachataList`, `createTangoList`, `createLindyHopList`, `createBlankList`) built on `createPatternList` / `createPatternType`. Each returns a fresh `IPatternList` with UUID-stamped `PatternType`s and an empty `modifiers` array. `TEMPLATE_FOUNDATIONAL_PATTERNS` maps a template id (`wcs`, `salsa`, …) to starter `TemplatePattern[]`; `resolveTemplatePatterns` converts those to `NewPattern[]` by matching `typeSlug` → `typeId`, so templates stay stable across renames. Picking a template happens in `PatternListTemplateModal`.

## Schema versioning and migrations

Stored data carries a version under `@schemaVersion`, and `runMigrations()`
(`src/pattern/data/migrations/`) brings it up to `SCHEMA_VERSION` **before anything reads pattern
data** — it is awaited first in `ActivePatternListProvider`'s mount effect, behind the loading
state that was already there.

Rules for adding one: bump `SCHEMA_VERSION`, add the migration to `MIGRATIONS`, and make it
**idempotent** — a crash part-way through leaves the version marker unchanged, so it runs again
next launch. Migrations never run backwards: if the stored version is *ahead* of the build (the
user installed an older APK over a newer one), nothing runs and the marker is left alone, because
downgrading the data would discard whatever the newer build added. A failed migration is logged
and does not block startup; the read-time repairs still cope.

The read-time normalisation in `PatternListStorage` stays even though migration 001 materialises
it — data still arrives from imports and cloud syncs after migrations have run.

## Import validation

**Never trust an import file.** It comes from a document picker, so it comes from anywhere, and
everything downstream writes it to storage and then to the screen.
`validateExportData` (`src/pattern/data/validation/`) is the only gate, and `ImportPatterns` calls
it before touching anything. It splits problems in two:

- **Fatal** — not an object, an unsupported version, `patternLists` not an array, a list with no
  id, a pattern whose id is not an integer, duplicate ids. The whole file is refused, because a
  half-import leaves the user unable to tell what landed.
- **Repairable** — a pattern pointing at a type that is not in its list, a prerequisite matching
  no pattern, a malformed video reference. Cleaned, reported through the existing `warnings`
  channel, and the import proceeds.

What it returns is normalised: optional fields filled in, references resolvable. Nothing
downstream re-checks it.

`canImport` (`types/ExportVersion.ts`) owns compatibility, separate from `exportDataVersion` which
is what we *write*. A newer **minor** is refused rather than parsed best-effort: the writer added
a field this build cannot carry, and saving over it would silently drop the user's data. Bumping
the format means bumping `SUPPORTED_MINOR` here too.

## Import conflict resolution

`useImportDecisions` derives each list's default from its props on every read — `skip` when the id
already exists locally, `replace` when it does not — and keeps only the user's explicit choices in
state. It must stay that way. The defaults used to be snapshotted by a lazy `useState`
initialiser, which never saw real data: `SettingsScreen` mounts `PatternListImportModal`
permanently and only toggles `visible`, so the hook first ran with an empty list and the real one
arrived as a prop change. Every conflicting list then fell through to `replace` and was silently
overwritten.

The same shape applies to any hook behind one of these always-mounted modals: derive from props,
or remount so the snapshot is retaken. `PatternListTemplateModal` takes the second route — it keys
its body on what the modal is open on, so opening it re-mounts with drafts seeded fresh — and that
is equally correct. What is not correct is snapshotting once and leaving it.

## Export / Import format

Version `"3.0.0"` JSON — `exportDataVersion` and `IPatternListExportData` in `src/pattern/data/types/IExportData.ts`:

```ts
{ version, exportDate, includesVideos, patternLists: PatternListWithPatterns[], videos: { [localPath]: base64 } }
```

- `exportPatternLists(lists, includeVideos, exportAsReadonly)` (`exportPatterns.ts`) writes the file to the document directory and hands it to `expo-sharing`. With `includeVideos === false` local refs are stripped instead of embedded (URL refs always survive); with `exportAsReadonly` each list gets `readonly: true`.
- Videos are keyed in the `videos` map by their **original local path**; pattern videos, universal-modifier videos and per-pattern modifier-combination videos are all embedded.
- `importPatternLists()` (`ImportPatterns.ts`) picks a file via `expo-document-picker`, decodes base64 videos back to the local filesystem via `expo-file-system`, and returns the lists — collecting non-fatal `warnings` for missing/unreadable videos.

Export/import UI lives in `src/pattern/data/components/` (`PatternListExportModal`, `PatternListImportModal`, and helpers `ConflictBadge`, `ExportListItem`, `ImportListItem`, `ImportSummary`, `SelectAllButton`, `ImportActionButtons`). The backing hooks are `useExportSelection` and `useImportDecisions` (`ImportAction = "skip" | "replace"` per list, defaulting to `skip` on id conflict) in `src/pattern/data/hooks/`; `src/settings/hooks/useDataTransfer.ts` orchestrates the full flow from `SettingsScreen`.

## Firebase / cloud sharing

`src/firebase/` provides optional Firestore-backed list sharing:
- `firebaseConfig.ts` — reads credentials from `Constants.expoConfig.extra.firebase`; when absent, `firebaseAvailable === false` and all service calls throw/no-op rather than crash the app. Also exports `db`, `APP_TOKEN` (write guard checked by Firestore Security Rules) and `SHARED_LISTS_COLLECTION = "sharedLists"`.
- `FirebaseListService.ts` — `publishList`, `syncPublishedList`, `unpublishList`, `fetchSharedList`, `subscribeToSharedList`; documents follow `SharedListDocument` (`list`, `patterns`, `publisherVersion`, `publishedAt`, `appToken`). Share codes are 8-char alphanumeric, generated with `expo-crypto` (CSPRNG).
- `useSharedList` (`src/pattern/data/hooks/useSharedList.ts`) — called inside `ActivePatternListProvider`; maintains a live `onSnapshot` listener while `activeList.shareCode` is set; handles publisher unpublishing (clears `shareCode`/`readonly` locally and surfaces a themed dialog).

**Publisher flow**: `ShareListModal` → `publishList()` → `IPatternList.shareCode` set → stored locally; the modal can render the code as a QR code (`react-native-qrcode-svg`).
**Subscriber flow**: `SubscribeListModal` → type the 8-char code or scan the QR with `QrCodeScanner` (`expo-camera`) → `fetchSharedList()` → list saved with `readonly: true` and `shareCode` → `useSharedList` keeps it in sync.

Writes are also pushed opportunistically from the UI: `PatternListManager` calls `syncPublishedList(activeList, patterns)` after pattern CRUD when a `shareCode` exists.

### Configuration

Config is **dynamic** — `app.config.ts` (there is no `app.json`) reads credentials from environment variables, so nothing secret is committed. Copy `.env.example` to `.env` (gitignored) and fill in:

```
FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET,
FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_APP_TOKEN
```

Expo loads `.env` automatically for `expo start` / `eas build`; for EAS builds the same names must exist as EAS Secrets. Without them the app runs local-only.

### Config plugins

**Config plugins are applied only when listed in `app.config.ts` → `plugins`; autolinking does not apply them.** `expo-camera` and `expo-image-picker` are listed there purely so their iOS usage strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) reach the generated `Info.plist` — iOS terminates an app that touches those APIs without them, and Android's permission arrives via manifest merging regardless, so the omission is invisible until an iOS device runs it. Both pass `microphonePermission: false` (and camera `recordAudioAndroid: false`) because nothing in the app records audio; that also blocks `RECORD_AUDIO` from being merged in by a transitive dependency.

`expo-document-picker` is deliberately **not** listed: its plugin only sets iCloud entitlements, and only when `ios.usesIcloudStorage` is set, which this app does not use.

`ios.bundleIdentifier` must stay in `app.config.ts`. There is no `app.json`, so the CLI cannot write it for you — without it `expo prebuild --platform ios` and EAS iOS builds both refuse to run.

Verify a change here by running `npx expo prebuild --platform ios --no-install --clean` and grepping the generated `ios/*/Info.plist`; `npx expo config --type prebuild` will *not* show these, because the plugins apply through mods that only run during prebuild. Prebuild also rewrites the `android` / `ios` npm scripts to `expo run:*` — revert that, the project uses the `--dev-client` workflow.

## Read-only lists

`IPatternList.readonly` is set on imported read-only exports and on subscribed cloud lists. Every mutating path must guard on it (`const isReadonly = !!activeList?.readonly`) — pattern and modifier CRUD in `PatternListManager` already does.

## Path alias

`@/` resolves to the **project root** (not `src/`). Use `@/src/...` for source imports and `@/utils/...` for test utilities. The same mapping is configured in `tsconfig.json` and in `jest.config.js` (`moduleNameMapper`).

## Platform-specific code

Metro resolves `Foo.web.tsx` in preference to `Foo.tsx` when bundling for web, and the two files must export the same shape.

- `src/common/components/YouTubeVideoItem.tsx` uses `react-native-youtube-iframe`, which renders through `react-native-webview`. That library has no web build (its web entry imports the unmaintained `react-native-web-webview`), so `YouTubeVideoItem.web.tsx` embeds the YouTube iframe directly instead. Keep the YouTube player behind this component — importing `react-native-youtube-iframe` anywhere reachable from web breaks the web bundle.
- `src/pattern/graph/PatternNodeGroup.tsx` is the tappable `<G>` around a graph node. On native it just sets `onPress`; on web that would make react-native-svg spread six react-native responder handlers onto the DOM node, one React console error each, per node — so `PatternNodeGroup.web.tsx` takes the DOM node through `forwardedRef` and binds the listener itself. Route node presses through this component rather than putting `onPress` on an SVG element directly.
- Verify both targets with `npx expo export --platform web` and `--platform android`; web also builds an SSR bundle (static rendering is on), so a bad import surfaces twice. Console errors like these only appear with a populated graph, so check a list that actually has patterns.

## Dependencies & security

`npm audit` is expected to report **three moderate findings and nothing else**. Anything beyond that is new and worth looking at.

- The three expected ones are one root cause: `expo-router` → `query-string@7` → `decode-uri-component@0.2.2`. The patched `decode-uri-component@0.5.0` is ESM-only, so it cannot be forced under the CJS `query-string@7`; this has to wait for expo-router upstream. Impact is a DoS in query-string decoding, reachable only through a URL the user opens.
- `overrides` in `package.json` carries the rest. Each entry exists because a parent pins a range that sits below the fix — keep the comment-worthy ones in mind before removing any:
  `shell-quote` (react-devtools-core), `brace-expansion@1` / `@5` (eslint and @typescript-eslint minimatch), `@humanfs/node` (eslint), `@babel/core`, `flatted` (eslint flat-cache), and `xcode` → `uuid@^11` (xcode only calls `uuid.v4()`, unchanged across those majors; it runs during iOS prebuild).
- `react-test-renderer` is pinned to the exact `react` version and must be bumped with it. `jest-expo` must track the SDK major.
- Do **not** run `npx expo install --fix`. Several packages are deliberately ahead of the versions SDK 57 bundles — `@react-native-async-storage/async-storage@3`, `react-native-gesture-handler@3`, `jest@30`, `react@19.2.7`, `react-native-safe-area-context`, `react-native-svg` — and `--fix` would downgrade them, two across a major. `npx expo install --check` listing them is expected.
- `react-native-web` 0.21 warns that `shadow*` and `textShadow*` style props are deprecated. `shadow*` is migrated to the `boxShadow` shorthand; `textShadow` is not, because react-native 0.86 still types only `textShadowColor` / `textShadowOffset` / `textShadowRadius` (see `QrCodeScanner.tsx`).

## Developer workflows

```bash
npm install              # install deps
npm start                # expo start --lan (or: npx expo start)
npm run android          # expo start --android
npm run ios              # expo start --ios
npm test                 # Jest, both projects (no device needed)
npm run test:unit        # pure-logic project only — sub-second feedback loop
npm run test:components  # rendering project only (jest-expo)
npm run test:watch       # watch mode
npm run test:coverage    # coverage over all of src/, with thresholds enforced
npm run lint             # ESLint via expo lint
npm run format:check     # Prettier, same glob CI uses
npm run format           # Prettier, write
npm run typecheck        # tsc --noEmit
```

Stack: Expo SDK ~57 / React Native 0.86 / React 19 / TypeScript ~6, `newArchEnabled`, typed routes and the React Compiler are on (`app.config.ts` → `experiments`).

## Testing conventions

All tests live in `__tests__/` (not co-located), named `*.test.ts(x)`. Jest runs **two projects** (`jest.config.js`), and a test must go in the directory matching its project:

| Project | Directory | Environment | Use it for |
|---|---|---|---|
| `unit` | `__tests__/unit/` | `node` + `ts-jest` | Pure logic — storage, graph maths, hooks-free helpers. Fast; this is where most tests belong. |
| `components` | `__tests__/components/` | `jest-expo` preset | Anything that renders. |

`npm test` runs both; `npm run test:unit` / `npm run test:components` run one. A test placed in the wrong directory is silently never run.

- **AsyncStorage is mocked globally and behaviourally.** `__mocks__/@react-native-async-storage/async-storage.ts` is a real in-memory store implementing the v3 surface, applied automatically (a `__mocks__` directory beside `node_modules` needs no `jest.mock()` call). Both setup files reset it per test. Assert on observable state (`await loadPatterns(id)`) rather than on mock bookkeeping (`setItem.mock.calls[0][1]`), so tests survive refactors of the storage internals. `seedAsyncStorage` / `peekAsyncStorage` are there for setup and assertions.
- **The filesystem is mocked globally too.** `__mocks__/expo-file-system.ts` is an in-memory `File` / `Paths` implementation that stores real bytes and does real base64, so no test can touch the real disk and an export→import round trip has to preserve bytes exactly. `seedFile` / `seedBinaryFile` set fixtures up, `readFileBytes` / `readFileText` / `listFileUris` assert on the result. It implements only the surface the app uses and throws on anything else, so a new call site surfaces here rather than silently no-oping.
- **Export and import are tested as a round trip**, not separately (`__tests__/unit/ExportImportRoundTrip.test.ts`): the two modules only agree through the on-disk format, so exercising them apart proves very little. Add a case there when changing either side or the format version.
- **Component tests render through `renderWithProviders`** (`utils/renderWithProviders.tsx`), which supplies the real provider stack — i18n, `ThemeProvider`, `ActivePatternListProvider` — and seeds storage before mounting. It re-exports everything from `@testing-library/react-native`, so import `screen`, `fireEvent`, `within` from it rather than from the library directly.
- **Native modules are mocked in `jest.setup.components.ts`** (expo-video, expo-camera, the pickers, haptics, sharing, the YouTube player, QR codes). The firebase SDK is mocked there too: it ships untranspiled ESM that jest cannot parse, and mocking matches how the app behaves without credentials (`firebaseAvailable === false`). Tests that need sharing should mock `@/src/firebase/FirebaseListService` directly.
- Use factory helpers from `utils/testFactories.ts` (`createTestPattern`, `createTestPatternList`, `createTestPatternType`) — do not inline raw object literals in tests. They already supply `modifiers: []` / `modifierRefs: []`, so new required fields belong there too.
- `IPattern.id` in tests should be a plain integer; `PatternType.id` / `IPatternList.id` / `IModifier.id` should use `generateUUID()`.
- **`tsconfig.jest.json` must not override `jsx`.** Expo's base sets `react-jsx` (the automatic runtime), and several components rely on it by importing only `FC`/`ReactNode` rather than `React`. An override to the classic `"react"` transform makes those files fail to compile under ts-jest with `TS2686: 'React' refers to a UMD global` — which surfaces only as `Failed to collect coverage from …` on stderr, does **not** fail the run, and quietly drops those files from the coverage report.
- **Timeouts are sized for a cold CI runner, not for a warm laptop.** `npm ci` wipes the Babel cache, so the first component test in a run transforms the whole React Native + Expo tree before it can render: a test that takes ~300ms warm takes ~3.5s with caches cleared, and more on a slower runner. Hence `testTimeout` of 60s for components, 30s for unit, and `asyncUtilTimeout` of 10s for RNTL's `waitFor` (whose 1s default would fail as a confusing assertion error instead of a timeout). Reproduce the cold path with `npx jest --clearCache && rm -rf node_modules/.cache` before assuming a CI-only failure is a fluke.
- **Coverage thresholds are a ratchet**, set just under measured reality so CI is green on arrival (`jest.config.js` → `coverageThreshold`). Raise them as suites land; never lower them. Three mechanics to know before touching them. A file with its own entry is **removed from the `global` pool**, so pinning well-covered files pushes the global number *down* — it measures the leftovers, not the project. A file imported by both projects is instrumented by two transforms, so its percentages drift between run modes; set a floor under the lowest of `npx jest --coverage`, `--ci --maxWorkers=2` and `--maxWorkers=1`. And the **global figure itself varies by several points between otherwise identical runs**, because that merge depends on which worker saw a shared file first — so measure it a few times and floor it under the worst, never under the best. The numbers jest prints when a threshold is *missed* are the ones to key off, not the summary table's — they use different denominators.
- **Both projects set `clearMocks: true`**, which resets call history *and* factory implementations before each test. A mock whose return value matters must (re)establish it in `beforeEach`, not only in the `jest.mock` factory — otherwise it returns `undefined` and code that calls `.catch()` on it fails in a way React reports as `window.dispatchEvent is not a function`.
- **`renderHookWithProviders`** (`utils/renderWithProviders.tsx`) mounts a hook in the same provider stack. Wait for `activeList` to be non-null before acting: the provider loads storage on mount, and an assertion like "zero patterns" is already true on the first render, before anything has loaded.
- **Mocking `FirebaseListService` means mocking `subscribeToSharedList` too**, not just `syncPublishedList` — a list with a `shareCode` activates the provider's live-subscription hook.
- **`firebaseAvailable` is `false` under jest**, always: it derives from `Constants.expoConfig.extra.firebase`, which jest-expo does not populate. That is at least consistent between a dev machine (which has a `.env`) and CI (which does not), but it means the sharing screens render their "not configured" branch by default. A suite that tests the *available* path mocks `@/src/firebase/firebaseConfig` with a getter it can flip, rather than depending on the environment — see `ShareListModal.test.tsx`.
- **`VideoCarousel` renders nothing until it is measured.** It keeps `containerWidth` at 0 and mounts its list only once `onLayout` fires, which nothing does under jest — fire it yourself (`fireEvent(view, "layout", { nativeEvent: { layout: { width: 320 } } })`) or the component looks empty and untestable.
- **A callback that is not a touch event** — `onViewableItemsChanged`, say — is invoked through the prop rather than `fireEvent`, so wrap it in `act()` or its state update never lands.
- **Never poll for a node's *absence* with `waitFor`.** `waitFor(() => expect(screen.queryByX(...)).toBeNull())` is unreliable on a loaded CI runner: it re-runs its check inside `act`, and under contention it can still be observing the pre-update tree when its budget expires — even though the state itself settled in tens of milliseconds. Wait on something positive instead — a node appearing, a mock being called, storage reaching its expected value — and then assert the absence synchronously. This cost a red CI run; it reproduces locally with `for i in $(seq 8); do (while :; do :; done) & done` to saturate the CPU.

- **A render helper must wait on something the _data_ produced, not on chrome.** `renderSelector` used to wait for the "Pattern Lists" header, which renders synchronously and therefore says nothing about whether the read from storage has landed; under CPU contention a run lost a list row between that wait and the assertion. Anchor on a value only the loaded data can produce (`await screen.findByText(lists[0].name)`). Where a screen loads from more than one key — `PatternListManager` reads `@patternLists` and `@patterns_<id>` separately — anchor on each, or the rows can still be missing while the chrome for the list is already up.

- **Reanimated and Gesture Handler are mocked by hand** (`__mocks__/react-native-reanimated.tsx`, `__mocks__/react-native-gesture-handler.tsx`), picked up automatically because they are node modules. Reanimated's real entry point initialises the worklets runtime on import, which under jest reaches a native module that does not exist and fails the suite before a test runs; its own shipped mock re-imports that entry point, so it does not help, and resolving worklets to its web build only moves the problem to Gesture Handler. The mocks are behavioural where it is useful — shared values really hold and update, and the gesture mock records every handler a component registers, so `peekGestures()` / `findGesture()` let a test call those handlers with synthetic events. That is how `ZoomableCanvas.test.tsx` covers the pan/pinch/zoom arithmetic. The same trick covers the node drag (`useNodeDrag.test.tsx`), including that it tracks the finger at every zoom. What no test here can cover: whether gestures arbitrate correctly, how motion feels, and whether a tap still reaches a node under a pan. Those are device checks.
- **The Android back button is testable.** Each `Modal` handles it through `onRequestClose`; `fireEvent(modal, "requestClose")` exercises that path, and it is a real user action worth covering rather than a formality.
- **`test.failing` marks a known defect**, passing while the bug exists and failing the moment it is fixed. `__tests__/unit/GraphLayoutInvariants.test.ts` uses it to pin the dangling-prerequisite and cycle defects (AGENT_TASKS.md B1/B2). Prefer it over deleting or skipping a test that documents real broken behaviour.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `master` and every PR, in three jobs:

- **verify** — `npm run lint`, `npm run format:check`, `npm run typecheck`, `npx jest --coverage --ci`.
- **bundle** — `npx expo export` for **both** `web` and `android`. Metro resolves `.web.tsx` over `.tsx`, so a bad import can break exactly one platform; web additionally builds an SSR bundle (static rendering is on) and surfaces such a fault twice. This is the gate that catches the class of problem described under "Platform-specific code".
- **audit** — fails if `npm audit` drifts from the documented baseline of exactly three moderate findings (see "Dependencies & security"). If a change to that baseline is intentional, update both the workflow's `expected` map and this file.

Run the same checks locally before pushing; every one of them passes on `master`.
