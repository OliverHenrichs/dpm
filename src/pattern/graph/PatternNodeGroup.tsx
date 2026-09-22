import { FC, ReactNode } from "react";
import { G } from "react-native-svg";

export type PatternNodeGroupProps = {
  /**
   * Omit to make the node inert.
   *
   * This is not a nicety. `onPress` on an SVG element installs React Native's
   * full Touchable responder set — including `onStartShouldSetResponder` and
   * an `onResponderTerminationRequest` that refuses to yield — so a touch
   * landing on a node is claimed before Gesture Handler ever sees it. That is
   * why long-press-to-drag did nothing on a node while panning from empty
   * canvas worked. The network view therefore leaves this undefined and
   * handles taps in the same gesture system as the drag; the timeline, which
   * has no canvas gesture to compete with, still uses it.
   */
  onPress?: () => void;
  /**
   * Drawn back, for a node shown only as context around a filter match.
   *
   * Applied to the whole group rather than to the node's fill: the fill
   * opacity already encodes level (0.3 / 0.5 / 0.7), and folding a second
   * meaning into it would make an advanced context node and a beginner match
   * indistinguishable.
   */
  opacity?: number;
  children: ReactNode;
};

/** An SVG group that reports taps — the tappable wrapper around a graph node. */
const PatternNodeGroup: FC<PatternNodeGroupProps> = ({
  onPress,
  opacity,
  children,
}) =>
  onPress ? (
    <G onPress={onPress} opacity={opacity}>
      {children}
    </G>
  ) : (
    <G opacity={opacity}>{children}</G>
  );

export default PatternNodeGroup;
