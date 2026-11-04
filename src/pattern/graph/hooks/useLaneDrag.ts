import { useCallback, useEffect, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  SharedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import {
  laneAt,
  laneIndexAt,
  landingOffsets,
  moveLane,
} from "@/src/pattern/graph/utils/laneOrder";
import { DRAG_ACTIVATION_MS } from "@/src/pattern/graph/hooks/useNodeDrag";
import { motion } from "@/src/common/theme/tokens";

/** How long the lifted name takes to settle into its lane after the drop. */
export const LANE_SETTLE_MS = motion.duration.normal;
/** How long the name takes to lift on pick-up. */
const LIFT_MS = motion.duration.fast;

/** A lane as drawn: its type and its band, in the timeline's content coordinates. */
export interface LaneBand {
  typeId: string;
  y: number;
  height: number;
}

export interface LaneDrag {
  /**
   * The lane being dragged, its index and band top when picked up, and the lanes' order then
   * (type ids, top to bottom), or null. Changes once per drag.
   */
  dragging: {
    typeId: string;
    from: number;
    top: number;
    order: string[];
  } | null;
  /** Where the dragged lane would land now, an index into `dragging.order`, or null. */
  target: number | null;
  /**
   * The lane just let go of, its band top when picked up, while its lifted name settles into
   * place (`LANE_SETTLE_MS`), or null.
   */
  settling: { typeId: string; top: number } | null;
  /**
   * How far the lifted label is from where it was picked up: the finger's travel while
   * dragged, then easing to the lane's landing place.
   */
  dragOffset: SharedValue<number>;
  /** 0 to 1 as the name lifts on pick-up, and back as it settles. */
  lift: SharedValue<number>;
  /** One pan over the lane-label column, hit-testing which lane it picked up. */
  gesture: ReturnType<typeof Gesture.Pan>;
}

/**
 * Long-press a lane's label in the timeline and drag it up or down.
 *
 * One pan over a column that never moves, hit-testing the lanes, rather than a gesture per
 * label: the labels reflow under the finger as the lanes do, and a gesture whose view moves
 * mid-drag reports its translation against the moved view. The band positions are captured on
 * the UI thread at pick-up, so the drop target does not shift as the lanes reflow either.
 *
 * Long press to activate, as for a graph node, so an ordinary swipe over the labels still
 * scrolls the timeline. `dragging` and `target` are React state, set at most once per lane
 * passed; nothing re-renders per frame.
 *
 * `onDrop` gets the lanes' type ids, top to bottom, after the move. It is not called when the
 * lane lands where it started.
 */
export function useLaneDrag(
  lanes: LaneBand[],
  onDrop: (order: string[]) => void,
  enabled: boolean,
): LaneDrag {
  const [dragging, setDragging] = useState<LaneDrag["dragging"]>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [settling, setSettling] = useState<LaneDrag["settling"]>(null);
  const dragOffset = useSharedValue(0);
  const lift = useSharedValue(0);
  // How far the lane would travel to land at each index, worked out at pick-up.
  const landing = useSharedValue<number[]>([]);
  // The lane picked up, for the settle after the drop or cancel; outside React state for the
  // same reason as `startOrder` below.
  const picked = useSharedValue<LaneDrag["settling"]>(null);
  const activeIndex = useSharedValue(-1);
  const lastTarget = useSharedValue(-1);
  const centres = useSharedValue<number[]>([]);
  // The same order as `dragging.order`, for the drop: held outside React state, so the drop
  // does not depend on a re-render having swapped a newer callback into the gesture.
  const startOrder = useSharedValue<string[]>([]);

  const begin = useCallback(
    (from: number) => {
      const lane = lanes[from];
      if (!lane) return;
      // `lanes` is the reflowed preview by the time of the drop; the move is from this order.
      const order = lanes.map((l) => l.typeId);
      startOrder.set(order);
      picked.set({ typeId: lane.typeId, top: lane.y });
      setSettling(null);
      setDragging({ typeId: lane.typeId, from, top: lane.y, order });
      setTarget(from);
      // Medium on pick-up, Light on drop, as for a graph node. Never the only cue: the label
      // visibly lifts.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [lanes, picked, startOrder],
  );

  // Lets go of the lane and keeps its lifted name up while it eases into place.
  const letGo = useCallback(() => {
    setDragging(null);
    setTarget(null);
    setSettling(picked.get());
    picked.set(null);
  }, [picked]);

  useEffect(() => {
    if (!settling) return;
    const timer = setTimeout(() => setSettling(null), LANE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [settling]);

  const finish = useCallback(
    (from: number, to: number) => {
      letGo();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (from !== to) onDrop(moveLane(startOrder.get(), from, to));
    },
    [letGo, onDrop, startOrder],
  );

  // Worked out here, on the JS thread, and captured by the gesture as plain data. An arrow
  // function inside the worklet below is not safe: the React Compiler hoists one that captures
  // nothing out to module scope, where it is an ordinary JS function, and calling it on the UI
  // thread crashes ("Tried to synchronously call a Remote Function").
  const bands = lanes.map((lane) => ({ y: lane.y, height: lane.height }));
  const bandCentres = lanes.map((lane) => lane.y + lane.height / 2);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(DRAG_ACTIVATION_MS)
    .onStart((event) => {
      const index = laneAt(bands, event.y);
      activeIndex.set(index);
      if (index < 0) return;
      centres.set(bandCentres);
      landing.set(landingOffsets(bands, index));
      dragOffset.set(0);
      lift.set(withTiming(1, { duration: LIFT_MS }));
      lastTarget.set(index);
      scheduleOnRN(begin, index);
    })
    .onChange((event) => {
      const from = activeIndex.get();
      if (from < 0) return;
      const offset = dragOffset.get() + event.changeY;
      dragOffset.set(offset);
      const all = centres.get();
      const to = laneIndexAt(all, from, all[from] + offset);
      if (to !== lastTarget.get()) {
        lastTarget.set(to);
        scheduleOnRN(setTarget, to);
      }
    })
    .onEnd((_event, success) => {
      const from = activeIndex.get();
      // A cancelled drag is put back in `onFinalize`, not dropped.
      if (from < 0 || success === false) return;
      const to = lastTarget.get();
      // The lifted name eases from under the finger to where its lane landed.
      const offsets = landing.get();
      const settleTo = to < offsets.length ? offsets[to] : 0;
      dragOffset.set(withTiming(settleTo, { duration: LANE_SETTLE_MS }));
      lift.set(withTiming(0, { duration: LANE_SETTLE_MS }));
      activeIndex.set(-1);
      scheduleOnRN(finish, from, to);
    })
    .onFinalize(() => {
      // Still active here only when the drag was cancelled rather than dropped: back to where
      // it was picked up, as the lanes slide back.
      if (activeIndex.get() < 0) return;
      activeIndex.set(-1);
      dragOffset.set(withTiming(0, { duration: LANE_SETTLE_MS }));
      lift.set(withTiming(0, { duration: LANE_SETTLE_MS }));
      scheduleOnRN(letGo);
    });

  return { dragging, target, settling, dragOffset, lift, gesture };
}
