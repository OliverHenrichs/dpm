# Graph views — `src/pattern/graph/`

Two switchable views (`ViewMode = "timeline" | "graph"`, declared once in `types/ViewMode.ts`,
selected in `PatternGraphScreen`, rendered by `GraphViewContainer` alongside `Legend`), both
driven by `IPattern.prerequisites[]`. Unqualified paths below are relative to
`src/pattern/graph/`.

## The graph model

**Both views render from one `GraphModel`, built once.** `buildGraphModel(patterns, patternTypes)` (`model/GraphModel.ts`) returns nodes, edges, the adjacency index, the depth map, the cycles and the type-colour map; `useGraphModel(patterns, patternTypes)` memoises it on the screen and hands it down. This is the contract every view, layout function and renderer agrees on — nothing derives depth, edges or colour for itself any more.

- `model/adjacency.ts` is the whole graph maths: `buildAdjacency` (indexes both directions and **drops prerequisite ids that match no pattern**, so no consumer guards against a dangling id), `collectDependents` / `collectPrerequisites` (BFS, cycle-safe), `findCycles` (iterative Tarjan, O(V + E)) and `buildDepthMap` (iterative longest-path DFS with memoisation). All iterative on purpose: a 5000-long chain must not blow the stack, and the detector this replaced enumerated every distinct path.
- A `GraphNode` carries `{ pattern, depth, foundational, color, inCycle }`. `foundational` is judged on *resolvable* prerequisites, so a pattern pointing only at missing ids is a root.
- Keep the model pure and cheap. It is rebuilt on every change to the pattern set, and `PatternNode` takes a `GraphNode` rather than a bare pattern plus a colour map — that is what removed the `as any` casts at each call site.
- `model.cycles` is not just diagnostics: `CycleWarning.tsx` renders a banner above the graph when it is non-empty. Cycle detection used to run on every render and emit only a `console.warn`.

## Filtering

The graph screen filters through the same `PatternFilter` and `PatternFilterBottomSheet` the list screen uses (`usePatternFilter` lives in `src/pattern/filter/hooks/`, shared by both). `useGraphFilter` owns the filter and chain-mode state and produces the model to render.

**Never hand a filtered `patterns` array to a layout function.** The network layout places a node only once *every* prerequisite is positioned, and `drawNodes` renders nothing for an unpositioned node — so one id pointing outside the shown set deletes that node and its whole subtree with no error. `filterGraphModel` (`model/filterGraphModel.ts`) exists to prevent that: it rewrites every surviving node's `prerequisites` against the shown set, turning a prerequisite hidden by the filter into an *elided* edge onto the nearest shown ancestor (drawn dashed, `ELIDED_DASH`) or dropping it when there is none. `__tests__/unit/filterGraphModel.test.ts` holds this as a property over random graphs; do not weaken it.

- `selectSubgraph` decides which nodes appear: a multi-source BFS, O(V + E), with `matchesOnly` / `prerequisites` / `dependents` / `fullChain` and an optional radius. Only three of those are offered in the UI — see `types/ChainMode.ts` for why.
- **Depth stays on full-graph terms** so a node keeps its timeline column when a filter is toggled; that is why `calculateDynamicTimelineLayout` takes a `depthMap` rather than deriving one. `foundational` deliberately does not, because it anchors the network ellipse and must describe what is drawn. `cycles` stay full-graph too — data a filter hides is still corrupt.
- Context nodes (shown but not matched) dim via the group's `opacity`, never via `PatternNode`'s fill opacity, which already encodes level.
- The network view's initial zoom is fitted to the drawn content (`useGraphLayout`). It was a fixed 0.35, which leaves a filtered graph as a mostly empty canvas.
- Filter state is **not persisted**, deliberately: a filter that survives a navigation away is invisible on return and reads as "my patterns disappeared". It resets when the active list changes, adjusted during render rather than in an effect.

## Pan and zoom

The network view's canvas is `components/ZoomableCanvas.tsx` — Gesture Handler gestures driving Reanimated shared values, with the live transform published to descendants through `CanvasTransformContext`.

It replaced `@openspacelabs/react-native-zoomable-view`, which is implemented with `PanResponder`. **Do not reintroduce a `PanResponder`-based gesture here.** A node drag has to live in Gesture Handler's touch system, and the two systems do not negotiate — there is no `simultaneousHandlers` across that boundary, so whichever claimed a touch first won, non-deterministically from the user's point of view.

- Everything is on the UI thread: shared values and `useAnimatedStyle`, never `setState` from a handler. Use `.get()` / `.set()`, not `.value` — the React Compiler is on and cannot see through bare `.value` access.
- The transform array is `[{ translateX }, { translateY }, { scale }]`. Translate before scale, so offsets stay in screen pixels and a drag tracks the finger 1:1 at any zoom.
- Pinch reports *cumulative* scale; the canvas converts it to a per-frame factor so pinch and pan can both write `translate` without fighting.
- **No `GestureHandlerRootView` is mounted in `src/`, deliberately.** On native the drawer supplies a real one (`react-native-drawer-layout`'s `Drawer.native` renders one around its children, so every screen is inside it). On web RNGH's root view is a plain `View` plus a context flag, so gestures work without one. Nesting another around the graph would take that area out of the drawer's own gesture tree.

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
  *unfiltered* set when deciding what to persist.
- A manual layout is **never written to the Firestore shared document**. A subscriber's
  arrangement is theirs, and `syncPublishedList` runs after every pattern CRUD — a layout in there
  would fire a network write on every drag.
- Dragging is allowed on read-only lists. It is a local view preference, not a content edit, so it
  is a deliberate exception to the `isReadonly` guard every mutating path has.

## Dragging a node

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

**`generateOrthogonalPath` and the helpers it calls are worklets, and their position in `utils/GraphUtils.ts` is load-bearing.** The worklets Babel plugin rewrites a `"worklet"` function declaration into a `var` assigned from a factory that closes over its helpers *by value at the point the declaration appears*. Declared above its helpers, such a function captures `undefined` and throws `getConnectionPoint is not a function` the first time an edge is drawn — on device as well as under test, and function hoisting does not save it because there is no longer a declaration to hoist. If you add a helper there, mark it `"worklet"` and define it above its callers.

## The web split

`PatternNodeGroup.tsx` is the tappable `<G>` around a graph node. On native it just sets
`onPress`; on web that would make react-native-svg spread six react-native responder handlers onto
the DOM node, one React console error each, per node — so `PatternNodeGroup.web.tsx` takes the DOM
node through `forwardedRef` and binds the listener itself. Route node presses through this
component rather than putting `onPress` on an SVG element directly. These console errors only
appear with a populated graph, so check a list that actually has patterns.

## Node badges

A node marks what it has: a play triangle when the pattern (or one of its modifier combinations) has video, and up to three dots for attached modifiers. `model/nodeBadges.ts` decides; `render/NodeBadges.tsx` draws.

- **They live inside the existing 100×60 box.** `NODE_WIDTH`/`NODE_HEIGHT` feed the timeline's swimlane sizing and its collision-avoidance pass, so node size is not a free variable — growing a node moves the timeline layout everywhere.
- **Shapes, not glyphs from a font.** A triangle and circles render identically on every device; an emoji or a box-drawing character depends on what is installed. `Legend` draws the same shapes so it always matches the graph.
- **Coloured with the node's type colour**, never a secondary-text grey: the fill opacity already varies by level (0.3 / 0.5 / 0.7) and grey washes out on an advanced pattern.
- **Every shape is positioned by its bounding box, on both axes.** Taking the right edge of one and the centre line of another looks correct in code and is visibly lopsided on a device — it happened twice, once to each badge. The shapes are written symmetrically about their own centre lines so the insets are a testable property rather than true by construction.
- The dots take the corner themselves when there is no video mark, and share the triangle's centre line when there is. Always sharing it would hang them the triangle's height above the bottom edge with nothing underneath.
- **A foundational node's badges step in further**, because its inner double border is itself at inset 3 and the badges would otherwise rest on that line.
- **Dot spacing is set by what survives being zoomed out**, not by what looks right at 1:1. At 1.5px apart the dots merged into one blob at the zoom the graph actually opens at; they now have a full dot's width of clear space. Anything drawn here has the same constraint — the network view fits a whole list on screen by default.
- Only *attached* modifiers are counted. A universal modifier applies to every pattern in the list, so badging one would mark every node and say nothing.

## The views

- **Timeline** (`TimelineView.tsx`) — swimlane by `PatternType`, left-to-right by `node.depth` (`calculateDynamicTimelineLayout` in `utils/TimelineGraphUtils.ts`); skip-level edge routing handled by `utils/CollisionAvoidanceUtils.ts`
- **Network** (`NetworkGraphView.tsx`) — force-free hierarchical layout (`calculateGraphLayout` in `utils/NetworkGraphUtils.ts`), driven by the `useGraphLayout` hook (`hooks/useGraphLayout.ts`)

Both draw through the shared primitives in `render/GraphPrimitives.tsx` (`ArrowheadMarker`, `drawEdges`, `drawNodes`) rather than one view importing from its sibling. `GraphSvg.tsx` is now just the network view's `<Svg>` around those primitives.

`utils/GenericGraphUtils.ts` keeps only what is needed *outside* the views — `findIneligiblePrerequisiteIds` (the editor's cycle guard) and `repairDanglingPrerequisites` (storage's repair-on-read) — and both delegate to `model/adjacency.ts`. `utils/GraphUtils.ts` holds `LayoutPosition` and the path geometry (`generateOrthogonalPath` / `generateSkipLevelPath`). Layout constants (`NODE_HEIGHT`, `HORIZONTAL_SPACING`, …) are centralised in `types/Constants.ts`; the shared SVG props contract is `IGraphSvgProps` in `types/IGraphSvgProps.ts`. Tapping a node opens `PatternDetailsModal` → `PatternDetails`.


## Prerequisite integrity

`IPattern.prerequisites` is the data model — both graph views are built from it — and two ways of
corrupting it used to make patterns disappear from the network view while the list and timeline
still showed them. Three rules keep that shut, and all three live in
`src/pattern/graph/utils/GenericGraphUtils.ts`:

- **Never remove a pattern without scrubbing references to it.** `deletePattern` composes deletion
  as `repairDanglingPrerequisites(patterns.filter(...))` rather than filtering alone. The helper
  returns the same array reference when there is nothing to repair, so the healthy path is free.
- **`loadPatterns` repairs on read**, so lists corrupted by older builds heal themselves as they
  load. Keep it even though there is a migration runner now: a migration runs once, and this also
  catches data arriving from an import or a cloud subscription, which never passes through one.
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


## The pattern details view

`PatternDetails` is shared by two hosts: `PatternListItem`, where it expands directly under a row, and `PatternDetailsModal`, which the graph opens on a node tap. That is why the top rule is a prop (`showTopSeparator`) — it separates the row from its detail in the list, and duplicates the modal header's rule in the modal.

- **The modal's card is sized to its content**, capped at 80% of the screen rather than fixed at it. React Native puts `flexGrow: 1` on a ScrollView's content container, so both the ScrollView's own style *and* its `contentContainerStyle` need `flexGrow: 0` or the card fills its whole allowance however little is in it.
- **Empty sections are not all alike.** Prerequisites and "builds into" say so explicitly when empty — "nothing comes before this" answers a question someone opened a *graph* detail view to ask. Tags render nothing at all, because an absent tag list carries no information and a bare label is just height.
- **Backdrop tap dismisses via a sibling `Pressable` behind the card, never a wrapper around it.** A press handler wrapping content claims the touch, and native children never receive it — the video player's controls stopped responding inside this modal while the same details rendered in a list row were fine. A sibling only receives touches where it is the topmost view, which is exactly outside the card. `BottomSheet` still uses the nested-`Pressable` form; that works for ordinary touchables, which win the responder over an ancestor, but do not put a native player inside it without changing it to this shape.

