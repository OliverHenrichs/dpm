import React, { ReactNode, useCallback } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  CanvasTransform,
  CanvasTransformProvider,
} from "@/src/pattern/graph/components/CanvasTransformContext";

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4.5;
/** A double tap multiplies the zoom by 1 + this, then wraps back to initial. */
const ZOOM_STEP = 0.5;
const DOUBLE_TAP_DURATION = 220;
/** Strong ease-out. Reanimated's built-ins are as weak as CSS's. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface ZoomableCanvasProps {
  contentWidth: number;
  contentHeight: number;
  /** Zoom to open at, and the level a double tap wraps back down to. */
  initialZoom: number;
  /** Screen-pixel offsets applied after the content is centred. */
  initialOffsetX: number;
  initialOffsetY: number;
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
  initialOffsetX,
  initialOffsetY,
  children,
}) => {
  const scale = useSharedValue(initialZoom);
  const translateX = useSharedValue(initialOffsetX);
  const translateY = useSharedValue(initialOffsetY);

  // Viewport size, for converting a gesture's focal point into an offset from
  // the centre — which is where the content is anchored.
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  // Pinch reports cumulative scale; this turns it into a per-frame factor so
  // it composes with pan instead of the two fighting over `translate`.
  const lastPinchScale = useSharedValue(1);

  const transform: CanvasTransform = { scale, translateX, translateY };

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      viewportWidth.set(width);
      viewportHeight.set(height);
    },
    [viewportWidth, viewportHeight],
  );

  /** Zoom about a focal point, keeping whatever is under it in place. */
  const zoomAround = (
    focalX: number,
    focalY: number,
    nextScale: number,
    animated: boolean,
  ) => {
    "worklet";
    const current = scale.get();
    const factor = nextScale / current;
    const targetX = focalX - (focalX - translateX.get()) * factor;
    const targetY = focalY - (focalY - translateY.get()) * factor;

    if (animated) {
      const config = { duration: DOUBLE_TAP_DURATION, easing: EASE_OUT };
      scale.set(withTiming(nextScale, config));
      translateX.set(withTiming(targetX, config));
      translateY.set(withTiming(targetY, config));
      return;
    }
    scale.set(nextScale);
    translateX.set(targetX);
    translateY.set(targetY);
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
        false,
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((event) => {
      const current = scale.get();
      const stepped = clamp(current * (1 + ZOOM_STEP), MIN_ZOOM, MAX_ZOOM);
      // Wrap rather than dead-ending at max: a double tap always does
      // something, which is the behaviour the old container had.
      const next = stepped <= current + 0.001 ? initialZoom : stepped;
      zoomAround(
        event.x - viewportWidth.get() / 2,
        event.y - viewportHeight.get() / 2,
        next,
        true,
      );
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch));

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
