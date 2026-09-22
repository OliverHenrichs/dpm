import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
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
  palette: Record<PaletteColor, string>;
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
  palette,
  showTopSeparator = true,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
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
        <VideoCarousel videoRefs={activeVideoRefs} palette={palette} />
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
  styles: ReturnType<typeof getStyles>,
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
  styles: ReturnType<typeof getStyles>,
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
function getTagView(
  selectedPattern: IPattern,
  t: any,
  styles: ReturnType<typeof getStyles>,
) {
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
  styles: ReturnType<typeof getStyles>,
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

const getStyles = (palette: Record<PaletteColor, string>) => {
  return StyleSheet.create({
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 8,
    },
    otherLabel: getCommon2ndOrderLabel(palette),
    label: getCommonLabel(palette),
    multiSelectContainer: {
      ...getCommonPrereqContainer(palette),
      marginTop: 0,
    },
    prereqItem: getCommonPrereqItem(palette),
    tagsRow: {
      ...getCommonRow(),
      flexWrap: "wrap",
    },
    tagItem: getCommonTagItem(palette),
    tagText: getCommonTagText(palette),
    detailsContainer: {
      borderTopWidth: 1,
      borderTopColor: palette[PaletteColor.Border],
      paddingTop: 8,
      marginTop: 6,
    },
    unseparated: {
      borderTopWidth: 0,
      paddingTop: 0,
      marginTop: 0,
    },
    patternName: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 4,
      color: palette[PaletteColor.PrimaryText],
    },
    patternDetailsDesc: {
      fontStyle: "italic",
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    patternDetailsRow: {
      ...getCommonRow(),
      marginBottom: 8,
    },
    patternDetailsCol: { flex: 1 },
    patternDetailsValue: {
      fontSize: 16,
      fontWeight: "bold",
      color: palette[PaletteColor.SecondaryText],
    },
  });
};

export default PatternDetails;
