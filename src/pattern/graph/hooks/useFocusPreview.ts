import { useCallback, useState } from "react";
import {
  SharedValue,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptics } from "@/src/common/ui";
import { motion } from "@/src/common/theme/tokens";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { CanvasTransform } from "@/src/pattern/graph/components/CanvasTransformContext";
import {
  FOCUS_RADIUS,
  focusAtCentre,
  translationToCentre,
} from "@/src/pattern/graph/model/focus";

export interface FocusPreview {
  /** The pattern under the focus mark, or null. React state: it changes as the focus moves. */
  focusedId: number | null;
  /** Whether a pan is in flight, readable by the preview's animated styles. */
  panning: SharedValue<boolean>;
  /** Hand to `ZoomableCanvas`: called from its pan, on the UI thread. */
  onPanStart: () => void;
  onPanEnd: () => void;
  /**
   * The focused pattern, when a tap (in viewport coordinates) lands on the
   * focus mark; otherwise null. A worklet, for the canvas's tap gesture.
   */
  focusedAtMark: (x: number, y: number) => number | null;
  /**
   * Put the preview away until the next pan: a pattern is being opened in full,
   * and its details bring their own player.
   */
  dismiss: () => void;
}

/**
 * Which pattern the focus mark in the middle of the network view rests on.
 *
 * Tracked on the UI thread from the canvas's own shared values, so nothing
 * re-renders while the canvas moves; React hears about it only when the
 * focus passes to another pattern. The preview waits for the first pan: the
 * view opens fitted to the whole graph, and a card popping up over it before
 * the user has done anything would be noise.
 *
 * Releasing the pan eases the focused pattern into the middle, so what the
 * user lets go of is plainly the one a tap will open.
 */
export function useFocusPreview(
  transform: CanvasTransform,
  positions: Map<number, LayoutPosition>,
  contentWidth: number,
  contentHeight: number,
): FocusPreview {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const armed = useSharedValue(false);
  const panning = useSharedValue(false);
  // The same id as `focusedId`, readable from a worklet.
  const focused = useSharedValue<number | null>(null);

  const changed = useCallback((id: number | null) => {
    setFocusedId(id);
    // A light tick as a pattern comes into focus, the same as a selection
    // changing. Never the only cue: the preview card changes too.
    if (id !== null) haptics.selection();
  }, []);

  useAnimatedReaction(
    () => ({
      armed: armed.get(),
      scale: transform.scale.get(),
      translateX: transform.translateX.get(),
      translateY: transform.translateY.get(),
      width: transform.viewportWidth.get(),
      height: transform.viewportHeight.get(),
    }),
    (now) => {
      if (!now.armed || now.width === 0) return;
      const id = focusAtCentre(
        { width: now.width, height: now.height },
        now,
        { width: contentWidth, height: contentHeight },
        positions,
        focused.get(),
      );
      if (id !== focused.get()) {
        focused.set(id);
        scheduleOnRN(changed, id);
      }
    },
    [positions, contentWidth, contentHeight],
  );

  const onPanStart = () => {
    "worklet";
    armed.set(true);
    panning.set(true);
  };

  const onPanEnd = () => {
    "worklet";
    panning.set(false);
    const id = focused.get();
    const position = id === null ? undefined : positions.get(id);
    if (!position) return;
    const target = translationToCentre(position, transform.scale.get(), {
      width: contentWidth,
      height: contentHeight,
    });
    transform.translateX.set(withSpring(target.translateX, motion.spring));
    transform.translateY.set(withSpring(target.translateY, motion.spring));
  };

  const focusedAtMark = (x: number, y: number) => {
    "worklet";
    const dx = x - transform.viewportWidth.get() / 2;
    const dy = y - transform.viewportHeight.get() / 2;
    return Math.sqrt(dx * dx + dy * dy) <= FOCUS_RADIUS ? focused.get() : null;
  };

  const dismiss = useCallback(() => {
    armed.set(false);
    focused.set(null);
    setFocusedId(null);
  }, [armed, focused]);

  return { focusedId, panning, onPanStart, onPanEnd, focusedAtMark, dismiss };
}
