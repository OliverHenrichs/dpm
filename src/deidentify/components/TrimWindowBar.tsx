import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import {
  dragWindow,
  formatSeconds,
  hitTest,
  moveWindow,
  TrimGrab,
  TrimLimits,
  TrimWindow,
} from "@/src/deidentify/model/trimWindow";

type Props = {
  limits: TrimLimits;
  window: TrimWindow;
  /** Called on every drag step, for the labels. */
  onChange: (window: TrimWindow) => void;
  /** Called once a drag ends — the moment to seek the preview. */
  onChangeEnd: (window: TrimWindow) => void;
  /** Current preview position, drawn as a playhead. */
  playhead?: number;
};

const GRIP_WIDTH = 22;
/** How far outside a grip a touch still grabs it — fingers are wider than 22 pt. */
const GRIP_REACH = 28;
const TRACK_HEIGHT = 44;
/** A11y increment/decrement step, in seconds. */
const STEP = 1;

/**
 * A seek-bar-shaped track with a window over it: drag the middle to move the window, the
 * grips to resize it. One pan on the whole track hit-tests where the touch began (as the
 * graph canvas does, see src/pattern/graph/AGENTS.md) — nested detectors would let the move
 * and a grip both activate. The arithmetic lives in `model/trimWindow.ts`.
 *
 * Gestures run on the JS thread (`runOnJS(true)`): the bar is a handful of views, so a
 * per-step re-render is cheap, and the preview is only seeked when a drag ends.
 */
const TrimWindowBar: React.FC<Props> = ({
  limits,
  window,
  onChange,
  onChangeEnd,
  playhead,
}) => {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  // Deltas apply to the window as it was when the drag began, so rounding cannot accumulate.
  // Shared values rather than refs, as in useNodeDrag: the React Compiler rejects refs read
  // from gesture callbacks that are built during render.
  const origin = useSharedValue(window);
  const grab = useSharedValue<TrimGrab | null>(null);
  const latest = useSharedValue(window);
  useEffect(() => latest.set(window), [latest, window]);

  const secondsPerPixel = width > 0 ? limits.duration / width : 0;
  const x = (seconds: number) => (seconds / limits.duration) * width;

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onStart((e) => {
      origin.set(latest.get());
      grab.set(hitTest(e.x, latest.get(), width, limits.duration, GRIP_REACH));
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
      onChange(next);
    })
    .onEnd(() => {
      if (grab.get()) onChangeEnd(latest.get());
      grab.set(null);
    });

  const length = window.end - window.start;
  const range = {
    start: formatSeconds(window.start),
    end: formatSeconds(window.end),
    length: Math.round(length),
  };
  // A cap below the clip's length is worth stating; "of max. 42 s" on a 42 s clip is not.
  const label =
    limits.max < limits.duration
      ? t("trimSelection", { ...range, max: limits.max })
      : t("trimSelectionFree", range);

  const nudge = (delta: number) => {
    const next = moveWindow(window, delta, limits);
    onChange(next);
    onChangeEnd(next);
  };

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
                  { left: x(window.start), width: x(length) },
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
      <Text style={styles.label}>{label}</Text>
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
  label: {
    ...theme.typography.bodySmall,
    marginTop: theme.space.sm,
    textAlign: "center",
    color: theme.colors.textMuted,
  },
}));

export default TrimWindowBar;
