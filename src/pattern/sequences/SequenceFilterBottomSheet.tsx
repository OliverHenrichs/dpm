import React from "react";
import { Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Chip } from "@/src/common/ui";
import { RevealTextInput } from "@/src/common/components/reveal";
import NameFilter from "@/src/pattern/filter/components/NameFilter";
import FilterSheetFrame from "@/src/pattern/filter/components/FilterSheetFrame";
import { filterStyles as styles } from "@/src/pattern/filter/FilterCommonStyles";
import {
  EMPTY_SEQUENCE_FILTER,
  SequenceFilter,
} from "@/src/pattern/sequences/sequenceView";

interface SequenceFilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilter: (filter: SequenceFilter) => void;
  currentFilter: SequenceFilter;
}

/** Filters the Sequences segment by name, by a figure in it, and by having a video. */
const SequenceFilterBottomSheet: React.FC<SequenceFilterBottomSheetProps> = ({
  visible,
  onClose,
  onApplyFilter,
  currentFilter,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  return (
    <FilterSheetFrame
      visible={visible}
      title={t("filterSequences")}
      currentFilter={currentFilter}
      emptyFilter={EMPTY_SEQUENCE_FILTER}
      onApplyFilter={onApplyFilter}
      onClose={onClose}
    >
      {(filter, setFilter) => (
        <>
          <NameFilter
            value={filter.name}
            onChange={(name) => setFilter({ ...filter, name })}
          />
          <View style={styles.filterSection}>
            <Text style={styles.label}>{t("sequenceFilterFigure")}</Text>
            <RevealTextInput
              placeholder={t("sequenceFilterFigureHint")}
              value={filter.figure}
              onChangeText={(figure) => setFilter({ ...filter, figure })}
              style={styles.input}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.filterSection}>
            <View style={styles.chipContainer}>
              <Chip
                label={t("sequenceHasVideo")}
                icon="play-circle-outline"
                toggle
                selected={filter.withVideo}
                onPress={() =>
                  setFilter({ ...filter, withVideo: !filter.withVideo })
                }
              />
            </View>
          </View>
        </>
      )}
    </FilterSheetFrame>
  );
};

export default SequenceFilterBottomSheet;
