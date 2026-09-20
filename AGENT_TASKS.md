# AGENT_TASKS.md

Triaged backlog for DancePatternMapper. The raw idea list (previous revision of this file) has
been categorised by size, with full writeups for the large items.

**How this file is meant to be read.** Every claim about the current code is backed by a
`file.ts:line` reference that was checked against the working tree at commit `3c65d51`. Where a
claim needs verification on a device or against a generated native project, it is marked
**[verify]** rather than asserted. Effort estimates are engineer-days for one person already
familiar with the codebase, including tests and review — they are estimates, not commitments.

**Sizing rubric**

| Size | Meaning |
|---|---|
| **S** | ≤ 1 day. One or two files, no new types, no new dependency, no data-format change. |
| **M** | 2–5 days. Several files or one new component; may touch a shared contract; no data migration. |
| **L** | ≥ 1 week. New architecture layer, new dependency, data-format or storage change, or platform/legal surface. Gets a writeup below. |

---

## 1. Triage summary

### The original list

| # | Idea (as written) | Size | Status | Where it goes |
|---|---|---|---|---|
| 1 | Don't focus the pattern-list name right after picking a starting point — the keyboard hides too much | **S** | ✅ done | [S1](#s1--stop-auto-focusing-the-list-name-field--done) |
| 2 | App's swipe-left gesture fights the OS back gesture | **M** | open | [M1](#m1--stop-the-apps-horizontal-gestures-fighting-the-os-back-gesture) |
| 2b | Searchable/filterable pattern graph (only show direct chains of filtered figures) | **L** | open | [L1](#l1--searchable--filterable-pattern-graph) |
| 3 | Moveable patterns in network graph | **L** | open | [L2](#l2--moveable-patterns-in-the-network-graph) |
| 4 | Show video and modifier availability in the graph; show modifiers in details when clicked | **M** | ◐ details half done ([B7](#b7--the-graphs-detail-modal-can-never-show-modifiers--done)) | [M2](#m2--surface-video-and-modifier-availability-in-the-graph) |
| 5 | Make home-button field larger | **S** | ✅ done | [S2](#s2--enlarge-the-home-button-target--done) |
| 6 | AI comic-style anonymised videos (BYOK, 30 s cap, cost warning) | **L** | open | [L3](#l3--ai-anonymised-comic-style-videos) |

Note on item 4: half of it is a one-line fix (`PatternDetailsModal` never passes `modifiers`
down, so the graph's detail view renders a permanently empty modifier strip — see
[B7](#b7--the-graphs-detail-modal-can-never-show-modifiers--done)). The other half — badges on graph
nodes — touches the node renderer shared by both graph views, so the item as a whole is M.

### Added during triage

Reading the code to size the above surfaced work that is not in the original list but that the
large items depend on, plus a set of defects. Nothing here is speculative; each entry names the
evidence.

| # | Item | Size | Status | Why it's here |
|---|---|---|---|---|
| [F1](#f1--test-infrastructure-and-ci--in-progress) | Test infrastructure and CI | **L** | ◐ in progress | 3 test files / 529 lines against ~12 900 lines of source; component testing was installed but could not run; no CI at all. Gates every other item. |
| [F2](#f2--graph-domain-layer) | Graph domain layer | **M–L** | open | L1 and L2 both need a stable graph model; today the views own the computation and paper over it with `as any`. |
| [F3](#f3--storage-schema-versioning-and-import-validation) | Storage schema versioning + import validation | **M** | open | No schema version, no migration runner, no validation of imported files, lossy concurrent writes. L2 and L3 both add persisted data. |
| [B1](#b1--deleting-a-pattern-leaves-dangling-prerequisite-ids) | Deleting a pattern leaves dangling prerequisite ids | **M** | open — now reproduced by a `test.failing` | Makes patterns silently vanish from the network graph, and lets a recycled id inherit stale links. |
| [B2](#b2--no-cycle-prevention-when-editing-prerequisites) | No cycle prevention when editing prerequisites | **S–M** | open — now reproduced by a `test.failing` | Same failure mode as B1: nodes in a cycle are never laid out. |
| [B3](#b3--pattern-delete-confirmation-is-hardcoded-english--done-was-misdiagnosed) | ~~Delete confirmation is hardcoded English~~ dead helper + dropped `{{name}}` | **S** | ✅ done | Was misdiagnosed in triage — see the entry. |
| [B4](#b4--the-pattern-list-is-not-virtualised--done) | Pattern list is not virtualised | **S** | ✅ done | `ScrollView` + `.map`, each row mounting thumbnails. |
| [B5](#b5--clearalldata-orphans-every-pattern-key--done) | `clearAllData` orphans every pattern key | **S** | ✅ done | Acknowledged in a code comment. |
| [B6](#b6--camera-and-media-config-plugins-are-not-registered--done-confirmed-and-worse-than-filed) | Camera/media config plugins not registered | **S** | ✅ done | Confirmed — and iOS prebuild was blocked outright by a missing `bundleIdentifier`. |
| [B7](#b7--the-graphs-detail-modal-can-never-show-modifiers--done) | Graph detail modal never receives `modifiers` | **S** | ✅ done | Half of original item 4. |
| [B8](#b8--imported-videos-overwrite-each-other--done) | Imported videos overwrite each other | **S** | ✅ done | A pattern with two local videos lost one on every import. Found by the new round-trip suite. |

### Suggested sequencing

```
Phase 0  F1 ◐ ──────────────────────────────────────────►  (nothing else is safe without it)
Phase 1  S1✅ S2✅ B3✅ B4✅ B5✅ B6✅ B7✅        F3         (quick wins + data safety)
Phase 2  B1  B2  M1  M2                        F2          (defects + the graph model)
Phase 3  L1 ──────────────► L2                             (needs F2)
Phase 4  L3 (spike first) ─────────────────────►           (needs F3, independent of L1/L2)
```

**Phase 1 is complete.** Phase 0 (F1) has its infrastructure in place — see the F1 entry for what
landed and what is still outstanding.

L1 before L2: filtering changes which nodes exist, and manual node positions have to reconcile
against a changing node set. Building L2 first means building the reconciliation twice.

---

## 2. Small changes

### S1 — Stop auto-focusing the list-name field — DONE

**Done:** removed `autoFocus`. Kept it unconditional (not `autoFocus={isEditMode}`) — a field that
focuses on one path and not another is the kind of thing that surprises people later. The
placeholder still carries the template name, so an untouched field creates a sensibly named list.

**Evidence:** `src/pattern/list/PatternListTemplateModal.tsx:347` — the name `TextInput` in the
configure step has `autoFocus`. The step is reached immediately after choosing a template, so the
keyboard opens over the pattern-types and starter-patterns sections below it.

**Change:** remove `autoFocus`. The field already carries a placeholder from the template name
(`t(selectedTemplate?.nameKey ?? "templateBlankName")`), so an untouched field still creates a
sensibly named list.

**Worth doing at the same time:** the edit path opens the same component straight into
`"configure"` (`PatternListTemplateModal.tsx:163`). There, focusing the name field is arguably
right — the user came to rename something. If that distinction is wanted, pass
`autoFocus={isEditMode}`. Recommend plain removal first and only add the conditional if the user
asks; a conditional autofocus is a thing that surprises people later.

**Test:** with F1 in place, a render test asserting the input is not focused on the create path.

---

### S2 — Enlarge the home-button target — DONE

**Done:** icon 32→40 px with 8 pt padding on the button, giving a 56 pt visual target before
`hitSlop` (which is kept). Added `paddingRight: 8` to the header so both ends inset equally, since
the hamburger already carried `padding: 8`. The absolutely-positioned title is centred on the
screen rather than between the buttons, so the wider left slot does not shift it. Press feedback
was left as `TouchableOpacity`'s default fade — a `scale` press treatment belongs with a
app-wide press convention, not one button.

**Evidence:** `src/common/components/AppHeader.tsx:15,39,72` — the icon is 32×32 with an 8 pt
`hitSlop`, giving a 48×48 touch target. That meets the Android 48 dp minimum but the *visual* is
small and there is no press feedback, which is what makes it feel unhittable.

**Change:**
1. Grow the visual to 40×40 and the padding around it, so the button reads as a button rather
   than as decoration. Keep `hitSlop` — combined, the target lands around 56 pt.
2. Add press feedback. `TouchableOpacity`'s default fade is fine here; a `scale: 0.97` over
   ~120 ms would match the rest of the app better if press animation is introduced elsewhere.
3. The header title is `position: "absolute"` spanning the full width with `pointerEvents: "none"`
   (`AppHeader.tsx:73-75`) — confirm the enlarged button still sits above it and that the title's
   centring is not thrown off by the wider left slot. It is centred on the *screen*, not between
   the buttons, so growing the left button does not move it. **[verify]** on a long list name.

**Test:** snapshot of the header at both themes; an accessibility test that the button exposes
`accessibilityRole="button"` and the `goHome` label (both already present).

---

### B3 — ~~Pattern-delete confirmation is hardcoded English~~ — DONE (was misdiagnosed)

> **Correction.** The triage claimed a German user would see an English system alert. That was
> wrong, and the fix is different from the one written here originally.

**What was actually true:** `src/common/utils/PatternDelete.ts` did build `"Delete pattern"` /
`"Are you sure you want to delete \"${name}\"?"` / `"Cancel"` / `"Delete"` as English literals and
used the raw `Alert` / `window.confirm` instead of the themed `AppDialog`. But **nothing imported
it** — verified by grep across `src/`, `app/`, `__tests__/` and `utils/`. `PatternListItem` had
already been migrated to `AppDialog` with proper i18n keys
(`PatternListItem.tsx:96-110`). The helper was dead code left behind by that migration, so no user
ever saw those strings.

**Done:**
- Deleted `src/common/utils/PatternDelete.ts`.
- `deletePatternConfirm` took a `{{name}}` interpolation from its only caller but the copy ignored
  it, so the confirmation read "…delete this pattern?" with the name silently dropped. Both locales
  now use the name, matching `deletePatternListConfirm`: `"Are you sure you want to delete
  '{{name}}'?"` / `"Bist du sicher, dass du '{{name}}' löschen willst?"`.
- `PatternListItem`'s press handlers optional-chained the *method* but not the event
  (`e.stopPropagation?.()`), so they threw on an event-less press. Now `e?.stopPropagation?.()`.
- Covered by `__tests__/components/PatternList.test.tsx`.

---

### B4 — The pattern list is not virtualised — DONE

**Done:** `ScrollView` + `.map` → `FlatList` with `keyExtractor` and `ListEmptyComponent`, and
`PatternListItem` is now `React.memo`'d. `renderItem`/`keyExtractor` are `useCallback`'d to match
house style (`PatternListSelector`, `VideoCarousel`) — note that the React Compiler is enabled
(`babel-plugin-react-compiler@1.0.0` is installed and `experiments.reactCompiler` is on), so it
already memoises `PatternListManager`'s inline handlers; that file was deliberately left alone
rather than hand-rolling `useCallback` the compiler would duplicate.

**Evidence:** `src/pattern/list/PatternList.tsx:69-91` renders `sortedPatterns.map(...)` inside a
plain `ScrollView`. Every `PatternListItem` mounts its own thumbnails. `PatternListSelector`
already uses `FlatList` correctly (`PatternListSelector.tsx:265-273`), so this is an
inconsistency, not a house style.

**Change:** `FlatList` with `keyExtractor={(p) => String(p.id)}`, the header moved to
`ListHeaderComponent`, the empty state to `ListEmptyComponent`. Keep `PatternListItem`
`React.memo`'d and make sure its props are referentially stable (`allPatterns`, `patternTypes`,
`modifiers` come straight from the context and are stable; the callbacks are not — wrap them in
`useCallback` in `PatternListManager`, or the memo does nothing).

**Why it matters for a production app:** a serious user's West Coast Swing list is a few hundred
patterns. At that size the current code mounts every row and every thumbnail on first paint.

---

### B5 — `clearAllData` orphans every pattern key — DONE

**Done:** `clearAllData` now enumerates `getAllKeys()` and removes every `@patterns_` key alongside
the two top-level ones. Added `collectOrphanedPatternKeys()`, which reclaims `@patterns_*` entries
whose list no longer exists — for keys left behind by a crash between the two writes in
`deletePatternList`, or by an older build. It is called once, unawaited, from
`ActivePatternListProvider` after the initial load, so it can never delay or fail first paint.
Covered by six tests including the "leaves unrelated keys alone" case.

**Evidence:** `src/pattern/data/PatternListStorage.ts:180-181` removes only `@patternLists` and
`@activeListId`; the comment concedes that `@patterns_{listId}` keys are "cleaned up when lists
are deleted" — which is exactly the path `clearAllData` skips.

**Change:** enumerate keys with `AsyncStorage.getAllKeys()`, remove everything matching the
`@patterns_` prefix. Fold the same sweep into a startup GC (see [F3](#f3--storage-schema-versioning-and-import-validation))
so storage left behind by earlier versions is reclaimed too.

**Note:** the existing test mock (`jest.setup.js`) stubs exactly four AsyncStorage methods and
will need `getAllKeys`. That mock being hand-maintained is itself an F1 item — the official
`@react-native-async-storage/async-storage/jest/async-storage-mock` should be used instead.

---

### B6 — Camera and media config plugins are not registered — DONE (confirmed, and worse than filed)

**Verified:** ran `npx expo prebuild --platform ios --no-install --clean`. It **refused to run at
all** — `ios.bundleIdentifier` was missing, and because the project uses a dynamic `app.config.ts`
with no `app.json`, the CLI cannot write it itself. So iOS builds were blocked outright, not just
missing permission strings. Added `bundleIdentifier: "com.teholi.DancePatternMapper"` (Expo's own
suggested value, mirroring `android.package`).

**Done:** registered `expo-camera` and `expo-image-picker` in `plugins` with usage strings, both
with `microphonePermission: false` (and camera `recordAudioAndroid: false`) since nothing records
audio — which also blocks `RECORD_AUDIO` from transitive merging. Re-ran prebuild and confirmed
`NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` are present in the generated
`Info.plist`, and `NSMicrophoneUsageDescription` correctly is not.

`expo-document-picker` was **not** registered: its plugin only sets iCloud entitlements, and only
when `ios.usesIcloudStorage` is set, which this app does not use. Registering it would be noise.

Two traps worth knowing, now recorded in AGENTS.md: `npx expo config --type prebuild` does **not**
show these strings (the plugins apply through mods that run only during prebuild), and prebuild
rewrites the `android`/`ios` npm scripts to `expo run:*`, which has to be reverted.

**Evidence:** `app.config.ts` lists only `expo-router`, `expo-splash-screen` and `expo-video`
under `plugins`. But `expo-camera` (QR scanning, `src/common/components/QrCodeScanner.tsx`),
`expo-image-picker` (video picking) and `expo-document-picker` (import) are all used at runtime
and all ship an `app.plugin.js` (verified present in `node_modules`). Config plugins are applied
only when listed; they are not autolinked. On Android the permission still lands via manifest
merging (`CAMERA` is present in the generated `android/app/src/main/AndroidManifest.xml`), but on
iOS the `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` strings come from the
plugins, and iOS terminates an app that touches those APIs without them.

**[verify] before acting:** run `npx expo prebuild --platform ios --clean` and grep the generated
`ios/*/Supporting/Info.plist` for `NSCameraUsageDescription`. If absent, this is a crash on the
first QR scan in a production iOS build.

**Change:** add the three plugins with localised usage strings (the app already ships en/de, so
the strings belong in the plugin config and, for full localisation, in an
`ios.infoPlist` + `CFBundleLocalizations` setup — start with English strings and treat the
localised variants as a follow-up).

---

### B7 — The graph's detail modal can never show modifiers — DONE

**Done:** `modifiers` is now declared on `PatternDetailsModal` and threaded from
`PatternGraphScreen` (`activeList?.modifiers ?? []`), alongside the `patternTypes` it already
passed. This is the "modifiers in details when clicked" half of original item 4; the node-badge
half remains open as [M2](#m2--surface-video-and-modifier-availability-in-the-graph).

**Evidence:** `PatternDetails` renders a `ModifierPillStrip` from its `modifiers` prop, defaulting
to `[]` (`src/pattern/graph/PatternDetails.tsx:31`). `PatternDetailsModal` does not declare or
forward a `modifiers` prop (`PatternDetailsModal.tsx:18-24,56-62`), and `PatternGraphScreen`
does not pass one (`PatternGraphScreen.tsx:65-71`) even though `activeList.modifiers` is right
there next to `activeList.patternTypes`, which it does pass.

**Change:** thread `modifiers={activeList?.modifiers ?? []}` through both components. Two lines
plus a prop declaration. This is the "modifiers in details when clicked" half of original item 4.

---

## 3. Medium changes

### M1 — Stop the app's horizontal gestures fighting the OS back gesture

The original note — *"app's swipe-left screen () fights vs native/OS's 'back' aka go-back left
swipe gesture"* — has an empty parenthesis where a screen name was meant to go, so it is
ambiguous. Both plausible readings are real problems and share a fix strategy.

**Reading A — the drawer.** `app/_layout.tsx:36-38` configures
`drawerPosition: "right"` with `swipeEdgeWidth: 40`. On Android 10+ with gesture navigation, the
system back gesture is bound to **both** screen edges, with the system consuming the outermost
~20 dp. A right-edge swipe is therefore simultaneously "open the drawer" and "go back", and the
system wins the outer band while the app wins the inner one — which is exactly what an
inconsistent-feeling gesture is. On iOS the interactive pop gesture is left-edge only, so a
right-hand drawer is fine there.

**Reading B — in-screen horizontal scrollers.** Several screens put horizontally scrolling
content near a screen edge: `VideoCarousel`'s paging `FlatList`
(`src/common/components/VideoCarousel.tsx:41-53`), the prerequisite and "builds into" strips in
`PatternDetails` (`PatternDetails.tsx:119,181`), the timeline view's horizontal `ScrollView`
(`TimelineView.tsx:96`), and the network view's pan container. Each of these competes with the
system back gesture when the finger starts near the edge.

**Fix strategy, in order of preference:**

1. **Drop swipe-to-open on Android, keep the hamburger.** Every screen renders `AppHeader`, which
   has an always-visible menu button (`AppHeader.tsx:50-58`). Setting `swipeEnabled: Platform.OS !== "android"`
   in `screenOptions` removes the conflict entirely at the cost of a gesture the app does not need.
   This is the recommendation: one line, zero risk, and it makes the interaction deterministic.
2. **If the swipe must stay:** Android 10+ exposes `View.setSystemGestureExclusionRects`, which
   tells the system to yield a region back to the app (capped at 200 dp of total height per edge).
   React Native exposes no JS API for it and `@react-navigation/drawer` does not call it, so this
   means a small Expo module (`src/modules/gesture-exclusion/`, built with the Expo Modules API —
   see the `expo-module` skill) that takes a view ref and a rect list. That is a genuine native
   module with its own build, test and prebuild story: ~3 days, and it only helps Android 10+.
3. **For reading B**, the correct fix is the same exclusion-rect mechanism, or simply keeping
   horizontally scrolling content out of the outer ~24 dp with container padding. The latter is
   free and should be done regardless.

**Also worth fixing while in here:** `swipeEdgeWidth: 40` combined with `drawerPosition: "right"`
means a swipe that starts 40 px from the right edge opens the drawer *on every screen*, including
while panning the network graph. Once L2 (draggable nodes) lands, that is a direct conflict with
node dragging near the right edge — another reason to take option 1.

**Verification:** this is a feel problem and cannot be judged from code. Check on a physical
Android device with gesture navigation enabled (not 3-button), on both a phone with and without
curved edges, and on an iPhone with the home indicator. Check specifically: graph pan starting
within 40 px of the right edge; video carousel paging near either edge; drawer open/close.

**Effort:** 0.5 days for option 1 + padding. 3–4 days if the native module is wanted.

---

### M2 — Surface video and modifier availability in the graph

**Two parts.** The details half is [B7](#b7--the-graphs-detail-modal-can-never-show-modifiers--done) —
one line. This entry covers the node badges.

**Current state:** `PatternNode` (`src/pattern/graph/PatternNode.tsx`) draws a rect, an optional
inner rect for foundational patterns, the truncated name and the count. It is shared by both
views: `GraphSvg.drawNodes` is imported by `NetworkGraphView` via `GraphSvg` and directly by
`TimelineView` (`TimelineView.tsx:19`). Node geometry is fixed at `NODE_WIDTH = 100`,
`NODE_HEIGHT = 60` (`src/pattern/graph/types/Constants.ts:5-6`) and those constants feed the
timeline's swimlane sizing and the collision-avoidance pass, so **node size is not a free
variable** — growing the node changes timeline layout everywhere.

**Design:**

1. Badges go *inside* the existing 100×60 box, in the bottom-right corner, as small glyphs:
   a film icon when `videoRefs.length > 0`, a dot-count or a small "×N" when
   `modifierRefs.length > 0`. Keep them ≤ 10×10 so no constant changes.
2. Universal modifiers apply to every pattern (`AGENTS.md`, "Modifiers"), so a universal-modifier
   badge on every node is noise. Badge only *attached* (non-universal) modifiers — i.e.
   `pattern.modifierRefs`. Videos attached to a modifier *combination* also count as "this pattern
   has video", so the video predicate is
   `videoRefs.length > 0 || modifierRefs.some(r => r.videoRefs.length > 0)`.
3. The predicates are pure functions of a pattern and belong in the graph model
   ([F2](#f2--graph-domain-layer)) as `nodeBadges(pattern)`, not inline in the SVG component —
   they are the one part of this that is unit-testable.
4. `PatternNode` currently declares its own structural `BasePattern` type
   (`PatternNode.tsx:8-15`) that does *not* include `videoRefs`/`modifierRefs`, which is why the
   call sites need `patterns as any` (`NetworkGraphView.tsx:99`). Adding badges means widening
   that type — do it by replacing `BasePattern` with the model's node type from F2 rather than
   adding two more optional fields.
5. Update `Legend` (`src/pattern/graph/Legend.tsx`) to explain the badges; it currently only
   explains type colours.
6. Contrast: the node background already varies opacity by level (0.3/0.5/0.7,
   `PatternNode.tsx:47-63`). A badge drawn in `SecondaryText` over a 0.7-opacity fill may not
   read. Use the type colour (already computed as `borderColor`) or a fixed high-contrast token,
   and check both palettes.

**Tests:** unit tests for `nodeBadges` covering: no videos, pattern videos only, modifier-combo
videos only, universal-modifier-only (→ no badge), and the read-only-list case. Visual regression
is out of scope until F1 lands a component-test environment.

**Effort:** 2–3 days including the F2-lite type cleanup, 1 day if F2 has already landed.

---

## 4. Large changes

Each writeup states the goal, what exists today with references, the design, the data/contract
changes, the test plan, the risks, and an estimate.

---

### L1 — Searchable / filterable pattern graph

> *"Searchable/filterable pattern graph (only show direct chains of filtered figures)"*

#### Goal

Apply a filter on the graph screen and render not just the matching patterns but the **chains they
belong to**: a match plus its transitive prerequisites (what you must learn first) and/or its
transitive dependents (what it leads to). Searching "whip" should show the whip and the path into
and out of it, not five disconnected boxes.

#### What exists today

- A complete filter model and UI already exist and are **only wired into the list screen**:
  `PatternFilter` and `PatternFilterBottomSheet` (`src/pattern/filter/components/PatternFilterBottomSheet.tsx:22-28`),
  the five sub-panels (`NameFilter`, `TypeFilter`, `LevelFilter`, `CountsFilter`, `TagFilter`), and
  `usePatternFilter` (`src/pattern/list/hooks/usePatternFilter.ts`). `PatternList` owns the filter
  state (`PatternList.tsx:39-46`) and the sheet (`PatternList.tsx:93-100`).
- `PatternGraphScreen` renders `patterns` from the context straight through
  (`PatternGraphScreen.tsx:20,61`) with no filter affordance. `PatternGraphHeader` has room for it
  — it already takes a `rightActions` slot.
- `usePatternFilter` lives under `src/pattern/list/hooks/` but has no list-specific coupling; it
  is in the wrong place for a shared concern, and it has exactly one call site.

#### The trap that makes this a Large

Passing a filtered subset of `patterns` to the graph views **breaks the network graph**, silently.

`calculateGraphLayout` places a node only once *every* prerequisite id is already positioned:

```ts
// src/pattern/graph/utils/NetworkGraphUtils.ts:74-78
const children = patterns.filter(
  (p) =>
    p.prerequisites.includes(parentId) &&
    !positioned.has(p.id) &&
    p.prerequisites.every((prereqId) => positioned.has(prereqId)),
);
```

and the deferred pass applies the same gate (`NetworkGraphUtils.ts:144-145`). A prerequisite id
that points outside the subset is never positioned, so the node never is either; `drawNodes`
then finds no position and returns `null` (`GraphSvg.tsx:75-76`). The node — and everything
downstream of it — disappears with no error. This is the same mechanism as
[B1](#b1--deleting-a-pattern-leaves-dangling-prerequisite-ids), which is a live bug today.

So filtering is not "pass a shorter array". It requires **rewriting the prerequisite edges** of
the subgraph.

A second, subtler decision: the timeline view lays out by depth
(`calculateDynamicTimelineLayout` → `calculatePrerequisiteDepthMap`). Computing depth over the
*filtered* set re-bases every column, so toggling a filter makes patterns jump horizontally.
**Recommendation: compute depth on the full graph once, then render the selected nodes at their
full-graph depth.** Columns stay put, gaps show where filtered-out prerequisites were, and the
filter reads as a highlight rather than a different diagram.

#### Design

**1. Graph domain layer ([F2](#f2--graph-domain-layer)) first.** L1 is the reason F2 exists. New
directory `src/pattern/graph/model/`:

```ts
// GraphModel.ts
export interface GraphNode {
  pattern: IPattern;
  depth: number;          // computed on the FULL graph, stable under filtering
  isMatch: boolean;       // matched the filter directly
  isContext: boolean;     // pulled in as an ancestor/descendant of a match
}

export interface GraphEdge {
  from: number;
  to: number;
  kind: "direct" | "elided";   // "elided": the real path runs through hidden nodes
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacency: { prereqsOf: Map<number, number[]>; dependentsOf: Map<number, number[]> };
  depthMap: Map<number, number>;
  cycles: number[][];
  typeColorMap: Map<string, string>;
}

export function buildGraphModel(
  patterns: IPattern[],
  patternTypes: PatternType[],
  selection?: SubgraphSelection,
): GraphModel;
```

**2. `selectSubgraph` — the core algorithm.** Pure, no React, fully unit-testable:

```ts
export type ChainMode = "matchesOnly" | "prerequisites" | "dependents" | "fullChain";

export function selectSubgraph(
  adjacency: Adjacency,
  matchedIds: Set<number>,
  mode: ChainMode,
  maxDepth?: number,       // optional radius limit, e.g. "2 steps out"
): { included: Set<number>; matched: Set<number> };
```

Implementation: build `prereqsOf` / `dependentsOf` once, then BFS backwards and/or forwards from
the matched set. **O(V + E)** — deliberately not a path enumeration, unlike the current cycle
detector (see F2). Visited-set guards make it cycle-safe by construction.

**3. Edge rewriting.** After selection, every node's outgoing edges are recomputed against
`included`:
- a prerequisite inside `included` → `{ kind: "direct" }`
- a prerequisite outside `included` where a path to another included node exists through hidden
  nodes → `{ kind: "elided" }`, rendered dashed with a small "⋯" so the user sees that something
  is hidden rather than believing the chain starts there
- a prerequisite outside `included` with no included ancestor → dropped

Critically, the `IPattern` objects handed to the layout functions must have their
`prerequisites` arrays rewritten to contain only included ids. The layout code stays untouched
and the trap above cannot fire. Write this as an explicit invariant and test it as one (see the
property test below).

**4. Wiring.**
- Move `usePatternFilter` to `src/pattern/filter/hooks/usePatternFilter.ts` (one call site to fix).
- New `src/pattern/graph/hooks/useGraphFilter.ts`: owns `PatternFilter` + `ChainMode` state, calls
  `usePatternFilter` for matching, calls `buildGraphModel` memoised on
  `(patterns, patternTypes, filter, chainMode)`.
- `PatternGraphScreen` renders `PatternFilterBottomSheet` (reused as-is — it takes
  `allPatterns` and `patternTypes` and is otherwise self-contained) and passes the model down.
- `GraphViewContainer`, `TimelineView` and `NetworkGraphView` take `model: GraphModel` instead of
  `patterns` + `patternTypes`. This removes `patterns as any` / `onNodeTap as any`
  (`NetworkGraphView.tsx:99,102`) and `patterns as any` (`useGraphLayout.ts:46`), which exist
  precisely because the contract is currently structural and loose.
- Extract the thrice-declared `type ViewMode` (`PatternGraphScreen.tsx:14`,
  `GraphViewContainer.tsx:10`, `PatternGraphHeader.tsx:9`) into
  `src/pattern/graph/types/ViewMode.ts`.

**5. UI.**
- Filter button in `PatternGraphHeader`'s `rightActions`, with the active-filter dot convention
  `PatternListHeader` already uses — reuse that component's styling rather than reinventing it.
- A chain-mode control. Four modes is too many for a segmented control on a phone; recommend a
  three-way — *Matches* / *Path to* / *Everything connected* — with "Path to" meaning ancestors,
  which is the dominant use case (*"what do I need before I can do this?"*). Put it in the filter
  sheet, not the header.
- A results banner: `t("graphFilterSummary", { matched, total, shown })` → "12 matched · 31 shown
  of 84". Without it the user cannot tell context nodes from matches.
- Matched nodes render at full opacity; context nodes dim. Do **not** implement dimming by
  overloading the level-derived `fillOpacity` (`PatternNode.tsx:47-63`) — add an explicit
  `dimmed?: boolean` prop and multiply, or the two meanings become indistinguishable.
- Zoom/position: when a filter narrows the graph drastically, the network view's initial zoom of
  0.35 (`NetworkGraphView.tsx:74`) leaves the user staring at a mostly empty canvas. Recompute
  the initial zoom from the filtered content bounds. `useGraphLayout` already computes bounds
  (`useGraphLayout.ts:86-101`); expose them.

**6. States to handle explicitly:** zero matches (distinct copy from "no patterns in this list",
which `TimelineView.tsx:88-92` and `NetworkGraphView.tsx:55-62` already render); a filter that
matches everything (skip the subgraph pass entirely — pure win, and it is the common case while
typing); filter reset when the active list changes (`activeList.id` in the effect deps); filter
persistence across a navigation away and back (recommend: do not persist; a stale invisible
filter is a support ticket).

#### Test plan

Pure-unit (runs today, no F1 needed):
- `selectSubgraph`: single match with no neighbours; linear chain in both directions; diamond
  (two paths to the same node); disconnected components; a cycle; `maxDepth` truncation; empty
  match set; match set equal to the whole graph.
- Edge rewriting: direct/elided/dropped classification for each of the above.
- **Property test (the important one):** for any pattern set and any filter, every node in the
  returned model has `prerequisites ⊆ includedIds`. This is the invariant that prevents the
  disappearing-node class of bug permanently. Generate inputs with a small random DAG builder in
  `utils/testFactories.ts`.
- Depth stability: the depth of any node is identical with and without a filter applied.
- A regression test asserting `calculateGraphLayout` positions **every** node it is given — i.e.
  `positions.size === patterns.length` — which fails today for dangling ids and would have caught
  B1.

Component (needs F1): filter sheet opens from the graph header; applying a name filter reduces the
rendered node count; chain mode changes it; reset restores.

#### Risks

- **Layout thrash.** `buildGraphModel` + full re-layout on every keystroke in the name field.
  Debounce the name input (~200 ms) and memoise on a stable filter key, not the filter object
  (`PatternFilterBottomSheet` already applies only on "Apply", so this bites only if live search
  is added — and live search is what "searchable" implies).
- **Cycles.** Until [B2](#b2--no-cycle-prevention-when-editing-prerequisites) is fixed, a user can
  create a cycle; BFS handles it, but the layout functions do not. Ship B2 first or make the model
  surface cycles so the view can warn.
- **Scope creep into "saved views".** Users will ask for saved filters next. Design the filter
  state as a serialisable object now (it already is) but do not build persistence in L1.

#### Effort

**4–7 days** assuming F2 has landed (2–3 of those are F2 itself if it has not). Roughly: 1 day
`selectSubgraph` + tests, 1 day edge rewriting + the property test, 1 day model plumbing and
removing the `as any` casts, 1–2 days UI, 1 day states/polish/i18n.

---

### L2 — Moveable patterns in the network graph

> *"Moveable patterns in network graph"*

#### Goal

Let the user drag a node to a new position in the network view, have the layout remember it, and
have it survive restarts, list edits and app updates.

#### What exists today

- `NetworkGraphView` wraps a single `<Svg>` in `ReactNativeZoomableView`
  (`NetworkGraphView.tsx:84-105`), zoom range 0.15–4.5, initial 0.35, `bindToBorders={false}`.
- **`@openspacelabs/react-native-zoomable-view` is implemented with `PanResponder`** — verified in
  `node_modules/@openspacelabs/react-native-zoomable-view/src/ReactNativeZoomableView.tsx:6-9,133-137`.
- Positions are computed from scratch by `calculateGraphLayout`
  (`src/pattern/graph/utils/NetworkGraphUtils.ts`) on every `patterns`/window-size change
  (`useGraphLayout.ts:41-80`) and normalised so content starts at `CONTENT_PADDING / 2`. Nothing
  is persisted.
- `PatternNodeGroup` has a platform split: native sets `onPress` on `<G>`; web takes the DOM node
  through `forwardedRef` and binds a `click` listener, because react-native-svg's web build spreads
  six responder handlers onto the DOM node otherwise (`PatternNodeGroup.web.tsx` — the reasoning is
  in its doc comment and in `AGENTS.md`).
- `react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1` and
  `react-native-gesture-handler@3.3.0` are all dependencies but **are not imported anywhere in
  `src/` or `app/`** (verified by grep). They are present as peer requirements of the drawer.
- **[verify]** No `GestureHandlerRootView` is mounted: `app/_layout.tsx` does not render one, and
  neither `expo-router`'s layouts nor `@react-navigation/drawer` mount one (grepped). Gesture
  Handler requires it. Confirm on device before assuming any `Gesture.*` API will fire.

#### The three problems

**(a) Gesture arbitration.** A `Gesture.Pan()` on a node lives in Gesture Handler's native touch
system; the container's pan lives in RN's `PanResponder` responder system. The two do **not**
negotiate — there is no `simultaneousHandlers` / `requireExternalGestureToFail` across that
boundary. Whichever claims the touch first wins, non-deterministically from the user's point of
view. Three ways out:

| | Approach | Verdict |
|---|---|---|
| **A** | Replace the zoom container with a Gesture-Handler + Reanimated implementation: `Gesture.Simultaneous(Gesture.Pan(), Gesture.Pinch())` driving a shared `{ scale, translateX, translateY }`, and node drags composed via `Gesture.Exclusive` / `blocksExternalGesture`. Drops the `@openspacelabs` dependency. | **Recommended.** It is the only option where gesture priority is expressible rather than emergent. ~3–4 days on its own, and it also fixes the container's interaction with [M1](#m1--stop-the-apps-horizontal-gestures-fighting-the-os-back-gesture). |
| **B** | Keep the container; hit-test inside its `onPanResponderMove` and route drags manually. | Rejected. Re-implements gesture arbitration by hand, unreachable from tests, and every container upgrade is a risk. |
| **C** | Move the whole graph to `@shopify/react-native-skia`. | The right answer if node counts pass ~500 and SVG becomes the bottleneck. Too large for this item; note it as the escape hatch and keep the model layer (F2) renderer-agnostic so it stays available. |

**(b) Per-frame updates.** Two hard rules apply (both from the `expo-animation` skill):
*never `setState` from a gesture handler*, and *`transform`/`opacity` only*. So:

- Node positions become shared values, not React state. The dragged node's `<G>` is an
  `Animated.createAnimatedComponent(G)` whose `transform` is driven by `useAnimatedStyle` /
  `useAnimatedProps`. React never re-renders during the drag; commit to React state (and to
  storage) in `onEnd` only.
- **Edges are the hard part.** They are `<Path d="...">` strings built in JS
  (`GraphSvg.drawEdges` → `generateOrthogonalPath`). Recomputing `d` for every edge per frame from
  the JS thread is exactly the jank this design is trying to avoid. Options, in order:
  1. **Animate only the dragged node's incident edges** via `useAnimatedProps` on an animated
     `Path`, with a worklet copy of `generateOrthogonalPath` (`'worklet'` as its first line).
     Bounded work: a node has a handful of incident edges. The rest of the graph is static during
     the drag. **Recommended.**
  2. Snap edges on release only — the dragged node detaches from its lines mid-drag. Cheapest;
     acceptable for a v1 but visibly wrong.
  3. Skia (option C above).
- **The scale bug to design against:** the container is zoomed. A raw gesture translation of
  `dx` pixels must become `dx / scale` in graph coordinates, or the node lags the finger at zoom
  > 1 and outruns it at zoom < 1. Read `scale` from the container's shared value inside the
  worklet; do not capture it at gesture start unless pinch-while-dragging is disabled (and it
  should be — `Gesture.Exclusive`).
- Drag must not eat taps: `Gesture.Pan().activateAfterLongPress(200)` (or a minimum activation
  distance) so a tap still opens the detail modal. Pair pickup and drop with
  `Haptics.impactAsync(Light)` — `expo-haptics` is already a dependency — scheduled back with
  `scheduleOnRN`, never `runOnJS` (deprecated in Reanimated 4).

**(c) Persistence and semantics.** This is where the long-term maintainability questions are, and
they need answers before code:

1. **Scope.** Positions are per-list, per-view (network only — the timeline is algorithmic by
   design and should not become draggable), and per-device.
2. **Not shared.** A manual layout must **not** be written into the Firestore `SharedListDocument`
   (`src/firebase/FirebaseListService.ts`). A subscriber's layout is theirs. This also keeps
   `syncPublishedList` — which is called opportunistically after every pattern CRUD
   (`PatternListManager.tsx:70,83,94`) — from firing on every drag.
3. **New storage key** `@graphLayout_{listId}`, in a new
   `src/pattern/graph/data/GraphLayoutStorage.ts` alongside `PatternListStorage.ts`, following the
   same helpers-only convention (`AGENTS.md`, "Persistence"):
   ```ts
   interface StoredGraphLayout {
     version: number;
     positions: Record<string /* patternId */, { x: number; y: number }>;
     updatedAt: number;
   }
   ```
4. **Reconciliation** — the part that will produce bugs if it is not a pure, tested function:
   ```ts
   resolveLayout(
     patterns: IPattern[],
     stored: StoredGraphLayout | null,
     autoLayout: Map<number, LayoutPosition>,
   ): { positions: Map<number, LayoutPosition>; staleIds: number[] }
   ```
   - A pattern with a stored position keeps it.
   - A pattern added since (no stored position) gets an auto position **seeded near its
     prerequisites' stored positions**, not from a global re-layout — otherwise adding one pattern
     reshuffles a layout the user arranged by hand. That is the single most important behaviour in
     this item.
   - Stored entries for deleted patterns are stale and get GC'd on save (the same class of leak as
     [B5](#b5--clearalldata-orphans-every-pattern-key--done)).
   - An entirely empty stored layout falls through to today's behaviour exactly.
5. **Read-only lists** (`activeList.readonly`, set for imported read-only exports and cloud
   subscriptions): dragging is a local view preference, not a content edit, so **allow it**. Every
   other mutating path guards on `isReadonly` (`AGENTS.md`, "Read-only lists"), so this exception
   must be written down in `AGENTS.md` or someone will "fix" it later.
6. **Reset.** A "reset layout" action in `PatternGraphHeader`, with confirmation via `AppDialog`.
7. **Export/import.** `IPatternListExportData` is at `"3.0.0"`. Layout is a device preference —
   **recommend not exporting it**, which keeps the format untouched. If it is exported anyway, that
   is a bump to `3.1.0` *and* real version handling in `ImportPatterns.ts`, which today accepts any
   truthy `version` with no branching (`ImportPatterns.ts:29`) — see
   [F3](#f3--storage-schema-versioning-and-import-validation).
8. **Web.** The web build binds click listeners by hand (`PatternNodeGroup.web.tsx`). RNGH pan on
   web is a separate code path; budget a verification pass with
   `npx expo export --platform web` and a real browser, per `AGENTS.md`'s platform-specific
   section. Mouse drag and touch drag are different enough to need both.
9. **Accessibility.** Dragging must never be the only way to achieve something. It is a layout
   convenience here, so this is satisfied by default — but do not let "drag to connect
   prerequisites" sneak in later without a non-gesture path.

#### Test plan

Pure-unit (the majority of the value):
- `resolveLayout`: empty stored layout; full stored layout; one pattern added; one deleted; all
  deleted; a stored position for an id that now belongs to a *different* pattern (possible today
  because of [B1](#b1--deleting-a-pattern-leaves-dangling-prerequisite-ids)'s id recycling — this
  is a concrete reason to fix B1 before L2); positions at the `MAX_COORDINATE` clamp
  (`NetworkGraphUtils.ts:195-201`).
- Seeded placement: a new pattern with one prerequisite lands within `DEPTH_SPACING` of it; with
  two prerequisites, between them; with none, on the foundational ellipse.
- Storage round-trip, including a corrupt/partial JSON payload (must fall back to auto-layout, not
  throw — the current storage helpers all swallow and return a default, keep that contract).
- Coordinate conversion: `screenDelta → graphDelta` at scale 0.15, 1.0 and 4.5.

Component (needs F1): a drag simulated through RNGH's jest utilities moves a node and persists
once; a tap still opens the detail modal.

Manual, on device — name these in the PR description because they cannot be automated:
- Drag at minimum zoom and at maximum zoom; does the node track the finger 1:1?
- Flick a node and let it settle — does it overshoot? (It should not; use
  `{ duration: 400, dampingRatio: 1, overshootClamping: true }` for the settle.)
- Interrupt a drag with a second finger.
- Drag near the right screen edge with Android gesture navigation on — see
  [M1](#m1--stop-the-apps-horizontal-gestures-fighting-the-os-back-gesture).
- Release build on the slowest supported Android device, with a 100+ pattern list. A dev build's
  JS thread hides exactly the problems this design is avoiding.

#### Risks

- **Replacing the zoom container is the bulk of the work and touches the one screen most likely to
  regress.** Do it as its own PR, with no behaviour change, before any drag code. That PR is
  independently reviewable and independently revertable.
- **Reanimated 4 requires the New Architecture** — enabled here (`newArchEnabled`, per
  `AGENTS.md`), so fine, but it pins the project to it.
- React Compiler is on (`app.config.ts` → `experiments.reactCompiler`). Use Reanimated's
  `.get()` / `.set()` accessors throughout; bare `.value` access is the form the compiler cannot
  see through.
- Layout stability under filtering: once [L1](#l1--searchable--filterable-pattern-graph) lands,
  filtering changes the node set. Stored positions must survive a filter being applied and removed
  — which they do, because `resolveLayout` is keyed by pattern id, not by index. Test it.

#### Effort

**8–12 days.** ~4 for the container replacement, ~3 for the drag interaction including the edge
worklets, ~2 for persistence and reconciliation, ~2 for tests, web verification and polish.

---

### L3 — AI anonymised comic-style videos

> *"Allow to create realistic comic-versions of videos using AI to make anonymized videos (bring
> your own key for now); limit to 30s videos (show warning that it's getting expensive...)"*

This is the largest item by a wide margin, and it is the only one with legal and store-policy
surface. The writeup leads with that, because it changes the design rather than sitting beside it.

#### The premise needs adjusting

The stated purpose is **anonymisation**. Implemented as "upload the clip to a hosted model and get
a stylised clip back", the feature does the opposite in the one moment that matters: it transmits
unmodified, identifiable footage of people to a third party.

That matters concretely here:

- The footage is of **partner dancing**. The people in it are, by construction, mostly not the
  person operating the phone — a dance partner, an instructor, a class. They have not agreed to
  anything.
- The app ships a German locale and a `PRIVACY_POLICY.md`, so GDPR is the operative regime.
  Faces in video are personal data; depending on processing, biometric data. The user uploading is
  a controller with no lawful basis over their partner's data by default.
- Model providers differ on retention and on training use, and the terms change. "We use
  Provider X" is not a durable answer; "the user picks a provider from an allow-list, and we show
  that provider's retention terms at the point of use" is.

**Consequence for the design: ship a local, offline anonymisation strategy first.** Pixelation,
posterisation, silhouette or a pose-skeleton overlay computed on-device needs no network, no key,
no consent problem, no cost and no store-policy review. It serves the users who will not pay, it
serves the privacy goal honestly, and the AI path then slots in behind the same interface as one
strategy among several. If only one phase of this item ever ships, this is the one that should.

The AI path is still worth building — a comic render is genuinely better for teaching than a
pixelated blur. It just should not be the only path, and it must be gated on informed consent
rather than on a checkbox nobody reads.

#### What exists today

- `IVideoReference` is `{ type: "url" | "local", value, startTime? }`
  (`src/pattern/types/IPatternList.ts:64-68`). Local videos are file paths; `ImportPatterns.ts`
  writes imported videos back to the filesystem with `expo-file-system`'s `File` / `Paths` API.
- Videos hang off three places: a pattern (`IPattern.videoRefs`), a universal modifier
  (`IModifier.videoRefs`), and a pattern×modifier combination (`IPatternModifierRef.videoRefs`).
  Anything generated must be attachable to all three, and `exportPatterns.ts` already walks all
  three (`exportPatterns.ts:57-110`).
- Playback is `expo-video` (`src/common/components/VideoItem.tsx`), with a YouTube path split out
  per platform.
- Thumbnails come from `expo-video-thumbnails`.
- **There is no secure storage.** `expo-secure-store` is not a dependency; everything persists as
  plaintext JSON in AsyncStorage.
- **There is no notification capability.** `expo-notifications` is not a dependency.
- **There is no feature-flag mechanism.**
- Settings live in `src/settings/SettingsScreen.tsx` (234 lines) with `useDataTransfer` as the one
  hook; it is a reasonable host for a new section but has no sub-navigation.

#### Blocking unknown: transcoding

Providers charge by output duration and reject oversized inputs; mobile uploads of a 4K 30 s clip
over cellular are their own failure mode. So the source needs downscaling and trimming before
upload. React Native's options for that are all bad:

- `ffmpeg-kit-react-native` — **retired by its maintainer in 2025**; the prebuilt binaries were
  pulled. Also LGPL/GPL licence questions depending on the build.
- `react-native-video-processing` — effectively unmaintained.
- Rolling a native Expo module over `AVAssetExportSession` (iOS) and `MediaCodec` / `Media3
  Transformer` (Android) — entirely feasible with the Expo Modules API, and the most durable
  answer, but it is a multi-day native project on its own.

**This should be spiked before the item is committed to.** Two days: can a 30 s 1080p clip be
trimmed and downscaled to 720p on both platforms, in-app, with a maintained dependency or a small
custom module? The answer determines whether L3 is a 15-day item or a 25-day one. If the answer is
no, the fallback is to require the user to pick a short clip and to enforce the cap by *rejecting*
rather than by *transcoding* — workable, worse UX, and it caps what can ship.

#### Architecture

New feature module `src/ai/` (not under `src/pattern/` — it is orthogonal to the pattern domain):

```
src/ai/
  types/          AnonymizationJob, JobStatus, ProviderDescriptor, CostEstimate
  providers/      AnonymizationProvider interface + implementations + registry
  queue/          JobQueue, JobStorage, the foreground poller
  strategies/     LocalPixelate, LocalSilhouette (phase 1), RemoteStylize (phase 3)
  components/     ConsentSheet, CostConfirmSheet, JobStatusCard, ApiKeySection
  hooks/          useAnonymizationJobs, useProviderKey
```

**Provider interface.** The point of this is that no vendor's API shape reaches the UI:

```ts
export interface AnonymizationProvider {
  readonly id: string;
  readonly displayName: string;
  readonly maxDurationSeconds: number;
  readonly termsUrl: string;
  readonly retentionSummaryKey: string;   // i18n key, shown in the consent sheet
  validateKey(key: string): Promise<{ valid: boolean; reason?: string }>;
  estimateCost(durationSeconds: number): CostEstimate;   // { amount, currency, confidence }
  submit(input: JobInput, key: string, signal: AbortSignal): Promise<RemoteJobId>;
  poll(remoteId: RemoteJobId, key: string): Promise<JobStatus>;
  download(remoteId: RemoteJobId, key: string): Promise<string /* local uri */>;
  cancel(remoteId: RemoteJobId, key: string): Promise<void>;
}
```

Ship a `MockProvider` from day one — it is what the tests and the whole dev loop run against, and
it means the queue, the UI and the error handling are finished and tested before a single real API
call is made. For real providers, video-to-video stylisation is offered by Runway, Luma and Kling
among others; their endpoints, parameter names and pricing all change on a scale of months, so
pick one at implementation time and **verify the current API surface then** rather than encoding
today's shape into a plan.

**Key storage.** `npx expo install expo-secure-store`. Keys go in the Keychain / Keystore, never
in AsyncStorage, never in an export file. Add a test asserting that the export payload
(`createExportData` in `exportPatterns.ts`) contains no key material — cheap insurance against a
future refactor that starts exporting settings.

**Job lifecycle.** Generation takes minutes, so this cannot be a promise held in a component.

`expo-background-task` is **not** the answer — verified against the Expo docs: it is deliberately
*deferrable*, with a 15-minute minimum interval on Android's `WorkManager` and system-chosen
scheduling on iOS's `BGTaskScheduler`. It is built for "sync overnight", not for "poll this job
every ten seconds".

The design that actually works:

1. Persist the job before doing anything network (`@aiJobs`, its own storage module):
   `{ id, listId, patternId, modifierId?, providerId, remoteJobId?, status, sourceUri, submittedAt, costEstimate, attempts, error? }`.
2. Foreground poller with exponential backoff while the app is open, driven by a hook that
   subscribes to the queue.
3. On app foreground (`AppState`), resume every non-terminal job — re-poll rather than re-submit.
   **Idempotency matters**: a re-submit costs the user real money.
4. Optional `expo-notifications` so a finished job announces itself. Adds a permission prompt and
   an iOS entitlement; make it opt-in and not required for the feature to work.
5. Every job must be cancellable, and a job whose pattern is deleted mid-flight must be cancelled
   and cleaned up (the orphan class of bug again — see B1, B5, L2's stale positions; a single
   startup GC pass covering all of them is the right shape).

**Duration cap.** Enforce the 30 s limit *before* upload, which means reading the source
duration. `expo-video`'s player exposes `duration` once loaded; an off-screen `useVideoPlayer`
gets it. **[verify]** whether SDK 57's `expo-video` offers a metadata read without mounting a
player — if so, prefer it. Also cap file size and resolution, and show the numbers in the confirm
sheet.

**Cost UX.** The idea list says "show warning that it's getting expensive". Concretely:
- An estimate in the provider's currency shown before submit, with the duration it is based on.
- An explicit confirm containing the number — not a generic "Continue".
- A local running total per month, visible in settings.
- A configurable monthly soft cap that blocks submission when exceeded (a local guard, not a real
  spend limit — say so plainly in the copy; the user's own provider dashboard is the real limit).
- **Never auto-retry a paid call.** A failed job offers a retry button; it does not take one.

**Result handling.** Extend `IVideoReference` additively so every existing `switch (type)` keeps
working:

```ts
export interface IVideoReference {
  type: "url" | "local";
  value: string;
  startTime?: number;
  origin?: "user" | "generated";                 // NEW, defaults to "user" when absent
  generated?: {                                  // NEW
    providerId: string;
    jobId: string;
    createdAt: number;
    sourceHash?: string;                         // links back to the original, if kept
  };
}
```

That is an export-format bump to `"3.1.0"` plus real version handling on import
([F3](#f3--storage-schema-versioning-and-import-validation)). Older app versions reading a 3.1.0
file will ignore the new fields, which is the right failure mode — but only if they do not
validate strictly, so **[verify]** the forward-compatibility story before bumping.

Generated videos need a visible badge. `PatternVideos.tsx` already has the pattern for it (the
`urlBadge` / `urlBadgeText` styles at lines 168-181) — reuse it with an "AI" label.

**Store policy.** Both stores have generative-AI content rules, and both are enforced at review:
- Google Play's AI-Generated Content policy requires in-app reporting of offensive generated
  content and prohibits certain generation categories.
- Apple requires generative features to have content moderation and age-rating implications; a
  BYOK key-entry flow must not read as a purchase flow (3.1.1).
- Labelling generated media in-app is required by both in practice. Consider writing C2PA-style
  provenance metadata; at minimum, the in-app badge and the `generated` field above.
- `PRIVACY_POLICY.md` needs a new section naming: what leaves the device, to whom, under whose
  terms, for how long, and that the user is responsible for the consent of people in the footage.

#### Failure modes to design for

Invalid or revoked key · provider 4xx/5xx · rate limit · job stuck in `processing` indefinitely
(needs a timeout and a manual "give up") · app killed mid-upload · offline mid-poll · device
storage full on download · the user deletes the pattern, the modifier or the whole list while a
job is in flight · the source file deleted from the device between submit and download · a
provider returning a result the user considers worse than the input (keep the original until the
user explicitly replaces it — **never** overwrite the source).

#### Phasing

| Phase | Content | Ships value alone? |
|---|---|---|
| **0** | Transcoding spike (2 days). Decides everything downstream. | Decision, not a feature |
| **1** | Local strategies: pixelate / posterise / silhouette. No network, no key, no consent gate, no cost. Plus the feature-flag mechanism and the `AnonymizationStrategy` seam. | **Yes** — this is the honest anonymisation feature |
| **2** | Provider interface + `MockProvider` + job queue + secure key storage + settings UI, behind a flag. | No (internal), but fully testable |
| **3** | One real provider + consent sheet + cost UX + privacy-policy and store-listing updates. | Yes |
| **4** | Second provider, to prove the interface is not shaped around the first one. | Marginal; do it before the interface ossifies |

A feature flag is needed and does not exist. It is trivial: `src/common/config/features.ts`
reading from `Constants.expoConfig.extra`, with the same "absent means off" discipline that
`firebaseConfig.ts` already uses for Firebase (`firebaseAvailable`) — follow that precedent
exactly rather than inventing a second pattern.

#### Test plan

- `MockProvider`-driven queue tests: submit → poll → download → attach; every failure mode above,
  each asserting that no duplicate paid submission occurs.
- Cost estimation and the monthly-cap guard, including boundary conditions.
- Duration/size gate rejects a 31 s clip and accepts a 29 s one.
- Key storage: stored, read back, and **absent from** the export payload.
- Job/entity lifecycle: deleting the pattern cancels the job; a cold start resumes a pending job
  exactly once.
- `IVideoReference` back-compat: a 3.0.0 file imports with `origin` undefined and everything still
  renders.
- Consent gate: submission is impossible without an explicit, recorded consent acknowledgement
  (record the acknowledgement with a timestamp — it is the audit trail).

#### Effort

**15–25 days**, plus the 2-day spike that sets which end of that range applies. Phase 1 alone is
~4–5 days and is the part with the clearest value-to-risk ratio.

---

## 5. Foundation work

These are not on the original list. They are prerequisites for doing the large items to a standard
that holds up over a long-lived, production-installed app.

### F1 — Test infrastructure and CI — IN PROGRESS

**Why this is first.** Every large item above says "and tests". None of them could be tested
beyond pure functions.

#### Landed

| | What | Where |
|---|---|---|
| ✅ | **Two Jest projects.** `unit` (node + ts-jest, `__tests__/unit/`) stays a sub-second loop; `components` (`jest-expo` preset, `__tests__/components/`) can render. `npm run test:unit` / `test:components` run one. | `jest.config.js` |
| ✅ | **Behavioural AsyncStorage mock** — a real in-memory store implementing the full v3 surface, applied automatically. Replaces the four hand-stubbed `jest.fn()`s that silently lacked `getAllKeys`, which is how B5's fix broke the suite the moment it was written. | `__mocks__/@react-native-async-storage/async-storage.ts` |
| ✅ | **Native-module mocks** for expo-video, expo-camera, the pickers, haptics, sharing, YouTube, QR. Plus firebase, which ships untranspiled ESM jest cannot parse — mocking is faster than Babel-compiling the SDK per suite and matches the app's real no-credentials behaviour. | `jest.setup.components.ts` |
| ✅ | **In-memory filesystem mock** storing real bytes, with real base64 encode/decode, applied to both projects. That fidelity is what makes a round-trip meaningful: a video has to come back byte-identical, not merely non-empty. Fixtures use deliberately non-UTF-8 bytes so a broken encode cannot pass. | `__mocks__/expo-file-system.ts` |
| ✅ | **`renderWithProviders`** — real provider stack (i18n + theme + `ActivePatternListProvider`) with storage seeded before mount, re-exporting RNTL so tests have one import. | `utils/renderWithProviders.tsx` |
| ✅ | **Coverage over all of `src/`** with ratchet thresholds set just under measured reality. | `jest.config.js` |
| ✅ | **CI** — three jobs: `verify` (lint, format, typecheck, test+coverage), `bundle` (`expo export` for web **and** android — the gate AGENTS.md names), `audit` (fails if `npm audit` drifts from the documented three-moderate baseline). | `.github/workflows/ci.yml` |
| ✅ | **Scripts**: `test:unit`, `test:components`, `typecheck`, `format`, `format:check`. ESLint config updated for the new layout and to ignore generated `ios/`, `android/`, `coverage/`. | `package.json`, `eslint.config.js` |
| ✅ | Dropped `@testing-library/jest-native` (deprecated; RNTL 13 registers its matchers itself) and `lucide-react` (imported nowhere). Added `jest-expo`. | `package.json` |

**Suites written:** storage rewritten behaviourally (12 → 25 tests, including the error-path
contract: readers degrade to a safe default, writers rethrow); i18n parity (8); graph layout
invariants (16); **export/import round trip (36)**. **36 → 127 tests, all green**, plus lint,
format, typecheck and both bundle exports verified locally.

Three of the new suites earn their place immediately:

- **`__tests__/unit/ExportImportRoundTrip.test.ts`** runs a real export and feeds the file it
  produced straight back into the importer — the two modules only agree through the on-disk
  format, so testing them apart proves very little. It covers `exportPatterns.ts` to **94%** and
  `ImportPatterns.ts` to **98%**, and spans all three places videos live (pattern, universal
  modifier, pattern×modifier), `includeVideos: false`, read-only exports, the envelope shape,
  vanished and unreadable source files, and every failure path on both sides (cancellation,
  non-JSON, non-export JSON, missing version, missing file, disk full, sharing unavailable). It
  found [B8](#b8--imported-videos-overwrite-each-other--done), which is now fixed.

- **`__tests__/unit/GraphLayoutInvariants.test.ts`** pins "every node the layout is given gets a
  position", the invariant whose violation makes patterns silently vanish. It records
  [B1](#b1--deleting-a-pattern-leaves-dangling-prerequisite-ids) and
  [B2](#b2--no-cycle-prevention-when-editing-prerequisites) as `test.failing` — passing while the
  bug exists, failing the moment it is fixed. This is executable confirmation that both defects
  reproduce exactly as filed, and it also confirms the timeline view is *not* affected, which is
  why the bug presents as "the graph is missing patterns the list shows".
- **`__tests__/unit/i18n.test.ts`** checks key parity both ways, no empty strings, matching
  `{{placeholders}}` across locales, and that every literal `t("…")` in `src/` resolves — with a
  guard test so a broken scanner cannot pass silently.

#### Still outstanding

1. **Conflict resolution** — `useImportDecisions` / `useExportSelection` (the `skip` vs `replace`
   decision on an id clash) are not covered yet. The round-trip suite stops at the module
   boundary; these hooks decide what actually lands in storage.
2. **Widen component coverage** — `PatternListManager` CRUD, the filter/sort sheets,
   `PatternListSelector`. The infrastructure is proven by one suite; the rest is volume.
3. **Extract `usePatternCrud`** from `PatternListManager` (7 `useState` + 7 inline async handlers,
   each repeating *storage write → local state → opportunistic Firestore sync*). Testable without
   rendering, and collapses the duplicated `if (activeList?.shareCode) syncPublishedList(...)`
   from three call sites. ~1.5 days.
4. **Ratchet the thresholds up** as 1–3 land. They are currently a floor, not a target.
5. **Verify the workflow on GitHub.** Every step was run locally and passes, but the workflow file
   itself has never executed on a runner.

#### Original plan, for reference

**Evidence:**
- `__tests__/` holds 3 files totalling 159 + 206 + 104 = **469 lines of test**, plus 60 lines of
  factories, against **~12 900 lines** of source in `src/` + `app/`.
- `@testing-library/react-native@13` and `@testing-library/jest-native@5` are devDependencies —
  and there is not one component test. They cannot run: `jest.config.js` sets
  `testEnvironment: "node"` with a bare `ts-jest` transform and no `jest-expo` preset and no
  `transformIgnorePatterns`, so importing anything from `react-native` fails.
- `collectCoverageFrom` covers only `src/pattern/data/**` and `src/pattern/graph/utils/**` — about
  a fifth of the code — and sets **no thresholds**, so coverage can only be read, never enforced.
- `jest.setup.js` hand-stubs four AsyncStorage methods. The library ships an official mock; the
  hand-rolled one silently diverges (it will need `getAllKeys` for B5, and `removeMany` is the v3
  name — verified correct for the pinned v3, but that is a coincidence waiting to break).
- **There is no `.github/` directory.** Nothing runs lint, typecheck, tests or a bundle check on
  push. `AGENTS.md` already names `npx expo export --platform web` and `--platform android` as the
  gate that catches platform-specific bundling regressions — and it is run by hand, when
  remembered.

**Plan:**

1. **Multi-project Jest.** Keep the fast node project for pure logic; add a `jest-expo`-preset
   project for components so the two do not slow each other down:
   ```js
   module.exports = {
     projects: [
       { displayName: "node", testEnvironment: "node", testMatch: ["**/__tests__/unit/**/*.test.ts"], /* current config */ },
       { displayName: "components", preset: "jest-expo", testMatch: ["**/__tests__/components/**/*.test.tsx"],
         setupFilesAfterEnv: ["<rootDir>/jest.setup.components.ts"],
         transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)/)"] },
     ],
   };
   ```
2. **Module mocks** for `expo-video`, `expo-video-thumbnails`, `expo-file-system`,
   `expo-image-picker`, `expo-document-picker`, `expo-camera`, `react-native-youtube-iframe` and
   `firebase/firestore`, in `__mocks__/`. Firebase especially: `firebaseConfig.ts` already has a
   `firebaseAvailable === false` mode that no-ops, so tests can run in that mode and the mock only
   covers the tests that exercise sharing.
3. **`renderWithProviders`** in `utils/` — wraps `ThemeProvider` + `ActivePatternListProvider` +
   an i18n instance with the real `en.json`, and takes a seeded storage state. Without this,
   every component test re-does the same 30 lines.
4. **Coverage thresholds that ratchet.** Start at whatever today's numbers are for the data and
   graph-utils directories, widen `collectCoverageFrom` to all of `src/`, and set a global floor
   that only ever goes up. Enforce in CI.
5. **GitHub Actions** (`.github/workflows/ci.yml`): `npm ci` → `npm run lint` →
   `npx tsc --noEmit` → `npm test -- --coverage` → `npx expo export --platform web` →
   `npx expo export --platform android`. The last two are the documented platform-regression gate
   and take minutes; they belong in CI, not in a human's memory. Cache `node_modules` and the
   Metro cache.
6. **An `npm audit` check** that fails on anything beyond the three documented, currently
   unfixable `decode-uri-component` findings (`AGENTS.md`, "Dependencies & security"). The expected
   state is written down; make the machine hold it.

**Highest-value suites to write first**, in order:

| # | Suite | Why |
|---|---|---|
| 1 | **Export/import round-trip** | This is real user data leaving and re-entering the app, with base64 video embedding, three video locations, and a conflict-resolution UI. A silent regression here loses somebody's lists. |
| 2 | **Storage + migrations** ([F3](#f3--storage-schema-versioning-and-import-validation)) | Same reason, one layer down. |
| 3 | **Graph layout invariants** | Property-style: every node gets a position; no node is dropped; prerequisites are a subset of the node set; layout is deterministic for a given input. Would have caught [B1](#b1--deleting-a-pattern-leaves-dangling-prerequisite-ids). |
| 4 | **i18n key parity** | Two assertions: `en.json` and `de.json` have identical key sets (true today — 197 each), and every `t("literal")` in `src/` resolves against `en.json`. Both are ~20 lines and prevent a whole class of shipped bug. |
| 5 | **Filter + sort hooks** | Pure, cheap, and the logic is about to be reused by [L1](#l1--searchable--filterable-pattern-graph). |
| 6 | **`PatternListManager` CRUD** | The state transitions there are the app's core, and they are currently entangled with JSX (384 lines). Testing them is most of the reason to extract them — see below. |

**Refactor that F1 makes worthwhile:** `PatternListManager` holds 7 `useState` hooks and 7 async
CRUD handlers inline, each of which does *storage write → local state → opportunistic Firestore
sync* (`PatternListManager.tsx:64-140`). Extracting that into a `usePatternCrud(activeList,
patterns)` hook — or a reducer — makes it testable without rendering, removes the duplicated
`if (activeList?.shareCode) syncPublishedList(...)` block from three call sites, and gives the
read-only guard one place to live instead of six. ~1.5 days, and it pays for itself the first time
someone adds an eighth mutation.

**Effort:** 5–8 days for the infrastructure and the first three suites; the rest accretes.

---

### F2 — Graph domain layer

**Evidence of the current shape:**

- `type ViewMode = "timeline" | "graph"` is declared **three times**:
  `PatternGraphScreen.tsx:14`, `GraphViewContainer.tsx:10`, `PatternGraphHeader.tsx:9`.
- `NetworkGraphView` casts its way past the contract: `patterns as any` (line 99),
  `onNodeTap as any` (line 102); `useGraphLayout` does the same (`useGraphLayout.ts:46`). Those
  casts exist because `PatternNode` declares its own structural `BasePattern`
  (`PatternNode.tsx:8-15`) that diverges from `IPattern`.
- `GraphSvg.tsx` exports `drawNodes` and `ArrowheadMarker`, which `TimelineView.tsx:19` imports —
  a view importing another view's rendering internals. These are shared primitives that belong in
  their own module.
- `createEmptyNetworkGraph` is a **plain function that calls `useTranslation`**, with an
  `// eslint-disable-next-line react-hooks/rules-of-hooks` on top
  (`NetworkGraphView.tsx:55-56`), and it is called conditionally (`NetworkGraphView.tsx:42-44`)
  after `useGraphLayout` and a `useMemo` have already run. Going from a populated list to an empty
  one changes the hook count between renders. It happens to work; it is a latent crash and the
  suppression comment is the tell.
- **`useGraphLayout` calls `detectCircularDependencies(patterns)` outside its `useMemo`**
  (`useGraphLayout.ts:39`), so it re-runs on **every render** of the network view. And that
  function enumerates paths, copying the visited set and the path array per edge
  (`GenericGraphUtils.ts:53`: `findCycles(prereqId, new Set(visited), [...path])`), called once per
  pattern. On a densely linked list that is exponential in the number of distinct paths. Its only
  output is `console.warn`.

**Plan:**

1. `src/pattern/graph/model/` with `buildGraphModel(patterns, patternTypes, selection?)` returning
   the `GraphModel` sketched in [L1](#l1--searchable--filterable-pattern-graph): nodes, edges,
   adjacency, depth map, cycles, colour map. Computed once, memoised on `(patterns, patternTypes,
   selectionKey)`.
2. Replace the path-enumerating cycle detector with an **iterative colour-DFS or Tarjan SCC pass**,
   O(V + E), returning strongly connected components. Keep the public name so call sites do not
   churn; change the return type to something the UI can actually use (a cycle banner) instead of
   a console warning.
3. Views become pure renderers over the model. `TimelineView` and `NetworkGraphView` stop calling
   `detectCircularDependencies` and stop computing depth.
4. Move the shared SVG primitives (`ArrowheadMarker`, `drawNodes`, `drawEdges`, `PatternNode`,
   `PatternNodeGroup`) into `src/pattern/graph/render/`; `GraphSvg.tsx` becomes the network view's
   own composition.
5. Fix `createEmptyNetworkGraph` into a proper component (`<EmptyGraphMessage />`) and drop the
   lint suppression.
6. Extract `ViewMode` to `src/pattern/graph/types/ViewMode.ts`.
7. Delete every `as any` in the graph directory. There are four; each one is load-bearing only
   because of the structural types above.

**Tests:** the model is pure, so all of it is unit-testable — adjacency construction, depth on
DAGs and on cycles, edge generation, colour mapping, determinism, and the "every node gets a
position" invariant against both layout functions.

**Effort:** 3–5 days. Do it as two PRs (extract-and-move with no behaviour change; then the
algorithmic fixes) so the diff is reviewable.

---

### F3 — Storage schema versioning and import validation

**Evidence:**

- The AsyncStorage payloads carry **no version**. Compatibility is handled by ad-hoc defaulting at
  read time — `modifiers: list.modifiers ?? []` and `modifierRefs: pattern.modifierRefs ?? []`
  (`PatternListStorage.ts:8-22`). That worked once. It does not compose: three more optional
  fields and the read path becomes the migration system, with no way to know what version any
  given record is.
- `importPatternLists` accepts **any truthy version** and never validates the payload shape:
  `if (!data.version || !data.patternLists) return createResult(false, "Invalid import file format")`
  (`ImportPatterns.ts:29`). Everything after that trusts the file. The file comes from
  `expo-document-picker` — i.e. from anywhere. A malformed or hostile export writes straight into
  storage and then into the UI.
- `savePatternList` is **read-modify-write over the whole list array** with no concurrency guard
  (`PatternListStorage.ts:44-63`): load all → find index → mutate → write all. Two overlapping
  saves — entirely possible, since `PatternListSelector.handleSaveList` and the context's
  `updateActiveList` can both be in flight — and one silently loses.
- `clearAllData` orphans pattern keys ([B5](#b5--clearalldata-orphans-every-pattern-key--done)).

**Plan:**

1. **`SCHEMA_VERSION` + a migration runner.** `src/pattern/data/migrations/` with numbered,
   individually tested migrations (`001_add_modifiers.ts` formalising what the `?? []` defaulting
   does today, and onwards). Run once at startup, before `ActivePatternListProvider` reads
   anything — which means a gate in `app/_layout.tsx` or inside the provider's initial load,
   showing the existing loading state until it completes. Migrations must be idempotent and must
   never run backwards; record the applied version under `@schemaVersion`.
2. **Runtime validation of imported payloads.** Hand-written type guards in
   `src/pattern/data/validation/` (keeps the dependency count at zero and is entirely testable) or
   `zod` if the team prefers a schema library. Validate: version in a known range; every list has
   `id`/`name`/`patternTypes`/`modifiers`; every pattern has an integer `id` and a
   `prerequisites` array of integers; every `typeId` resolves to a type in its own list; every
   `modifierId` in a `modifierRefs` resolves to a modifier in its own list; every prerequisite id
   resolves to a pattern in the same list. Reject with a specific message, not a generic failure —
   `ImportPatterns.ts` already has a `warnings` channel for the non-fatal cases; use it.
3. **Serialise writes.** A single in-flight write promise per storage key inside
   `PatternListStorage.ts`; queue the next one behind it. ~20 lines, removes an entire class of
   lost-update bug, and no call site changes.
4. **Startup GC** for orphaned `@patterns_*` keys — and the same pass later covers L2's stale
   layout entries and L3's orphaned jobs. Build it once, generically: "keys matching prefix P whose
   id is not in the known-lists set".
5. **Export-format version handling.** `exportDataVersion` is `"3.0.0"`. Introduce explicit
   `canImport(version)` with a supported range and per-version upgrade functions, so that L2 and L3
   can bump to 3.1.0 without either of them inventing the mechanism.

**Tests:** each migration in isolation, and as a chain from every prior version; validator
accept/reject tables including hostile inputs (wrong types, missing fields, huge arrays, dangling
references, duplicate ids); concurrent-write test asserting no lost update; GC test asserting that
only orphans are removed.

**Effort:** 4–6 days. Do this before L2 and L3, both of which add persisted state.

---

## 6. Defects found during triage

### B1 — Deleting a pattern leaves dangling prerequisite ids

**Severity: high — silent data corruption plus invisible nodes.**

`deletePattern` filters the pattern out of the array and writes
(`src/pattern/list/PatternListManager.tsx:88-98`). It never removes that id from any other
pattern's `prerequisites[]`. Note that `deleteModifier` **twenty lines below it** does exactly the
right thing for modifiers (`PatternListManager.tsx:126-140`, scrubbing `modifierRefs` from every
pattern) — so this is an oversight, not a design choice.

Two distinct consequences, both reachable by an ordinary user:

1. **Nodes vanish from the network graph.** `calculateGraphLayout` places a node only when every
   prerequisite is already positioned (`NetworkGraphUtils.ts:74-78` and again at `:144-145`). A
   dangling id is never positioned, so the node is never placed; `drawNodes` finds no position and
   renders `null` (`GraphSvg.tsx:75-76`). The node and its entire downstream subtree disappear,
   with no error and no warning. The timeline view is unaffected — it positions by depth, and
   `calculatePrerequisiteDepthMap` treats a missing prerequisite as depth 0 — so the bug presents
   as "the graph view is missing patterns that the timeline view shows", which is a confusing
   report to receive.
2. **Id recycling re-attaches stale links.** `createNewId` returns
   `Math.max(...patterns.map(p => p.id)) + 1` (`PatternListManager.tsx:30-33`). Delete the
   highest-id pattern, create a new one, and it takes the dead id — inheriting every dangling
   inbound link. A freshly created pattern silently becomes a prerequisite of unrelated patterns.

**Fix:**
- Scrub the deleted id from every pattern's `prerequisites` in the same write, mirroring
  `deleteModifier`.
- Replace `max + 1` with a monotonic `nextPatternId` stored on `IPatternList` (a migration — see
  [F3](#f3--storage-schema-versioning-and-import-validation)), so ids are never reused.
- Add a repair pass on load that drops prerequisite ids with no matching pattern, so existing
  corrupted lists heal themselves.
- Regression test: `positions.size === patterns.length` for every layout function, plus a
  delete-then-create round-trip asserting no prerequisite points at a non-existent pattern.

---

### B2 — No cycle prevention when editing prerequisites

`EditPatternForm` renders every pattern in the list as a togglable prerequisite chip
(`src/pattern/list/EditPatternForm.tsx:307-339`) with no eligibility filtering. A pattern can be
made its own prerequisite, and A→B→A is two taps away.

Cycles are only *detected*, at render time, by `detectCircularDependencies`, whose entire effect
is a `console.warn` (`GenericGraphUtils.ts:41-44`). In the network view, patterns in a cycle can
never satisfy the `prerequisites.every(positioned)` gate, so — exactly as in B1 — they silently
disappear.

**Fix:** compute reachability from the graph model ([F2](#f2--graph-domain-layer)) and disable
chips that would close a cycle, with a short explanation on the disabled chip. Belt and braces:
have the layout functions place unplaceable nodes at a fallback position and have the model expose
`cycles` so the view can show a warning banner rather than a mystery.

---

### B8 — Imported videos overwrite each other — DONE

**Severity was: high — silent data loss on import, on the common path.**

**Found by** the export/import round-trip suite
(`__tests__/unit/ExportImportRoundTrip.test.ts`, "known defects"), and confirmed by running those
two cases unmasked: both videos resolve to the identical path
`file:///document/imported-pattern_1-1700000000000.mp4`.

`ImportPatterns.ts` builds each restored video's destination like this:

```ts
// src/pattern/data/ImportPatterns.ts:148-152
function generateVideoUri(contextId: string) {
  const timestamp = Date.now();
  const safeId = contextId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${Paths.document.uri}imported-${safeId}-${timestamp}.mp4`;
}
```

The `contextId` is `pattern:${pattern.id}` for **every** video of that pattern
(`ImportPatterns.ts:51-56`), so the only thing distinguishing two of them is `Date.now()`. The
restore loop is tight and the writes are synchronous, so two videos of the same pattern almost
always land in the same millisecond — the second `file.write` overwrites the first, and both
`videoRefs` end up pointing at one file. The user sees the same clip twice and the other is gone.

Same-millisecond is the normal case here, not a rare race. Two further collisions share the cause:

- Two patterns with the same numeric `id` in **different lists** in one import file also share the
  context id (ids are only unique within a list), so they collide across lists.
- A pattern video and a modifier-combination video never collide, because their context strings
  differ — that part is fine.

The result reaches storage: `useDataTransfer` hands `result.patternLists` straight into the import
decision flow (`src/settings/hooks/useDataTransfer.ts:101-107`), which persists it.

**Fixed** in `generateVideoUri` — the suffix now comes from `generateUUID()` instead of
`Date.now()`, so it is unique per video rather than per context. `contextId` stays in the filename
purely so the files remain identifiable on disk.

```ts
function generateVideoUri(contextId: string) {
  const safeId = contextId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${Paths.document.uri}imported-${safeId}-${generateUUID()}.mp4`;
}
```

The two `test.failing` cases became real tests, joined by two more, under
`"restored video paths are unique"`. All four freeze `Date.now()`, which is the
guaranteed-collision case under the old implementation — so they fail loudly if the filename ever
goes back to being time-derived. Verified by reverting the fix: three of the four fail. The fourth
(a pattern's own video vs. a modifier-combination video) passes either way, because those have
different context ids and never collided; it is there to document that.

**Still open, same six lines** — deliberately left out of the fix rather than bundled with it:

- The extension is hardcoded `.mp4` regardless of the source file's real type, so an imported
  `.mov` lands as `.mp4`.
- Nothing cleans up restored video files if the user then cancels the import at the decision step,
  so they leak into the documents directory. Same family as
  [B5](#b5--clearalldata-orphans-every-pattern-key--done) and best handled by the generic startup
  GC proposed in [F3](#f3--storage-schema-versioning-and-import-validation).

---

### Other defects

Covered above as small changes: [B3](#b3--pattern-delete-confirmation-is-hardcoded-english--done-was-misdiagnosed),
[B4](#b4--the-pattern-list-is-not-virtualised--done),
[B5](#b5--clearalldata-orphans-every-pattern-key--done),
[B6](#b6--camera-and-media-config-plugins-are-not-registered--done-confirmed-and-worse-than-filed),
[B7](#b7--the-graphs-detail-modal-can-never-show-modifiers--done).

---

## 7. Notes on maintainability

Observations that are not tasks but that should inform how the tasks above are done.

- **`AGENTS.md` is unusually good** and is the main reason this triage could be grounded quickly.
  Every item above that changes an architectural rule — L2's read-only exception, L1's new model
  layer, F3's migration runner, L3's feature flag — must update it in the same PR. It is load
  bearing.
- **The styling convention (per-render inline `StyleSheet.create` from a palette) is consistent
  and works**, but it recreates every stylesheet on every render, which will show up in the graph
  views once nodes are draggable. If L2 lands, memoise `getStyles(palette)` per palette in the
  hot components. Do not convert the whole codebase; the pattern is fine everywhere else.
- **Four screens, one global context.** `ActivePatternListContext` holds the active list and its
  patterns and is consumed by everything. That is the right call at this size. It will stop being
  the right call at the point where a screen needs a *different* list than the active one — which
  L3's job queue nearly requires (a job outlives the active-list selection). Keep job state out of
  that context.
- **Two icon libraries are declared, one is used.** *(still open)* `react-native-vector-icons` is imported by
  **12** files; `@expo/vector-icons` is a direct dependency and is imported by **zero** (verified
  by grep over `src/` and `app/`). `@expo/vector-icons` is the Expo-maintained wrapper and is the
  one the SDK expects. Pick one: either drop the unused `@expo/vector-icons` from `package.json`,
  or migrate the 12 files (a mechanical import swap — the component and prop names match) and drop
  `react-native-vector-icons`, which also removes a font-asset pipeline and a
  `@types/react-native-vector-icons` devDependency. The second is the better end state; fold it
  into whichever PR already touches the most components.
- ~~**`lucide-react` is a dead dependency.**~~ **Removed.** It was the *web* build of Lucide (not
  `lucide-react-native`) and imported nowhere. `@testing-library/jest-native` went with it —
  deprecated, and RNTL 13 registers its own matchers.
- **`src/common/utils/TImeUtils.ts`** has a typo in its filename (capital `I`). It has exactly one
  importer (`src/pattern/list/PatternVideos.tsx:20`, which spells the typo faithfully), so the
  rename is a two-line change today and gets more expensive with every new call site. Do it now.
  Note that it imports fine on a case-insensitive filesystem and breaks on a case-sensitive one
  the moment someone types the name correctly — CI on Linux ([F1](#f1--test-infrastructure-and-ci--in-progress))
  is where that would surface.
