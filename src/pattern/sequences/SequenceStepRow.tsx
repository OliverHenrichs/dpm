import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Icon, IconButton, ListRow } from "@/src/common/ui";
import { RevealTextInput } from "@/src/common/components/reveal";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import {
  IModifier,
  IPattern,
  ISequenceStep,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import ModifierPillStrip from "@/src/pattern/list/ModifierPillStrip";
import {
  MAX_STEP_NOTE,
  MAX_STEP_TEXT,
  stepCounts,
  stepVariant,
} from "@/src/pattern/sequences/sequences";
import { StepDrag } from "@/src/pattern/sequences/useStepDrag";

/** How long a passed row takes to make way. */
const MAKE_WAY_MS = 120;
/** Picked up, so slightly larger: the cue that does not need hardware. */
const LIFT_SCALE = 1.02;

interface SequenceStepRowProps {
  step: ISequenceStep;
  index: number;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  /** Editing: with a grip, the step's own fields when expanded, duplicate and remove. */
  edit?: {
    expanded: boolean;
    count: number;
    drag: StepDrag;
    onToggle: () => void;
    onChange: (step: ISequenceStep) => void;
    onDuplicate: () => void;
    onRemove: () => void;
    onMoveBy: (step: -1 | 1) => void;
  };
}

/**
 * One step of a sequence: its number, the figure in its type's colour (or the free step's
 * text), the variant and the counts. In the editor it also has a grip to drag it by, and
 * expanded, the variant strip, the free step's text and counts, and the note.
 */
const SequenceStepRow: React.FC<SequenceStepRowProps> = ({
  step,
  index,
  patterns,
  patternTypes,
  modifiers,
  edit,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const pattern =
    step.kind === "figure"
      ? patterns.find((p) => p.id === step.patternId)
      : undefined;
  const type = pattern
    ? patternTypes.find((pt) => pt.id === pattern.typeId)
    : undefined;
  const variant =
    step.kind === "figure" ? stepVariant(step, pattern, modifiers) : undefined;
  const counts = stepCounts(step, patterns, modifiers);

  const title =
    step.kind === "free"
      ? step.text.trim() || t("sequenceFreeStep")
      : (pattern?.name ?? t("sequenceFigureMissing"));
  const details = [
    step.kind === "free" ? t("sequenceFreeStep") : variant?.name,
    counts !== undefined ? t("countsSection", { n: counts }) : undefined,
  ].filter((part): part is string => !!part);
  const subtitle = [details.join(" · "), edit?.expanded ? "" : step.note]
    .filter((line) => !!line)
    .join("\n");

  // Plain data for the worklet: no function is called inside it (React Compiler trap,
  // src/pattern/graph/AGENTS.md).
  const drag = edit?.drag;
  const active = drag?.active;
  const target = drag?.target;
  const offset = drag?.offset;
  const room = drag?.room;
  const moving = useAnimatedStyle(() => {
    if (!active || !target || !offset || !room) return {};
    const from = active.get();
    const to = target.get();
    if (from < 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    if (from === index) {
      return {
        transform: [{ translateY: offset.get() }, { scale: LIFT_SCALE }],
        zIndex: 1,
      };
    }
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -room.get();
    if (to < from && index >= to && index < from) shift = room.get();
    return {
      transform: [
        { translateY: withTiming(shift, { duration: MAKE_WAY_MS }) },
        { scale: 1 },
      ],
      zIndex: 0,
    };
  });

  const leading = (
    <View style={styles.leading}>
      <AppText variant="label" color="textMuted" style={styles.number}>
        {index + 1}
      </AppText>
      {step.kind === "figure" ? (
        <View style={styles.dot(type?.color ?? theme.colors.border)} />
      ) : (
        <Icon
          name="text-short"
          size={theme.iconSize.sm}
          color={theme.colors.textMuted}
        />
      )}
    </View>
  );

  if (!edit) {
    return (
      <View style={styles.row}>
        <ListRow
          title={title}
          leading={leading}
          subtitle={subtitle || undefined}
          subtitleLines={0}
        />
      </View>
    );
  }

  const set = (fields: Partial<ISequenceStep>) =>
    edit.onChange({ ...step, ...fields } as ISequenceStep);

  return (
    <Animated.View
      style={[styles.row, styles.editRow, moving]}
      onLayout={(e) =>
        edit.drag.onRowLayout(index, {
          y: e.nativeEvent.layout.y,
          height: e.nativeEvent.layout.height,
        })
      }
      testID={`sequence-step-${index}`}
    >
      <View style={styles.header}>
        <GestureDetector gesture={edit.drag.gripGesture(index)}>
          <View
            style={styles.grip}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t("sequenceStepGrip", {
              n: index + 1,
              name: title,
            })}
            accessibilityHint={t("sequenceStepGripHint")}
            accessibilityActions={[
              ...(index > 0
                ? [{ name: "moveUp", label: t("laneMoveUp") }]
                : []),
              ...(index < edit.count - 1
                ? [{ name: "moveDown", label: t("laneMoveDown") }]
                : []),
            ]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;
              if ((action === "moveUp" || action === "decrement") && index > 0)
                edit.onMoveBy(-1);
              if (
                (action === "moveDown" || action === "increment") &&
                index < edit.count - 1
              )
                edit.onMoveBy(1);
            }}
            testID={`sequence-step-grip-${index}`}
          >
            <Icon
              name="drag-vertical"
              size={theme.iconSize.md}
              color={theme.colors.textMuted}
            />
          </View>
        </GestureDetector>
        <ListRow
          title={title}
          leading={leading}
          subtitle={subtitle || undefined}
          subtitleLines={0}
          expanded={edit.expanded}
          onPress={edit.onToggle}
          // A shortcut only: the copy button does the same.
          onLongPress={edit.onDuplicate}
          accessibilityLabel={t("sequenceStepLabel", {
            n: index + 1,
            name: title,
          })}
          style={styles.rowBody}
          trailing={
            <View style={styles.actions}>
              <IconButton
                icon="content-copy"
                size={theme.iconSize.md}
                onPress={edit.onDuplicate}
                accessibilityLabel={t("sequenceDuplicateStep", {
                  n: index + 1,
                })}
              />
              <IconButton
                icon="close"
                size={theme.iconSize.md}
                color="danger"
                onPress={edit.onRemove}
                accessibilityLabel={t("sequenceRemoveStep", { n: index + 1 })}
              />
            </View>
          }
        />
      </View>

      {edit.expanded && (
        <View style={styles.body}>
          {step.kind === "figure" && pattern && (
            <ModifierPillStrip
              modifiers={modifiers}
              modifierRefs={pattern.modifierRefs ?? []}
              baseVideoCount={0}
              selectedModifierId={variant?.id ?? null}
              onSelect={(modifierId) => {
                const { modifierId: _old, ...rest } = step;
                edit.onChange(modifierId ? { ...rest, modifierId } : rest);
              }}
              hideHint
            />
          )}
          {step.kind === "free" && (
            <View style={styles.freeFields}>
              <RevealTextInput
                value={step.text}
                onChangeText={(text) => set({ text })}
                placeholder={t("sequenceFreeStepPlaceholder")}
                accessibilityLabel={t("sequenceFreeStepText")}
                maxLength={MAX_STEP_TEXT}
                autoFocus={!step.text}
                style={[styles.input, styles.freeText]}
                placeholderTextColor={theme.colors.textMuted}
              />
              <RevealTextInput
                value={step.counts !== undefined ? String(step.counts) : ""}
                onChangeText={(text) => {
                  const n = parseInt(text.replace(/\D/g, ""), 10);
                  if (n > 0) {
                    set({ counts: n });
                  } else {
                    const { counts: _gone, ...rest } = step;
                    edit.onChange(rest);
                  }
                }}
                placeholder={t("counts")}
                accessibilityLabel={t("counts")}
                keyboardType="numeric"
                maxLength={3}
                style={[styles.input, styles.freeCounts]}
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
          )}
          <RevealTextInput
            value={step.note ?? ""}
            onChangeText={(note) => set({ note })}
            placeholder={t("sequenceStepNotePlaceholder")}
            accessibilityLabel={t("sequenceStepNote")}
            maxLength={MAX_STEP_NOTE}
            multiline
            style={styles.input}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create((theme) => ({
  row: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.space.xs,
  },
  editRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  grip: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingHorizontal: theme.space.xs,
    minWidth: theme.touchTarget,
    alignItems: "center",
  },
  rowBody: {
    flex: 1,
    paddingLeft: 0,
  },
  leading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
  },
  number: {
    minWidth: theme.space.xl,
    textAlign: "right",
  },
  dot: (color: string) => ({
    width: theme.space.md,
    height: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
    gap: theme.space.xs,
  },
  freeFields: {
    flexDirection: "row",
    gap: theme.space.sm,
  },
  input: getCommonInput(theme),
  freeText: { flex: 1 },
  freeCounts: { width: 80 },
}));

export default SequenceStepRow;
