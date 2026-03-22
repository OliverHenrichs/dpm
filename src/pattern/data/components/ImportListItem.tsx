import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { ImportAction } from "@/src/pattern/data/hooks/useImportDecisions";
import { ConflictBadge } from "./ConflictBadge";
import { ImportActionButtons } from "./ImportActionButtons";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface ImportListItemProps {
  list: PatternListWithPatterns;
  existingList?: IPatternList;
  currentAction: ImportAction;
  onActionChange: (action: ImportAction) => void;
  palette: Record<PaletteColor, string>;
}

export const ImportListItem: React.FC<ImportListItemProps> = ({
  list,
  existingList,
  currentAction,
  onActionChange,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
  return (
    <View style={styles.listItem}>
      <View style={styles.listHeader}>
        <Text style={styles.listName}>{list.name}</Text>
        <View style={styles.badges}>
          {list.readonly && (
            <View style={styles.readonlyBadge}>
              <Icon
                name="lock-outline"
                size={11}
                color={palette[PaletteColor.SecondaryText]}
              />
              <Text style={styles.readonlyBadgeText}>{t("readonlyBadge")}</Text>
            </View>
          )}
          {existingList && <ConflictBadge palette={palette} />}
        </View>
      </View>
      <Text style={styles.listMeta}>
        {list.patterns.length} {t("patterns")}
      </Text>
      <ImportActionButtons
        currentAction={currentAction}
        hasConflict={!!existingList}
        onActionChange={onActionChange}
        palette={palette}
      />
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    listItem: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: palette[PaletteColor.CardBackground],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    badges: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    readonlyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: palette[PaletteColor.SecondaryText] + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    readonlyBadgeText: {
      fontSize: 11,
      color: palette[PaletteColor.SecondaryText],
      fontWeight: "600",
    },
    listName: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      flex: 1,
    },
    listMeta: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 12,
    },
  });
