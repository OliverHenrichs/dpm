import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Icon } from "@/src/common/ui";
import { SwimlaneInfo } from "@/src/pattern/graph/utils/TimelineGraphUtils";
import { LaneDrag } from "@/src/pattern/graph/hooks/useLaneDrag";
import { START_OFFSET } from "@/src/pattern/graph/types/Constants";

/**
 * How wide the column of lane handles is. Kept clear of the first column of nodes, whose boxes
 * start at `LEFT_MARGIN - NODE_WIDTH / 2` (70), so the column never takes a tap meant for a node.
 */
export const LANE_HANDLE_WIDTH = 64;
/** Where a reorderable lane's name starts, past the handle's grip. */
export const LANE_LABEL_X_WITH_HANDLE = 30;
/** Picked up, so slightly larger: the cue that does not need hardware. */
const LIFT_SCALE = 1.06;

interface LaneHandlesProps {
  /** The lanes as drawn now (the preview order while a lane is dragged). */
  lanes: SwimlaneInfo[];
  drag: LaneDrag;
  /** The timeline's height, so the column covers every lane. */
  height: number;
  uppercase: boolean;
  /** Moves the lane at `index` one place up (-1) or down (+1): the screen reader's way. */
  onStep: (index: number, step: -1 | 1) => void;
}

/**
 * The grips on the timeline's lane names, and the lifted name while one is dragged.
 *
 * One column, under one pan (`useLaneDrag`), laid over the left edge of the lanes; the grips
 * inside it are drawn where the lanes are now, the dragged one hidden while its lifted copy
 * follows the finger. The column itself never moves, so the gesture's coordinates stay put
 * while the lanes reflow.
 */
const LaneHandles: React.FC<LaneHandlesProps> = ({
  lanes,
  drag,
  height,
  uppercase,
  onStep,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { dragging, dragOffset } = drag;

  const lifted = useAnimatedStyle(() => ({
    transform: [{ translateY: dragOffset.get() }, { scale: LIFT_SCALE }],
  }));

  const label = (lane: SwimlaneInfo) => {
    const text = lane.label || lane.typeId || "";
    return uppercase ? text.toUpperCase() : text;
  };
  const draggedLane = dragging
    ? lanes.find((lane) => lane.typeId === dragging.typeId)
    : undefined;

  return (
    <>
      <GestureDetector gesture={drag.gesture}>
        <View style={[styles.column, { height }]} testID="lane-handle-column">
          {lanes.map((lane, index) => {
            const name = lane.label || lane.typeId || "";
            return (
              <View
                key={lane.typeId ?? name}
                style={[
                  styles.grip,
                  { top: lane.y },
                  dragging?.typeId === lane.typeId && styles.hidden,
                ]}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t("laneHandleLabel", { type: name })}
                accessibilityHint={t("laneHandleHint")}
                accessibilityActions={[
                  ...(index > 0
                    ? [{ name: "moveUp", label: t("laneMoveUp") }]
                    : []),
                  ...(index < lanes.length - 1
                    ? [{ name: "moveDown", label: t("laneMoveDown") }]
                    : []),
                ]}
                onAccessibilityAction={(event) => {
                  const action = event.nativeEvent.actionName;
                  if (action === "moveUp" || action === "decrement") {
                    if (index > 0) onStep(index, -1);
                  } else if (action === "moveDown" || action === "increment") {
                    if (index < lanes.length - 1) onStep(index, 1);
                  }
                }}
              >
                <Icon
                  name="drag-vertical"
                  size={theme.iconSize.sm}
                  color={lane.color ?? theme.colors.textMuted}
                />
              </View>
            );
          })}
        </View>
      </GestureDetector>

      {dragging && (
        <Animated.View
          pointerEvents="none"
          style={[styles.lifted, { top: dragging.top }, lifted]}
          testID="lane-lifted"
        >
          <Icon
            name="drag-vertical"
            size={theme.iconSize.sm}
            color={draggedLane?.color ?? theme.colors.textMuted}
          />
          {/* In the text colour: a type colour on the surface may not be legible, and the
              grip beside it carries the lane's colour. */}
          <AppText variant="section" numberOfLines={1}>
            {draggedLane ? label(draggedLane) : ""}
          </AppText>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  column: {
    position: "absolute",
    left: 0,
    top: 0,
    width: LANE_HANDLE_WIDTH,
  },
  grip: {
    position: "absolute",
    left: 0,
    width: LANE_HANDLE_WIDTH,
    height: START_OFFSET,
    paddingLeft: theme.space.xs,
    justifyContent: "center",
  },
  hidden: {
    opacity: 0,
  },
  lifted: {
    position: "absolute",
    left: 0,
    height: START_OFFSET,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    paddingLeft: theme.space.xs,
    paddingRight: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    ...theme.elevation.md,
  },
}));

export default LaneHandles;
