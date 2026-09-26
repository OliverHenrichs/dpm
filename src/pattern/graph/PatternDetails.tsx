import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { useTranslation } from "react-i18next";
import {
  getCommon2ndOrderLabel,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonPrereqItem,
  getCommonRow,
  getCommonTagItem,
  getCommonTagText,
} from "@/src/common/utils/CommonStyles";
import VideoCarousel from "@/src/common/components/VideoCarousel";
import ModifierPillStrip from "@/src/pattern/list/ModifierPillStrip";

type PatternDetailsProps = {
  selectedPattern: IPattern;
  patterns: IPattern[];
  patternTypes?: PatternType[]; // Optional for type name lookup
  modifiers?: IModifier[];
  /**
   * Rule above the content, separating it from whatever sits on top.
   *
   * Earns its keep in `PatternListItem`, where the details expand directly
   * under the row. In the details modal the header already has a rule, and
   * two stacked separators is one too many — so that passes `false`.
   */
  showTopSeparator?: boolean;
};

const PatternDetails: React.FC<PatternDetailsProps> = ({
  selectedPattern,
  patterns,
  patternTypes,
  modifiers = [],
  showTopSeparator = true,
}) => {
  const { t } = useTranslation();
  const [selectedModifierId, setSelectedModifierId] = useState<string | null>(
    null,
  );

  // Get type display name
  const getTypeName = () => {
    // Look up type name from patternTypes
    const type = patternTypes?.find((pt) => pt.id === selectedPattern.typeId);
    return type ? type.slug : selectedPattern.typeId;
  };

  // Resolve which videoRefs to show based on the selected pill
  const activeVideoRefs = (() => {
    if (selectedModifierId === null) {
      return selectedPattern.videoRefs ?? [];
    }
    const mod = modifiers.find((m) => m.id === selectedModifierId);
    if (!mod) return [];
    if (mod.universal) return mod.videoRefs ?? [];
    const ref = (selectedPattern.modifierRefs ?? []).find(
      (r) => r.modifierId === selectedModifierId,
    );
    return ref?.videoRefs ?? [];
  })();

  return (
    <View
      style={[styles.detailsContainer, !showTopSeparator && styles.unseparated]}
    >
      {!!selectedPattern.description && (
        <Text style={styles.patternDetailsDesc}>
          {selectedPattern.description}
        </Text>
      )}
      {/* Modifier pill strip + contextual video carousel */}
      <ModifierPillStrip
        modifiers={modifiers}
        modifierRefs={selectedPattern.modifierRefs ?? []}
        selectedModifierId={selectedModifierId}
        onSelect={setSelectedModifierId}
        isEditMode={false}
      />
      {activeVideoRefs.length > 0 && (
        <VideoCarousel
          videoRefs={activeVideoRefs}
          generatedLabel={t("videoBadgeSilhouette")}
        />
      )}
      <View style={styles.patternDetailsRow}>
        <View style={styles.patternDetailsCol}>
          <Text style={styles.label}>{t("counts")}:</Text>
          <Text style={styles.patternDetailsValue}>
            {selectedPattern.counts}
          </Text>
        </View>
        <View style={styles.patternDetailsCol}>
          <Text style={styles.label}>{t("type")}:</Text>
          <Text style={styles.patternDetailsValue}>{getTypeName()}</Text>
        </View>
        <View style={styles.patternDetailsCol}>
          <Text style={styles.label}>{t("level")}:</Text>
          <Text style={styles.patternDetailsValue}>
            {selectedPattern.level}
          </Text>
        </View>
      </View>
      {getPrerequisiteView(selectedPattern, patterns, t, styles)}
      {getBuildsIntoView(selectedPattern, patterns, t, styles)}
      {getTagView(selectedPattern, t, styles)}
    </View>
  );
};

function getPrerequisiteView(
  selectedPattern: IPattern,
  patterns: IPattern[],
  t: any,
  styles: Styles,
) {
  return (
    <View style={styles.multiSelectContainer}>
      <Text style={styles.label}>{t("prerequisites")}:</Text>
      {selectedPattern.prerequisites.length === 0 ? (
        <Text style={styles.patternDetailsDesc}>
          {t("patternDetailsNoPrerequisites")}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {getPrerequisites(selectedPattern, patterns, styles)}
        </ScrollView>
      )}
    </View>
  );
}

function getPrerequisites(
  selectedPattern: IPattern,
  patterns: IPattern[],
  styles: Styles,
) {
  return (
    <>
      {selectedPattern.prerequisites.map((preRequisiteId: number) => {
        const prerequisite = patterns.find((p) => p.id === preRequisiteId);
        return prerequisite ? (
          <View key={preRequisiteId} style={styles.prereqItem}>
            <Text style={styles.otherLabel}>{prerequisite.name}</Text>
          </View>
        ) : null;
      })}
    </>
  );
}

/**
 * Tags, or nothing at all when there are none.
 *
 * Unlike prerequisites and "builds into" — which say so explicitly, because
 * "nothing comes before this" answers a question someone opened a *graph*
 * detail view to ask — an absent tag list carries no information. A bare
 * "Tags:" with a blank after it is just height.
 */
function getTagView(selectedPattern: IPattern, t: any, styles: Styles) {
  if (selectedPattern.tags.length === 0) return null;

  return (
    <View style={styles.tagsRow}>
      <Text style={styles.label}>{t("tags")}: </Text>
      <View style={styles.tagsRow}>
        {selectedPattern.tags.map((tag, idx) => (
          <View key={idx} style={styles.tagItem}>
            <Text key={idx} style={styles.tagText}>
              {tag}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function getBuildsIntoView(
  selectedPattern: IPattern,
  patterns: IPattern[],
  t: any,
  styles: Styles,
) {
  const dependents = patterns.filter((pattern) =>
    pattern.prerequisites.includes(selectedPattern.id),
  );
  if (dependents.length === 0) {
    return (
      <View style={styles.multiSelectContainer}>
        <Text style={styles.label}>{t("buildsInto")}:</Text>
        <Text style={styles.patternDetailsDesc}>
          {t("noDependentPatterns")}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.multiSelectContainer}>
      <Text style={styles.label}>{t("buildsInto")}:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {dependents.map((dep) => (
          <View key={dep.id} style={styles.prereqItem}>
            <Text style={styles.otherLabel}>{dep.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => {
  return {
    sectionTitle: {
      ...theme.typography.title,
      color: theme.colors.text,
      marginBottom: theme.space.sm,
    },
    otherLabel: getCommon2ndOrderLabel(theme),
    label: getCommonLabel(theme),
    multiSelectContainer: {
      ...getCommonPrereqContainer(theme),
      marginTop: theme.space.none,
    },
    prereqItem: getCommonPrereqItem(theme),
    tagsRow: {
      ...getCommonRow(),
      flexWrap: "wrap",
    },
    tagItem: getCommonTagItem(theme),
    tagText: getCommonTagText(theme),
    detailsContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: theme.space.sm,
      marginTop: theme.space.sm,
    },
    unseparated: {
      borderTopWidth: 0,
      paddingTop: theme.space.none,
      marginTop: theme.space.none,
    },
    patternName: {
      ...theme.typography.headline,
      marginBottom: theme.space.xs,
      color: theme.colors.text,
    },
    patternDetailsDesc: {
      fontStyle: "italic",
      color: theme.colors.textMuted,
      marginBottom: theme.space.sm,
    },
    patternDetailsRow: {
      ...getCommonRow(),
      marginBottom: theme.space.sm,
    },
    patternDetailsCol: { flex: 1 },
    patternDetailsValue: {
      ...theme.typography.button,
      fontWeight: "bold",
      color: theme.colors.textMuted,
    },
  };
});

export default PatternDetails;

type Styles = typeof styles;
