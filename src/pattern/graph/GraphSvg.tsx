import React from "react";
import Svg, { G } from "react-native-svg";
import { useUnistyles } from "react-native-unistyles";
import { IGraphSvgProps } from "@/src/pattern/graph/types/IGraphSvgProps";
import { rasterizeLargeGraph } from "@/src/pattern/graph/utils/RasterizeProps";
import {
  ArrowheadMarker,
  drawEdges,
  drawNodes,
  SEQUENCE_EDGE_OPACITY,
} from "@/src/pattern/graph/render/GraphPrimitives";
import SequenceLayer from "@/src/pattern/graph/render/SequenceLayer";

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
  sequence,
}) => {
  const { theme } = useUnistyles();
  const highlight = sequence ? new Set(sequence.numbers.keys()) : undefined;
  return (
    <Svg
      width={svgWidth}
      height={svgHeight}
      {...rasterizeLargeGraph(model.nodes.length)}
    >
      <ArrowheadMarker />
      <G opacity={sequence ? SEQUENCE_EDGE_OPACITY : undefined}>
        {drawEdges(model.edges, positions, theme, {
          draggingId,
          dragX,
          dragY,
        })}
      </G>
      {/* No per-node press handler: the network view's taps come from the
        canvas gesture, because an SVG press handler claims the touch and
        stops the drag activating. See `PatternNodeGroup`. */}
      {drawNodes(
        model.nodes,
        positions,
        undefined,
        { draggingId, dragX, dragY },
        highlight,
      )}
      {sequence && (
        <SequenceLayer
          overlay={sequence}
          positions={positions}
          draggingId={draggingId}
        />
      )}
    </Svg>
  );
};

export default NetworkGraphSvg;
