import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { useGraphLayout } from "./hooks/useGraphLayout";
import NetworkGraphSvg from "./GraphSvg";
import ZoomableCanvas from "@/src/pattern/graph/components/ZoomableCanvas";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { useCanvasTransformValues } from "@/src/pattern/graph/components/CanvasTransformContext";
import { useNodeDrag } from "@/src/pattern/graph/hooks/useNodeDrag";

interface NetworkGraphViewProps {
  model: GraphModel;
  palette: Record<PaletteColor, string>;
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
  palette,
  hasActiveFilter,
  positions,
  onMoveNode,
  onNodeTap,
}) => {
  const { t } = useTranslation();
  const { svgWidth, svgHeight, contentCenterX, contentCenterY, initialZoom } =
    useGraphLayout(model);
  const styles = getStyles(palette);

  // The canvas centers the SVG mid-point in the viewport. Shift by the
  // difference to the content's center instead, scaled by zoom.
  const initialOffsetX = (svgWidth / 2 - contentCenterX) * initialZoom;
  const initialOffsetY = (svgHeight / 2 - contentCenterY) * initialZoom;

  const transform = useCanvasTransformValues(
    initialZoom,
    initialOffsetX,
    initialOffsetY,
  );
  const { draggingId, dragX, dragY, gesture } = useNodeDrag(
    transform,
    positions,
    svgWidth,
    svgHeight,
    onMoveNode,
    model.nodes.length > 0,
  );

  // Hooks first, then the empty case. This used to be a plain function that
  // called useTranslation and was invoked conditionally, with a
  // rules-of-hooks suppression on top — the hook count changed between a
  // populated and an empty list.
  if (model.nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {t(
            hasActiveFilter ? "noPatternsMatchFilter" : "noPatternsToVisualize",
          )}
        </Text>
      </View>
    );
  }

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
      >
        <NetworkGraphSvg
          svgWidth={svgWidth}
          svgHeight={svgHeight}
          model={model}
          positions={positions}
          palette={palette}
          draggingId={draggingId}
          dragX={dragX}
          dragY={dragY}
          onNodeTap={onNodeTap}
        />
      </ZoomableCanvas>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
      overflow: "hidden",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette[PaletteColor.Background],
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: palette[PaletteColor.SecondaryText],
      textAlign: "center",
    },
  });

export default NetworkGraphView;
