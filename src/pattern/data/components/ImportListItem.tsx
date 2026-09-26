import React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { useTranslation } from "react-i18next";
import { IPatternList } from "@/src/pattern/types/IPatternList";
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
}

export const ImportListItem: React.FC<ImportListItemProps> = ({
  list,
  existingList,
  currentAction,
  onActionChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
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
                color={theme.colors.textMuted}
              />
              <Text style={styles.readonlyBadgeText}>{t("readonlyBadge")}</Text>
            </View>
          )}
          {existingList && <ConflictBadge />}
        </View>
      </View>
      <Text style={styles.listMeta}>
        {list.patterns.length} {t("patterns")}
      </Text>
      <ImportActionButtons
        currentAction={currentAction}
        hasConflict={!!existingList}
        onActionChange={onActionChange}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  listItem: {
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.space.xs,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  readonlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    backgroundColor: alpha(theme.colors.textMuted, 0.13),
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xxs,
    borderRadius: theme.radius.xs,
  },
  readonlyBadgeText: {
    ...theme.typography.micro,
    color: theme.colors.textMuted,
  },
  listName: {
    ...theme.typography.button,
    color: theme.colors.text,
    flex: 1,
  },
  listMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.space.md,
  },
}));
