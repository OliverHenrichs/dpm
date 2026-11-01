import React, { useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button, Chip, IconButton } from "@/src/common/ui";
import { RevealTextInput } from "@/src/common/components/reveal";
import {
  applyLevelPreset,
  IPatternLevel,
  LevelPreset,
  levelNameErrors,
  MAX_LEVEL_NAME_LENGTH,
  MAX_LEVELS,
  newLevelId,
  nextLevelName,
} from "@/src/pattern/types/PatternLevel";
import {
  addTypeMove,
  countAfterMoves,
  LevelMoves,
  NO_LEVEL,
} from "@/src/pattern/list/typeMoves";
import MoveFiguresDialog from "@/src/pattern/list/MoveFiguresDialog";

/** The presets, in the order the chips show them. */
const PRESETS: { id: LevelPreset; labelKey: string }[] = [
  { id: "builtIn", labelKey: "levelPresetBuiltIn" },
  { id: "numbers", labelKey: "levelPresetNumbers" },
  { id: "ownNames", labelKey: "levelPresetOwnNames" },
];

interface LevelEditorProps {
  /** The draft levels, easiest first. */
  levels: IPatternLevel[];
  onChange: (levels: IPatternLevel[]) => void;
  /** How many figures are on each level, by id, before any moves. */
  usage: Record<string, number>;
  /** Where the figures of the levels removed so far go. */
  moves: LevelMoves;
  onChangeMoves: (moves: LevelMoves) => void;
}

/**
 * The list's levels in list settings, beside its types: rename, reorder (up and down), add up to
 * `MAX_LEVELS`, remove, or start again from a preset. A level in use asks where its figures go,
 * another level or none, as removing a type does; the list keeps at least one level.
 */
const LevelEditor: React.FC<LevelEditorProps> = ({
  levels,
  onChange,
  usage,
  moves,
  onChangeMoves,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // The level whose removal is being asked, and where its figures would go.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>(NO_LEVEL);

  const usageOf = (id: string) => countAfterMoves(id, usage, moves);
  const errors = levelNameErrors(levels);
  const displayName = (level: IPatternLevel) =>
    level.name.trim() || t("levelName");
  const removing = levels.find((level) => level.id === removingId);
  const isFull = levels.length >= MAX_LEVELS;
  const isOnly = levels.length <= 1;

  const rename = (id: string, name: string) =>
    onChange(
      levels.map((level) => (level.id === id ? { ...level, name } : level)),
    );

  const move = (index: number, by: -1 | 1) => {
    const next = [...levels];
    const [level] = next.splice(index, 1);
    next.splice(index + by, 0, level);
    onChange(next);
  };

  const add = () => {
    if (isFull) return;
    onChange([...levels, { id: newLevelId(), name: nextLevelName(levels) }]);
  };

  const remove = (id: string) =>
    onChange(levels.filter((level) => level.id !== id));

  /** A level in use asks where its figures go first. */
  const handleRemove = (id: string) => {
    if (isOnly) return;
    if (usageOf(id) === 0) {
      remove(id);
      return;
    }
    setTargetId(NO_LEVEL);
    setRemovingId(id);
  };

  const confirmRemove = () => {
    if (removingId) {
      onChangeMoves(addTypeMove(moves, removingId, targetId));
      remove(removingId);
    }
    setRemovingId(null);
  };

  return (
    <View>
      {/* The section header in list settings names it. */}
      <Text style={styles.hint}>{t("listLevelsHint")}</Text>

      <Text style={styles.presetLabel}>{t("levelPresetsLabel")}</Text>
      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            label={t(preset.labelKey)}
            onPress={() => onChange(applyLevelPreset(levels, preset.id, t))}
          />
        ))}
      </View>

      {levels.map((level, index) => {
        const used = usageOf(level.id);
        const name = displayName(level);
        return (
          <React.Fragment key={level.id}>
            <View style={styles.row}>
              <IconButton
                icon="chevron-up"
                size={theme.iconSize.md}
                color="textMuted"
                onPress={() => move(index, -1)}
                disabled={index === 0}
                accessibilityLabel={t("moveLevelUp", { level: name })}
              />
              <IconButton
                icon="chevron-down"
                size={theme.iconSize.md}
                color="textMuted"
                onPress={() => move(index, 1)}
                disabled={index === levels.length - 1}
                accessibilityLabel={t("moveLevelDown", { level: name })}
              />
              <RevealTextInput
                style={[styles.input, errors[level.id] && styles.inputError]}
                value={level.name}
                onChangeText={(value) => rename(level.id, value)}
                placeholder={t("levelName")}
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel={t("levelName")}
                maxLength={MAX_LEVEL_NAME_LENGTH}
              />
              <IconButton
                icon="close"
                size={theme.iconSize.md}
                color="textMuted"
                onPress={() => handleRemove(level.id)}
                disabled={isOnly}
                accessibilityLabel={`${t("removeLevel")}: ${name}`}
                accessibilityHint={
                  isOnly ? t("cannotRemoveOnlyLevel") : undefined
                }
              />
            </View>
            {(used > 0 || errors[level.id]) && (
              <Text style={errors[level.id] ? styles.error : styles.usage}>
                {errors[level.id] === "empty"
                  ? t("emptyTypeSlug")
                  : errors[level.id] === "duplicate"
                    ? `${name}: ${t("duplicateTypeSlug")}`
                    : used === 1
                      ? t("typeUsedByOne")
                      : t("typeUsedByMany", { count: used })}
              </Text>
            )}
          </React.Fragment>
        );
      })}

      <Button
        title={t("addLevel")}
        icon="plus"
        variant="outline"
        size="sm"
        onPress={add}
        disabled={isFull}
        style={styles.addButton}
      />
      {isFull && (
        <Text style={styles.usage}>
          {t("maxLevelsReached", { max: MAX_LEVELS })}
        </Text>
      )}

      <MoveFiguresDialog
        removing={removing ? displayName(removing) : undefined}
        count={removing ? usageOf(removing.id) : 0}
        targets={[
          ...levels
            .filter((level) => level.id !== removingId)
            .map((level) => ({ id: level.id, title: displayName(level) })),
          { id: NO_LEVEL, title: t("noLevel") },
        ]}
        selectedId={targetId}
        onSelect={setTargetId}
        onClose={() => setRemovingId(null)}
        onConfirm={confirmRemove}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  presetLabel: {
    ...theme.typography.caption,
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xs,
    marginBottom: theme.space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.space.sm,
    gap: theme.space.xs,
  },
  input: {
    ...theme.typography.bodySmall,
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  usage: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: -theme.space.xs,
    marginBottom: theme.space.sm,
  },
  error: {
    ...theme.typography.micro,
    color: theme.colors.danger,
    marginTop: -theme.space.xs,
    marginBottom: theme.space.sm,
  },
  addButton: {
    marginTop: theme.space.xs,
    alignSelf: "flex-start",
  },
}));

export default LevelEditor;
