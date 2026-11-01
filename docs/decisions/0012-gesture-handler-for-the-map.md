# 0012: The Map's gestures all live in Gesture Handler

- **Status:** accepted
- **Date:** recorded 2026-11-01
- **Decided by:** Oliver merged the PRs that built it (L2)
- **Recorded from:** `src/pattern/graph/AGENTS.md` (Pan and zoom, Dragging a node), `docs/history/AGENT_TASKS.md` L2

## Context

Moving figures by hand needs a drag inside a pannable, zoomable canvas. The old canvas library used
React Native's `PanResponder`, which does not negotiate with Gesture Handler, so whichever claimed a
touch first won, unpredictably.

## Decision

- The canvas is our own `ZoomableCanvas` on Gesture Handler and Reanimated.
- One pan gesture hit-tests which figure it picked up; figures have no `onPress`.
- No double-tap zoom, so a single tap opens a figure at once.

## Alternatives considered

- **Keep `@openspacelabs/react-native-zoomable-view`**: `PanResponder`-based.
- **A gesture per node**: a detector inside an `<Svg>`, fragile on native.

## Consequences

- No `PanResponder` may come back on the Map.
- Worklets must not contain inline arrow functions (the React Compiler hoists them to plain JS).
