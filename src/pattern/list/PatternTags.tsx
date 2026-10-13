import React, { useRef, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useReveal } from "@/src/common/components/RevealScrollView";
import { useTranslation } from "react-i18next";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  getCommonInput,
  getCommonPrereqContainer,
} from "@/src/common/utils/CommonStyles";
import { prependTag, tagOptions } from "./pickerOptions";

interface PatternTagsProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  /** The list's patterns, whose tags are offered. */
  allPatterns: IPattern[];
  /** The pattern being edited, whose saved tags do not count towards usage. */
  editingId?: number;
}

/**
 * The pattern editor's tags, picked like its prerequisites: the pattern's own tags first and
 * highlighted (a tap removes one), then the list's other tags, most used first (a tap adds one
 * at the front). Typing narrows them fuzzily and offers to create a tag no pattern has yet.
 */
const PatternTags: React.FC<PatternTagsProps> = ({
  tags,
  setTags,
  allPatterns,
  editingId,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [query, setQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  // The picker sits low in the form; keep it above the keyboard while searching.
  const containerRef = useRef<View>(null);
  const { reveal, release } = useReveal();

  const { options, creatable } = tagOptions(
    allPatterns,
    tags,
    query,
    editingId,
  );

  const add = (tag: string) => {
    setTags(prependTag(tags, tag));
    // The chip lands at the front, which may be scrolled out of view.
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  };

  const create = () => {
    if (!creatable) return;
    add(creatable);
    setQuery("");
  };

  return (
    <View ref={containerRef} style={styles.container}>
      <TextInput
        placeholder={t("searchOrAddTag")}
        value={query}
        onChangeText={setQuery}
        onFocus={() => reveal(containerRef)}
        onBlur={release}
        onSubmitEditing={create}
        submitBehavior="submit"
        returnKeyType="done"
        autoCapitalize="none"
        style={styles.filterInput}
        placeholderTextColor={theme.colors.textMuted}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {creatable ? (
          <Chip
            label={t("createTag", { tag: creatable })}
            icon="plus"
            onPress={create}
          />
        ) : null}
        {tags.map((tag) => (
          <Chip
            key={`chosen:${tag}`}
            label={tag}
            selected
            onPress={() => setTags(tags.filter((other) => other !== tag))}
          />
        ))}
        {options.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            icon="tag-outline"
            onPress={() => add(tag)}
          />
        ))}
      </ScrollView>
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
}));

export default PatternTags;
