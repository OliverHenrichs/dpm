import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { WCSPattern } from "@/components/pattern/types/WCSPattern";
import { Pattern } from "@/components/pattern/types/PatternList";
import { loadPatterns } from "@/components/pattern/data/PatternStorage";
import { foundationalWCSPatterns } from "@/components/pattern/data/DefaultWCSPatterns";
import {
  convertWCSPatternsToPatterns,
  getWCSPatternListForLegacyConversion,
} from "@/components/pattern/data/PatternConversion";
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
  const { activeList, patterns: contextPatterns } = useActivePatternList();

  const [legacyWCSPatterns, setLegacyWCSPatterns] = useState<WCSPattern[]>(
    foundationalWCSPatterns,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedPattern, setSelectedPattern] = useState<
    (WCSPattern | Pattern) | undefined
  >(undefined);
  const [resetKey, setResetKey] = useState(0);

  // Load legacy WCS patterns if no active list (backward compatibility)
  useFocusEffect(
    useCallback(() => {
      if (!activeList) {
        const fetchPatterns = async () => {
          try {
            const stored = await loadPatterns();
            if (stored) {
              console.log("Loaded legacy WCS patterns:", stored.length);
              setLegacyWCSPatterns(stored);
            }
          } catch (error) {
            console.error("Error loading legacy patterns:", error);
          }
        };
        fetchPatterns();
      }
    }, [activeList]),
  );

  // Convert legacy patterns to new format and create temporary WCS list
  const { patterns, patternTypes } = useMemo(() => {
    if (activeList) {
      // Use active list patterns and types
      return {
        patterns: contextPatterns,
        patternTypes: activeList.patternTypes,
      };
    } else {
      // Convert legacy WCS patterns to new format
      const tempWCSList = getWCSPatternListForLegacyConversion();
      const convertedPatterns = convertWCSPatternsToPatterns(
        legacyWCSPatterns,
        tempWCSList,
      );
      console.log("Converted patterns:", convertedPatterns.length);
      return {
        patterns: convertedPatterns,
        patternTypes: tempWCSList.patternTypes,
      };
    }
  }, [activeList, contextPatterns, legacyWCSPatterns]);

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "timeline" ? "graph" : "timeline"));
    setResetKey((prev) => prev + 1);
  };

  const handleNodeTap = (pattern: WCSPattern | Pattern) => {
    setSelectedPattern(pattern);
  };

  const handleCloseModal = () => {
    setSelectedPattern(undefined);
  };

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
          pattern={selectedPattern as any}
          allPatterns={patterns as any}
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
