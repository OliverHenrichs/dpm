import React from "react";
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
} from "@/src/common/utils/CommonStyles";
import VideoCarousel from "@/src/common/components/VideoCarousel";

type ModifierDetailsProps = {
  modifier: IModifier;
  patterns: IPattern[];
  patternTypes?: PatternType[];
};

const ModifierDetails: React.FC<ModifierDetailsProps> = ({
  modifier,
  patterns,
}) => {
  const { t } = useTranslation();

  // Patterns that have this modifier in their modifierRefs (non-universal only)
  const appliedPatterns = modifier.universal
    ? []
    : patterns.filter((p) =>
        (p.modifierRefs ?? []).some((ref) => ref.modifierId === modifier.id),
      );

  return (
    <View style={styles.container}>
      {/* Videos — only for universal modifiers */}
      {modifier.universal && (modifier.videoRefs ?? []).length > 0 && (
        <VideoCarousel videoRefs={modifier.videoRefs} />
      )}

      {/* Connected patterns — only for non-universal modifiers */}
      {!modifier.universal && (
        <View style={styles.section}>
          <Text style={styles.label}>{t("appliedToPatterns")}:</Text>
          {appliedPatterns.length === 0 ? (
            <Text style={styles.emptyText}>{t("notAppliedToAnyPattern")}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {appliedPatterns.map((p) => (
                <View key={p.id} style={styles.patternPill}>
                  <Text style={styles.patternPillText}>{p.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space.sm,
    marginTop: theme.space.sm,
  },
  section: {
    ...getCommonPrereqContainer(theme),
    marginTop: theme.space.none,
  },
  label: getCommonLabel(theme),
  emptyText: {
    ...getCommon2ndOrderLabel(theme),
    fontStyle: "italic",
  },
  patternPill: getCommonPrereqItem(theme),
  patternPillText: getCommon2ndOrderLabel(theme),
}));

export default ModifierDetails;
