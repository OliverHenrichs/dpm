import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { AppText, IconButton } from "@/src/common/ui";
import {
  canZoom,
  decimalMark,
  dragWindow,
  formatLength,
  formatSeconds,
  formatTenths,
  fullView,
  hitTest,
  moveWindow,
  resizeEnd,
  resizeStart,
  showsWindow,
  toPixels,
  TrimGrab,
  TrimLimits,
  TrimView,
  TrimWindow,
  zoomView,
} from "@/src/anonymize/model/trimWindow";

type Props = {
  limits: TrimLimits;
  window: TrimWindow;
  /** A grip or the window was picked up: the moment to stop playing and show its frame. */
  onDragStart?: (grab: TrimGrab) => void;
  /** Called on every drag step, for the labels and the frame under the grabbed handle. */
  onChange: (window: TrimWindow, grab: TrimGrab) => void;
  /**
   * Called once a drag ends, and on each step button or a11y nudge — the moment to seek the
   * preview to the handle that moved.
   */
  onChangeEnd: (window: TrimWindow, grab: TrimGrab) => void;
  /** Current preview position, drawn as a playhead. */
  playhead?: number;
};

const GRIP_WIDTH = 22;
/** How far outside a grip a touch still grabs it — fingers are wider than 22 pt. */
const GRIP_REACH = 28;
const TRACK_HEIGHT = 44;
/** A11y increment/decrement step for the whole window, in seconds. */
const STEP = 1;
/** What each step button moves one handle by, in seconds: about three frames. */
const FINE_STEP = 0.1;

/**
 * A seek-bar-shaped track with a window over it: drag the middle to move the window, the
 * grips to resize it. One pan on the whole track hit-tests where the touch began (as the
 * graph canvas does, see src/pattern/graph/AGENTS.md) — nested detectors would let the move
 * and a grip both activate. The arithmetic lives in `model/trimWindow.ts`.
 *
 * On a long clip a pixel is seconds of video, so two finer controls sit under the track: a
 * step button either side of each handle's time (a tenth of a second), and a zoom that makes
 * the track span just the selection and its length again to either side. The zoomed view
 * stays put while a handle is dragged, so the bar does not slide under the finger, and
 * re-centres once a drag or step leaves part of the selection off it.
 *
 * Gestures run on the JS thread (`runOnJS(true)`): the bar is a handful of views, so a
 * per-step re-render is cheap; the caller decides how often to seek its preview.
 */
const TrimWindowBar: React.FC<Props> = ({
  limits,
  window,
  onDragStart,
  onChange,
  onChangeEnd,
  playhead,
}) => {
  const { t, i18n } = useTranslation();
  const decimal = decimalMark(i18n.language);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<TrimView | null>(null);
  const zoomable = canZoom(window, limits.duration);
  const view = zoom ?? fullView(limits.duration);
  // Deltas apply to the window as it was when the drag began, so rounding cannot accumulate.
  // Shared values rather than refs, as in useNodeDrag: the React Compiler rejects refs read
  // from gesture callbacks that are built during render.
  const origin = useSharedValue(window);
  const grab = useSharedValue<TrimGrab | null>(null);
  const latest = useSharedValue(window);
  useEffect(() => latest.set(window), [latest, window]);

  const secondsPerPixel = width > 0 ? (view.to - view.from) / width : 0;
  const x = (seconds: number) => toPixels(seconds, view, width);

  /** A change is done: keep the selection on a zoomed bar, then tell the caller. */
  const settle = (next: TrimWindow, grabbed: TrimGrab) => {
    if (zoom && !showsWindow(zoom, next)) {
      setZoom(zoomView(next, limits.duration));
    }
    onChangeEnd(next, grabbed);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onStart((e) => {
      origin.set(latest.get());
      const grabbed = hitTest(e.x, latest.get(), width, view, GRIP_REACH);
      grab.set(grabbed);
      if (grabbed) onDragStart?.(grabbed);
    })
    .onUpdate((e) => {
      const grabbed = grab.get();
      if (!grabbed) return;
      const next = dragWindow(
        origin.get(),
        grabbed,
        e.translationX * secondsPerPixel,
        limits,
      );
      latest.set(next);
      onChange(next, grabbed);
    })
    .onEnd(() => {
      const grabbed = grab.get();
      if (grabbed) settle(latest.get(), grabbed);
      grab.set(null);
    });

  const length = window.end - window.start;
  const range = {
    start: formatTenths(window.start, decimal),
    end: formatTenths(window.end, decimal),
    length: formatLength(length, decimal),
  };
  // A cap below the clip's length is worth stating; "of max. 42 s" on a 42 s clip is not.
  const label =
    limits.max < limits.duration
      ? t("trimSelection", { ...range, max: limits.max })
      : t("trimSelectionFree", range);

  const apply = (next: TrimWindow, grabbed: TrimGrab) => {
    onChange(next, grabbed);
    settle(next, grabbed);
  };
  const nudge = (delta: number) =>
    apply(moveWindow(window, delta, limits), "move");
  const stepStart = (delta: number) =>
    apply(resizeStart(window, window.start + delta, limits), "start");
  const stepEnd = (delta: number) =>
    apply(resizeEnd(window, window.end + delta, limits), "end");
  const step = { step: formatLength(FINE_STEP, decimal) };

  /** A handle's time between its two step buttons. */
  const stepper = (
    time: string,
    earlier: () => void,
    later: () => void,
    earlierLabel: string,
    laterLabel: string,
    testID: string,
  ) => (
    <View style={styles.stepper}>
      <IconButton
        icon="chevron-left"
        onPress={earlier}
        accessibilityLabel={earlierLabel}
        testID={`${testID}-earlier`}
      />
      <AppText variant="bodySmall" style={styles.time} testID={testID}>
        {time}
      </AppText>
      <IconButton
        icon="chevron-right"
        onPress={later}
        accessibilityLabel={laterLabel}
        testID={`${testID}-later`}
      />
    </View>
  );

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width)
          }
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("trimWindowA11y")}
          accessibilityValue={{ text: label }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) =>
            nudge(e.nativeEvent.actionName === "increment" ? STEP : -STEP)
          }
          testID="trim-track"
        >
          {width > 0 && (
            <>
              <View
                pointerEvents="none"
                testID="trim-window"
                style={[
                  styles.window,
                  {
                    left: x(window.start),
                    width: x(window.end) - x(window.start),
                  },
                ]}
              >
                <View style={styles.grip} />
                <View style={styles.fill} />
                <View style={styles.grip} />
              </View>
              {playhead !== undefined && (
                <View
                  pointerEvents="none"
                  style={[styles.playhead, { left: x(playhead) }]}
                />
              )}
            </>
          )}
        </View>
      </GestureDetector>
      {zoom && (
        <View style={styles.edges} testID="trim-zoom-edges">
          <AppText variant="micro" color="textMuted">
            {formatSeconds(zoom.from)}
          </AppText>
          <AppText variant="micro" color="textMuted">
            {formatSeconds(zoom.to)}
          </AppText>
        </View>
      )}
      <View style={styles.controls}>
        {stepper(
          range.start,
          () => stepStart(-FINE_STEP),
          () => stepStart(FINE_STEP),
          t("trimStartEarlier", step),
          t("trimStartLater", step),
          "trim-start",
        )}
        <View style={styles.middle}>
          {(zoom || zoomable) && (
            <IconButton
              icon={zoom ? "magnify-minus-outline" : "magnify-plus-outline"}
              onPress={() =>
                setZoom(zoom ? null : zoomView(window, limits.duration))
              }
              accessibilityLabel={zoom ? t("trimZoomOut") : t("trimZoomIn")}
              selected={!!zoom}
              testID="trim-zoom"
            />
          )}
        </View>
        {stepper(
          range.end,
          () => stepEnd(-FINE_STEP),
          () => stepEnd(FINE_STEP),
          t("trimEndEarlier", step),
          t("trimEndLater", step),
          "trim-end",
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  window: {
    position: "absolute",
    top: 0,
    bottom: 0,
    flexDirection: "row",
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.primary,
  },
  grip: {
    width: GRIP_WIDTH,
    backgroundColor: theme.colors.primary,
  },
  fill: {
    flex: 1,
  },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.text,
  },
  edges: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.space.xxs,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.space.xs,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontVariant: ["tabular-nums"],
  },
  middle: {
    flex: 1,
    alignItems: "center",
  },
}));

export default TrimWindowBar;
