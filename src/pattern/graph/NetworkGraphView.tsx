import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import { useGraphLayout } from "./hooks/useGraphLayout";
import NetworkGraphSvg from "./GraphSvg";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";

interface NetworkGraphViewProps {
  model: GraphModel;
  palette: Record<PaletteColor, string>;
  /** Distinguishes "nothing matched" from "this list is empty". */
  hasActiveFilter: boolean;
  onNodeTap: (pattern: IPattern) => void;
}

const NetworkGraphView: React.FC<NetworkGraphViewProps> = ({
  model,
  palette,
  hasActiveFilter,
  onNodeTap,
}) => {
  const { t } = useTranslation();
  const {
    positions,
    svgWidth,
    svgHeight,
    contentCenterX,
    contentCenterY,
    initialZoom,
  } = useGraphLayout(model);
  const styles = getStyles(palette);

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

  // The zoomable view centers the SVG mid-point in the viewport by default.
  // Shift by the difference to the content's center instead, scaled by zoom.
  const initialOffsetX = (svgWidth / 2 - contentCenterX) * initialZoom;
  const initialOffsetY = (svgHeight / 2 - contentCenterY) * initialZoom;

  return (
    <View style={styles.container}>
      <ReactNativeZoomableView
        maxZoom={4.5}
        minZoom={0.15}
        zoomStep={0.5}
        initialZoom={initialZoom}
        initialOffsetX={initialOffsetX}
        initialOffsetY={initialOffsetY}
        bindToBorders={false}
      >
        <NetworkGraphSvg
          svgWidth={svgWidth}
          svgHeight={svgHeight}
          model={model}
          positions={positions}
          palette={palette}
          onNodeTap={onNodeTap}
        />
      </ReactNativeZoomableView>
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
