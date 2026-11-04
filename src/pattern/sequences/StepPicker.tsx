import React, { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { RevealTextInput } from "@/src/common/components/reveal";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import { AppText, Icon, ListRow } from "@/src/common/ui";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { stepPickerGroups } from "@/src/pattern/sequences/sequences";

interface StepPickerProps {
  visible: boolean;
  patterns: IPattern[];
  patternTypes: PatternType[];
  /**
   * Figures that followed the last step in the list's other sequences (`nextStepHints`),
   * offered first under _Often next_ while nothing is searched.
   */
  hints?: IPattern[];
  onPickFigure: (pattern: IPattern) => void;
  onPickFree: () => void;
  onClose: () => void;
}

/**
 * _Add step_: a free step first, then the list's figures grouped by type in its colour,
 * narrowed fuzzily by name as in the prerequisites picker. Picking one adds it at the end.
 * While nothing is searched, the figures that followed the last step in the list's other
 * sequences come first, under _Often next_; they stay in their type's group too.
 */
const StepPicker: React.FC<StepPickerProps> = ({
  visible,
  patterns,
  patternTypes,
  hints = [],
  onPickFigure,
  onPickFree,
  onClose,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [query, setQuery] = useState("");
  const searchRef = useRef<View>(null);
  const groups = stepPickerGroups(patterns, patternTypes, query);
  const shownHints = query.trim() ? [] : hints;
  const typeOf = (pattern: IPattern) =>
    patternTypes.find((type) => type.id === pattern.typeId);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={t("sequenceAddStep")}
      minHeight="60%"
      maxHeight="85%"
    >
      <View ref={searchRef}>
        <RevealTextInput
          placeholder={t("searchByName")}
          value={query}
          onChangeText={setQuery}
          revealRef={searchRef}
          accessibilityLabel={t("searchByName")}
          style={styles.search}
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <ListRow
          title={t("sequenceFreeStep")}
          subtitle={t("sequenceFreeStepHint")}
          icon="text-short"
          onPress={() => {
            setQuery("");
            onPickFree();
          }}
        />
        {shownHints.length > 0 && (
          <View testID="step-picker-hints">
            <View style={styles.groupHeader}>
              <Icon
                name="arrow-right-bottom"
                size={theme.iconSize.sm}
                color={theme.colors.textMuted}
              />
              <AppText variant="label" color="textMuted">
                {t("sequenceOftenNext")}
              </AppText>
            </View>
            {shownHints.map((pattern) => (
              <ListRow
                key={pattern.id}
                title={pattern.name}
                leading={
                  <View
                    style={styles.dot(
                      typeOf(pattern)?.color ?? theme.colors.border,
                    )}
                  />
                }
                meta={t("countsSection", { n: pattern.counts })}
                onPress={() => {
                  setQuery("");
                  onPickFigure(pattern);
                }}
              />
            ))}
          </View>
        )}
        {groups.map((group) => (
          <View key={group.type?.id ?? "other"}>
            <View style={styles.groupHeader}>
              <View
                style={styles.dot(group.type?.color ?? theme.colors.border)}
              />
              <AppText variant="label" color="textMuted">
                {group.type?.slug ?? t("sequenceOtherFigures")}
              </AppText>
            </View>
            {group.patterns.map((pattern) => (
              <ListRow
                key={pattern.id}
                title={pattern.name}
                meta={t("countsSection", { n: pattern.counts })}
                onPress={() => {
                  setQuery("");
                  onPickFigure(pattern);
                }}
              />
            ))}
          </View>
        ))}
        {patterns.length > 0 && groups.length === 0 && (
          <AppText color="textMuted" style={styles.empty}>
            {t("sequenceNoFigureMatches")}
          </AppText>
        )}
        {patterns.length === 0 && (
          <AppText color="textMuted" style={styles.empty}>
            {t("sequenceNoFigures")}
          </AppText>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  search: {
    ...getCommonInput(theme),
    marginBottom: theme.space.sm,
  },
  scroll: { flexShrink: 1 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xxs,
  },
  dot: (color: string) => ({
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  empty: {
    textAlign: "center",
    paddingVertical: theme.space.lg,
  },
}));

export default StepPicker;
