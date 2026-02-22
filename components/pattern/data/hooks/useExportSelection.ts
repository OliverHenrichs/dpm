import { useMemo, useState } from "react";
import { PatternList } from "@/components/pattern/types/PatternList";
import { PatternListWithPatterns } from "@/components/pattern/data/types/IExportData";

interface UseExportSelectionProps {
  patternLists: PatternListWithPatterns[];
}

export const useExportSelection = ({
  patternLists,
}: UseExportSelectionProps) => {
  // Initialize with all lists selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(patternLists.map((l) => l.id)),
  );
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === patternLists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patternLists.map((l) => l.id)));
    }
  };
  const getSelectedLists = (): PatternList[] => {
    return patternLists.filter((l) => selectedIds.has(l.id));
  };
  const stats = useMemo(() => {
    const selectedLists = patternLists.filter((l) => selectedIds.has(l.id));
    const totalSelectedPatterns = selectedLists.reduce(
      (sum, list) => sum + list.patterns.length,
      0,
    );
    return {
      selectedCount: selectedIds.size,
      totalCount: patternLists.length,
      allSelected: selectedIds.size === patternLists.length,
      noneSelected: selectedIds.size === 0,
      totalSelectedPatterns,
    };
  }, [selectedIds, patternLists]);
  return {
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    getSelectedLists,
    stats,
  };
};
