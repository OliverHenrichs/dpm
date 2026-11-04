import { ISequence } from "@/src/pattern/types/IPatternList";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";

/*
 * "Show sequence" on the Map (#136, phase 3): the sequence's figures stand out, the rest dims,
 * and its order is drawn as numbered, dashed arrows over the prerequisite edges. Pure, so both
 * views share it and it is unit-tested; `render/SequenceLayer.tsx` draws it.
 */

/** One arrow of a shown sequence: from one figure to the next one drawn. */
export interface SequenceHop {
  from: number;
  to: number;
}

export interface SequenceOverlay {
  /** Each drawn figure of the sequence, with its step numbers (1-based, as on the List tab). */
  numbers: Map<number, number[]>;
  /** The arrows, in dancing order, each pair of figures once. */
  hops: SequenceHop[];
}

/**
 * What the Map draws for `sequence`, over the figures `drawn` (what the filter left).
 *
 * Steps are numbered as in the sequence, free steps included, so "5" on the Map is step 5 in
 * the list. Free steps and figures the filter hides are passed over: the arrow runs on to the
 * next figure drawn, and the numbers show the gap. A figure danced twice in a row gets no arrow
 * onto itself, just both numbers; a pair danced twice in the same direction gets one arrow.
 */
export function sequenceOverlay(
  sequence: ISequence,
  drawn: ReadonlySet<number>,
): SequenceOverlay {
  const numbers = new Map<number, number[]>();
  const hops: SequenceHop[] = [];
  const seen = new Set<string>();
  let previous: number | undefined;
  sequence.steps.forEach((step, index) => {
    if (step.kind !== "figure" || !drawn.has(step.patternId)) return;
    const id = step.patternId;
    numbers.set(id, [...(numbers.get(id) ?? []), index + 1]);
    if (previous !== undefined && previous !== id) {
      const key = `${previous}>${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        hops.push({ from: previous, to: id });
      }
    }
    previous = id;
  });
  return { numbers, hops };
}

/** At most this many step numbers on a figure's badge; more end in "…". */
export const MAX_BADGE_NUMBERS = 3;

/** A figure's step numbers as its badge shows them: "2", "1 · 4", "1 · 4 · 7 …". */
export function badgeLabel(numbers: readonly number[]): string {
  const shown = numbers.slice(0, MAX_BADGE_NUMBERS).join(" · ");
  return numbers.length > MAX_BADGE_NUMBERS ? `${shown} …` : shown;
}

/** How far an arrow bends off the straight line, as a share of its length. */
const BEND = 0.18;
/** How far past a box's side an arrow along its column or row bends, in box widths/heights. */
const SIDESTEP = 1.4;
/** Room between a box and the end of an arrow (the start, and the arrowhead's tip). */
const GAP = 4;

/**
 * An arrow's path between two boxes: a gentle curve, so A → B and B → A bend to opposite sides
 * rather than lying on top of each other, cut at both boxes' outlines. `tipRoom` is left free in
 * front of the target for the arrowhead. Null when the boxes overlap and there is no room.
 */
export function hopPath(
  from: LayoutPosition,
  to: LayoutPosition,
  tipRoom: number,
): string | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  // Overlapping boxes (only a manual layout puts them so) have no outside to run between.
  if (Math.abs(dx) < NODE_WIDTH && Math.abs(dy) < NODE_HEIGHT) return null;
  // Between two boxes in one column (or one row), the straight way runs through whatever
  // sits in between, and two stacked boxes leave no room for an arrow at all: bend out past
  // the column's side instead. A quadratic curve reaches half way to its control point.
  let bend = length * BEND;
  if (Math.abs(dx) < NODE_WIDTH) bend = Math.max(bend, NODE_WIDTH * SIDESTEP);
  else if (Math.abs(dy) < NODE_HEIGHT)
    bend = Math.max(bend, NODE_HEIGHT * SIDESTEP);
  // The control point, off the midpoint to the left of the direction of travel.
  const cx = (from.x + to.x) / 2 - (dy / length) * bend;
  const cy = (from.y + to.y) / 2 + (dx / length) * bend;
  const start = toOutline(from, cx, cy, GAP);
  const end = toOutline(to, cx, cy, GAP + tipRoom);
  if (!start || !end) return null;
  // Too short to draw once both ends are cut back: the boxes nearly touch.
  if (Math.hypot(end.x - start.x, end.y - start.y) < tipRoom) return null;
  return `M ${round(start.x)} ${round(start.y)} Q ${round(cx)} ${round(cy)} ${round(end.x)} ${round(end.y)}`;
}

/**
 * Where the line from a box's centre towards (tx, ty) leaves the box, plus `extra` beyond it.
 * Null when the target point is inside the box.
 */
function toOutline(
  centre: LayoutPosition,
  tx: number,
  ty: number,
  extra: number,
): LayoutPosition | null {
  const dx = tx - centre.x;
  const dy = ty - centre.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const scale = Math.min(
    dx === 0 ? Infinity : NODE_WIDTH / 2 / Math.abs(dx),
    dy === 0 ? Infinity : NODE_HEIGHT / 2 / Math.abs(dy),
  );
  if (scale >= 1) return null;
  const reach = scale * length + extra;
  return {
    x: centre.x + (dx / length) * reach,
    y: centre.y + (dy / length) * reach,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
