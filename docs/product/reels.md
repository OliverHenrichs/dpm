# Reels

The Reels tab pages through every figure that has a video, for browsing before a social rather
than looking something up.

## What the user can do

- An **overview** shows the figures as stills, several to a screen, from _This list_ or _All
  lists_ on the phone.
- Tapping one opens them **one per screen**: swipe up or down between figures, sideways through a
  figure's videos. Its own videos come first, then those danced with a modifier. A caption names
  the figure, its type and, for a variant's video, the modifier.
- The grid button or the back gesture returns to the overview.
- Figures are in list order, then by name. Figures without a video are left out.
- An edit to the open list shows at once. Other lists are read fresh each time the tab is opened.
- Empty states say how to get a video into Reels.

## Rules that must always hold

| Rule                                                                   | Guarded by                                   |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| Only the video on screen holds a player, and only while Reels is open | No test yet                                  |
| Order: lists, then figures by name, own videos before variants'        | `__tests__/unit/reels.test.ts`               |
| A variant's video still shows after its modifier is deleted            | No test yet                                  |

## Not built yet

Nothing planned.

## Code

`src/reels/AGENTS.md`.

## Decisions

None recorded yet.
