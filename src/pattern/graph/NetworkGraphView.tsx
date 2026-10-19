import React, { useCallback, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import GraphEmptyState from "@/src/pattern/graph/components/GraphEmptyState";
import { measureCanvas } from "@/src/pattern/graph/model/canvasMetrics";
import NetworkGraphSvg from "./GraphSvg";
import ZoomableCanvas from "@/src/pattern/graph/components/ZoomableCanvas";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { useCanvasTransformValues } from "@/src/pattern/graph/components/CanvasTransformContext";
import { useNodeDrag } from "@/src/pattern/graph/hooks/useNodeDrag";
import DragOverlay from "@/src/pattern/graph/render/DragOverlay";
import { PatternType } from "@/src/pattern/types/PatternType";
import { useFocusPreview } from "@/src/pattern/graph/hooks/useFocusPreview";
import FocusMark from "@/src/pattern/graph/render/FocusMark";
import FocusPreviewCard from "@/src/pattern/graph/components/FocusPreviewCard";

interface NetworkGraphViewProps {
  model: GraphModel;
  /** For the focus preview's type name. */
  patternTypes: PatternType[];
  /** Distinguishes "nothing matched" from "this list is empty". */
  hasActiveFilter: boolean;
  /** The positions to draw: the manual layout where one exists. */
  positions: Map<number, LayoutPosition>;
  /** Persist a node's new position. */
  onMoveNode: (id: number, position: LayoutPosition) => void;
  onNodeTap: (pattern: IPattern) => void;
}

const NetworkGraphView: React.FC<NetworkGraphViewProps> = ({
  model,
  patternTypes,
  hasActiveFilter,
  positions,
  onMoveNode,
  onNodeTap,
}) => {
  const { width, height } = useWindowDimensions();

  // Measured from the positions actually being drawn, not from the automatic
  // layout: a manual layout replaces those, and a node dragged past the
  // automatic bounds would fall outside the SVG and never be drawn at all.
  const { svgWidth, svgHeight, contentCenterX, contentCenterY, initialZoom } =
    useMemo(
      () => measureCanvas(positions, width, height),
      [positions, width, height],
    );

  // The canvas centers the SVG mid-point in the viewport. Shift by the
  // difference to the content's center instead, scaled by zoom.
  const initialOffsetX = (svgWidth / 2 - contentCenterX) * initialZoom;
  const initialOffsetY = (svgHeight / 2 - contentCenterY) * initialZoom;

  const transform = useCanvasTransformValues(
    initialZoom,
    initialOffsetX,
    initialOffsetY,
  );
  // Taps go through the gesture system too, not through each node's own SVG
  // press handler — that handler claims the touch outright and stopped the
  // drag from ever activating. See `PatternNodeGroup`.
  const patternById = useMemo(
    () => new Map(model.nodes.map((node) => [node.pattern.id, node.pattern])),
    [model.nodes],
  );
  // The pattern under the mark in the middle, previewed while panning.
  const focus = useFocusPreview(transform, positions, svgWidth, svgHeight);
  const { dismiss: dismissFocus } = focus;

  const handleTap = useCallback(
    (id: number) => {
      const pattern = patternById.get(id);
      if (!pattern) return;
      // Opening a pattern in full puts the preview away: the details have a
      // player of their own, and two at once is more than a phone decodes.
      dismissFocus();
      onNodeTap(pattern);
    },
    [patternById, onNodeTap, dismissFocus],
  );

  const { draggingId, dragX, dragY, gesture } = useNodeDrag(
    transform,
    positions,
    svgWidth,
    svgHeight,
    onMoveNode,
    handleTap,
    model.nodes.length > 0,
    focus.focusedAtMark,
  );

  // Hooks first, then the empty case. This used to be a plain function that
  // called useTranslation and was invoked conditionally, with a
  // rules-of-hooks suppression on top — the hook count changed between a
  // populated and an empty list.
  if (model.nodes.length === 0) {
    return <GraphEmptyState hasActiveFilter={hasActiveFilter} />;
  }

  const draggedNode =
    draggingId === null
      ? undefined
      : model.nodes.find((node) => node.pattern.id === draggingId);
  const focusedNode =
    focus.focusedId === null
      ? undefined
      : model.nodes.find((node) => node.pattern.id === focus.focusedId);

  return (
    <View style={styles.container}>
      <ZoomableCanvas
        contentWidth={svgWidth}
        contentHeight={svgHeight}
        initialZoom={initialZoom}
        initialOffsetX={initialOffsetX}
        initialOffsetY={initialOffsetY}
        transform={transform}
        extraGesture={gesture}
        onPanStart={focus.onPanStart}
        onPanEnd={focus.onPanEnd}
        overlay={<FocusMark engaged={!!focusedNode} panning={focus.panning} />}
      >
        <NetworkGraphSvg
          svgWidth={svgWidth}
          svgHeight={svgHeight}
          model={model}
          positions={positions}
          draggingId={draggingId}
          dragX={dragX}
          dragY={dragY}
          onNodeTap={onNodeTap}
        />

        {draggedNode && (
          <DragOverlay
            node={draggedNode}
            origin={positions.get(draggedNode.pattern.id)!}
            dragX={dragX}
            dragY={dragY}
          />
        )}
      </ZoomableCanvas>

      <View style={styles.previewSlot} pointerEvents="box-none">
        {focusedNode && (
          <FocusPreviewCard
            key={focusedNode.pattern.id}
            node={focusedNode}
            typeName={
              patternTypes.find(
                (type) => type.id === focusedNode.pattern.typeId,
              )?.slug ?? ""
            }
            before={
              model.adjacency.prereqsOf.get(focusedNode.pattern.id)?.length ?? 0
            }
            after={
              model.adjacency.dependentsOf.get(focusedNode.pattern.id)
                ?.length ?? 0
            }
            panning={focus.panning}
            onOpen={() => handleTap(focusedNode.pattern.id)}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  // Above the legend's button in the bottom corner, and well clear of the
  // focus mark in the middle.
  previewSlot: {
    position: "absolute",
    left: theme.space.md,
    right: theme.space.md,
    bottom: theme.touchTarget + theme.space.xl,
  },
}));

export default NetworkGraphView;
