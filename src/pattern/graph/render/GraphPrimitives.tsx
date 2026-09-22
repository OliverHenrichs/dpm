import React from "react";
import { Defs, Marker, Path, Polygon } from "react-native-svg";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import PatternNode from "@/src/pattern/graph/PatternNode";
import {
  generateOrthogonalPath,
  LayoutPosition,
} from "@/src/pattern/graph/utils/GraphUtils";
import { GraphEdge, GraphNode } from "@/src/pattern/graph/model/GraphModel";
import { ELIDED_DASH } from "@/src/pattern/graph/types/Constants";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { SharedValue } from "react-native-reanimated";
import DraggedEdge from "@/src/pattern/graph/render/DraggedEdge";
import DraggedNode from "@/src/pattern/graph/render/DraggedNode";

/**
 * The in-flight drag, if any.
 *
 * Passed down rather than read from context so the timeline — which draws the
 * same nodes and has no drag — simply omits it.
 */
export interface DragRender {
  draggingId?: number | null;
  dragX?: SharedValue<number>;
  dragY?: SharedValue<number>;
}

/** Is this the node under the finger, with somewhere to read its position? */
function isDragging(
  id: number,
  drag: DragRender | undefined,
): drag is Required<DragRender> {
  return (
    drag?.draggingId === id &&
    drag.dragX !== undefined &&
    drag.dragY !== undefined
  );
}

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

/** Edges whose endpoints are both laid out; the rest are skipped silently. */
export function drawEdges(
  edges: GraphEdge[],
  positions: Map<number, LayoutPosition>,
  palette: Record<PaletteColor, string>,
  drag?: DragRender,
) {
  return (
    <>
      {edges.map((edge, index) => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;
        const elided = edge.kind === "elided";

        // One end is moving: follow it on the UI thread rather than
        // re-rendering. Only the dragged node's own edges take this path, so
        // the per-frame work is a handful of worklets whatever the graph size.
        const movingFrom = isDragging(edge.from, drag);
        const movingTo = isDragging(edge.to, drag);
        if ((movingFrom || movingTo) && drag?.dragX && drag.dragY) {
          return (
            <DraggedEdge
              key={`edge-${index}`}
              anchor={movingFrom ? toPos : fromPos}
              dragX={drag.dragX}
              dragY={drag.dragY}
              draggingFrom={movingFrom}
              elided={elided}
              palette={palette}
            />
          );
        }

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
  onNodeTap: ((pattern: IPattern) => void) | undefined,
  drag?: DragRender,
) {
  return nodes.map((node) => {
    const pos = positions.get(node.pattern.id);
    // The layout is expected to place every node it is given; see
    // GraphLayoutInvariants. This guard is the last line of defence.
    if (!pos) return null;

    if (isDragging(node.pattern.id, drag)) {
      return (
        <DraggedNode
          key={node.pattern.id}
          node={node}
          origin={pos}
          dragX={drag.dragX}
          dragY={drag.dragY}
          palette={palette}
          onPress={onNodeTap}
        />
      );
    }

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
