# Graph node drawing — `src/pattern/graph/render/`

Split from `src/pattern/graph/AGENTS.md`, which covers the graph views as a whole; read that too.
Unqualified paths below are relative to `src/pattern/graph/`.

## Node boxes follow the app style

`render/NodeFrame.tsx` draws a pattern's box from `theme.graph` (`tokens.ts`), after the style
mockups' Map screens: After Hours outlines a rounded box in the type colour, with a soft halo in
its dark theme; Clipboard draws a square box on the neutral `border` rule with the type colour in
a bar down its left edge. Edges (`render/edgeStyle.ts`) take the accent in After Hours and the
muted rule in Clipboard; lane labels take the list's section style. Node text uses the
`nodeTitle` / `nodeMeta` text styles.

- **Level is a tint of the type colour mixed into the surface** (`model/nodeFrame.ts`), one solid
  fill so edges don't show through. `levelTints(n)` spreads the list's levels over 0.1 to 0.36;
  `buildGraphModel`'s third argument (level ids) sets each node's `tint`. The tints are capped by `__tests__/unit/nodeFrame.test.ts`:
  the node text must hold 4.5:1 over every palette type colour in every theme. That is also why
  the counts are in `text`, not `textMuted`.
- `Legend` draws its samples with `NodeFrame` itself, so it matches whatever the style draws.

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
