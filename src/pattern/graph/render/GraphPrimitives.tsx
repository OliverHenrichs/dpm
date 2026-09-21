import React from "react";
import { Defs, Marker, Path, Polygon } from "react-native-svg";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import PatternNode from "@/src/pattern/graph/PatternNode";
import {
  generateOrthogonalPath,
  LayoutPosition,
} from "@/src/pattern/graph/utils/GraphUtils";
import { GraphEdge, GraphNode } from "@/src/pattern/graph/model/GraphModel";
import { IPattern } from "@/src/pattern/types/IPatternList";

/**
 * Drawing primitives shared by both graph views.
 *
 * They lived in `GraphSvg.tsx` — the network view's own module — which meant
 * `TimelineView` imported from a sibling view to draw its nodes. Both views
 * now depend on this instead of on each other.
 */

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

/**
 * Dash pattern for an edge that spans nodes a filter is hiding.
 *
 * Without it a chain A → B → C with B filtered out would draw as a solid
 * A → C, telling the user those two are adjacent when they are not.
 */
export const ELIDED_DASH = "6 4";

/** Edges whose endpoints are both laid out; the rest are skipped silently. */
export function drawEdges(
  edges: GraphEdge[],
  positions: Map<number, LayoutPosition>,
  palette: Record<PaletteColor, string>,
) {
  return (
    <>
      {edges.map((edge, index) => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;
        const elided = edge.kind === "elided";
        return (
          <Path
            key={`edge-${index}`}
            d={generateOrthogonalPath(fromPos, toPos)}
            stroke={palette[PaletteColor.Primary]}
            strokeWidth={2}
            strokeDasharray={elided ? ELIDED_DASH : undefined}
            fill="none"
            markerEnd="url(#arrowhead-graph)"
            opacity={elided ? 0.4 : 0.6}
          />
        );
      })}
    </>
  );
}

export function drawNodes(
  nodes: GraphNode[],
  positions: Map<number, LayoutPosition>,
  palette: Record<PaletteColor, string>,
  onNodeTap: (pattern: IPattern) => void,
) {
  return nodes.map((node) => {
    const pos = positions.get(node.pattern.id);
    // The layout is expected to place every node it is given; see
    // GraphLayoutInvariants. This guard is the last line of defence.
    if (!pos) return null;

    return (
      <PatternNode
        key={node.pattern.id}
        node={node}
        x={pos.x}
        y={pos.y}
        palette={palette}
        onPress={onNodeTap}
      />
    );
  });
}
