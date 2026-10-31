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
import { Icon } from "@/src/common/ui/Icon";
import { RevealTextInput } from "@/src/common/components/reveal";
import { getCommonInput } from "@/src/common/utils/CommonStyles";

interface ImportListItemProps {
  list: PatternListWithPatterns;
  existingList?: IPatternList;
  currentAction: ImportAction;
  onActionChange: (action: ImportAction) => void;
  /** Shown for a copy, and for a new list whose name another list already has. */
  showName?: boolean;
  name?: string;
  onNameChange?: (name: string) => void;
}

export const ImportListItem: React.FC<ImportListItemProps> = ({
  list,
  existingList,
  currentAction,
  onActionChange,
  showName = false,
  name = "",
  onNameChange,
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
      {showName && (
        <View style={styles.nameBlock}>
          <Text style={styles.nameLabel}>
            {currentAction === "copy"
              ? t("importCopyName")
              : t("importNameClash")}
          </Text>
          <RevealTextInput
            value={name}
            onChangeText={onNameChange}
            accessibilityLabel={
              currentAction === "copy"
                ? t("importCopyName")
                : t("importNameClash")
            }
            placeholder={list.name}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.nameInput}
          />
        </View>
      )}
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
  nameBlock: {
    marginTop: theme.space.md,
    gap: theme.space.xs,
  },
  nameLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  nameInput: {
    ...getCommonInput(theme),
    ...theme.typography.body,
  },
  listMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.space.md,
  },
}));
