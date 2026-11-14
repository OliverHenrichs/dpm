import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Chip } from "@/src/common/ui";
import NameFilter from "@/src/pattern/filter/components/NameFilter";
import FilterSheetFrame from "@/src/pattern/filter/components/FilterSheetFrame";
import { filterStyles as styles } from "@/src/pattern/filter/FilterCommonStyles";
import {
  EMPTY_MODIFIER_FILTER,
  MODIFIER_POSITIONS,
  ModifierFilter,
  ModifierKind,
  modifierPositionKey,
} from "@/src/pattern/list/modifierView";

interface ModifierFilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilter: (filter: ModifierFilter) => void;
  currentFilter: ModifierFilter;
}

const KINDS: { kind: ModifierKind; key: string }[] = [
  { kind: "universal", key: "modifierKindUniversal" },
  { kind: "attached", key: "modifierKindAttached" },
];

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** Filters the Modifiers segment by name, position and whether a modifier is universal. */
const ModifierFilterBottomSheet: React.FC<ModifierFilterBottomSheetProps> = ({
  visible,
  onClose,
  onApplyFilter,
  currentFilter,
}) => {
  const { t } = useTranslation();

  return (
    <FilterSheetFrame
      visible={visible}
      title={t("filterModifiers")}
      currentFilter={currentFilter}
      emptyFilter={EMPTY_MODIFIER_FILTER}
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
            <Text style={styles.label}>{t("modifierPosition")}</Text>
            <View style={styles.chipContainer}>
              {MODIFIER_POSITIONS.map((position) => (
                <Chip
                  key={position}
                  label={t(modifierPositionKey(position))}
                  selected={filter.positions.includes(position)}
                  onPress={() =>
                    setFilter({
                      ...filter,
                      positions: toggle(filter.positions, position),
                    })
                  }
                />
              ))}
            </View>
          </View>
          <View style={styles.filterSection}>
            <Text style={styles.label}>{t("modifierKind")}</Text>
            <View style={styles.chipContainer}>
              {KINDS.map(({ kind, key }) => (
                <Chip
                  key={kind}
                  label={t(key)}
                  selected={filter.kinds.includes(kind)}
                  onPress={() =>
                    setFilter({ ...filter, kinds: toggle(filter.kinds, kind) })
                  }
                />
              ))}
            </View>
          </View>
        </>
      )}
    </FilterSheetFrame>
  );
};

export default ModifierFilterBottomSheet;
