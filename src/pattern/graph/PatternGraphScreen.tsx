import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { IPattern } from "@/src/pattern/types/IPatternList";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { getCommonListContainer } from "@/src/common/utils/CommonStyles";
import PatternGraphHeader from "./PatternGraphHeader";
import GraphViewContainer from "./GraphViewContainer";
import PatternDetailsModal from "./PatternDetailsModal";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";

type ViewMode = "timeline" | "graph";

const PatternGraphScreen: React.FC = () => {
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const { activeList, patterns } = useActivePatternList();

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedPattern, setSelectedPattern] = useState<IPattern | undefined>(
    undefined,
  );
  const [resetKey, setResetKey] = useState(0);

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "timeline" ? "graph" : "timeline"));
    setResetKey((prev) => prev + 1);
  };

  const handleNodeTap = (pattern: IPattern) => {
    setSelectedPattern(pattern);
  };

  const handleCloseModal = () => {
    setSelectedPattern(undefined);
  };

  // Get pattern types from active list or empty array
  const patternTypes = activeList?.patternTypes ?? [];

  return (
    <View style={{ flex: 1 }}>
      <PageContainer
        style={{ backgroundColor: palette[PaletteColor.Background] }}
      >
        <AppHeader />

        <View style={styles.contentContainer}>
          <PatternGraphHeader
            viewMode={viewMode}
            onToggleView={handleToggleView}
          />

          <GraphViewContainer
            viewMode={viewMode}
            patterns={patterns}
            patternTypes={patternTypes}
            palette={palette}
            resetKey={resetKey}
            onNodeTap={handleNodeTap}
          />
        </View>

        <PatternDetailsModal
          visible={selectedPattern !== undefined}
          pattern={selectedPattern}
          allPatterns={patterns}
          patternTypes={patternTypes}
          onClose={handleCloseModal}
        />
      </PageContainer>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    contentContainer: {
      ...getCommonListContainer(palette),
      flex: 1,
    },
  });

export default PatternGraphScreen;
