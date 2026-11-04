import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { alpha, motion } from "@/src/common/theme/tokens";

export type ProgressTone = "primary" | "success" | "danger";

export interface ProgressBarProps {
  /**
   * How far it got, 0..1. Left out, the bar is indeterminate: a segment sweeps along the track
   * (or, with reduced motion, sits still), for work that reports no count.
   */
  value?: number;
  /** What is in progress, for screen readers. */
  accessibilityLabel: string;
  tone?: ProgressTone;
  /** Layout only. */
  style?: StyleProp<ViewStyle>;
}

/** The share of the track the indeterminate segment covers. */
const SEGMENT = 0.35;

/**
 * A thin progress track. Determinate with `value`, announced as a progress bar with its
 * percentage; indeterminate without, announced as busy.
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  accessibilityLabel,
  tone = "primary",
  style,
}) => {
  const determinate = value !== undefined;
  const percent = determinate
    ? Math.round(Math.min(1, Math.max(0, value)) * 100)
    : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        determinate ? { min: 0, max: 100, now: percent } : undefined
      }
      accessibilityState={{ busy: !determinate }}
      style={[styles.track(tone), style]}
    >
      {determinate ? (
        <View style={styles.fill(tone, percent)} />
      ) : (
        <Sweep tone={tone} />
      )}
    </View>
  );
};

/** The indeterminate segment, moving left to right across the measured track. */
const Sweep: React.FC<{ tone: ProgressTone }> = ({ tone }) => {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const phase = useSharedValue(0);
  const span = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    phase.set(
      withRepeat(
        withTiming(1, {
          duration: motion.duration.sweep,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(phase);
  }, [phase, reduceMotion]);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setWidth(next);
    span.set(next);
  };
  // From just off the left edge to just off the right; still, it rests in the middle.
  const slide = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? span.get() * ((1 - SEGMENT) / 2)
          : (phase.get() * (1 + SEGMENT) - SEGMENT) * span.get(),
      },
    ],
  }));
  return (
    <View style={styles.sweepTrack} onLayout={onLayout} testID="progress-sweep">
      {width > 0 && (
        <Animated.View style={[styles.segment(tone, width * SEGMENT), slide]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  track: (tone: ProgressTone) => ({
    height: theme.space.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: alpha(theme.colors[tone], 0.18),
    overflow: "hidden" as const,
  }),
  fill: (tone: ProgressTone, percent: number) => ({
    width: `${percent}%` as const,
    height: "100%" as const,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors[tone],
  }),
  sweepTrack: { flex: 1 },
  segment: (tone: ProgressTone, width: number) => ({
    width,
    height: "100%" as const,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors[tone],
  }),
}));

export default ProgressBar;
