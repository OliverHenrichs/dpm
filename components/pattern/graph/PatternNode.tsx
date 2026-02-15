import React from "react";
import { G, Rect, Text as SvgText } from "react-native-svg";
import {
  WCSPatternLevel,
  WCSPatternType,
} from "@/components/pattern/types/WCSPatternEnums";
import { PaletteColor } from "@/components/common/ColorPalette";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
} from "@/components/pattern/graph/types/Constants";

interface BasePattern {
  id: number;
  name: string;
  counts: number;
  prerequisites: number[];
  level?: string;
  typeId?: string;
  type?: any;
}

interface PatternNodeProps<T extends BasePattern> {
  pattern: T;
  x: number;
  y: number;
  palette: Record<PaletteColor, string>;
  onPress: (pattern: T) => void;
  typeColorMap?: Map<string, string>;
}

const PatternNode = <T extends BasePattern>({
  pattern,
  x,
  y,
  palette,
  onPress,
  typeColorMap,
}: PatternNodeProps<T>) => {
  // Determine border color based on pattern type
  const getBorderColor = (): string => {
    // If we have a typeColorMap and typeId, use it
    if (typeColorMap && pattern.typeId) {
      return typeColorMap.get(pattern.typeId) || palette[PaletteColor.Primary];
    }

    // Fallback to WCS pattern type for backward compatibility
    const wcsPattern = pattern as any;
    if (wcsPattern.type) {
      switch (wcsPattern.type) {
        case WCSPatternType.PUSH:
          return palette[PaletteColor.Primary];
        case WCSPatternType.PASS:
          return palette[PaletteColor.SecondaryText];
        case WCSPatternType.WHIP:
          return palette[PaletteColor.Accent];
        case WCSPatternType.TUCK:
          return palette[PaletteColor.Error];
        default:
          return palette[PaletteColor.Primary];
      }
    }

    return palette[PaletteColor.Primary];
  };

  // Determine background opacity based on level
  const getBackgroundOpacity = (): number => {
    if (!pattern.level) return 0.3;

    switch (pattern.level) {
      case WCSPatternLevel.BEGINNER:
      case "beginner":
        return 0.3;
      case WCSPatternLevel.INTERMEDIATE:
      case "intermediate":
        return 0.5;
      case WCSPatternLevel.ADVANCED:
      case "advanced":
        return 0.7;
      default:
        return 0.3;
    }
  };

  const isFoundational = pattern.prerequisites.length === 0;
  const borderColor = getBorderColor();
  const bgOpacity = getBackgroundOpacity();

  // Truncate long pattern names
  const displayName =
    pattern.name.length > 12
      ? pattern.name.substring(0, 11) + "..."
      : pattern.name;

  return (
    <G onPress={() => onPress(pattern)}>
      {/* Main background */}
      <Rect
        x={x - NODE_WIDTH / 2}
        y={y - NODE_HEIGHT / 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        fill={palette[PaletteColor.PrimaryText]}
        fillOpacity={bgOpacity}
        stroke={borderColor}
        strokeWidth={2}
        rx={4}
      />

      {/* Double border for foundational patterns */}
      {isFoundational && (
        <Rect
          x={x - NODE_WIDTH / 2 + 3}
          y={y - NODE_HEIGHT / 2 + 3}
          width={NODE_WIDTH - 6}
          height={NODE_HEIGHT - 6}
          fill="none"
          stroke={borderColor}
          strokeWidth={1}
          rx={2}
        />
      )}

      {/* Pattern name */}
      <SvgText
        x={x}
        y={y - 5}
        fontSize={12}
        fontWeight="bold"
        fill={palette[PaletteColor.PrimaryText]}
        textAnchor="middle"
      >
        {displayName}
      </SvgText>

      {/* Counts */}
      <SvgText
        x={x}
        y={y + 11}
        fontSize={10}
        fill={palette[PaletteColor.SecondaryText]}
        textAnchor="middle"
      >
        {`${pattern.counts} count`}
      </SvgText>
    </G>
  );
};

export default React.memo(PatternNode) as typeof PatternNode;
