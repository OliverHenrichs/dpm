import { FC, ReactNode } from "react";
import { G } from "react-native-svg";

export type PatternNodeGroupProps = {
  onPress: () => void;
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
}) => (
  <G onPress={onPress} opacity={opacity}>
    {children}
  </G>
);

export default PatternNodeGroup;
