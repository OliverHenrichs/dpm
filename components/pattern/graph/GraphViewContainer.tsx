import React from "react";
import { StyleSheet, View } from "react-native";
import { WCSPattern } from "@/components/pattern/types/WCSPattern";
import { Pattern } from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { PaletteColor } from "@/components/common/ColorPalette";
import TimelineView from "./TimelineView";
import NetworkGraphView from "./NetworkGraphView";
import Legend from "./Legend";

type ViewMode = "timeline" | "graph";
type GraphPattern = WCSPattern | Pattern;

interface GraphViewContainerProps {
  viewMode: ViewMode;
  patterns: GraphPattern[];
  patternTypes?: PatternType[]; // Optional for dynamic mode
  palette: Record<PaletteColor, string>;
  resetKey: number;
  onNodeTap: (pattern: GraphPattern) => void;
}

const GraphViewContainer: React.FC<GraphViewContainerProps> = ({
  viewMode,
  patterns,
  patternTypes,
  palette,
  resetKey,
  onNodeTap,
}) => {
  const styles = getStyles(palette);

  return (
    <>
      <View style={styles.viewContainer}>
        {viewMode === "timeline" ? (
          <TimelineView
            key={`timeline-${resetKey}`}
            patterns={patterns}
            patternTypes={patternTypes}
            palette={palette}
            onNodeTap={onNodeTap}
          />
        ) : (
          <NetworkGraphView
            key={`graph-${resetKey}`}
            patterns={patterns}
            patternTypes={patternTypes}
            palette={palette}
            onNodeTap={onNodeTap}
          />
        )}
      </View>

      <Legend palette={palette} />
    </>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    viewContainer: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
    },
  });

export default GraphViewContainer;
