import React from "react";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { FOCUS_RADIUS } from "@/src/pattern/graph/model/focus";

interface FocusMarkProps {
  /** Whether a pattern touches the mark: it fills in, the same way the card appears. */
  engaged: boolean;
  /** While the canvas pans the mark grows a little and darkens, to say it is looking. */
  panning: SharedValue<boolean>;
}

const SIZE = FOCUS_RADIUS * 2;
const STROKE = 2;
/** Length of a bracket's arm, along each side. */
const ARM = FOCUS_RADIUS * 0.6;

/**
 * The mark in the middle of the network view that previews whatever pattern
 * it rests on. Fixed to the viewport, not the graph, and inert: touches go
 * straight through it to the canvas.
 */
const FocusMark: React.FC<FocusMarkProps> = ({ engaged, panning }) => {
  const { theme } = useUnistyles();
  const colour = theme.colors.primary;
  const duration = theme.motion.duration.fast;

  const animatedStyle = useAnimatedStyle(() => {
    const active = panning.get();
    return {
      opacity: withTiming(active ? 1 : 0.6, { duration }),
      transform: [
        {
          scale: withTiming(active ? 1.12 : 1, { duration }),
        },
      ],
    };
  });

  const inset = STROKE / 2;
  const far = SIZE - inset;
  const centre = FOCUS_RADIUS;
  const fill = engaged ? alpha(colour, 0.16) : "none";

  return (
    <Animated.View
      style={[styles.mark, animatedStyle]}
      pointerEvents="none"
      testID="graph-focus-mark"
    >
      <Svg width={SIZE} height={SIZE}>
        {theme.graph.focusMark === "ring" ? (
          <Circle
            cx={centre}
            cy={centre}
            r={FOCUS_RADIUS - inset}
            stroke={colour}
            strokeWidth={STROKE}
            fill={fill}
          />
        ) : (
          <>
            <Path
              d={[
                `M${inset} ${inset + ARM}V${inset}H${inset + ARM}`,
                `M${far - ARM} ${inset}H${far}V${inset + ARM}`,
                `M${far} ${far - ARM}V${far}H${far - ARM}`,
                `M${inset + ARM} ${far}H${inset}V${far - ARM}`,
              ].join("")}
              stroke={colour}
              strokeWidth={STROKE}
              fill="none"
            />
            {engaged && (
              <Path
                d={`M${inset} ${inset}H${far}V${far}H${inset}Z`}
                fill={fill}
              />
            )}
          </>
        )}
        <Circle cx={centre} cy={centre} r={STROKE} fill={colour} />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  mark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: SIZE,
    height: SIZE,
    marginTop: -FOCUS_RADIUS,
    marginLeft: -FOCUS_RADIUS,
  },
});

export default FocusMark;
