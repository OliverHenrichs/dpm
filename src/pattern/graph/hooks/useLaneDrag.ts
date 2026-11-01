import { useCallback, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import { SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import {
  laneAt,
  laneIndexAt,
  moveLane,
} from "@/src/pattern/graph/utils/laneOrder";
import { DRAG_ACTIVATION_MS } from "@/src/pattern/graph/hooks/useNodeDrag";

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
  /** How far the finger has moved since pick-up, for the lifted label. */
  dragOffset: SharedValue<number>;
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
  const dragOffset = useSharedValue(0);
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
      setDragging({ typeId: lane.typeId, from, top: lane.y, order });
      setTarget(from);
      // Medium on pick-up, Light on drop, as for a graph node. Never the only cue: the label
      // visibly lifts.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [lanes, startOrder],
  );

  const finish = useCallback(
    (from: number, to: number) => {
      setDragging(null);
      setTarget(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (from !== to) onDrop(moveLane(startOrder.get(), from, to));
    },
    [onDrop, startOrder],
  );

  const cancel = useCallback((_ignored: number) => {
    setDragging(null);
    setTarget(null);
  }, []);

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
      dragOffset.set(0);
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
    .onEnd(() => {
      const from = activeIndex.get();
      if (from >= 0) scheduleOnRN(finish, from, lastTarget.get());
    })
    .onFinalize((_event, success) => {
      activeIndex.set(-1);
      if (!success) scheduleOnRN(cancel, 0);
    });

  return { dragging, target, dragOffset, gesture };
}
