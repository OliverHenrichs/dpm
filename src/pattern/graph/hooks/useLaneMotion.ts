import { useEffect } from "react";
import {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion } from "@/src/common/theme/tokens";

/** How long a lane takes to slide to its new place. */
export const LANE_SLIDE_MS = motion.duration.fast;

/**
 * Where the timeline's lanes are on screen, as they slide between orders.
 *
 * Each lane's top is a tween from `from` to `to` by `progress`, keyed by type id. Everything that
 * belongs to a lane (its band, its figures and the edges inside it, its grip) is drawn relative
 * to the lane's top and moved by it; only the edges between lanes are rebuilt each frame.
 */
export interface LaneMotion {
  from: SharedValue<Record<string, number>>;
  to: SharedValue<Record<string, number>>;
  progress: SharedValue<number>;
}

/**
 * The lane's top now. `fallback` is its top as laid out, for the render before the lane is
 * known here (a lane that has just appeared): it then sits where it belongs, without sliding.
 * A worklet.
 */
export function laneTop(
  lanes: LaneMotion,
  typeId: string,
  fallback: number,
): number {
  "worklet";
  const to = lanes.to.get()[typeId];
  if (to === undefined) return fallback;
  const from = lanes.from.get()[typeId];
  const start = from === undefined ? to : from;
  return start + (to - start) * lanes.progress.get();
}

/**
 * Slides each lane to its new top whenever the layout moves it: while a lane is dragged past
 * others, on the drop, a screen reader's move, or a filter that changes which lanes are shown.
 *
 * Lanes are positioned by these values alone, never by a `top` in their style. A layout that
 * put a lane at its new place and then started a slide back from the old one would flash it
 * at the new place for a frame; here a new layout moves nothing until the slide begins.
 */
export function useLaneMotion(
  lanes: readonly { typeId?: string; y: number }[],
): LaneMotion {
  const from = useSharedValue<Record<string, number>>({});
  const to = useSharedValue<Record<string, number>>({});
  const progress = useSharedValue(1);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const lane of lanes) next[lane.typeId ?? ""] = lane.y;

    const oldTo = to.get();
    const oldFrom = from.get();
    const ids = Object.keys(next);
    if (
      ids.length === Object.keys(oldTo).length &&
      ids.every((id) => oldTo[id] === next[id])
    ) {
      return;
    }

    // Start from wherever each lane is now, mid-slide or not. A lane new to the layout has no
    // "now" and appears in place.
    const t = progress.get();
    const now: Record<string, number> = {};
    let moves = false;
    for (const id of ids) {
      const target = oldTo[id];
      if (target === undefined) continue;
      const start = oldFrom[id] ?? target;
      now[id] = start + (target - start) * t;
      if (now[id] !== next[id]) moves = true;
    }
    from.set(now);
    to.set(next);
    if (moves) {
      progress.set(0);
      progress.set(withTiming(1, { duration: LANE_SLIDE_MS }));
    } else {
      progress.set(1);
    }
  }, [lanes, from, to, progress]);

  return { from, to, progress };
}

/** A lane-relative view's style: moved to the lane's top, as it slides. */
export function useLaneStyle(
  lanes: LaneMotion,
  typeId: string,
  fallback: number,
) {
  return useAnimatedStyle(() => ({
    transform: [{ translateY: laneTop(lanes, typeId, fallback) }],
  }));
}
