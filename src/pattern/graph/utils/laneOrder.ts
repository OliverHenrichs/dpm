import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";

/** Up to this many lanes every order is tried; above it, a barycentre heuristic. */
const EXACT_LIMIT = 7;
const HEURISTIC_PASSES = 8;

/**
 * The timeline's lanes, top to bottom: only the types that have a pattern shown, ordered so that
 * linked types sit near each other.
 *
 * A type with nothing shown gets no lane. A filter that hid a type used to leave its lane as an
 * empty band (tester review 1).
 *
 * The order minimises the summed lane distance of every edge between two types, so a Push → Tuck
 * edge no longer crosses every lane in between when the list happens to name Push first and Tuck
 * last. Ties keep the list's own order, so a list with no edges across types draws its lanes
 * exactly as before.
 */
export function orderLanes(
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
