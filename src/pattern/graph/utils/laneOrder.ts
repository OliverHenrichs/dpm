import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";

/** Up to this many lanes every order is tried; above it, a barycentre heuristic. */
const EXACT_LIMIT = 7;
const HEURISTIC_PASSES = 8;

/**
 * The timeline's lanes, top to bottom: only the types that have a pattern shown, in the user's
 * own order where they set one (`IPatternList.laneOrder`), otherwise ordered so that linked types
 * sit near each other.
 *
 * A type with nothing shown gets no lane, manual order or not. A filter that hid a type used to
 * leave its lane as an empty band (tester review 1).
 *
 * With a manual order, the types it names come first, in its order; a type it does not name (one
 * added since the user last dragged a lane) follows, in its automatic position among the rest.
 * An id naming no type is ignored.
 */
export function orderLanes(
  patternTypes: PatternType[],
  patterns: IPattern[],
  manualOrder?: readonly string[],
): PatternType[] {
  const automatic = automaticLanes(patternTypes, patterns);
  if (!manualOrder?.length) return automatic;
  const byId = new Map(automatic.map((type) => [type.id, type]));
  const placed = new Set<string>();
  const lanes: PatternType[] = [];
  manualOrder.forEach((id) => {
    const type = byId.get(id);
    if (!type || placed.has(id)) return;
    placed.add(id);
    lanes.push(type);
  });
  automatic.forEach((type) => {
    if (!placed.has(type.id)) lanes.push(type);
  });
  return lanes;
}

/**
 * The manual order to save after the user dragged a lane: `shownOrder` is the lanes as now drawn,
 * top to bottom, after the move.
 *
 * Under a filter only some lanes are drawn, so the order covers every type of the list: the
 * hidden ones keep their places and the shown ones fill the places shown lanes had, in their new
 * order. Types with no figure at all go last (they have no lane to drag), keeping their place in
 * an earlier manual order.
 */
export function reorderLanes(
  patternTypes: PatternType[],
  patterns: IPattern[],
  manualOrder: readonly string[] | undefined,
  shownOrder: readonly string[],
): string[] {
  const known = new Set(patternTypes.map((type) => type.id));
  const full: string[] = [];
  const add = (id: string) => {
    if (known.has(id) && !full.includes(id)) full.push(id);
  };
  orderLanes(patternTypes, patterns, manualOrder).forEach((type) =>
    add(type.id),
  );
  manualOrder?.forEach(add);
  patternTypes.forEach((type) => add(type.id));

  const shown = [...new Set(shownOrder)].filter((id) => known.has(id));
  const shownSet = new Set(shown);
  // Every known id is in `full`, so each shown place is filled exactly once.
  let next = 0;
  return full.map((id) => (shownSet.has(id) ? shown[next++] : id));
}

/** `order` with the entry at `from` moved to `to`; an index out of range changes nothing. */
export function moveLane<T>(
  order: readonly T[],
  from: number,
  to: number,
): T[] {
  const moved = [...order];
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) {
    return moved;
  }
  const [lane] = moved.splice(from, 1);
  moved.splice(to, 0, lane);
  return moved;
}

/**
 * Where a lane being dragged would land: its index among the lanes once the dragged one's centre
 * is at `y`. `centres` are the lanes' vertical centres as laid out when the drag began, top to
 * bottom, so the answer does not shift as the lanes reflow under the finger.
 *
 * A worklet: the drag asks on every frame, on the UI thread, and tells React only when the
 * answer changes.
 */
export function laneIndexAt(
  centres: readonly number[],
  from: number,
  y: number,
): number {
  "worklet";
  let index = 0;
  for (let i = 0; i < centres.length; i++) {
    if (i !== from && centres[i] < y) index++;
  }
  return index;
}

/** The index of the lane whose band holds `y`, or -1. A worklet, for the drag's pick-up. */
export function laneAt(
  bands: readonly { y: number; height: number }[],
  y: number,
): number {
  "worklet";
  for (let i = 0; i < bands.length; i++) {
    if (y >= bands[i].y && y < bands[i].y + bands[i].height) return i;
  }
  return -1;
}

/**
 * The automatic order:the lanes that have a pattern shown, ordered to minimise the summed lane
 * distance of every edge between two types, so a Push → Tuck edge no longer crosses every lane in
 * between when the list happens to name Push first and Tuck last. Ties keep the list's own
 * order, so a list with no edges across types draws its lanes exactly as before.
 */
function automaticLanes(
  patternTypes: PatternType[],
  patterns: IPattern[],
): PatternType[] {
  const shown = new Set(patterns.map((p) => p.typeId));
  const lanes = patternTypes.filter((type) => shown.has(type.id));
  if (lanes.length < 3) return lanes;

  const index = new Map(lanes.map((type, i) => [type.id, i]));
  const typeOf = new Map(patterns.map((p) => [p.id, index.get(p.typeId)]));
  const weights = lanes.map(() => lanes.map(() => 0));
  patterns.forEach((p) => {
    const to = typeOf.get(p.id);
    p.prerequisites.forEach((id) => {
      const from = typeOf.get(id);
      if (from === undefined || to === undefined || from === to) return;
      weights[from][to] += 1;
      weights[to][from] += 1;
    });
  });

  const order =
    lanes.length <= EXACT_LIMIT
      ? exactOrder(weights)
      : barycentreOrder(weights);
  return order.map((i) => lanes[i]);
}

/** Summed lane distance of every edge, for `order` (lane indices, top to bottom). */
function cost(order: number[], weights: number[][]): number {
  const row = new Array<number>(order.length);
  order.forEach((lane, position) => (row[lane] = position));
  let total = 0;
  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) {
      total += weights[a][b] * Math.abs(row[a] - row[b]);
    }
  }
  return total;
}

/**
 * The cheapest order, trying them all in lexicographic order and keeping the first strict
 * minimum, so ties fall to the order closest to the list's own.
 */
function exactOrder(weights: number[][]): number[] {
  const n = weights.length;
  let best = Array.from({ length: n }, (_, i) => i);
  let bestCost = cost(best, weights);
  const current: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const visit = () => {
    if (current.length === n) {
      const c = cost(current, weights);
      if (c < bestCost) {
        bestCost = c;
        best = [...current];
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      current.push(i);
      visit();
      current.pop();
      used[i] = false;
    }
  };
  visit();
  return best;
}

/**
 * Moves each lane towards the average position of the lanes it links to, a few times, then
 * moves single lanes to wherever they cost least until nothing improves. Starts from, and only
 * ever replaces, the list's own order, so the result is never worse than it.
 */
function barycentreOrder(weights: number[][]): number[] {
  const n = weights.length;
  let order = Array.from({ length: n }, (_, i) => i);
  let best = order;
  let bestCost = cost(order, weights);
  for (let pass = 0; pass < HEURISTIC_PASSES; pass++) {
    const row = new Array<number>(n);
    order.forEach((lane, position) => (row[lane] = position));
    const centre = (lane: number) => {
      let sum = 0;
      let weight = 0;
      weights[lane].forEach((w, other) => {
        sum += w * row[other];
        weight += w;
      });
      return weight === 0 ? row[lane] : sum / weight;
    };
    order = [...order].sort((a, b) => centre(a) - centre(b) || row[a] - row[b]);
    const c = cost(order, weights);
    if (c < bestCost) {
      bestCost = c;
      best = order;
    }
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let from = 0; from < n; from++) {
      for (let to = 0; to < n; to++) {
        if (from === to) continue;
        const moved = [...best];
        const [lane] = moved.splice(from, 1);
        moved.splice(to, 0, lane);
        const c = cost(moved, weights);
        if (c < bestCost) {
          bestCost = c;
          best = moved;
          improved = true;
        }
      }
    }
  }
  return best;
}
