import { useCallback, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import { SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { CanvasTransform } from "@/src/pattern/graph/components/CanvasTransformContext";
import {
  findNodeAt,
  screenDeltaToContent,
  screenToContent,
} from "@/src/pattern/graph/model/graphCoordinates";
import { MAX_GRAPH_COORDINATE } from "@/src/pattern/graph/types/Constants";

/** Hold this long before a touch becomes a drag rather than a canvas pan. */
export const DRAG_ACTIVATION_MS = 200;

export interface NodeDrag {
  /** The node being dragged, or null. React state: it changes once per drag. */
  draggingId: number | null;
  /** The dragged node's live position, in graph coordinates. */
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Pan>;
}

function clamp(value: number): number {
  "worklet";
  return Math.max(-MAX_GRAPH_COORDINATE, Math.min(MAX_GRAPH_COORDINATE, value));
}

/**
 * Long-press-then-drag a node.
 *
 * One pan on the canvas that hit-tests, rather than a gesture per node. Nodes
 * are SVG elements; wrapping each in a `GestureDetector` means a detector
 * inside an `<Svg>`, which is fragile on native and collides with the web
 * build's hand-bound click listeners (see `PatternNodeGroup.web.tsx`). Hit
 * testing against positions we already have is pure, cheap and testable — and
 * it is not hand-rolled arbitration: this gesture still races the canvas's own
 * through Gesture Handler.
 *
 * Long press to activate, so an ordinary drag still pans the canvas and a tap
 * still opens the detail modal. `draggingId` is React state, set once at the
 * start of a drag and cleared at the end; nothing re-renders per frame.
 */
export function useNodeDrag(
  transform: CanvasTransform,
  positions: Map<number, LayoutPosition>,
  contentWidth: number,
  contentHeight: number,
  onMove: (id: number, position: LayoutPosition) => void,
  enabled: boolean,
): NodeDrag {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // The same id as `draggingId`, readable from a worklet — React state is not.
  const activeId = useSharedValue<number | null>(null);

  const begin = useCallback((id: number) => {
    setDraggingId(id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finish = useCallback(
    (id: number, x: number, y: number) => {
      setDraggingId(null);
      onMove(id, { x, y });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onMove],
  );

  const cancel = useCallback(() => setDraggingId(null), []);
  // `scheduleOnRN` is typed to pass every argument through, so a zero-argument
  // callback needs a wrapper rather than a spare `undefined`.
  const cancelDrag = useCallback((_ignored: number) => cancel(), [cancel]);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(DRAG_ACTIVATION_MS)
    .onStart((event) => {
      const point = screenToContent(
        event.x,
        event.y,
        {
          width: transform.viewportWidth.get(),
          height: transform.viewportHeight.get(),
        },
        {
          scale: transform.scale.get(),
          translateX: transform.translateX.get(),
          translateY: transform.translateY.get(),
        },
        { width: contentWidth, height: contentHeight },
      );
      const id = findNodeAt(point, positions);
      activeId.set(id);
      if (id === null) return;

      const start = positions.get(id)!;
      dragX.set(start.x);
      dragY.set(start.y);
      // Pickup is the causal moment, so the haptic fires here rather than when
      // the node has visibly moved.
      scheduleOnRN(begin, id);
    })
    .onChange((event) => {
      const id = activeId.get();
      if (id === null) {
        // The long press landed on empty canvas. This gesture has already won
        // the race, so the canvas pan will not fire — pan here instead, rather
        // than leaving the drag doing nothing at all.
        transform.translateX.set(transform.translateX.get() + event.changeX);
        transform.translateY.set(transform.translateY.get() + event.changeY);
        return;
      }
      // Live zoom, not one captured at gesture start: a pinch cannot happen
      // mid-drag (the gestures race), but the canvas can be zoomed between
      // drags, and reading it live is free.
      const scale = transform.scale.get();
      dragX.set(
        clamp(dragX.get() + screenDeltaToContent(event.changeX, scale)),
      );
      dragY.set(
        clamp(dragY.get() + screenDeltaToContent(event.changeY, scale)),
      );
    })
    .onEnd(() => {
      const id = activeId.get();
      if (id !== null) scheduleOnRN(finish, id, dragX.get(), dragY.get());
    })
    .onFinalize((_event, success) => {
      activeId.set(null);
      if (!success) scheduleOnRN(cancelDrag, 0);
    });

  return { draggingId, dragX, dragY, gesture };
}
