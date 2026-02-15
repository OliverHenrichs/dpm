import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pattern } from "@/components/pattern/types/PatternList";
import AppHeader from "@/components/common/AppHeader";
import PageContainer from "@/components/common/PageContainer";
import { useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { getCommonListContainer } from "@/components/common/CommonStyles";
import PatternGraphHeader from "./PatternGraphHeader";
import GraphViewContainer from "./GraphViewContainer";
import PatternDetailsModal from "./PatternDetailsModal";
import { useActivePatternList } from "@/components/pattern/context/ActivePatternListContext";

type ViewMode = "timeline" | "graph";

const PatternGraphScreen: React.FC = () => {
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const { activeList, patterns } = useActivePatternList();

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedPattern, setSelectedPattern] = useState<Pattern | undefined>(
    undefined,
  );
  const [resetKey, setResetKey] = useState(0);

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "timeline" ? "graph" : "timeline"));
    setResetKey((prev) => prev + 1);
  };

  const handleNodeTap = (pattern: Pattern) => {
    setSelectedPattern(pattern);
  };

  const handleCloseModal = () => {
    setSelectedPattern(undefined);
  };

  // Get pattern types from active list or empty array
  const patternTypes = activeList?.patternTypes || [];

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
