import { FC, ReactNode } from "react";
import { G } from "react-native-svg";

export type PatternNodeGroupProps = {
  onPress: () => void;
  children: ReactNode;
};

/** An SVG group that reports taps — the tappable wrapper around a graph node. */
const PatternNodeGroup: FC<PatternNodeGroupProps> = ({ onPress, children }) => (
  <G onPress={onPress}>{children}</G>
);

export default PatternNodeGroup;
