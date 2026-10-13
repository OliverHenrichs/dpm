import React, { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  getCommonInput,
  getCommonPrereqContainer,
} from "@/src/common/utils/CommonStyles";
import { prerequisiteOptions } from "./pickerOptions";

interface PatternPrerequisitesProps {
  /** The list's patterns. */
  patterns: IPattern[];
  /** The ids of the chosen prerequisites, most recently chosen first. */
  chosen: number[];
  setChosen: (ids: number[]) => void;
  /** Patterns that would close a prerequisite loop: shown greyed out, last. */
  ineligible: ReadonlySet<number>;
  /** The pattern being edited, whose saved prerequisites do not count towards usage. */
  editingId?: number;
}

/**
 * The pattern editor's prerequisites: the chosen ones first and highlighted (a tap removes
 * one), then the rest, most often a prerequisite elsewhere first (a tap adds one at the front).
 * Typing narrows them fuzzily by name.
 */
const PatternPrerequisites: React.FC<PatternPrerequisitesProps> = ({
  patterns,
  chosen,
  setChosen,
  ineligible,
  editingId,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [query, setQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const chosenPatterns = chosen
    .map((id) => patterns.find((p) => p.id === id))
    .filter((p): p is IPattern => !!p);
  const options = prerequisiteOptions(
    patterns,
    chosen,
    query,
    ineligible,
    editingId,
  );

  const add = (id: number) => {
    setChosen([id, ...chosen]);
    // The chip lands at the front, which may be scrolled out of view.
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder={t("searchByName")}
        value={query}
        onChangeText={setQuery}
        style={styles.filterInput}
        placeholderTextColor={theme.colors.textMuted}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {chosenPatterns.map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            selected
            onPress={() => setChosen(chosen.filter((id) => id !== p.id))}
          />
        ))}
        {options.map((p) => {
          // Picking something that already depends on this pattern — or the pattern itself —
          // would close a prerequisite cycle, and a cycle has no valid learning order.
          const wouldCycle = ineligible.has(p.id);
          return (
            <Chip
              key={p.id}
              label={p.name}
              disabled={wouldCycle}
              accessibilityHint={
                wouldCycle ? t("prerequisiteWouldCycle") : undefined
              }
              onPress={() => add(p.id)}
            />
          );
        })}
      </ScrollView>
      {ineligible.size > 0 && (
        <Text style={styles.hint}>{t("prerequisiteWouldCycle")}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: getCommonPrereqContainer(theme),
  filterInput: {
    ...getCommonInput(theme),
    height: 40,
    marginBottom: theme.space.sm,
  },
  chips: { gap: theme.space.xs },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    marginTop: theme.space.sm,
  },
}));

export default PatternPrerequisites;
