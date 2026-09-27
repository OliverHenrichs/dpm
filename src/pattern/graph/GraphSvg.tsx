import React from "react";
import Svg from "react-native-svg";
import { useUnistyles } from "react-native-unistyles";
import { IGraphSvgProps } from "@/src/pattern/graph/types/IGraphSvgProps";
import { rasterizeLargeGraph } from "@/src/pattern/graph/utils/RasterizeProps";
import {
  ArrowheadMarker,
  drawEdges,
  drawNodes,
} from "@/src/pattern/graph/render/GraphPrimitives";

/** The network view's SVG. Timeline builds its own, from the same primitives. */
const NetworkGraphSvg: React.FC<IGraphSvgProps> = ({
  svgWidth,
  svgHeight,
  model,
  positions,
  draggingId,
  dragX,
  dragY,
  onNodeTap,
}) => {
  const { theme } = useUnistyles();
  return (
    <Svg
      width={svgWidth}
      height={svgHeight}
      {...rasterizeLargeGraph(model.nodes.length)}
    >
      <ArrowheadMarker />
      {drawEdges(model.edges, positions, theme.colors, {
        draggingId,
        dragX,
        dragY,
      })}
      {/* No per-node press handler: the network view's taps come from the
        canvas gesture, because an SVG press handler claims the touch and
        stops the drag activating. See `PatternNodeGroup`. */}
      {drawNodes(model.nodes, positions, undefined, {
        draggingId,
        dragX,
        dragY,
      })}
    </Svg>
  );
};

export default NetworkGraphSvg;
