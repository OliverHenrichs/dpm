import { useCallback, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import { SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { laneIndexAt } from "@/src/pattern/graph/utils/laneOrder";

/** A step row as laid out: its top and height within the steps' column. */
export interface RowBox {
  y: number;
  height: number;
}

export interface StepDrag {
  /** Whether a grip is held: the form's scroller stops scrolling meanwhile. */
  holding: boolean;
  /** The row being dragged, or -1. */
  active: SharedValue<number>;
  /** Where it would land now, or -1. */
  target: SharedValue<number>;
  /** How far the finger moved since pick-up. */
  offset: SharedValue<number>;
  /** How far the other rows make way: the dragged row's height and the gap below it. */
  room: SharedValue<number>;
  onRowLayout: (index: number, box: RowBox) => void;
  /** The pan for the grip of the row at `index`. */
  gripGesture: (index: number) => ReturnType<typeof Gesture.Pan>;
}

/**
 * Dragging a sequence's steps into a new order by their grips.
 *
 * Each grip has its own pan, which activates at once (the grip is for nothing else). The rows do
 * not reflow while one is dragged: the dragged row follows the finger as a transform and the
 * rows it passes make way by its height (`SequenceStepRow`'s animated style), so no view moves
 * under the gesture and React hears of the drag only at pick-up and drop. The rows' centres are
 * worked out here on the JS thread from their last layout and captured by each gesture as data:
 * an arrow function inside a worklet would be hoisted by the React Compiler out of the UI thread
 * (`src/pattern/graph/AGENTS.md`).
 *
 * `onMove(from, to)` is called on drop, not when the step lands where it started.
 */
export function useStepDrag(
  count: number,
  gap: number,
  onMove: (from: number, to: number) => void,
  enabled: boolean,
): StepDrag {
  const [holding, setHolding] = useState(false);
  const [boxes, setBoxes] = useState<RowBox[]>([]);
  const active = useSharedValue(-1);
  const target = useSharedValue(-1);
  const offset = useSharedValue(0);
  const room = useSharedValue(0);

  const onRowLayout = useCallback((index: number, box: RowBox) => {
    setBoxes((prev) => {
      const old = prev[index];
      if (old && old.y === box.y && old.height === box.height) return prev;
      const next = [...prev];
      next[index] = box;
      return next;
    });
  }, []);

  const hold = useCallback(() => setHolding(true), []);
  const lift = useCallback(() => {
    // Medium on pick-up, Light on drop, as for a lane. Never the only cue: the row lifts.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);
  const settle = useCallback(() => {
    active.set(-1);
    target.set(-1);
    offset.set(0);
  }, [active, target, offset]);
  const finish = useCallback(
    (from: number, to: number) => {
      setHolding(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (to >= 0 && from !== to) onMove(from, to);
      settle();
    },
    [onMove, settle],
  );
  const release = useCallback(() => {
    setHolding(false);
    settle();
  }, [settle]);

  // Only the rows there are now: a removed step's box stays behind until the array is reused.
  const centres = boxes
    .slice(0, count)
    .map((box) => (box ? box.y + box.height / 2 : 0));

  const gripGesture = (index: number) => {
    const height = (boxes[index]?.height ?? 0) + gap;
    return Gesture.Pan()
      .enabled(enabled)
      .minDistance(0)
      .onBegin(() => {
        scheduleOnRN(hold);
      })
      .onStart(() => {
        offset.set(0);
        room.set(height);
        target.set(index);
        active.set(index);
        scheduleOnRN(lift);
      })
      .onChange((event) => {
        if (active.get() !== index) return;
        const moved = offset.get() + event.changeY;
        offset.set(moved);
        const to = laneIndexAt(centres, index, centres[index] + moved);
        if (to !== target.get()) target.set(to);
      })
      .onEnd(() => {
        if (active.get() === index) scheduleOnRN(finish, index, target.get());
      })
      .onFinalize((_event, success) => {
        if (!success) scheduleOnRN(release);
      });
  };

  return { holding, active, target, offset, room, onRowLayout, gripGesture };
}
