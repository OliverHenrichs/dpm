import React from "react";
import { useTranslation } from "react-i18next";
import { ListRow } from "@/src/common/ui";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

interface ExportListItemProps {
  list: PatternListWithPatterns;
  isSelected: boolean;
  onToggle: () => void;
}

/** One list in the export picker: a checkbox row with its pattern count. */
export const ExportListItem: React.FC<ExportListItemProps> = ({
  list,
  isSelected,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <ListRow
      variant="card"
      title={list.name}
      subtitle={`${list.patterns.length} ${t("patterns")}`}
      selection="multiple"
      selected={isSelected}
      onPress={onToggle}
    />
  );
};
