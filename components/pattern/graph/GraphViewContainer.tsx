import React from "react";
import { StyleSheet, View } from "react-native";
import { Pattern } from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { PaletteColor } from "@/components/common/ColorPalette";
import TimelineView from "./TimelineView";
import NetworkGraphView from "./NetworkGraphView";
import Legend from "./Legend";

type ViewMode = "timeline" | "graph";

interface GraphViewContainerProps {
  viewMode: ViewMode;
  patterns: Pattern[];
  patternTypes: PatternType[];
  palette: Record<PaletteColor, string>;
  resetKey: number;
  onNodeTap: (pattern: Pattern) => void;
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
