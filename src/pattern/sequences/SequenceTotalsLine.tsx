import React from "react";
import { useTranslation } from "react-i18next";
import { AppText } from "@/src/common/ui";
import type { StyleProp, TextStyle } from "react-native";
import { SequenceTotals } from "@/src/pattern/sequences/sequences";

/** "12 steps · 96 counts · 12 × 8": a sequence's length, as its header and its row show it. */
export function useTotalsText(): (totals: SequenceTotals) => string {
  const { t } = useTranslation();
  return (totals) =>
    [
      totals.steps === 1
        ? t("sequenceStepsOne")
        : t("sequenceStepsMany", { count: totals.steps }),
      totals.counts > 0 ? t("countsSection", { n: totals.counts }) : undefined,
      totals.eights !== undefined
        ? t("sequenceEights", { count: totals.eights })
        : undefined,
    ]
      .filter((part): part is string => !!part)
      .join(" · ");
}

const SequenceTotalsLine: React.FC<{
  totals: SequenceTotals;
  style?: StyleProp<TextStyle>;
}> = ({ totals, style }) => {
  const text = useTotalsText();
  return (
    <AppText
      variant="caption"
      color="textMuted"
      style={style}
      accessibilityLiveRegion="polite"
    >
      {text(totals)}
    </AppText>
  );
};

export default SequenceTotalsLine;
