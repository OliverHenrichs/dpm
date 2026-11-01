# Map

The Map tab shows which figures build on which, from the figures' prerequisites. It has two views
of the same graph, switched in its header: **Timeline** and **Network**.

## What the user can do

### Both views

- Each figure is a box in its type's colour. A higher level shows as a stronger tint. Boxes follow
  the app style: rounded and outlined in After Hours, square with a colour bar in Clipboard.
- A box **badges what it carries**: a play mark when the figure or one of its variants has a
  video, and up to three dots for attached modifiers. Universal modifiers are not counted, since
  they apply to every figure.
- **Tapping a box** opens the figure's details. On a list the user may edit, the details have
  _Edit Figure_, which opens the same form as the List tab. On a subscribed list that takes
  suggested changes, they have _Suggest a change_ instead ([sharing](sharing.md)). Otherwise the
  details are read-only.
- **Filter** with the same filter as the List tab. The Map also asks what to show along with the
  matches: _Matches only_, _Path to_ (what leads to them) or _Everything connected_. Matches stay
  bright and the figures around them dim. A summary says how many matched and how many are shown,
  with _Clear filter_. Where a hidden figure sat between two shown ones, the edge is drawn dashed.
- A **legend** explains type colours, level shading, badges and the direction of prerequisites.
  It opens by itself the first time the Map is shown. On an editable list, tapping a type in the
  legend changes its colour.
- When figures form a **prerequisite loop** (possible only through old or imported data), a
  banner says how many figures are caught in it.
- An empty list explains what the Map shows and where to add figures.

### Timeline

- One lane per figure type, figures left to right by how deep they sit in the chain. An edge that
  skips a column curves around the boxes in between.
- Only types with a figure shown get a lane.
- **Lanes can be reordered**: hold a lane's grip, left of its name, and drag it up or down. The
  order is saved on the list, so it is shared with subscribers. _Reset lanes to automatic order_
  in the header (shown only while there is a manual order) goes back. Screen readers get _Move up_
  and _Move down_ actions. A read-only list has no grips.

### Network

- A hierarchical layout with pan and pinch zoom. It opens fitted to what is drawn. There is no
  double-tap zoom, so a single tap opens a figure at once.
- **Figures can be moved**: hold one for a moment, then drag. It lifts to show it was picked up.
  A hint says how until dismissed. The arrangement is saved per list and per phone, also on
  subscribed lists, and is never shared. A figure added later is placed near its prerequisites
  instead of re-laying out everything. _Reset layout_ asks before throwing the arrangement away.
- **Focus preview**: a mark sits in the middle of the view. After the first pan, whichever figure
  touches it is previewed in a card, with its first video playing muted once the focus has
  rested on it (YouTube and Vimeo links stay a still). Releasing the pan centres that figure.
  Tapping the card or the mark opens the figure.

## Rules that must always hold

| Rule                                                                                  | Guarded by                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Every figure gets a position, even with dangling or looping prerequisites             | `__tests__/unit/GraphLayoutInvariants.test.ts`                    |
| Filtering never makes a shown figure or its subtree vanish                            | `__tests__/unit/filterGraphModel.test.ts`                         |
| Both views agree on depth, edges and loops (one graph model)                          | `__tests__/unit/GraphModel.test.ts`                               |
| A figure added to a manual arrangement is placed near its prerequisites              | `__tests__/unit/resolveLayout.test.ts`                            |
| Stored positions of deleted figures are pruned on save                                | `__tests__/components/useGraphPositions.test.ts`                  |
| Lanes not named in the manual order follow it in automatic order                      | `__tests__/unit/laneOrder.test.ts`                                |
| Node text keeps 4.5:1 contrast on every type colour in every theme                    | `__tests__/unit/nodeFrame.test.ts`                                |
| Badges sit inside the box outline in both styles                                      | `__tests__/components/nodeBadgeRender.test.tsx`                   |

## Not built yet

- Auto-scroll at the screen's edges while dragging a lane.
- Highlighting sequences on the Map (sequences phase 3, planned).

## Code

`src/pattern/graph/AGENTS.md`; filtering in `src/pattern/filter/`; the details view is shared with
the List tab (`src/pattern/list/AGENTS.md`).

## Decisions

- [0012](../decisions/0012-gesture-handler-for-the-map.md) The Map's gestures all live in Gesture Handler
- [0005](../decisions/0005-figure-ids-are-never-reused.md) Figure ids are never reused (the manual layout relies on it)
