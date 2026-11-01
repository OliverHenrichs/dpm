# Graph views — `src/pattern/graph/`

Two switchable views (`ViewMode = "timeline" | "graph"`, declared once in `types/ViewMode.ts`,
selected in `PatternGraphScreen`, rendered by `GraphViewContainer` alongside `Legend`), both
driven by `IPattern.prerequisites[]`. Unqualified paths below are relative to
`src/pattern/graph/`.

## The graph model

**Both views render from one `GraphModel`, built once.** `buildGraphModel(patterns, patternTypes)` (`model/GraphModel.ts`) returns nodes, edges, the adjacency index, the depth map, the cycles and the type-colour map; `useGraphModel(patterns, patternTypes)` memoises it on the screen and hands it down. This is the contract every view, layout function and renderer agrees on — nothing derives depth, edges or colour for itself any more.

- `model/adjacency.ts` is the whole graph maths: `buildAdjacency` (indexes both directions and **drops prerequisite ids that match no pattern**, so no consumer guards against a dangling id), `collectDependents` / `collectPrerequisites` (BFS, cycle-safe), `findCycles` (iterative Tarjan, O(V + E)) and `buildDepthMap` (iterative longest-path DFS with memoisation). All iterative on purpose: a 5000-long chain must not blow the stack, and the detector this replaced enumerated every distinct path.
- A `GraphNode` carries `{ pattern, depth, foundational, color, inCycle }`. `foundational` is judged on _resolvable_ prerequisites, so a pattern pointing only at missing ids is a root.
- Keep the model pure and cheap. It is rebuilt on every change to the pattern set, and `PatternNode` takes a `GraphNode` rather than a bare pattern plus a colour map — that is what removed the `as any` casts at each call site.
- `model.cycles` is not just diagnostics: `CycleWarning.tsx` renders a banner above the graph when it is non-empty. Cycle detection used to run on every render and emit only a `console.warn`.

## Filtering

The graph screen filters through the same `PatternFilter` and `PatternFilterBottomSheet` the list screen uses (`usePatternFilter` lives in `src/pattern/filter/hooks/`, shared by both). `useGraphFilter` owns the filter and chain-mode state and produces the model to render.

**Never hand a filtered `patterns` array to a layout function.** The network layout places a node only once _every_ prerequisite is positioned, and `drawNodes` renders nothing for an unpositioned node — so one id pointing outside the shown set deletes that node and its whole subtree with no error. `filterGraphModel` (`model/filterGraphModel.ts`) exists to prevent that: it rewrites every surviving node's `prerequisites` against the shown set, turning a prerequisite hidden by the filter into an _elided_ edge onto the nearest shown ancestor (drawn dashed, `ELIDED_DASH`) or dropping it when there is none. `__tests__/unit/filterGraphModel.test.ts` holds this as a property over random graphs; do not weaken it.

- `selectSubgraph` decides which nodes appear: a multi-source BFS, O(V + E), with `matchesOnly` / `prerequisites` / `dependents` / `fullChain` and an optional radius. Only three of those are offered in the UI — see `types/ChainMode.ts` for why.
- **Depth stays on full-graph terms** so a node keeps its timeline column when a filter is toggled; that is why `calculateDynamicTimelineLayout` takes a `depthMap` rather than deriving one. `foundational` deliberately does not, because it anchors the network ellipse and must describe what is drawn. `cycles` stay full-graph too — data a filter hides is still corrupt.
- Context nodes (shown but not matched) dim via the group's `opacity`, never via `PatternNode`'s fill opacity, which already encodes level.
- The network view's initial zoom is fitted to the drawn content (`useGraphLayout`). It was a fixed 0.35, which leaves a filtered graph as a mostly empty canvas.
- Filter state is **not persisted**, deliberately: a filter that survives a navigation away is invisible on return and reads as "my patterns disappeared". It resets when the active list changes, adjusted during render rather than in an effect.

## Pan and zoom

The network view's canvas is `components/ZoomableCanvas.tsx` — Gesture Handler gestures driving Reanimated shared values, with the live transform published to descendants through `CanvasTransformContext`.

It replaced `@openspacelabs/react-native-zoomable-view`, which is implemented with `PanResponder`. **Do not reintroduce a `PanResponder`-based gesture here.** A node drag has to live in Gesture Handler's touch system, and the two systems do not negotiate — there is no `simultaneousHandlers` across that boundary, so whichever claimed a touch first won, non-deterministically from the user's point of view.

- Everything is on the UI thread: shared values and `useAnimatedStyle`, never `setState` from a handler.
- The transform array is `[{ translateX }, { translateY }, { scale }]`. Translate before scale, so offsets stay in screen pixels and a drag tracks the finger 1:1 at any zoom.
- Pinch reports _cumulative_ scale; the canvas converts it to a per-frame factor so pinch and pan can both write `translate` without fighting.
- **No `GestureHandlerRootView` is mounted in screens, deliberately.** On native the drawer supplies one (`react-native-drawer-layout`'s `Drawer.native` wraps its children); on web RNGH's root is a plain `View` plus a context flag. Nesting another around the graph would take that area out of the drawer's gesture tree. Inside a `Modal` it is the other way round (`src/common/AGENTS.md`).

## Manual layout

A user-arranged network layout is stored per list, per device, at `@graphLayout_{listId}`
(`data/GraphLayoutStorage.ts`, with the key itself in the import-free `data/GraphLayoutKeys.ts`
so `PatternListStorage` can clean it up without pulling in the reconciliation layer).

`model/resolveLayout.ts` merges what is stored with the patterns that exist now, and the rule that
matters is: **a pattern added since must be seeded near its prerequisites, never by re-running the
global layout.** Re-laying-out would be correct and would also throw away everything the user
arranged, every time they add a pattern. Stored positions are clamped to `MAX_GRAPH_COORDINATE` —
a node outside that box could not be dragged back, because it would never be on screen.

- A stored entry whose pattern no longer exists is reported as stale and pruned on save. Ordinary
  housekeeping now that ids are never reused — it used to be what stopped a stored position
  attaching to whichever pattern later inherited the id.
- **Filtering must not prune.** Filtering hides patterns, it does not delete them; `resolveLayout`
  reports them stale because it only sees the patterns it was handed, so the caller passes the
  _unfiltered_ set when deciding what to persist.
- A manual layout is **never written to the Firestore shared document**. A subscriber's
  arrangement is theirs, and a published list is pushed after every edit (`usePatternCrud`), so a
  layout in there would fire a network write on every drag.
- Dragging is allowed on read-only lists. It is a local view preference, not a content edit, so it
  is a deliberate exception to the `isReadonly` guard every mutating path has.

## Dragging a node

Long-press a node in the network view and drag it; the position is persisted on release.

**Nodes in the network view have no `onPress`, and must not get one.** `onPress` on an SVG element installs React Native's full Touchable responder set — `onStartShouldSetResponder` claims the touch, and `onResponderTerminationRequest` refuses to yield it — so a touch landing on a node never reaches Gesture Handler. That is why long-press-to-drag did nothing on a node while panning from empty canvas worked, and it was only found on a device. The network view draws inert nodes and handles **both** tap and drag in the gesture system; the timeline, which has no canvas gesture to compete with, still uses `onPress`.

Because the node tap is a Gesture Handler tap now, **the canvas has no double-tap-to-zoom**. The two cannot both be fast: a single tap would have to wait for a double tap to fail before it could open a pattern, which is the screen's most common interaction. Pinch remains, and the initial zoom is fitted to the content.

**One pan gesture on the canvas hit-tests, rather than a gesture per node** (`hooks/useNodeDrag.ts`, `model/graphCoordinates.ts`). Nodes are SVG elements, so a `GestureDetector` per node means a detector inside an `<Svg>` — fragile on native, and colliding with the web build's hand-bound click listeners. Hit testing against positions we already have is pure and testable, and arbitration is still Gesture Handler's job: the drag is _raced_ against the canvas's own gestures, not made exclusive, so a plain drag pans immediately instead of waiting for a long press to fail.

- **Screen deltas are divided by the live zoom.** Without that a dragged node lags the finger above 1:1 and outruns it below. The zoom is read from the shared value each frame rather than captured at gesture start.
- `draggingId` is React state, set once at the start of a drag and cleared at the end. **Nothing re-renders per frame**: only the dragged node and the edges touching it follow a shared value, so the per-frame cost is a handful of worklets whatever the size of the graph (`render/DragOverlay.tsx`, `render/DraggedEdge.tsx`).
- **The dragged node is drawn in its own `Animated.View` above the graph, not as an animated `<G>` inside the main `<Svg>`.** Animating an SVG group's transform props made the node disappear for the duration of the drag on device, while its edges followed correctly. A `View` transform is reliable everywhere, so the node is lifted into a small SVG of its own and the view moves; `drawNodes` skips it meanwhile so it does not ghost at its old position.
- **The lift is not decoration.** The scale-up is what tells the user a node has been picked up, since a haptic is never the only feedback (`src/common/ui/AGENTS.md`).
- A long press on empty canvas pans instead of doing nothing — the drag has already won the race by then, so the canvas pan will not fire.
- **The gesture has no affordance**, so `components/GraphDragHint.tsx` says so in words. It was reported as "how would I move the graph items?" the first time it reached a device. Do not remove it without replacing the cue with something else.
- **The canvas is measured from the positions actually drawn** (`model/canvasMetrics.ts`), not from the automatic layout — a node dragged beyond the automatic bounds would fall outside the SVG and stop being drawn. Those positions are deliberately _not_ re-normalised: that would shift every node whenever one was dragged past an edge. Positions are clamped at both ends (`MIN_GRAPH_COORDINATE`/`MAX_GRAPH_COORDINATE`) for the same reason.

**No arrow functions inside a gesture or animated-style worklet.** The app builds with the React Compiler, which hoists an inline function that captures nothing (`bands.map((b) => b.y + b.height / 2)`) out to module scope as `_tempN`. There it is a plain JS function, and calling it on the UI thread crashes with "Tried to synchronously call a Remote Function" on device. Jest runs neither the compiler nor the worklet runtime, so tests pass. Work such values out on the JS thread before building the gesture and capture them as data (`useLaneDrag` does), or call a `"worklet"` helper.

**`generateOrthogonalPath` and the helpers it calls are worklets, and their position in `utils/GraphUtils.ts` is load-bearing.** The worklets Babel plugin rewrites a `"worklet"` function declaration into a `var` assigned from a factory that closes over its helpers _by value at the point the declaration appears_. Declared above its helpers, such a function captures `undefined` and throws `getConnectionPoint is not a function` the first time an edge is drawn — on device as well as under test, and function hoisting does not save it because there is no longer a declaration to hoist. If you add a helper there, mark it `"worklet"` and define it above its callers.

## The focus preview

A mark sits fixed in the middle of the network view (`render/FocusMark.tsx`: a ring in After
Hours, four corner brackets in Clipboard, `theme.graph.focusMark`). Once the user has panned,
whatever pattern box touches it is previewed in a card above the legend button
(`components/FocusPreviewCard.tsx`); panning on passes the focus to the next box and the two cards
cross-fade. Releasing the pan eases the focused box into the middle and firms the card up with a
"Tap to open"; a tap on the card (or on the mark) opens `PatternDetailsModal`.

- **Tracked on the UI thread.** `hooks/useFocusPreview.ts` reacts to the canvas's shared values
  and tells React only when the focus changes hands; `model/focus.ts` is the pure part
  (`pickFocus`, `focusAtCentre`, `translationToCentre`), unit-tested. The mark's reach,
  `FOCUS_RADIUS`, is in screen pixels, so it is the same at every zoom.
- **The current focus holds while it still touches.** Handing it to whichever box is a pixel nearer
  flickered between two neighbours on a slow pan.
- **Nothing shows until the first pan.** The view opens fitted to the whole graph, and a card
  before the user has done anything is noise. Opening a pattern puts the preview away until the
  next pan.
- **The video is the pattern's first, muted, looping, without controls, and only after the focus
  has rested on it for `PREVIEW_VIDEO_DWELL_MS`** (`components/FocusPreviewVideo.tsx`): each
  player costs a decoder. YouTube and Vimeo links stay a still. The player unmounts when the Map
  tab loses focus and when the details open, which bring their own. To drop the video, render
  the still alone there.
- The pan reports its start and end to the focus through `ZoomableCanvas`'s `onPanStart` /
  `onPanEnd` worklets; the mark is passed as its `overlay`, fixed to the viewport and inert.

## The web split

`PatternNodeGroup.tsx` is the tappable `<G>` around a graph node. On native it just sets
`onPress`; on web that would make react-native-svg spread six react-native responder handlers onto
the DOM node, one React console error each, per node — so `PatternNodeGroup.web.tsx` takes the DOM
node through `forwardedRef` and binds the listener itself. Route node presses through this
component rather than putting `onPress` on an SVG element directly. These console errors only
appear with a populated graph, so check a list that actually has patterns.

## Node boxes follow the app style

`render/NodeFrame.tsx` draws a pattern's box from `theme.graph` (`tokens.ts`), after the style
mockups' Map screens: After Hours outlines a rounded box in the type colour, with a soft halo in
its dark theme; Clipboard draws a square box on the neutral `border` rule with the type colour in
a bar down its left edge. Edges (`render/edgeStyle.ts`) take the accent in After Hours and the
muted rule in Clipboard; lane labels take the list's section style. Node text uses the
`nodeTitle` / `nodeMeta` text styles.

- **Level is a tint of the type colour mixed into the surface** (`model/nodeFrame.ts`), one solid
  fill so edges don't show through. `levelTints(n)` spreads the list's levels from the lightest
  to the darkest built-in tint (three levels keep 0.1 / 0.22 / 0.36 exactly, one level takes the
  middle); the model resolves each node's `tint` from the list's level ids (`buildGraphModel`'s
  third argument), and no level or one the list lacks draws as the lightest. The tints are capped by `__tests__/unit/nodeFrame.test.ts`:
  the node text must hold 4.5:1 over every palette type colour in every theme. That is also why
  the counts are in `text`, not `textMuted`.
- `Legend` draws its samples with `NodeFrame` itself, so it matches whatever the style draws, one
  level row per level of the active list.

## Node badges

A node marks what it has: a play triangle when the pattern (or one of its modifier combinations) has video, and up to three dots for attached modifiers. `model/nodeBadges.ts` decides; `render/NodeBadges.tsx` draws.

- **They live inside the existing 100×60 box.** `NODE_WIDTH`/`NODE_HEIGHT` feed the timeline's swimlane sizing and its collision-avoidance pass, so node size is not a free variable — growing a node moves the timeline layout everywhere.
- **Shapes, not glyphs from a font.** A triangle and circles render identically on every device; an emoji or a box-drawing character depends on what is installed. `Legend` draws the same shapes so it always matches the graph.
- **Coloured with the node's type colour**, never a secondary-text grey: the fill carries more of the type colour the higher the level, and grey washes out on an advanced pattern.
- **The corner inset is the style's `theme.graph.badgeInset`.** After Hours' rounded corner would cut through marks set at Clipboard's square-corner inset; `nodeBadgeRender.test.tsx` checks every mark against the outline's inner edge with a dot's width of clear space; merely inside the curve (inset 5) still overlapped the line on a device.
- **Every shape is positioned by its bounding box, on both axes.** Taking the right edge of one and the centre line of another looks correct in code and is visibly lopsided on a device — it happened twice, once to each badge. The shapes are written symmetrically about their own centre lines so the insets are a testable property rather than true by construction.
- The dots take the corner themselves when there is no video mark, and share the triangle's centre line when there is. Always sharing it would hang them the triangle's height above the bottom edge with nothing underneath.
- **A foundational node's badges step in further** (`FOUNDATIONAL_FRAME_INSET`), because its inner frame is itself at that inset and the badges would otherwise rest on that line.
- **Dot spacing is set by what survives being zoomed out**, not by what looks right at 1:1. At 1.5px apart the dots merged into one blob at the zoom the graph actually opens at; they now have a full dot's width of clear space. Anything drawn here has the same constraint — the network view fits a whole list on screen by default.
- Only _attached_ modifiers are counted. A universal modifier applies to every pattern in the list, so badging one would mark every node and say nothing.

## Reordering the timeline's lanes

Long-press a lane's grip (left of its name) and drag it up or down; the lanes reflow as it passes
them, and the drop saves the order on the list as `IPatternList.laneOrder` (Oliver's call on
tester review 2, point 9). The header's _Reset lanes to automatic order_ (timeline only, shown
only while there is a manual order) removes the key.

- **A field, not a reordered `patternTypes`.** The list's type order is also the legend's, the
  filter chips' and the List tab's section order, and the automatic lane order breaks ties by it;
  a drag in the timeline must not reshuffle those, and "back to automatic" needs to know that
  there is a manual order at all. Absent means automatic. It is published with the list (the
  owner's lanes are the subscribers' lanes) and exported since 3.10.
- **What `orderLanes` does with it:** the types it names first, in its order; types it does not
  name (added since) after them, in their automatic order; ids of types gone are ignored. A type
  with nothing shown still gets no lane. `reorderLanes` turns the dropped order of the lanes
  _shown_ into one over every type, so lanes a filter hides keep their places.
- **One pan over a column that never moves** (`hooks/useLaneDrag.ts`,
  `components/LaneHandles.tsx`), hit-testing which lane it picked up, rather than a gesture per
  grip: the grips move with the reflow, and a gesture whose view moves mid-drag measures against
  the moved view. The lanes' centres are captured at pick-up for the same reason, so the drop
  target (`laneIndexAt`, a worklet) does not shift as the lanes reflow. React hears of the drag
  once per lane passed, never per frame.
- **The column stops short of the first node column**
  (`LANE_HANDLE_WIDTH` < `LEFT_MARGIN - NODE_WIDTH / 2`), so it never takes a node's tap; it
  scrolls sideways with the lanes.
- **Arbitration:** the timeline's two scroll views are Gesture Handler's, so the long-press pan
  and the scrolling negotiate in one system (a swipe moves before the long press and scrolls; a
  held press picks up), and both scroll views stop scrolling while a lane is held. Long press is
  `DRAG_ACTIVATION_MS`, as for a node. There is no canvas gesture here to race.
- Haptics as for a node (Medium on pick-up, Light on drop); the lifted name is the cue that does
  not need hardware. Screen readers move a lane one place with the grip's _Move up_ / _Move
  down_ actions.
- **Read-only lists get no grips** and no reset: the order is part of the list, unlike the
  network view's manual layout, so dragging it is an edit.
- No auto-scroll at the edges yet: a lane is moved past the screen in steps.

## The views

- **Timeline** (`TimelineView.tsx`) — swimlane by `PatternType`, left-to-right by `node.depth` (`calculateDynamicTimelineLayout` in `utils/TimelineGraphUtils.ts`); skip-level edge routing handled by `utils/CollisionAvoidanceUtils.ts`. Lanes come from `orderLanes` (`utils/laneOrder.ts`): only types with a pattern shown get one (a filtered-out type left an empty band), in the user's order when the list has one (below), otherwise ordered to keep linked types adjacent (every order up to seven lanes, a barycentre pass and single moves above), ties in the list's own order.
- **Network roots** go round the ellipse grouped by type (`getFoundationalPatterns`), so unlinked patterns of one type sit together. Only the automatic layout; a stored manual one is untouched.
- **The legend opens by itself the first time** the Map is shown (`isLegendSeen` in `data/GraphHintStorage.ts`, app-wide like the drag hint); the dots and triangle mean nothing to someone who never presses "Legend".
- **The legend recolours types** on a list the user may edit: each type row opens the palette list settings use (`TypeColorSwatches` from `src/pattern/list/`) and saves through `usePatternCrud.setPatternTypeColor`. `PatternGraphScreen` passes `onChangeTypeColor` only when the list is not read-only, so a subscribed list's legend stays a plain key. The tester of review 2 never found the colour dot in list settings.
- **Network** (`NetworkGraphView.tsx`) — force-free hierarchical layout (`calculateGraphLayout` in `utils/NetworkGraphUtils.ts`), driven by the `useGraphLayout` hook (`hooks/useGraphLayout.ts`)

Both draw through the shared primitives in `render/GraphPrimitives.tsx` (`ArrowheadMarker`, `drawEdges`, `drawNodes`) rather than one view importing from its sibling. `GraphSvg.tsx` is now just the network view's `<Svg>` around those primitives.

`utils/GenericGraphUtils.ts` keeps only what is needed _outside_ the views — `findIneligiblePrerequisiteIds` (the editor's cycle guard) and `repairDanglingPrerequisites` (storage's repair-on-read) — and both delegate to `model/adjacency.ts`. `utils/GraphUtils.ts` holds `LayoutPosition` and the path geometry (`generateOrthogonalPath` / `generateSkipLevelPath`). Layout constants (`NODE_HEIGHT`, `HORIZONTAL_SPACING`, …) are centralised in `types/Constants.ts`; the shared SVG props contract is `IGraphSvgProps` in `types/IGraphSvgProps.ts`. Tapping a node opens `PatternDetailsModal` → `PatternDetails`.

## Prerequisite integrity

`IPattern.prerequisites` is the data model — both graph views are built from it — and two ways of
corrupting it used to make patterns disappear from the network view while the list and timeline
still showed them. Three rules keep that shut, all built on the helpers in
`utils/GenericGraphUtils.ts`:

- **Never remove a pattern without scrubbing references to it.** `deletePattern` (`usePatternCrud`) composes deletion
  as `repairDanglingPrerequisites(patterns.filter(...))` rather than filtering alone. The helper
  returns the same array reference when there is nothing to repair, so the healthy path is free.
- **`loadPatterns` repairs on read**, so lists corrupted by older builds heal themselves as they
  load. Keep it even though there is a migration runner now: a migration runs once, and this also
  catches data arriving from an import or a cloud subscription, which never passes through one.
- **The prerequisite picker refuses cycles.** `findIneligiblePrerequisiteIds(patterns, id)` returns
  the pattern plus everything that already depends on it; `EditPatternForm` disables those chips.
  Note the direction: `P.prerequisites = [Q]` means Q comes _before_ P, so the edge runs Q → P and
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

## The pattern details view

**Editing from the Map.** On a list the user may edit, the details' header has _Edit Figure_,
which opens the List tab's form (`EditPatternModal`, `src/pattern/list/`) over the Map; on a
subscribed list whose owner takes changes (`canSuggestEditsTo`) it has _Suggest a change_
(`SuggestPatternModal` with `editing`) instead, and otherwise nothing. The details step aside
while either is open (two React Native modals at once is not something to rely on) and come
back when it closes; `PatternGraphScreen` holds the open figure by id, so they show the figure as
saved.

`PatternDetails` is shared by two hosts: `PatternListItem`, where it expands directly under a row, and `PatternDetailsModal`, which the graph opens on a node tap. That is why the top rule is a prop (`showTopSeparator`) — it separates the row from its detail in the list, and duplicates the modal header's rule in the modal.

- **The modal's card is sized to its content**, capped at 80% of the screen rather than fixed at it. React Native puts `flexGrow: 1` on a ScrollView's content container, so both the ScrollView's own style _and_ its `contentContainerStyle` need `flexGrow: 0` or the card fills its whole allowance however little is in it.
- **Empty sections are not all alike.** Prerequisites and "builds into" say so explicitly when empty — "nothing comes before this" answers a question someone opened a _graph_ detail view to ask. Tags render nothing at all, because an absent tag list carries no information and a bare label is just height.
- **Backdrop tap dismisses through a sibling `Pressable` behind the card**, so the video player's controls inside keep working; see "Dismissal touches" in `src/common/AGENTS.md`.
