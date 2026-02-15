import React from "react";
import Svg, { Defs, Marker, Path, Polygon } from "react-native-svg";
import { PaletteColor } from "@/components/common/ColorPalette";
import PatternNode from "./PatternNode";
import {
  IGraphPosition,
  IGraphSvgProps,
} from "@/components/pattern/graph/types/IGraphSvgProps";
import {
  generateEdges,
  generateOrthogonalPath,
  LayoutPosition,
} from "@/components/pattern/graph/utils/GraphUtils";

export const ArrowheadMarker: React.FC<{
  palette: Record<PaletteColor, string>;
}> = ({ palette }) => (
  <Defs>
    <Marker
      id="arrowhead-graph"
      markerWidth="5"
      markerHeight="5"
      refX="0"
      refY="3"
      orient="auto"
    >
      <Polygon points="0 0, 10 3, 0 6" fill={palette[PaletteColor.Primary]} />
    </Marker>
  </Defs>
);

export function drawEdges(
  edges: { from: number; to: number }[],
  positions: IGraphPosition,
  palette: Record<PaletteColor, string>,
) {
  return (
    <>
      {edges.map((edge, index) => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;
        return (
          <Path
            key={`edge-${index}`}
            d={generateOrthogonalPath(fromPos, toPos)}
            stroke={palette[PaletteColor.Primary]}
            strokeWidth={2}
            fill="none"
            markerEnd="url(#arrowhead-graph)"
            opacity={0.6}
          />
        );
      })}
    </>
  );
}

export function drawNodes<
  T extends {
    id: number;
    name: string;
    counts: number;
    prerequisites: number[];
    typeId?: string;
    type?: any;
  },
>(
  patterns: T[],
  positions: Map<number, LayoutPosition>,
  palette: Record<PaletteColor, string>,
  onNodeTap: (pattern: T) => void,
  typeColorMap?: Map<string, string>,
) {
  return patterns.map((pattern) => {
    const pos = positions.get(pattern.id);
    if (!pos) return null;

    return (
      <PatternNode
        key={pattern.id}
        pattern={pattern}
        x={pos.x}
        y={pos.y}
        palette={palette}
        onPress={onNodeTap}
        typeColorMap={typeColorMap}
      />
    );
  });
}

const NetworkGraphSvg: React.FC<IGraphSvgProps> = ({
  svgWidth,
  svgHeight,
  patterns,
  positions,
  palette,
  onNodeTap,
  typeColorMap,
}) => {
  const edges = generateEdges(patterns);
  return (
    <Svg
      width={svgWidth}
      height={svgHeight}
      shouldRasterizeIOS={patterns.length > 100}
    >
      <ArrowheadMarker palette={palette} />
      {drawEdges(edges, positions, palette)}
      {drawNodes(patterns, positions, palette, onNodeTap, typeColorMap)}
    </Svg>
  );
};

export default NetworkGraphSvg;
