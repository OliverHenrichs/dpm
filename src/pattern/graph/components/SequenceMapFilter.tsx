import React from "react";
import { Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { useTranslation } from "react-i18next";
import { filterStyles as styles } from "@/src/pattern/filter/FilterCommonStyles";
import { ISequence } from "@/src/pattern/types/IPatternList";

interface SequenceMapFilterProps {
  sequences: ISequence[];
  /** The sequence shown on the Map, or null for none. */
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

/**
 * _Show sequence_ in the Map's filter sheet: one chip per sequence of the list, and _None_.
 * Takes effect at once, like the chain mode above it: it isn't a filter criterion (nothing is
 * hidden), it lays the sequence over whatever the criteria leave. Absent on a list without
 * sequences.
 */
const SequenceMapFilter: React.FC<SequenceMapFilterProps> = ({
  sequences,
  selectedId,
  onChange,
}) => {
  const { t } = useTranslation();
  if (sequences.length === 0) return null;

  return (
    <View style={styles.filterSection} testID="sequence-map-filter">
      <Text style={styles.label}>{t("sequenceShowOnMap")}</Text>
      <View style={styles.chipContainer}>
        <Chip
          label={t("sequenceShowNone")}
          selected={selectedId === null}
          onPress={() => onChange(null)}
        />
        {sequences.map((sequence) => (
          <Chip
            key={sequence.id}
            label={sequence.name}
            selected={selectedId === sequence.id}
            onPress={() => onChange(sequence.id)}
          />
        ))}
      </View>
    </View>
  );
};

export default SequenceMapFilter;
