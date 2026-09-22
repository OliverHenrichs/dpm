import React, { ReactNode, useCallback } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  CanvasTransform,
  CanvasTransformProvider,
} from "@/src/pattern/graph/components/CanvasTransformContext";
import type { GestureType } from "react-native-gesture-handler";

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4.5;

interface ZoomableCanvasProps {
  contentWidth: number;
  contentHeight: number;
  /** Zoom to open at. */
  initialZoom: number;
  /** Screen-pixel offsets applied after the content is centred. */
  initialOffsetX: number;
  initialOffsetY: number;
  /** The shared values to drive, from `useCanvasTransformValues`. */
  transform: CanvasTransform;
  /**
   * Raced ahead of the canvas's own gestures.
   *
   * The node drag goes here. Racing rather than `Exclusive` on purpose: the
   * drag activates on a long press and the canvas pan on movement, so
   * whichever the user actually did wins immediately — `Exclusive` would make
   * every pan wait for the long press to fail first.
   */
  extraGesture?: GestureType | ReturnType<typeof Gesture.Race>;
  children: ReactNode;
}

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/**
 * Pan and pinch over fixed-size content.
 *
 * Replaces `@openspacelabs/react-native-zoomable-view`, which is implemented
 * with `PanResponder`. That mattered because a node drag has to live in
 * Gesture Handler's touch system, and the two systems do not negotiate: there
 * is no `simultaneousHandlers` across that boundary, so whichever claimed a
 * touch first won, non-deterministically from the user's point of view. With
 * both in Gesture Handler, priority is something we express rather than
 * something that emerges.
 *
 * Everything runs on the UI thread. The transform is shared values driving
 * `useAnimatedStyle`; React does not re-render while a gesture is in flight,
 * and the values are exposed through `CanvasTransformProvider` so a node drag
 * can read the live `scale` — without which a dragged node lags the finger
 * above 1:1 and outruns it below.
 *
 * No `GestureHandlerRootView` is mounted here on purpose. On native the drawer
 * supplies one (`react-native-drawer-layout`'s `Drawer.native` renders a real
 * one around its children); nesting another would take the graph area out of
 * the drawer's own gesture tree. On web RNGH's root view is a plain `View`
 * plus a context flag, so gestures work without one.
 */
const ZoomableCanvas: React.FC<ZoomableCanvasProps> = ({
  contentWidth,
  contentHeight,
  initialZoom,
  transform,
  extraGesture,
  children,
}) => {
  const { scale, translateX, translateY, viewportWidth, viewportHeight } =
    transform;

  // Pinch reports cumulative scale; this turns it into a per-frame factor so
  // it composes with pan instead of the two fighting over `translate`.
  const lastPinchScale = useSharedValue(1);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      viewportWidth.set(width);
      viewportHeight.set(height);
    },
    [viewportWidth, viewportHeight],
  );

  /** Zoom about a focal point, keeping whatever is under it in place. */
  const zoomAround = (focalX: number, focalY: number, nextScale: number) => {
    "worklet";
    const factor = nextScale / scale.get();
    translateX.set(focalX - (focalX - translateX.get()) * factor);
    translateY.set(focalY - (focalY - translateY.get()) * factor);
    scale.set(nextScale);
  };

  const pan = Gesture.Pan()
    // Two fingers pinching also drag; average them so the content does not
    // jump when the second finger lands.
    .averageTouches(true)
    .onChange((event) => {
      translateX.set(translateX.get() + event.changeX);
      translateY.set(translateY.get() + event.changeY);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      lastPinchScale.set(1);
    })
    .onUpdate((event) => {
      const factor = event.scale / lastPinchScale.get();
      lastPinchScale.set(event.scale);
      const next = clamp(scale.get() * factor, MIN_ZOOM, MAX_ZOOM);
      zoomAround(
        event.focalX - viewportWidth.get() / 2,
        event.focalY - viewportHeight.get() / 2,
        next,
      );
    });

  // No double-tap-to-zoom. The old container had it, but the graph's node tap
  // now lives in this gesture system too, and the two cannot both be fast: a
  // single tap would have to wait for the double tap to fail before it could
  // open a pattern, which is the most common interaction on the screen.
  // Pinch remains, and the initial zoom is already fitted to the content.
  const canvasGestures = Gesture.Simultaneous(pan, pinch);
  const gesture = extraGesture
    ? Gesture.Race(extraGesture, canvasGestures)
    : canvasGestures;

  // Translate before scale, so the offsets stay in screen pixels rather than
  // being multiplied by the zoom.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.viewport} onLayout={onLayout} collapsable={false}>
        <Animated.View
          style={[
            { width: contentWidth, height: contentHeight },
            animatedStyle,
          ]}
        >
          <CanvasTransformProvider value={transform}>
            {children}
          </CanvasTransformProvider>
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ZoomableCanvas;
