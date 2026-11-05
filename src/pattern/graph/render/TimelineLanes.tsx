import React from "react";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { GraphNode } from "@/src/pattern/graph/model/GraphModel";
import {
  ArrowheadMarker,
  drawNodes,
  SEQUENCE_EDGE_OPACITY,
} from "@/src/pattern/graph/render/GraphPrimitives";
import { edgeStroke } from "@/src/pattern/graph/render/edgeStyle";
import {
  generateOrthogonalPath,
  LayoutPosition,
} from "@/src/pattern/graph/utils/GraphUtils";
import { SwimlaneInfo } from "@/src/pattern/graph/utils/TimelineGraphUtils";
import {
  LaneMotion,
  laneTop,
  useLaneStyle,
} from "@/src/pattern/graph/hooks/useLaneMotion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** An edge inside one lane, its path already relative to the lane's top. */
export interface InnerEdge {
  key: string;
  d: string;
  elided: boolean;
}

/** An edge between two lanes: its ends relative to their own lanes' tops. */
export interface CrossEdge {
  key: string;
  from: LayoutPosition;
  to: LayoutPosition;
  fromLane: string;
  toLane: string;
  /** The two lanes' tops as laid out, until the motion knows them. */
  fromTop: number;
  toTop: number;
  elided: boolean;
}

/** What a lane draws, relative to its own top. */
export interface LaneContent {
  lane: SwimlaneInfo;
  typeId: string;
  nodes: GraphNode[];
  positions: Map<number, LayoutPosition>;
  edges: InnerEdge[];
}

/**
 * A lane's band and name, below every edge. Lanes are labelled like the pattern list's section
 * headers in the app style: After Hours' italic serif, Clipboard's mono capitals. A lane being
 * dragged is tinted more strongly where it would land, and its name rides on the lifted label
 * meanwhile (`nameHidden`).
 */
export const LaneBandLayer: React.FC<{
  lane: SwimlaneInfo;
  typeId: string;
  width: number;
  lanes: LaneMotion;
  labelX: number;
  highlighted: boolean;
  nameHidden: boolean;
  uppercase: boolean;
}> = ({
  lane,
  typeId,
  width,
  lanes,
  labelX,
  highlighted,
  nameHidden,
  uppercase,
}) => {
  const { theme } = useUnistyles();
  const { section } = theme.typography;
  const moving = useLaneStyle(lanes, typeId, lane.y);
  const label = lane.label || lane.typeId || "";
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { width, height: lane.height }, moving]}
    >
      <Svg width={width} height={lane.height}>
        <Rect
          x={0}
          y={0}
          width={width}
          height={lane.height}
          fill={lane.color}
          fillOpacity={highlighted ? 0.25 : 0.1}
        />
        <SvgText
          x={labelX}
          y={25}
          fontFamily={section.fontFamily}
          fontSize={section.fontSize}
          fontWeight={section.fontWeight}
          fontStyle={section.fontStyle}
          letterSpacing={section.letterSpacing}
          fill={lane.color}
          fillOpacity={nameHidden ? 0 : 0.5}
        >
          {uppercase ? label.toUpperCase() : label}
        </SvgText>
      </Svg>
    </Animated.View>
  );
};

/**
 * A lane's figures and the edges between them, above the edges between lanes. One small SVG per
 * lane in a view that moves, not an animated group inside one big SVG: animating an SVG group's
 * transform made its contents vanish on device (see "Dragging a node" in the AGENTS.md here).
 */
export const LaneFiguresLayer: React.FC<{
  content: LaneContent;
  width: number;
  lanes: LaneMotion;
  onNodeTap: (pattern: IPattern) => void;
  rasterize: object;
  /** A shown sequence's figures: the lane's other figures and its edges dim. */
  highlight?: ReadonlySet<number>;
}> = ({ content, width, lanes, onNodeTap, rasterize, highlight }) => {
  const { theme } = useUnistyles();
  const { lane, typeId, nodes, positions, edges } = content;
  const moving = useLaneStyle(lanes, typeId, lane.y);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, { width, height: lane.height }, moving]}
    >
      <Svg width={width} height={lane.height} {...rasterize}>
        <ArrowheadMarker />
        <G opacity={highlight ? SEQUENCE_EDGE_OPACITY : undefined}>
          {edges.map((edge) => (
            <Path
              key={edge.key}
              d={edge.d}
              {...edgeStroke(theme, edge.elided)}
              fill="none"
              markerEnd="url(#arrowhead-graph)"
            />
          ))}
        </G>
        {drawNodes(nodes, positions, onNodeTap, undefined, highlight)}
      </Svg>
    </Animated.View>
  );
};

/**
 * An edge between two lanes, rebuilt on the UI thread from the lanes' tops while they slide.
 * When nothing moves its worklet does not run.
 */
export const CrossLaneEdge: React.FC<{
  edge: CrossEdge;
  lanes: LaneMotion;
}> = ({ edge, lanes }) => {
  const { theme } = useUnistyles();
  // Plain data for the worklet, and no function defined inside it (the React Compiler trap in
  // the AGENTS.md here).
  const { from, to, fromLane, toLane, fromTop, toTop } = edge;
  const animatedProps = useAnimatedProps(() => {
    const start = { x: from.x, y: from.y + laneTop(lanes, fromLane, fromTop) };
    const end = { x: to.x, y: to.y + laneTop(lanes, toLane, toTop) };
    return { d: generateOrthogonalPath(start, end, true) };
  });
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      {...edgeStroke(theme, edge.elided)}
      fill="none"
      markerEnd="url(#arrowhead-graph)"
    />
  );
};

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
